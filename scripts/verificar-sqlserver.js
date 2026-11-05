import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { createDatabase, rows } from "../server/src/database.js";
let pool;
try {
  const env = parseEnv(
    readFileSync(fileURLToPath(new URL("../.env", import.meta.url)), "utf8"),
  );
  if (env.DB_PROVIDER !== "sqlserver") throw new Error();
  pool = createDatabase(env);
  const [version] = await rows(
    pool,
    "SELECT MAX(version) AS version FROM schema_versions",
  );
  const [count] = await rows(
    pool,
    "SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_TYPE='BASE TABLE'",
  );
  if (Number(version.version) !== 4 || Number(count.total) !== 19)
    throw new Error();
  const [permissions] = await rows(
    pool,
    "SELECT IS_SRVROLEMEMBER('sysadmin') AS administrator,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER') AS can_alter,HAS_PERMS_BY_NAME('dbo.roles','OBJECT','UPDATE') AS can_update_roles",
  );
  if (
    Number(permissions.administrator) !== 0 ||
    Number(permissions.can_alter) !== 0 ||
    Number(permissions.can_update_roles) !== 0
  )
    throw new Error();
  console.log(
    JSON.stringify({
      status: "connected",
      provider: "sqlserver",
      schemaVersion: 4,
      tables: Number(count.total),
      encrypted: true,
    }),
  );
} catch {
  console.error(
    "No se pudo verificar SQL Server. Revisa instalación, certificado y configuración local.",
  );
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
