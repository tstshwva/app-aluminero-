import express from "express";
import { randomUUID } from "node:crypto";
import {
  ApiError,
  fields,
  text,
  phone,
  id,
  isStaff,
  requireRole,
} from "./errors.js";
import { equalText } from "./crypto.js";
import { rows } from "./database.js";
import { AuthService } from "./auth.js";
import { businessRoutes } from "./business.js";
import { createRateLimit } from "./rate-limit.js";
export function createApp({
  pool,
  mail = null,
  setupKey = "",
  setupName = "",
  assistant = null,
  pushEnabled = false,
}) {
  const app = express(),
    auth = new AuthService(pool, mail);
  const ipLimit = createRateLimit({ limit: 300 }),
    authLimit = createRateLimit({ limit: 20 }),
    readLimit = createRateLimit({ limit: 300 }),
    writeLimit = createRateLimit({ limit: 120 });
  const authPaths = new Set([
    "register",
    "login",
    "me",
    "logout",
    "logout-all",
    "change-password",
    "forgot-password",
    "reset-password",
    "staff",
    "setup-admin",
  ]);
  const allow = (res, result) => {
    if (result.allowed) return true;
    res.set("Retry-After", String(result.retryAfter));
    res
      .status(429)
      .json({ error: "Demasiadas solicitudes. Espera un minuto." });
    return false;
  };
  let expensive = 0;
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Strict-Transport-Security": "max-age=31536000",
    });
    if (!req.secure)
      return res.status(400).json({ error: "Se requiere HTTPS." });
    next();
  });
  app.use((req, res, next) => {
    if (allow(res, ipLimit(req.ip))) next();
  });
  app.use("/api/auth", (req, res, next) => {
    const path = req.path.toLowerCase().replace(/^\/+|\/+$/g, "");
    const action = authPaths.has(path) ? path : "other";
    if (allow(res, authLimit(`${req.ip}|${action}`))) next();
  });
  app.use(express.json({ limit: "16kb", strict: true }));
  const run = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res)).catch(next);
  const protectedBy = (roles) => async (req, res, next) => {
    try {
      req.user = await auth.authenticate(req.headers.authorization);
      requireRole(req.user, roles);
      const limit = ["GET", "HEAD"].includes(req.method)
        ? readLimit
        : writeLimit;
      if (!allow(res, limit(req.user.id))) return;
      next();
    } catch (error) {
      next(error);
    }
  };
  const cryptoLimit = async (req, res, next) => {
    if (expensive >= 4)
      return res
        .status(429)
        .json({ error: "El servicio está ocupado. Inténtalo de nuevo." });
    expensive++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        expensive--;
      }
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
  app.get("/health/live", (req, res) =>
    res.json({ status: "running", service: "aluformix", schemaVersion: 4 }),
  );
  app.get(
    "/health/db",
    protectedBy(["Administrador"]),
    run(async (req, res) => {
      const [version] = await rows(
        pool,
        "SELECT MAX(version) AS version FROM schema_versions",
      );
      if (Number(version.version) !== 4)
        throw new ApiError(503, "Versión de esquema incompatible.");
      res.json({ status: "connected", schemaVersion: 4 });
    }),
  );
  app.post(
    "/api/auth/register",
    cryptoLimit,
    run(async (req, res) => {
      fields(req.body, ["name", "email", "phone", "password"]);
      res
        .status(201)
        .location("/api/auth/me")
        .json(await auth.create(req.body));
    }),
  );
  app.post(
    "/api/auth/login",
    cryptoLimit,
    run(async (req, res) => {
      fields(req.body, ["email", "password"]);
      res.json(await auth.login(req.body));
    }),
  );
  app.get("/api/auth/me", protectedBy(), (req, res) => {
    const { sessionHash, ...user } = req.user;
    res.json(user);
  });
  app.post(
    "/api/auth/logout",
    protectedBy(),
    run(async (req, res) => {
      fields(req.body, []);
      await auth.logout(req.user);
      res.sendStatus(204);
    }),
  );
  app.post(
    "/api/auth/logout-all",
    protectedBy(),
    run(async (req, res) => {
      fields(req.body, []);
      await auth.logout(req.user, true);
      res.sendStatus(204);
    }),
  );
  app.post(
    "/api/auth/change-password",
    protectedBy(),
    cryptoLimit,
    run(async (req, res) => {
      fields(req.body, ["currentPassword", "newPassword"]);
      await auth.changePassword(req.user, req.body);
      res.sendStatus(204);
    }),
  );
  app.post(
    "/api/auth/forgot-password",
    cryptoLimit,
    run(async (req, res) => {
      fields(req.body, ["email"]);
      res.status(202).json(await auth.requestReset(req.body));
    }),
  );
  app.post(
    "/api/auth/reset-password",
    cryptoLimit,
    run(async (req, res) => {
      fields(req.body, ["token", "password"]);
      res.json(await auth.reset(req.body));
    }),
  );
  app.post(
    "/api/auth/staff",
    protectedBy(["Administrador"]),
    cryptoLimit,
    run(async (req, res) => {
      fields(req.body, ["name", "email", "password", "role"]);
      if (!["Administrador", "Operador"].includes(req.body.role))
        throw new ApiError(400, "Rol inválido.");
      res.json(
        await auth.create(req.body, req.body.role === "Administrador" ? 1 : 2),
      );
    }),
  );
  app.post(
    "/api/auth/setup-admin",
    cryptoLimit,
    run(async (req, res) => {
      if (
        setupKey.length < 32 ||
        !equalText(req.get("X-Setup-Key") ?? "", setupKey)
      )
        throw new ApiError(404, "Operación no disponible.");
      fields(req.body, ["email", "password"]);
      if (!text(setupName, 120))
        throw new ApiError(503, "Falta configurar el responsable.");
      res.json(await auth.createFirstAdmin({ ...req.body, name: setupName }));
    }),
  );
  app.get(
    "/api/products",
    protectedBy(),
    run(async (req, res) => {
      const search = req.query.search ?? "";
      if (typeof search !== "string" || search.length > 150)
        throw new ApiError(400, "La búsqueda admite hasta 150 caracteres.");
      const result = await rows(
        pool,
        `SELECT id,category_id,code,name,description,unit,finish,length_mm,price,stock,reserved,minimum_stock,image_url,active,stock-reserved AS available FROM products
      WHERE (?=1 OR active=1) AND (?='' OR LOCATE(?,name)>0 OR LOCATE(?,code)>0) ORDER BY name LIMIT 100`,
        [
          isStaff(req.user) ? 1 : 0,
          search.trim(),
          search.trim(),
          search.trim(),
        ],
      );
      res.json(result.map((row) => ({ ...row, id: String(row.id) })));
    }),
  );
  app.get(
    "/api/customers",
    protectedBy(["Administrador", "Operador"]),
    run(async (req, res) => {
      res.json(
        (
          await rows(
            pool,
            "SELECT id,name,phone FROM customers ORDER BY id DESC LIMIT 100",
          )
        ).map((row) => ({ ...row, id: String(row.id) })),
      );
    }),
  );
  app.get(
    "/api/customers/:id",
    protectedBy(),
    run(async (req, res) => {
      const [customer] = await rows(
        pool,
        "SELECT id,name,phone FROM customers WHERE id=? AND (?=1 OR user_id=?)",
        [id(req.params.id), isStaff(req.user) ? 1 : 0, req.user.id],
      );
      if (!customer) throw new ApiError(404, "Cliente no encontrado.");
      res.json({ ...customer, id: String(customer.id) });
    }),
  );
  app.post(
    "/api/customers",
    protectedBy(["Administrador", "Operador"]),
    run(async (req, res) => {
      fields(req.body, ["name", "phone"]);
      const name = text(req.body.name, 120),
        number = phone(req.body.phone);
      if (!name || !number)
        throw new ApiError(400, "Indica nombre y teléfono válidos.");
      const result = await rows(
        pool,
        "INSERT INTO customers(name,phone) VALUES(?,?)",
        [name, number],
      );
      res
        .status(201)
        .location(`/api/customers/${result.insertId}`)
        .json({ id: String(result.insertId), name, phone: number });
    }),
  );
  businessRoutes(app, { pool, protectedBy, run, assistant, pushEnabled });
  app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
  app.use((error, req, res, next) => {
    const status =
      error instanceof ApiError
        ? error.status
        : error.type === "entity.too.large"
          ? 413
          : error instanceof SyntaxError && error.status === 400
            ? 400
            : error.code === "ER_DUP_ENTRY" ||
                [2601, 2627].includes(error.number)
              ? 409
              : 500;
    const message =
      error instanceof ApiError
        ? error.message
        : status === 409
          ? "No fue posible registrar esos datos."
          : status === 400
            ? "JSON inválido."
            : status === 413
              ? "La solicitud es demasiado grande."
              : "No fue posible completar la operación.";
    if (!res.headersSent)
      res.status(status).json({ error: message, traceId: randomUUID() });
  });
  return app;
}
