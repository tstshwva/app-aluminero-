import sql from "mssql";
import { readFileSync } from "node:fs";

export function compileSqlServer(statement, values = []) {
  let source = statement.trim();
  if (
    /ON DUPLICATE KEY|INSERT IGNORE|GET_LOCK\(|RELEASE_LOCK\(|\bIF\(/i.test(
      source,
    )
  )
    throw new Error("Consulta incompatible con SQL Server.");
  source = source.replace(
    /DATE_(ADD|SUB)\(UTC_TIMESTAMP\(6\),\s*INTERVAL\s+(\d+)\s+(MINUTE|HOUR)\)/gi,
    (_, action, count, unit) =>
      `DATEADD(${unit},${action.toUpperCase() === "SUB" ? "-" : ""}${count},SYSUTCDATETIME())`,
  );
  source = source
    .replace(/UTC_TIMESTAMP\(6\)/gi, "SYSUTCDATETIME()")
    .replace(/UTC_TIMESTAMP\(\)/gi, "SYSUTCDATETIME()")
    .replace(/LOCATE\(/gi, "CHARINDEX(");
  const locked = /\s+FOR UPDATE\s*$/i.test(source);
  source = source.replace(/\s+FOR UPDATE\s*$/i, "");
  if (locked) {
    const reserved = new Set([
      "WHERE",
      "JOIN",
      "INNER",
      "LEFT",
      "RIGHT",
      "FULL",
      "ON",
      "ORDER",
      "GROUP",
      "HAVING",
      "WITH",
    ]);
    source = source.replace(
      /\b(FROM|JOIN)\s+([a-z_][a-z0-9_]*)(\s+(?:AS\s+)?([a-z_][a-z0-9_]*))?/gi,
      (match, clause, table, suffix = "", alias = "") => {
        if (alias && !reserved.has(alias.toUpperCase()))
          return `${clause} dbo.${table}${suffix} WITH (UPDLOCK,HOLDLOCK)`;
        return `${clause} dbo.${table} WITH (UPDLOCK,HOLDLOCK)${suffix}`;
      },
    );
  }
  const limit = source.match(/\s+LIMIT\s+(\d+)\s*$/i);
  if (limit) {
    source = source
      .slice(0, limit.index)
      .replace(
        /^(SELECT|UPDATE|DELETE)\s+/i,
        (_, verb) => `${verb} TOP (${limit[1]}) `,
      );
  }
  let parameter = 0,
    quoted = false,
    result = "";
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === "'") {
      result += character;
      if (quoted && source[index + 1] === "'") {
        result += source[++index];
        continue;
      }
      quoted = !quoted;
    } else if (character === "?" && !quoted) {
      result += `@p${parameter++}`;
    } else result += character;
  }
  if (quoted || parameter !== values.length)
    throw new Error("Parámetros SQL incompatibles.");
  const insert = /^INSERT\s+INTO\s/i.test(result);
  return {
    text: `SET NOCOUNT OFF; ${result}${insert ? "; SELECT CONVERT(VARCHAR(20),SCOPE_IDENTITY()) AS __insert_id;" : ""}`,
    insert,
  };
}

function input(request, value, index) {
  const name = "p" + index;
  if (value === null || value === undefined)
    return request.input(name, sql.NVarChar(1), null);
  if (value instanceof Date)
    return request.input(name, sql.DateTime2(6), value);
  if (typeof value === "boolean") return request.input(name, sql.Bit, value);
  if (typeof value === "bigint")
    return request.input(name, sql.BigInt, value.toString());
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value))
      throw new Error("Parámetro numérico fuera de rango.");
    return request.input(
      name,
      value >= -2147483648 && value <= 2147483647 ? sql.Int : sql.BigInt,
      value,
    );
  }
  if (typeof value !== "string")
    throw new Error("Tipo de parámetro no permitido.");
  return request.input(
    name,
    sql.NVarChar(Math.max(1, Math.min(value.length, 4000))),
    value,
  );
}
function normalize(recordset) {
  const columns = recordset.columns ?? {};
  return recordset.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        const column = columns[key];
        if (value instanceof Date) return [key, value.toISOString()];
        if (value != null && column?.type === sql.BigInt) {
          if (typeof value === "number" && !Number.isSafeInteger(value))
            throw new Error("BIGINT fuera de precisión.");
          return [key, String(value)];
        }
        if (
          value != null &&
          (column?.type === sql.Decimal || column?.type === sql.Numeric)
        ) {
          const scale = column.scale ?? 0;
          if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            Math.abs(value) > Number.MAX_SAFE_INTEGER / 10 ** scale
          )
            throw new Error("Decimal fuera de precisión.");
          return [key, value.toFixed(scale)];
        }
        return [key, value];
      }),
    ),
  );
}
async function execute(target, statement, values) {
  const query = compileSqlServer(statement, values),
    request = target.request();
  values.forEach((value, index) => input(request, value, index));
  const result = await request.query(query.text);
  if (/^\s*SELECT\b/i.test(statement))
    return [normalize(result.recordsets[0] ?? [])];
  const identity = result.recordsets.find(
    (set) => set.columns?.__insert_id,
  )?.[0]?.__insert_id;
  return [
    {
      affectedRows: result.rowsAffected.reduce((sum, count) => sum + count, 0),
      insertId: identity ?? null,
    },
  ];
}

export function sqlServerConfiguration(env = process.env) {
  for (const key of ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"])
    if (!env[key]) throw new Error(`Configura ${key} fuera del código.`);
  if (["sa", "root"].includes(env.DB_USER.toLowerCase()))
    throw new Error("Configura una cuenta limitada para la API.");
  if (env.DB_TRUST_SERVER_CERTIFICATE === "true")
    throw new Error("Configura un certificado confiable para SQL Server.");
  const port = Number(env.DB_PORT || 1433);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Puerto SQL Server inválido.");
  return {
    server: env.DB_HOST,
    port,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectionTimeout: 5000,
    requestTimeout: 15000,
    pool: { max: 8, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: true,
      trustServerCertificate: false,
      useUTC: true,
      abortTransactionOnError: true,
      ...(env.DB_SSL_CA
        ? { cryptoCredentialsDetails: { ca: readFileSync(env.DB_SSL_CA) } }
        : {}),
    },
  };
}
export function createSqlServerDatabase(env = process.env) {
  const pool = new sql.ConnectionPool(sqlServerConfiguration(env));
  pool.on("error", () => {});
  let ready;
  const connect = () =>
    (ready ??= (async () => {
      try {
        return await pool.connect();
      } catch (error) {
        ready = null;
        throw error;
      }
    })());
  return {
    dialect: "sqlserver",
    async execute(statement, values = []) {
      await connect();
      return execute(pool, statement, values);
    },
    async end() {
      await pool.close();
    },
    async getConnection() {
      await connect();
      const transaction = new sql.Transaction(pool);
      let active = false;
      transaction.on("rollback", () => {
        active = false;
      });
      await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
      active = true;
      return {
        dialect: "sqlserver",
        get active() {
          return active;
        },
        execute: (statement, values = []) =>
          execute(transaction, statement, values),
        raw: async (statement, values = []) => {
          const request = transaction.request();
          values.forEach((value, index) => input(request, value, index));
          return request.query(statement);
        },
        async beginTransaction() {
          if (!active) throw new Error("Transacción cerrada.");
        },
        async commit() {
          await transaction.commit();
          active = false;
        },
        async rollback() {
          if (active) {
            await transaction.rollback();
            active = false;
          }
        },
        async release() {
          if (active) {
            await transaction.rollback();
            active = false;
          }
        },
      };
    },
  };
}
