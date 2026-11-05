import {
  ApiError,
  email,
  phone,
  text,
  validPassword,
  requireRole,
} from "./errors.js";
import {
  hashPassword,
  verifyPassword,
  token,
  tokenHash,
  validToken,
} from "./crypto.js";
import { rows, transaction } from "./database.js";
const accessError = () =>
  new ApiError(
    401,
    "No fue posible iniciar sesión. Revisa tus datos o inténtalo más tarde.",
  );
const account = (row) => ({
  id: String(row.id),
  name: row.name,
  email: row.email,
  role: row.role,
});
export class AuthService {
  constructor(pool, mail) {
    this.pool = pool;
    this.mail = mail;
    this.dummy = hashPassword(token());
  }
  async create(body, role = 3, existing) {
    const name = text(body.name, 120),
      address = email(body.email),
      number = phone(body.phone);
    if (
      !name ||
      !address ||
      !validPassword(body.password) ||
      (role === 3 && !number)
    )
      throw new ApiError(
        400,
        "Indica nombre, correo y teléfono válidos y contraseña de 12 a 128 caracteres.",
      );
    const hash = await hashPassword(body.password);
    const action = async (db) => {
      const result = await rows(
        db,
        "INSERT INTO users(role_id,name,email,password_hash) VALUES(?,?,?,?)",
        [role, name, address, hash],
      );
      const userId = String(result.insertId);
      if (role === 3)
        await rows(
          db,
          "INSERT INTO customers(user_id,name,phone,email) VALUES(?,?,?,?)",
          [userId, name, number, address],
        );
      return {
        id: userId,
        name,
        email: address,
        role:
          role === 1 ? "Administrador" : role === 2 ? "Operador" : "Cliente",
      };
    };
    return existing ? action(existing) : transaction(this.pool, action);
  }
  async login(body) {
    const address = email(body.email);
    if (
      !address ||
      typeof body.password !== "string" ||
      !body.password.length ||
      body.password.length > 128
    )
      throw accessError();
    const result = await transaction(this.pool, async (db) => {
      const [user] = await rows(
        db,
        `SELECT u.*,r.name AS role,CASE WHEN locked_until>UTC_TIMESTAMP(6) THEN 1 ELSE 0 END AS locked
        FROM users u JOIN roles r ON r.id=u.role_id WHERE email=? FOR UPDATE`,
        [address],
      );
      const verified = await verifyPassword(
        user?.password_hash ?? (await this.dummy),
        body.password,
      );
      if (!user || Number(user.active) !== 1 || Number(user.locked) === 1)
        return null;
      if (!verified) {
        await rows(
          db,
          `UPDATE users SET locked_until=CASE WHEN failed_login_attempts+1>=5 THEN DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE) ELSE NULL END,failed_login_attempts=failed_login_attempts+1 WHERE id=?`,
          [user.id],
        );
        return null;
      }
      const hash = user.password_hash.startsWith("scrypt$")
        ? user.password_hash
        : await hashPassword(body.password);
      await rows(
        db,
        "UPDATE users SET failed_login_attempts=0,locked_until=NULL,password_hash=? WHERE id=?",
        [hash, user.id],
      );
      const accessToken = token(),
        expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
      await rows(
        db,
        "INSERT INTO auth_sessions(user_id,token_hash,expires_at) VALUES(?,?,?)",
        [user.id, tokenHash(accessToken), expiresAt],
      );
      return {
        accessToken,
        expiresAt: expiresAt.toISOString(),
        user: account(user),
      };
    });
    if (!result) throw accessError();
    return result;
  }
  async authenticate(header) {
    if (
      typeof header !== "string" ||
      !/^Bearer /i.test(header) ||
      !validToken(header.slice(7))
    )
      throw accessError();
    const hash = tokenHash(header.slice(7));
    const [user] = await rows(
      this.pool,
      `SELECT u.id,u.name,u.email,r.name AS role FROM auth_sessions s
      JOIN users u ON s.user_id=u.id JOIN roles r ON r.id=u.role_id
      WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP(6) AND u.active=1`,
      [hash],
    );
    if (!user) throw accessError();
    return { ...account(user), sessionHash: hash };
  }
  async logout(user, all = false) {
    requireRole(user);
    await rows(
      this.pool,
      all
        ? "UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE user_id=? AND revoked_at IS NULL"
        : "UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE token_hash=?",
      [all ? user.id : user.sessionHash],
    );
  }
  async revoke(db, userId) {
    await rows(
      db,
      "UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(6) WHERE user_id=? AND revoked_at IS NULL",
      [userId],
    );
    await rows(
      db,
      "UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(6) WHERE user_id=? AND used_at IS NULL",
      [userId],
    );
  }
  async changePassword(user, body) {
    if (
      !validPassword(body.newPassword) ||
      typeof body.currentPassword !== "string" ||
      body.currentPassword.length > 128 ||
      body.currentPassword === body.newPassword
    )
      throw new ApiError(
        400,
        "Comprueba tu contraseña actual y utiliza una nueva distinta de 12 a 128 caracteres.",
      );
    await transaction(this.pool, async (db) => {
      const [row] = await rows(
        db,
        "SELECT password_hash FROM users WHERE id=? AND active=1 FOR UPDATE",
        [user.id],
      );
      if (
        !row ||
        !(await verifyPassword(row.password_hash, body.currentPassword))
      )
        throw new ApiError(400, "Comprueba tu contraseña actual.");
      await rows(
        db,
        "UPDATE users SET password_hash=?,failed_login_attempts=0,locked_until=NULL WHERE id=?",
        [await hashPassword(body.newPassword), user.id],
      );
      await this.revoke(db, user.id);
    });
  }
  async requestReset(body) {
    const address = email(body.email);
    if (!address) throw new ApiError(400, "Indica un correo válido.");
    if (!this.mail)
      throw new ApiError(
        503,
        "La recuperación por correo todavía no está habilitada.",
      );
    const code = token(),
      hash = tokenHash(code);
    const issued = await transaction(this.pool, async (db) => {
      const [user] = await rows(
        db,
        "SELECT id FROM users WHERE email=? AND active=1 FOR UPDATE",
        [address],
      );
      if (!user) return false;
      const [recent] = await rows(
        db,
        "SELECT id FROM password_reset_tokens WHERE user_id=? AND expires_at>DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 14 MINUTE) LIMIT 1",
        [user.id],
      );
      if (recent) return false;
      await rows(
        db,
        "INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE))",
        [user.id, hash],
      );
      return true;
    });
    if (issued) {
      try {
        await this.mail(address, code);
      } catch {
        await rows(
          this.pool,
          "UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(6) WHERE token_hash=?",
          [hash],
        );
      }
    }
    return {
      message:
        "Si la cuenta existe y el servicio está disponible, recibirás instrucciones por correo.",
    };
  }
  async reset(body) {
    if (!validToken(body.token) || !validPassword(body.password))
      throw new ApiError(400, "Código o contraseña inválidos.");
    const hash = tokenHash(body.token);
    const [item] = await rows(
      this.pool,
      "SELECT user_id FROM password_reset_tokens WHERE token_hash=?",
      [hash],
    );
    if (!item) throw new ApiError(400, "Código inválido o caducado.");
    await transaction(this.pool, async (db) => {
      const [user] = await rows(
        db,
        "SELECT id FROM users WHERE id=? AND active=1 FOR UPDATE",
        [item.user_id],
      );
      if (!user) throw new ApiError(400, "Código inválido o caducado.");
      const consumed = await rows(
        db,
        "UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(6) WHERE token_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP(6)",
        [hash],
      );
      if (consumed.affectedRows !== 1)
        throw new ApiError(400, "Código inválido o caducado.");
      await rows(
        db,
        "UPDATE users SET password_hash=?,failed_login_attempts=0,locked_until=NULL WHERE id=?",
        [await hashPassword(body.password), user.id],
      );
      await this.revoke(db, user.id);
    });
    return { message: "Contraseña actualizada. Inicia sesión nuevamente." };
  }
}
