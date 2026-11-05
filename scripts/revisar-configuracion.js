import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createPrivateKey, X509Certificate } from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url));
let pending = 0;
function report(label, ok) {
  console.log(`${ok ? "OK" : "PENDIENTE"}: ${label}`);
  if (!ok) pending++;
}
function read(relative) {
  const path = resolve(root, relative);
  report(`Archivo ${relative}`, existsSync(path));
  if (!existsSync(path)) return {};
  try {
    return parseEnv(readFileSync(path, "utf8"));
  } catch {
    report(`Formato válido de ${relative}`, false);
    return {};
  }
}
const env = read(".env");
const provider = env.DB_PROVIDER || "sqlserver";
report(
  "Proveedor de base de datos válido",
  ["sqlserver", "mysql"].includes(provider),
);
for (const key of ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"])
  report(key, Boolean(env[key]?.trim()));
report(
  "Cuenta de aplicación distinta de sa y root",
  Boolean(env.DB_USER?.trim()) &&
    !["sa", "root"].includes(env.DB_USER.toLowerCase()),
);
for (const [key, fallback, min] of [
  ["DB_PORT", provider === "sqlserver" ? 1433 : 3306, 1],
  ["PORT", 5180, 1024],
]) {
  const port = Number(env[key] || fallback);
  report(
    `${key} válido`,
    Number.isInteger(port) && port >= min && port <= 65535,
  );
}
const local = ["localhost", "127.0.0.1", "::1"].includes(env.DB_HOST);
if (provider === "mysql" && !local)
  report(
    "CA para MySQL remoto",
    Boolean(env.DB_SSL_CA) && existsSync(resolve(root, env.DB_SSL_CA)),
  );
if (provider === "sqlserver" && env.DB_SSL_CA)
  report(
    "Archivo de CA de SQL Server disponible",
    existsSync(resolve(root, env.DB_SSL_CA)),
  );
try {
  if (!env.TLS_KEY_PATH || !env.TLS_CERT_PATH) throw new Error();
  const key = createPrivateKey(readFileSync(resolve(root, env.TLS_KEY_PATH)));
  const cert = new X509Certificate(
    readFileSync(resolve(root, env.TLS_CERT_PATH)),
  );
  report(
    "Certificado HTTPS coincide con su clave privada",
    cert.checkPrivateKey(key),
  );
  report(
    "Certificado HTTPS vigente",
    Date.parse(cert.validFrom) <= Date.now() &&
      Date.parse(cert.validTo) > Date.now(),
  );
} catch {
  report("Archivos de certificado y clave HTTPS válidos", false);
}
const mailKeys = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];
const mailConfigured = mailKeys.every((key) => Boolean(env[key]?.trim()));
report(
  "Correo de recuperación configurado",
  mailConfigured && ["465", "587"].includes(env.SMTP_PORT || "587"),
);
if (env.SETUP_ADMIN_KEY) {
  report(
    "Clave temporal de primer administrador de al menos 32 caracteres",
    env.SETUP_ADMIN_KEY.length >= 32,
  );
  report(
    "Nombre del primer administrador",
    Boolean(env.SETUP_ADMIN_NAME?.trim()),
  );
}
for (const app of ["cliente", "empresa"]) {
  const mobile = read(`apps/${app}/.env`);
  let valid = false;
  try {
    const url = new URL(mobile.EXPO_PUBLIC_API_URL);
    valid =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname.endsWith("/");
  } catch {}
  report(`URL HTTPS pública de ${app}`, valid);
}
console.log(
  "Esta revisión no conecta a MySQL, no envía correos ni demuestra confianza del certificado en un teléfono.",
);
console.log(
  `Pendientes de configuración: ${pending}. No se muestran valores secretos.`,
);
process.exitCode = pending ? 1 : 0;
