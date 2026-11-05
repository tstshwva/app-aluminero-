import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url)),
  path = resolve(root, ".env");
let input = "";
for await (const part of process.stdin) {
  input += part;
  if (input.length > 16000) throw new Error("Configuración demasiado grande.");
}
const config = JSON.parse(input),
  previous = existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
if (
  !/^alu_api_[a-f0-9]{10}$/.test(config.user) ||
  !/^Aa![A-Fa-f0-9]{64}$/.test(config.password)
)
  throw new Error("Cuenta local inválida.");
const values = {
  ...previous,
  DB_PROVIDER: "sqlserver",
  DB_HOST: "localhost",
  DB_PORT: "14330",
  DB_NAME: "aluformix",
  DB_USER: config.user,
  DB_PASSWORD: config.password,
  DB_SSL_CA: config.ca,
  TLS_KEY_PATH: previous.TLS_KEY_PATH || config.key,
  TLS_CERT_PATH: previous.TLS_CERT_PATH || config.cert,
  PORT: previous.PORT || "5180",
};
delete values.DB_TRUST_SERVER_CERTIFICATE;
const content =
  Object.entries(values)
    .map(
      ([key, value]) =>
        `${key}=${String(value).includes("'") ? JSON.stringify(String(value)) : "'" + String(value) + "'"}`,
    )
    .join("\n") + "\n";
const parsed = parseEnv(content);
if (
  Object.entries(values).some(([key, value]) => parsed[key] !== String(value))
)
  throw new Error("No se pudo preservar la configuración.");
if (
  existsSync(path) &&
  !existsSync(resolve(root, ".local/env-antes-sqlserver"))
)
  writeFileSync(
    resolve(root, ".local/env-antes-sqlserver"),
    readFileSync(path),
    { mode: 0o600 },
  );
writeFileSync(path + ".tmp", content, { mode: 0o600 });
renameSync(path + ".tmp", path);
console.log("Configuración local de SQL Server guardada.");
