import test from "node:test";
import assert from "node:assert/strict";
import { withOfflineData } from "../../packages/mobile/src/offlineClient.js";
const failure = () =>
  Object.assign(new Error("offline"), { code: "unavailable" });
function setup() {
  let online = true,
    uid = "a",
    saved = [],
    calls = 0;
  const values = new Map();
  const store = {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => values.set(key, structuredClone(value)),
    remove: async (key) => values.delete(key),
  };
  const base = {
    offlineIdentity: async () => uid,
    current: async () => ({ id: uid, role: "Cliente" }),
    login: async () => ({ id: uid, role: "Cliente" }),
    logout: async () => {
      uid = null;
    },
    products: async () => {
      calls++;
      return [{ id: "1", name: "Riel", code: "10" }];
    },
    orders: async () => [{ id: "x", status: "Solicitado" }],
    product: async () => ({ id: "1", name: "Riel" }),
    profile: async () => ({ name: "Antes" }),
    saveProfile: async (body) => {
      saved.push(body);
    },
    assistant: async () => ({ answer: "ok" }),
  };
  const client = withOfflineData(base, store, async () => online);
  return {
    client,
    base,
    saved,
    store,
    calls: () => calls,
    setOnline: (value) => {
      online = value;
    },
    setUid: (value) => {
      uid = value;
    },
  };
}
test("Reabre sesión y consulta catálogo descargado sin hacer peticiones", async () => {
  const s = setup();
  await s.client.current();
  await s.client.products();
  s.setOnline(false);
  assert.equal((await s.client.current()).id, "a");
  assert.equal((await s.client.products("rie")).length, 1);
  assert.equal(s.calls(), 1);
  assert.equal((await s.client.product("1")).name, "Riel");
});
test("Caché y sesión no se comparten entre cuentas ni después de salir", async () => {
  const s = setup();
  await s.client.current();
  await s.client.products();
  s.setOnline(false);
  s.setUid("b");
  assert.equal(await s.client.current(), null);
  await assert.rejects(s.client.products(), /Sin conexión/);
  s.setUid("a");
  await s.client.logout();
  assert.equal(await s.client.current(), null);
});
test("Guarda perfil sin conexión y sincroniza una sola vez al volver", async () => {
  const s = setup();
  await s.client.current();
  await s.client.profile();
  s.setOnline(false);
  await s.client.saveProfile({ name: "Nuevo", phone: "9991234567" });
  assert.equal(s.saved.length, 0);
  assert.equal((await s.client.profile()).name, "Nuevo");
  s.setOnline(true);
  await Promise.all([s.client.syncOffline(), s.client.syncOffline()]);
  assert.equal(s.saved.length, 1);
  await s.client.syncOffline();
  assert.equal(s.saved.length, 1);
});
test("Permisos denegados no se ocultan con caché anterior", async () => {
  const s = setup();
  await s.client.products();
  s.base.products = async () => {
    throw Object.assign(new Error("denied"), { code: "permission-denied" });
  };
  await assert.rejects(s.client.products(), /denied/);
});
test("Fallo de red usa caché, primer login y asistente requieren internet", async () => {
  const s = setup();
  await s.client.products();
  s.base.products = async () => {
    throw failure();
  };
  assert.equal((await s.client.products()).length, 1);
  s.setOnline(false);
  await assert.rejects(s.client.login("a", "b"), /primer inicio/);
  await assert.rejects(s.client.assistant("hola"), /necesita internet/);
});
test("Un cambio de cuenta durante la consulta impide guardar o mostrar datos mezclados", async () => {
  const s = setup();
  s.base.products = async () => {
    s.setUid("b");
    return [{ id: "privado" }];
  };
  await assert.rejects(s.client.products(), /sesión cambió/);
  s.setOnline(false);
  await assert.rejects(s.client.products(), /Sin conexión/);
});
test("Un snapshot temporal vacío no borra los encargos descargados", async () => {
  let connected = true,
    receive;
  const values = new Map();
  const store = {
    get: async (k) => values.get(k) ?? null,
    set: async (k, v) => values.set(k, v),
    remove: async (k) => values.delete(k),
  };
  const base = {
    offlineIdentity: async () => "a",
    orders: async () => [{ id: "guardado" }],
    subscribeOrders: (_status, callback) => {
      receive = callback;
      return () => {};
    },
  };
  const client = withOfflineData(base, store, async () => connected);
  await client.orders();
  connected = false;
  const stop = client.subscribeOrders("", () => {});
  await receive([], { fromCache: true });
  await new Promise((r) => setImmediate(r));
  assert.equal((await client.orders())[0].id, "guardado");
  stop();
});
