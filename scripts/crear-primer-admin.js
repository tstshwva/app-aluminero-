import { readFileSync } from "node:fs";
import { AuthService } from "../server/src/auth.js";
import { createDatabase } from "../server/src/database.js";
import { ApiError } from "../server/src/errors.js";

let pool;
try {
  const account = JSON.parse(readFileSync(0, "utf8").replace(/^\uFEFF/, ""));
  pool = createDatabase();
  await new AuthService(pool).createFirstAdmin(account);
  console.log(
    "Cuenta administradora creada. Ya puedes acceder a Aluformix Empresa.",
  );
} catch (error) {
  console.error(
    error instanceof ApiError
      ? error.message
      : "No se pudo crear la cuenta. Revisa la base y los datos.",
  );
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
