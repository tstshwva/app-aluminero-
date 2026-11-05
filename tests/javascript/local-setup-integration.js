import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
export async function localSetupChecks({ check, port }) {
  const root = await mkdtemp(resolve(".test-artifacts/local-setup-"));
  await mkdir(resolve(root, "scripts"));
  const original = await readFile("scripts/conexion-local.js", "utf8");
  const script = original.replace(
    "../server/src/database.js",
    pathToFileURL(resolve("server/src/database.js")).href,
  );
  const scriptPath = resolve(root, "scripts/conexion-local.js");
  await writeFile(scriptPath, script);
  await writeFile(
    resolve(root, ".env"),
    `DB_PROVIDER=mysql\nDB_HOST=127.0.0.1\nDB_NAME=aluformix\nDB_PORT=${process.env.DB_PORT}\nPORT=${port}\n`,
  );
  const input = {
    password: process.env.MYSQL_PWD,
    keyPath: process.env.TEST_TLS_KEY,
    certPath: process.env.TEST_TLS_CERT,
  };
  const invoke = (action) =>
    new Promise((done, reject) => {
      const child = spawn(process.execPath, [scriptPath, action], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.resume();
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0)
          return reject(
            new Error(
              "Falló la configuración local aislada sin revelar credenciales.",
            ),
          );
        try {
          done(JSON.parse(output));
        } catch (error) {
          reject(error);
        }
      });
      child.stdin.end(action === "preparar" ? JSON.stringify(input) : "");
    });
  const result = await invoke("preparar");
  check(
    result.schemaVersion === 4 && result.tables === 19,
    "Configurador crea cuenta MySQL limitada y conserva las 19 tablas",
  );
  const first = parseEnv(await readFile(resolve(root, ".env"), "utf8"));
  check(
    first.DB_USER !== "root" && first.DB_PASSWORD !== process.env.MYSQL_PWD,
    "Configurador guarda contraseña de API distinta de root, solo en archivo local",
  );
  const second = await invoke("preparar");
  const next = parseEnv(await readFile(resolve(root, ".env"), "utf8"));
  check(
    second.status === "configured" &&
      first.DB_USER === next.DB_USER &&
      first.DB_PASSWORD === next.DB_PASSWORD,
    "Repetir configuración conserva la cuenta de aplicación existente",
  );
  const health = await invoke("verificar");
  check(
    health.status === "running" && health.schemaVersion === 4,
    "Diagnóstico local verifica HTTPS con confianza explícita y sin desactivar TLS",
  );
  assert.ok(!JSON.stringify(result).includes(first.DB_PASSWORD));
}
