import https from "node:https";
import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";
import { createDatabase, rows } from "./database.js";
import { createApp } from "./app.js";
import { createAssistant } from "./assistant.js";
import { createPushWorker } from "./push.js";
const env = process.env,
  port = Number(env.PORT || 5180);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Puerto HTTPS inválido.");
if (!env.TLS_KEY_PATH || !env.TLS_CERT_PATH)
  throw new Error(
    "Configura TLS_KEY_PATH y TLS_CERT_PATH; no existe alternativa HTTP.",
  );
const pool = createDatabase();
const [version] = await rows(
  pool,
  "SELECT MAX(version) AS version FROM schema_versions",
);
if (Number(version.version) !== 4) {
  await pool.end();
  throw new Error("Aplica el esquema de base de datos versión 4 antes de iniciar.");
}
let mail = null;
if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_FROM) {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_PORT === "465",
    requireTLS: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  mail = (to, code) =>
    transport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: "Recupera tu acceso a Aluformix",
      text: `Código: ${code}\nCaduca en 15 minutos. Si no lo solicitaste, ignora este correo.`,
    });
}
const server = https.createServer(
  {
    key: readFileSync(env.TLS_KEY_PATH),
    cert: readFileSync(env.TLS_CERT_PATH),
    minVersion: "TLSv1.2",
    maxHeaderSize: 16384,
  },
  createApp({
    pool,
    mail,
    setupKey: env.SETUP_ADMIN_KEY,
    setupName: env.SETUP_ADMIN_NAME,
    assistant: createAssistant(env),
    pushEnabled: env.PUSH_ENABLED === "true",
  }),
);
server.requestTimeout = 30000;
server.headersTimeout = 10000;
const stopPush = createPushWorker(pool, {
  enabled: env.PUSH_ENABLED === "true",
  accessToken: env.EXPO_ACCESS_TOKEN ?? "",
}).start();
server.listen(port, "127.0.0.1", () =>
  console.log(`Aluformix API HTTPS disponible en puerto ${port}.`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    stopPush();
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
