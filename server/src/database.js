import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { createSqlServerDatabase } from "./sqlserver.js";
export function createDatabase(env = process.env) {
  const provider = env.DB_PROVIDER || "sqlserver";
  if (provider === "sqlserver") return createSqlServerDatabase(env);
  if (provider !== "mysql")
    throw new Error("Proveedor de base de datos no admitido.");
  for (const key of ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"])
    if (!env[key]) throw new Error(`Configura ${key} fuera del código.`);
  const local = ["localhost", "127.0.0.1", "::1"].includes(env.DB_HOST);
  if (!local && !env.DB_SSL_CA)
    throw new Error("MySQL remoto requiere DB_SSL_CA y validación TLS.");
  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Puerto de MySQL inválido.");
  return mysql.createPool({
    host: env.DB_HOST,
    port,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL_CA
      ? {
          ca: readFileSync(env.DB_SSL_CA),
          rejectUnauthorized: true,
          verifyIdentity: true,
        }
      : undefined,
    timezone: "Z",
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectionLimit: 8,
    multipleStatements: false,
    decimalNumbers: false,
    connectTimeout: 5000,
  });
}
export async function transaction(pool, action) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const result = await action(db);
    await db.commit();
    return result;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.release();
  }
}
export async function rows(db, sql, values = []) {
  const [result] = await db.execute(sql, values);
  return result;
}
export async function acquireAppLock(db, name, seconds = 5) {
  if (db.dialect === "sqlserver") {
    const result = await db.raw(
      "DECLARE @result INT; EXEC @result=sys.sp_getapplock @Resource=@p0,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=@p1; SELECT @result AS acquired;",
      [name, seconds * 1000],
    );
    return Number(result.recordset[0].acquired) >= 0;
  }
  const [result] = await rows(db, "SELECT GET_LOCK(?,?) AS acquired", [
    name,
    seconds,
  ]);
  return Number(result.acquired) === 1;
}
export async function releaseAppLock(db, name) {
  if (db.dialect === "sqlserver") {
    if (db.active)
      await db.raw(
        "EXEC sys.sp_releaseapplock @Resource=@p0,@LockOwner='Transaction';",
        [name],
      );
    return;
  }
  await rows(db, "SELECT RELEASE_LOCK(?)", [name]);
}
