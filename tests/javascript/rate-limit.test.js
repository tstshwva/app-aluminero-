import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimit } from "../../server/src/rate-limit.js";
test("Límite de solicitudes cuenta por clave, vence y acota la memoria", () => {
  let time = 0;
  const limit = createRateLimit({
    limit: 2,
    windowMs: 60000,
    maxKeys: 2,
    now: () => time,
  });
  assert.equal(limit("a").allowed, true);
  assert.equal(limit("a").allowed, true);
  assert.deepEqual(limit("a"), { allowed: false, retryAfter: 60 });
  assert.equal(limit("b").allowed, true);
  assert.equal(limit("c").allowed, false);
  time = 60000;
  assert.equal(limit("c").allowed, true);
  assert.equal(limit("a").allowed, true);
});
