import {
  readFileSync,
  existsSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { randomBytes, X509Certificate, createPrivateKey } from "node:crypto";
import https from "node:https";
import mysql from "mysql2/promise";
import { createDatabase, rows } from "../server/src/database.js";
const root = fileURLToPath(new URL("../", import.meta.url)),
  envPath = resolve(root, ".env");
const read = () =>
  existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {};
const input = async () => {
  let value = "";
  for await (const part of process.stdin) {
    value += part;
    if (value.length > 16000) throw new Error();
  }
  return JSON.parse(value);
};
function save(values) {
  for (const key of Object.keys(values))
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error();
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
    throw new Error();
  const target = envPath + ".local-tmp";
  writeFileSync(target, content, { mode: 0o600 });
  renameSync(target, envPath);
}
async function provision(body) {
  let admin, pool;
  try {
    const env = read(),
      port = Number(env.DB_PORT || 3306);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
    if (env.DB_HOST && !["localhost", "127.0.0.1"].includes(env.DB_HOST))
      throw new Error();
    if (env.DB_NAME && env.DB_NAME !== "aluformix") throw new Error();
    const keyPath = env.TLS_KEY_PATH || body.keyPath,
      certPath = env.TLS_CERT_PATH || body.certPath;
    const cert = new X509Certificate(readFileSync(resolve(root, certPath)));
    if (
      !cert.checkPrivateKey(
        createPrivateKey(readFileSync(resolve(root, keyPath))),
      ) ||
      !cert.checkHost("localhost") ||
      Date.parse(cert.validTo) <= Date.now()
    )
      throw new Error();
    admin = await mysql.createConnection({
      host: "127.0.0.1",
      port,
      user: "root",
      password: body.password,
      database: "aluformix",
      multipleStatements: false,
      connectTimeout: 5000,
    });
    const [versions] = await admin.execute(
      "SELECT MAX(version) AS version FROM schema_versions",
    );
    if (Number(versions[0].version) !== 4) throw new Error();
    let dbUser = env.DB_USER,
      dbPassword = env.DB_PASSWORD;
    if (dbUser || dbPassword) {
      if (!dbUser || !dbPassword || dbUser.toLowerCase() === "root")
        throw new Error("Revisar la cuenta de aplicación existente.");
      pool = createDatabase({ DB_PROVIDER: "mysql", ...env, DB_HOST: "127.0.0.1" });
      await rows(pool, "SELECT 1");
    } else {
      dbUser = "alu_api_" + randomBytes(5).toString("hex");
      dbPassword = randomBytes(32).toString("hex");
      const account = admin.escape(dbUser) + "@'localhost'";
      await admin.query(
        `CREATE USER ${account} IDENTIFIED BY ${admin.escape(dbPassword)}`,
      );
      await admin.query(
        `GRANT SELECT,INSERT,UPDATE,DELETE ON aluformix.* TO ${account}`,
      );
      pool = createDatabase({ DB_PROVIDER: "mysql",
        DB_HOST: "127.0.0.1",
        DB_PORT: String(port),
        DB_NAME: "aluformix",
        DB_USER: dbUser,
        DB_PASSWORD: dbPassword,
      });
      await rows(pool, "SELECT 1");
    }
    const grants = await rows(pool, "SHOW GRANTS");
    if (
      grants.some((g) =>
        Object.values(g).some((v) => /ALL PRIVILEGES|GRANT OPTION/i.test(v)),
      )
    )
      throw new Error("Revisar privilegios excesivos.");
    const [count] = await rows(
      pool,
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema='aluformix'",
    );
    mkdirSync(resolve(root, ".local"), { recursive: true });
    if (
      existsSync(envPath) &&
      !existsSync(resolve(root, ".local/env-antes-conexion"))
    ) {
      writeFileSync(
        resolve(root, ".local/env-antes-conexion"),
        readFileSync(envPath),
        { mode: 0o600 },
      );
    }
    save({
      ...env,
      DB_HOST: "127.0.0.1",
      DB_PORT: String(port),
      DB_NAME: "aluformix",
      DB_USER: dbUser,
      DB_PASSWORD: dbPassword,
      TLS_KEY_PATH: keyPath,
      TLS_CERT_PATH: certPath,
      PORT: env.PORT || "5180",
    });
    console.log(
      JSON.stringify({
        status: "configured",
        schemaVersion: 4,
        tables: Number(count.total),
      }),
    );
  } finally {
    if (pool) await pool.end();
    if (admin) await admin.end();
  }
}
async function health() {
  const env = read(),
    cert = readFileSync(resolve(root, env.TLS_CERT_PATH));
  await new Promise((done, reject) => {
    const request = https.get(
      {
        hostname: "localhost",
        family: 4,
        port: Number(env.PORT || 5180),
        path: "/health/live",
        ca: cert,
        timeout: 3000,
      },
      (response) => {
        let value = "";
        response.on("data", (part) => (value += part));
        response.on("end", () => {
          try {
            const data = JSON.parse(value);
            if (
              response.statusCode !== 200 ||
              data.service !== "aluformix" ||
              data.schemaVersion !== 4
            )
              throw new Error();
            done();
          } catch {
            reject(new Error());
          }
        });
      },
    );
    request.on("error", reject);
    request.on("timeout", () => request.destroy(new Error()));
  });
  console.log(
    JSON.stringify({
      status: "running",
      url: `https://localhost:${Number(env.PORT || 5180)}`,
      schemaVersion: 4,
    }),
  );
}
try {
  if (process.argv[2] === "preparar") await provision(await input());
  else if (process.argv[2] === "verificar") await health();
  else throw new Error();
} catch {
  console.error(
    "No se pudo completar la conexión local. Revisa el servidor, las credenciales, los permisos y el certificado. No se imprimieron secretos.",
  );
  process.exitCode = 1;
}
