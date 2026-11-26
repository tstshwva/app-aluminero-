import test from "node:test";
import assert from "node:assert/strict";
import { readWithDeadline } from "../../packages/client/src/readDeadline.js";
import { withOfflineData } from "../../packages/mobile/src/offlineClient.js";

test("Una lectura bloqueada vence el plazo y permite una lectura posterior", async () => {
  await assert.rejects(
    readWithDeadline(() => new Promise(() => {}), 10),
    { code: "deadline-exceeded" },
  );
  assert.equal(
    await readWithDeadline(async () => "recuperado", 50),
    "recuperado",
  );
});

test("Permisos denegados se conservan y no se convierten en fallo de conexión", async () => {
  const error = Object.assign(new Error("denied"), {
    code: "permission-denied",
  });
  await assert.rejects(
    readWithDeadline(() => {
      throw error;
    }, 50),
    (e) => e === error,
  );
});

test("Lectura tardía usa caché propia sin sobrescribirla y reconecta después", async () => {
  let fail = false,
    finish;
  const values = new Map();
  const store = {
    get: async (k) => values.get(k) ?? null,
    set: async (k, v) => values.set(k, v),
  };
  const base = {
    offlineIdentity: async () => "owner",
    products: () =>
      readWithDeadline(
        () =>
          fail
            ? new Promise((resolve) => {
                finish = resolve;
              })
            : [{ id: "actual" }],
        10,
      ),
  };
  const client = withOfflineData(base, store, async () => true);
  assert.equal((await client.products())[0].id, "actual");
  fail = true;
  assert.equal((await client.products())[0].id, "actual");
  finish([{ id: "tardio" }]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok([...values.values()].every((v) => v[0].id === "actual"));
  fail = false;
  assert.equal((await client.products())[0].id, "actual");
});
