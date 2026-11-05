import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  compileSqlServer,
  sqlServerConfiguration,
} from "../../server/src/sqlserver.js";
test("SQL Server enlaza parámetros sin insertar los valores en la consulta", () => {
  const value = "x' OR 1=1 --";
  const query = compileSqlServer(
    "SELECT id FROM users WHERE email=? AND name<>'?' LIMIT 1",
    [value],
  );
  assert.match(query.text, /SELECT TOP \(1\)/);
  assert.match(query.text, /email=@p0/);
  assert.ok(!query.text.includes(value));
  assert.match(query.text, /name<>'\?'/);
  assert.throws(() =>
    compileSqlServer("SELECT id FROM users WHERE email=?", []),
  );
});
test("Bloqueos de filas y fechas se adaptan al dialecto de SQL Server", () => {
  const query = compileSqlServer(
    "SELECT o.id,c.user_id FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=? FOR UPDATE",
    ["1"],
  );
  assert.match(query.text, /dbo.orders o WITH \(UPDLOCK,HOLDLOCK\)/);
  assert.match(query.text, /dbo.customers c WITH \(UPDLOCK,HOLDLOCK\)/);
  assert.ok(!query.text.includes("FOR UPDATE"));
  assert.match(
    compileSqlServer(
      "SELECT id FROM users WHERE locked_until>DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE)",
    ).text,
    /DATEADD\(MINUTE,15,SYSUTCDATETIME\(\)\)/,
  );
  assert.match(
    compileSqlServer("UPDATE push_outbox SET attempts=0 LIMIT 1").text,
    /UPDATE TOP \(1\)/,
  );
});
test("Identidades de SQL Server se devuelven como texto y se exige TLS validado", () => {
  assert.match(
    compileSqlServer("INSERT INTO categories(name) VALUES(?)", ["Material"])
      .text,
    /CONVERT\(VARCHAR\(20\),SCOPE_IDENTITY\(\)\)/,
  );
  const env = {
    DB_HOST: "localhost",
    DB_NAME: "aluformix",
    DB_USER: "limited",
    DB_PASSWORD: "test-only",
  };
  const config = sqlServerConfiguration(env);
  assert.equal(config.options.encrypt, true);
  assert.equal(config.options.trustServerCertificate, false);
  assert.equal(config.port, 1433);
  assert.throws(() => sqlServerConfiguration({ ...env, DB_USER: "sa" }));
  assert.throws(() =>
    sqlServerConfiguration({ ...env, DB_TRUST_SERVER_CERTIFICATE: "true" }),
  );
});
test("Esquema SQL Server permite varios clientes sin cuenta y añade soporte de negocio", () => {
  const schema = readFileSync("database/sqlserver/001_schema.sql", "utf8"),
    migration = readFileSync("database/sqlserver/005_business.sql", "utf8");
  assert.ok(
    !schema.includes("CONSTRAINT UQ_customers_user_id UNIQUE (user_id)"),
  );
  assert.match(
    schema,
    /CREATE UNIQUE INDEX UQ_customers_user_id[^;]+WHERE user_id IS NOT NULL/,
  );
  assert.match(schema, /BEGIN TRANSACTION/);
  assert.match(schema, /ROLLBACK TRANSACTION/);
  for (const table of [
    "favorites",
    "company_settings",
    "push_devices",
    "push_outbox",
  ])
    assert.ok(migration.includes("CREATE TABLE dbo." + table));
  assert.match(migration, /VALUES\(4\)/);
});
