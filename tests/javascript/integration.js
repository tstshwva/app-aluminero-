import { businessChecks } from "./business-integration.js";
import { localSetupChecks } from "./local-setup-integration.js";
import assert from "node:assert/strict";
import https from "node:https";
import http from "node:http";
import { readFileSync } from "node:fs";
import { createDatabase, rows } from "../../server/src/database.js";
import { createApp } from "../../server/src/app.js";
import { createClient } from "../../packages/client/src/index.js";
import { token, tokenHash } from "../../server/src/crypto.js";
import { pbkdf2Sync, randomBytes } from "node:crypto";
const pool = createDatabase();
const key = readFileSync(process.env.TEST_TLS_KEY),
  cert = readFileSync(process.env.TEST_TLS_CERT);
const setupKey = token(),
  messages = new Map();
let checks = 0;
const app = createApp({
  pool,
  mail: async (to, code) => messages.set(to, code),
  setupKey,
  setupName: "Administrador aislado",
  pushEnabled: true,
});
const server = https.createServer({ key, cert, minVersion: "TLSv1.2" }, app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `https://127.0.0.1:${server.address().port}`;
if (process.env.DB_PROVIDER === "mysql")
  await localSetupChecks({ check, port: server.address().port });
function check(condition, message) {
  assert.ok(condition, message);
  checks++;
  console.log("PASS JS: " + message);
}
async function request(
  route,
  { method = "GET", body, session, headers = {} } = {},
) {
  const payload =
    body === undefined
      ? null
      : typeof body === "string"
        ? body
        : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      new URL(route, origin),
      {
        method,
        ca: cert,
        headers: {
          ...headers,
          ...(session ? { Authorization: `Bearer ${session}` } : {}),
          ...(body !== undefined
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        let value = "";
        res.on("data", (chunk) => (value += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: value ? JSON.parse(value) : null,
          }),
        );
      },
    );
    req.on("error", reject);
    if (body !== undefined) req.write(payload);
    req.end();
  });
}
const post = (route, body, session, headers) =>
  request(route, { method: "POST", body, session, headers });

function testAppSession() {
  let savedToken = null;
  const storage = {
    get: async () => savedToken,
    save: async (token) => {
      savedToken = token;
    },
    clear: async () => {
      savedToken = null;
    },
  };
  const open = () =>
    createClient({
      baseUrl: origin + "/",
      storage,
      fetchImpl: async (url, { method, body, headers }) => {
        const result = await request(url, { method, body, headers });
        return {
          ok: result.status >= 200 && result.status < 300,
          status: result.status,
          json: async () => result.body,
        };
      },
    });
  return { open, storage };
}
const password = "Integration-" + token(),
  buyerEmail = "buyer@integration.invalid";
try {
  check(
    (await rows(pool, "SELECT COUNT(*) AS n FROM users"))[0].n.toString() ===
      "0",
    "Base aislada empieza sin usuarios ficticios",
  );
  const [preserved] = await rows(
    pool,
    "SELECT i.product_name,i.product_code,i.quantity,i.unit_price,p.stock,p.reserved FROM order_items i JOIN products p ON p.id=i.product_id WHERE p.code='MIGRATION-OLD'",
  );
  check(
    preserved.product_name === "Material anterior" &&
      preserved.product_code === "MIGRATION-OLD" &&
      preserved.quantity === "1.000" &&
      preserved.unit_price === "125.50" &&
      preserved.stock === "5.000" &&
      preserved.reserved === "1.000",
    "Migración conserva encargos, importes, existencias y reservas previos",
  );
  check(
    (await request("/health/live")).status === 200,
    "API JavaScript responde por HTTPS",
  );
  const plain = await new Promise((resolve) => {
    const req = http.get(
      origin.replace("https:", "http:") + "/health/live",
      () => resolve(false),
    );
    req.on("error", () => resolve(true));
  });
  check(plain, "Servidor rechaza HTTP sin cifrar");
  const noTrust = await new Promise((resolve) => {
    https
      .get(origin + "/health/live", () => resolve(false))
      .on("error", () => resolve(true));
  });
  check(noTrust, "Certificado de pruebas no se acepta sin confianza explícita");
  check(
    (await request("/api/products")).status === 401,
    "Catálogo exige sesión",
  );
  check(
    (
      await post("/api/auth/setup-admin", {
        email: "admin@integration.invalid",
        password,
      })
    ).status === 404,
    "Configuración inicial exige clave externa",
  );
  const admin = await testAppSession()
    .open()
    .setupAdmin({ email: "admin@integration.invalid", password }, setupKey);
  check(
    admin.role === "Administrador",
    "Creación protegida del primer administrador desde el cliente de Empresa",
  );
  check(
    (
      await post(
        "/api/auth/setup-admin",
        { email: "admin@integration.invalid", password },
        null,
        { "X-Setup-Key": setupKey },
      )
    ).status === 409,
    "No repite el primer administrador",
  );
  const companySession = testAppSession();
  const adminUser = await companySession
    .open()
    .login("admin@integration.invalid", password, "empresa");
  check(
    adminUser.role === "Administrador",
    "La app Empresa inicia sesión con un administrador real de prueba",
  );
  check(
    (await companySession.open().current("empresa")).id === adminUser.id,
    "Empresa recupera la sesión con otra instancia del cliente",
  );
  const adminToken = await companySession.storage.get();
  check(
    (await request("/health/db", { session: adminToken })).body
      .schemaVersion === 4,
    "API reutiliza la base de datos versión 4",
  );
  const registration = await post("/api/auth/register", {
    name: "Comprador aislado",
    email: buyerEmail,
    phone: "9991234567",
    password,
  });
  check(registration.status === 201, "Registro crea comprador");
  check(
    registration.body.role === "Cliente",
    "Registro público no crea personal",
  );
  check(
    (
      await rows(pool, "SELECT COUNT(*) AS n FROM customers WHERE user_id=?", [
        registration.body.id,
      ])
    )[0].n.toString() === "1",
    "Cuenta y ficha se guardan juntas",
  );
  check(
    (
      await rows(pool, "SELECT password_hash FROM users WHERE id=?", [
        registration.body.id,
      ])
    )[0].password_hash.startsWith("scrypt$"),
    "la base de datos guarda hash, no contraseña",
  );
  check(
    (
      await post("/api/auth/register", {
        name: "Ataque",
        email: "no@integration.invalid",
        phone: "9991234567",
        password,
        role: "Administrador",
      })
    ).status === 400,
    "No acepta inyección de rol",
  );
  check(
    (
      await post("/api/auth/register", {
        name: "Corto",
        email: "short@integration.invalid",
        phone: "9991234567",
        password: "corta",
      })
    ).status === 400,
    "Contraseña corta rechazada",
  );
  check(
    (
      await post("/api/auth/register", {
        name: "Repetido",
        email: buyerEmail,
        phone: "9991234567",
        password,
      })
    ).status === 409,
    "Correo duplicado rechazado",
  );
  check(
    (
      await post("/api/auth/login", {
        email: buyerEmail,
        password: "incorrecta",
      })
    ).status === 401,
    "Contraseña incorrecta rechazada",
  );
  const buyerSession = testAppSession();
  const buyerUser = await buyerSession
    .open()
    .login(" BUYER@integration.invalid ", password, "cliente");
  let session = await buyerSession.storage.get();
  check(
    buyerUser.id === registration.body.id && Boolean(session),
    "La app Cliente inicia sesión y la API normaliza el correo",
  );
  check(
    (await buyerSession.open().current("cliente")).id === buyerUser.id,
    "Cliente recupera la sesión con otra instancia del cliente",
  );
  check(
    (await request("/api/auth/me", { session })).body.id ===
      registration.body.id,
    "Sesión identifica al comprador",
  );
  check(
    (
      await rows(
        pool,
        "SELECT token_hash FROM auth_sessions WHERE token_hash=?",
        [session],
      )
    ).length === 0,
    "Token original no se guarda en la base de datos",
  );
  check(
    (await request("/api/customers", { session })).status === 403,
    "Comprador no lista clientes de la empresa",
  );
  const own = (
    await rows(pool, "SELECT id FROM customers WHERE user_id=?", [
      registration.body.id,
    ])
  )[0].id;
  check(
    (await request(`/api/customers/${own}`, { session })).status === 200,
    "Comprador consulta su ficha",
  );
  check(
    (await request("/health/db", { session })).status === 403,
    "Comprador no consulta diagnóstico administrativo",
  );
  const customer = await post(
    "/api/customers",
    { name: "Cliente integración", phone: "9991234567" },
    adminToken,
  );
  check(customer.status === 201, "Empresa guarda cliente");
  check(
    (
      await rows(pool, "SELECT name FROM customers WHERE id=?", [
        customer.body.id,
      ])
    )[0].name === "Cliente integración",
    "Cliente persiste en la base de datos",
  );
  check(
    (await request(`/api/customers/${customer.body.id}`, { session }))
      .status === 404,
    "Comprador no consulta ficha ajena",
  );
  check(
    (await post("/api/customers", { name: "", phone: "abc" }, adminToken))
      .status === 400,
    "Formulario de cliente valida entradas",
  );
  await rows(pool, "INSERT INTO categories(name) VALUES('Categoría aislada')");
  await rows(
    pool,
    "INSERT INTO products(category_id,code,name,unit,price,stock) SELECT id,'JS-01','Riel aislado','barra',400,10 FROM categories WHERE name='Categoría aislada'",
  );
  check(
    (await request("/api/products?search=Riel", { session })).body.length === 1,
    "Catálogo consulta productos reales de la instancia aislada",
  );
  check(
    (
      await request(
        "/api/products?search=" + encodeURIComponent("' OR 1=1 --"),
        { session },
      )
    ).body.length === 0,
    "Texto SQL se trata como dato",
  );
  check(
    (await request("/api/products?search=" + "a".repeat(151), { session }))
      .status === 400,
    "Búsqueda excesiva rechazada",
  );
  await businessChecks({
    request,
    post,
    check,
    pool,
    buyer: session,
    admin: adminToken,
    password,
  });
  check(
    (
      await post(
        "/api/auth/staff",
        {
          name: "No",
          email: "no@integration.invalid",
          password,
          role: "Administrador",
        },
        session,
      )
    ).status === 403,
    "Comprador no crea administradores",
  );
  check(
    (
      await post(
        "/api/auth/staff",
        {
          name: "Operador aislado",
          email: "operator@integration.invalid",
          password,
          role: "Operador",
        },
        adminToken,
      )
    ).status === 200,
    "Administrador crea operador",
  );
  let op = (
    await post("/api/auth/login", {
      email: "operator@integration.invalid",
      password,
    })
  ).body.accessToken;
  check(
    (await request("/api/customers", { session: op })).status === 200,
    "Operador consulta clientes",
  );
  check(
    (
      await post(
        "/api/auth/staff",
        {
          name: "No",
          email: "another@integration.invalid",
          password,
          role: "Operador",
        },
        op,
      )
    ).status === 403,
    "Operador no administra cuentas",
  );
  check(
    (
      await post(
        "/api/auth/change-password",
        { currentPassword: "incorrecta", newPassword: password + "X" },
        op,
      )
    ).status === 400,
    "Cambio exige contraseña actual",
  );
  check(
    (
      await post(
        "/api/auth/change-password",
        { currentPassword: password, newPassword: password + "X" },
        op,
      )
    ).status === 204,
    "Cambio de contraseña se guarda",
  );
  check(
    (await request("/api/auth/me", { session: op })).status === 401,
    "Cambio revoca sesión anterior",
  );
  check(
    (
      await post("/api/auth/login", {
        email: "operator@integration.invalid",
        password,
      })
    ).status === 401,
    "Contraseña anterior deja de funcionar",
  );
  op = (
    await post("/api/auth/login", {
      email: "operator@integration.invalid",
      password: password + "X",
    })
  ).body.accessToken;
  check(
    (await post("/api/auth/logout-all", {}, op)).status === 204,
    "Cierre global registrado",
  );
  check(
    (await request("/api/auth/me", { session: op })).status === 401,
    "Cierre global invalida token",
  );
  await post("/api/auth/forgot-password", { email: buyerEmail });
  const code = messages.get(buyerEmail);
  check(
    Boolean(code),
    "Recuperación entrega código al adaptador de correo de pruebas",
  );
  check(
    (
      await post("/api/auth/reset-password", {
        token: code,
        password: password + "R",
      })
    ).status === 200,
    "Recuperación cambia contraseña",
  );
  check(
    (
      await post("/api/auth/reset-password", {
        token: code,
        password: password + "R",
      })
    ).status === 400,
    "Código de un solo uso",
  );
  check(
    (await request("/api/auth/me", { session })).status === 401,
    "Recuperación revoca sesión existente",
  );
  check(
    (await buyerSession.open().current("cliente")) === null &&
      (await buyerSession.storage.get()) === null,
    "Cliente borra su sesión guardada después de que la API la revoca",
  );
  session = (
    await post("/api/auth/login", {
      email: buyerEmail,
      password: password + "R",
    })
  ).body.accessToken;
  check(Boolean(session), "Nueva contraseña permite acceso");
  await rows(pool, "UPDATE users SET active=0 WHERE id=?", [
    registration.body.id,
  ]);
  check(
    (await request("/api/auth/me", { session })).status === 401,
    "Cuenta desactivada pierde acceso",
  );
  await rows(pool, "UPDATE users SET active=1 WHERE id=?", [
    registration.body.id,
  ]);
  await rows(
    pool,
    "UPDATE auth_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE) WHERE user_id=?",
    [registration.body.id],
  );
  check(
    (await request("/api/auth/me", { session })).status === 401,
    "Sesión vencida rechazada",
  );
  const salt = randomBytes(16),
    header = Buffer.alloc(13);
  header[0] = 1;
  header.writeUInt32BE(2, 1);
  header.writeUInt32BE(220000, 5);
  header.writeUInt32BE(16, 9);
  const oldHash = Buffer.concat([
    header,
    salt,
    pbkdf2Sync(password, salt, 220000, 32, "sha512"),
  ]).toString("base64");
  await rows(
    pool,
    "INSERT INTO users(role_id,name,email,password_hash) VALUES(3,?,?,?)",
    ["Cuenta heredada", "legacy@integration.invalid", oldHash],
  );
  check(
    (
      await post("/api/auth/login", {
        email: "legacy@integration.invalid",
        password,
      })
    ).status === 200,
    "Cuenta del formato C# anterior conserva acceso",
  );
  check(
    (
      await rows(
        pool,
        "SELECT password_hash FROM users WHERE email='legacy@integration.invalid'",
      )
    )[0].password_hash.startsWith("scrypt$"),
    "Hash anterior se actualiza al acceder",
  );
  for (let i = 0; i < 5; i++)
    await post("/api/auth/login", {
      email: buyerEmail,
      password: "incorrecta",
    });
  check(
    (
      await post("/api/auth/login", {
        email: buyerEmail,
        password: password + "R",
      })
    ).status === 401,
    "Cinco fallos bloquean temporalmente",
  );
  check(
    (
      await rows(
        pool,
        "SELECT CASE WHEN locked_until IS NOT NULL THEN 1 ELSE 0 END AS locked FROM users WHERE id=?",
        [registration.body.id],
      )
    )[0].locked.toString() === "1",
    "Bloqueo queda guardado",
  );
  await rows(
    pool,
    "UPDATE users SET locked_until=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE) WHERE id=?",
    [registration.body.id],
  );
  check(
    (
      await post("/api/auth/login", {
        email: buyerEmail,
        password: password + "R",
      })
    ).status === 200,
    "Bloqueo vencido permite acceso nuevamente",
  );
  check(
    (await post("/api/auth/register", "{")).status === 400,
    "JSON inválido no revela detalles internos",
  );
  const malformed = await post(
    "/api/customers",
    { name: 123, phone: [] },
    adminToken,
  );
  check(malformed.status === 400, "Tipos de entrada incorrectos se rechazan");
  const large = await post(
    "/api/customers",
    { name: "x".repeat(20000), phone: "9991234567" },
    adminToken,
  );
  check(large.status === 413, "Límite del cuerpo HTTP aplicado");
  let limited = false;
  for (let i = 0; i < 21; i++) {
    if (
      (
        await post("/api/auth/login", {
          email: "absent@integration.invalid",
          password: "incorrecta",
        })
      ).status === 429
    ) {
      limited = true;
      break;
    }
  }
  check(limited, "Límite de intentos HTTP aplicado");
  for (const route of [
    "/api/auth/LOGIN",
    "/api/auth/login/",
    "/API/AUTH/LoGiN/",
  ]) {
    check(
      (
        await post(route, {
          email: "absent@integration.invalid",
          password: "incorrecta",
        })
      ).status === 429,
      "Variación de ruta conserva el límite de acceso: " + route,
    );
  }
  check(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { email: "absent@integration.invalid", password: "incorrecta" },
        headers: { "X-Forwarded-For": "198.51.100.99" },
      })
    ).status === 429,
    "No permite cambiar la IP mediante encabezado no confiable",
  );
  const beforeReset = (
    await rows(
      pool,
      "SELECT COUNT(*) AS total FROM password_reset_tokens WHERE user_id=?",
      [registration.body.id],
    )
  )[0].total.toString();
  await Promise.all([
    post("/api/auth/forgot-password", { email: buyerEmail }),
    post("/api/auth/forgot-password", { email: buyerEmail }),
  ]);
  const afterReset = (
    await rows(
      pool,
      "SELECT COUNT(*) AS total FROM password_reset_tokens WHERE user_id=?",
      [registration.body.id],
    )
  )[0].total.toString();
  check(
    beforeReset === afterReset,
    "Recuperación repetida respeta espera por cuenta incluso con solicitudes simultáneas",
  );
  let generalLimited = false;
  for (let i = 0; i < 301; i++)
    if ((await request("/api/ruta-inexistente")).status === 429) {
      generalLimited = true;
      break;
    }
  check(
    generalLimited,
    "Límite general protege también rutas fuera del inicio de sesión",
  );
  console.log(
    `TOTAL JAVASCRIPT: ${checks} comprobaciones HTTPS y la base de datos correctas`,
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}
