import test from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import {
  hashPassword,
  verifyPassword,
  token,
  tokenHash,
} from "../../server/src/crypto.js";
test("Scrypt protege y verifica contraseñas, sin guardar texto", async () => {
  const password = "Contraseña-de-integración-123";
  const hash = await hashPassword(password);
  assert.ok(hash.startsWith("scrypt$"));
  assert.ok(!hash.includes(password));
  assert.equal(await verifyPassword(hash, password), true);
  assert.equal(await verifyPassword(hash, "otra"), false);
  assert.equal(
    await verifyPassword("scrypt$999999999$8$1$aa$bb", password),
    false,
  );
});
test("Compatible con el formato ASP.NET Identity V3 anterior", async () => {
  const password = "Cuenta-anterior-de-prueba-123",
    salt = randomBytes(16),
    key = pbkdf2Sync(password, salt, 220000, 32, "sha512");
  const head = Buffer.alloc(13);
  head[0] = 1;
  head.writeUInt32BE(2, 1);
  head.writeUInt32BE(220000, 5);
  head.writeUInt32BE(16, 9);
  const hash = Buffer.concat([head, salt, key]).toString("base64");
  assert.equal(await verifyPassword(hash, password), true);
  assert.equal(await verifyPassword(hash, "incorrecta"), false);
});
test("Tokens aleatorios de 256 bits y hash distinto del original", () => {
  const a = token(),
    b = token();
  assert.match(a, /^[A-F0-9]{64}$/);
  assert.notEqual(a, b);
  assert.notEqual(tokenHash(a), a);
});
