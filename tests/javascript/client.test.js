import test from "node:test";
import assert from "node:assert/strict";
import {
  apiUrl,
  createClient,
  allowedRole,
} from "../../packages/client/src/index.js";
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function memoryStorage(initial = null) {
  let value = initial;
  return {
    get: async () => value,
    save: async (token) => {
      value = token;
    },
    clear: async () => {
      value = null;
    },
  };
}
const loginResponse = (token) =>
  new Response(
    JSON.stringify({ accessToken: token, user: { id: "1", role: "Cliente" } }),
    { status: 200 },
  );
test("URL solo acepta HTTPS sin credenciales ni parámetros", () => {
  for (const value of [
    "",
    null,
    "http://localhost/",
    "https://user:password@localhost/",
    "https://localhost/?key=x/",
    "https://localhost/#x/",
    "https://localhost",
  ])
    assert.equal(apiUrl(value), null);
  assert.equal(apiUrl("https://localhost:5180/").protocol, "https:");
});
test("Apps empresa y comprador tienen roles separados", () => {
  assert.equal(allowedRole("empresa", "Cliente"), false);
  assert.equal(allowedRole("cliente", "Administrador"), false);
  assert.equal(allowedRole("empresa", "Operador"), true);
  assert.equal(allowedRole("cliente", "Cliente"), true);
});
test("HTTP se rechaza antes de enviar datos", async () => {
  const client = createClient({
    baseUrl: "http://localhost/",
    storage: { get: () => assert.fail("No leer token") },
    fetchImpl: () => assert.fail("No conectar"),
  });
  await assert.rejects(
    client.login("test@integration.invalid", "test-password-123", "cliente"),
    { status: 503 },
  );
});
test("Cuenta de otro tipo se revoca y no se guarda", async () => {
  const calls = [],
    storage = {
      get: async () => null,
      save: () => assert.fail("No guardar cuenta ajena"),
      clear: async () => {},
    };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      calls.length === 1
        ? JSON.stringify({
            accessToken: "A".repeat(64),
            user: { role: "Cliente" },
          })
        : null,
      { status: calls.length === 1 ? 200 : 204 },
    );
  };
  const client = createClient({
    baseUrl: "https://api.integration.invalid/",
    storage,
    fetchImpl,
  });
  await assert.rejects(
    client.login("test@integration.invalid", "test-password-123", "empresa"),
    { status: 403 },
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(
    calls[1].options.headers.Authorization,
    `Bearer ${"A".repeat(64)}`,
  );
});
test("No conserva sesión si falla SecureStore", async () => {
  let count = 0,
    cleared = false;
  const client = createClient({
    baseUrl: "https://api.integration.invalid/",
    storage: {
      get: async () => null,
      save: async () => {
        throw Error("fallo");
      },
      clear: async () => {
        cleared = true;
      },
    },
    fetchImpl: async () => {
      count++;
      return new Response(
        count === 1
          ? JSON.stringify({
              accessToken: "B".repeat(64),
              user: { role: "Cliente" },
            })
          : null,
        { status: count === 1 ? 200 : 204 },
      );
    },
  });
  await assert.rejects(
    client.login("test@integration.invalid", "test-password-123", "cliente"),
    { status: 503 },
  );
  assert.equal(count, 2);
  assert.equal(cleared, true);
});
test("Error de cierre limpia sesión local y se comunica al usuario", async () => {
  let cleared = false;
  const client = createClient({
    baseUrl: "https://api.integration.invalid/",
    storage: {
      get: async () => "A".repeat(64),
      clear: async () => {
        cleared = true;
      },
    },
    fetchImpl: async () => {
      throw Error("sin red");
    },
  });
  await assert.rejects(client.logout(), { status: 503 });
  assert.equal(cleared, true);
});
test("Respuesta 401 anterior no borra ni cierra una sesión nueva", async () => {
  const waiting = deferred(),
    started = deferred(),
    storage = memoryStorage("A".repeat(64));
  const client = createClient({
    baseUrl: "https://api.integration.invalid/",
    storage,
    fetchImpl: async (url) => {
      if (url.includes("/products")) {
        started.resolve();
        return waiting.promise;
      }
      return loginResponse("B".repeat(64));
    },
  });
  const products = client.products("").catch((error) => error);
  await started.promise;
  await client.login("buyer@example.invalid", "valid-password-123", "cliente");
  waiting.resolve(
    new Response(JSON.stringify({ error: "Sesión vencida" }), { status: 401 }),
  );
  assert.equal((await products).status, 409);
  assert.equal(await storage.get(), "B".repeat(64));
});
test("Login atrasado se revoca sin borrar el login más reciente", async () => {
  const waiting = deferred(),
    started = deferred(),
    storage = memoryStorage(),
    revoked = [];
  let calls = 0;
  const client = createClient({
    baseUrl: "https://api.integration.invalid/",
    storage,
    fetchImpl: async (url, options) => {
      if (url.endsWith("/logout")) {
        revoked.push(options.headers.Authorization);
        return new Response(null, { status: 204 });
      }
      if (++calls === 1) {
        started.resolve();
        return waiting.promise;
      }
      return loginResponse("B".repeat(64));
    },
  });
  const first = client
    .login("first@example.invalid", "valid-password-123", "cliente")
    .catch((error) => error);
  await started.promise;
  await client.login("second@example.invalid", "valid-password-123", "cliente");
  waiting.resolve(loginResponse("A".repeat(64)));
  assert.equal((await first).status, 503);
  assert.equal(await storage.get(), "B".repeat(64));
  assert.deepEqual(revoked, ["Bearer " + "A".repeat(64)]);
});
test("Logout pendiente revoca el token anterior y conserva un nuevo acceso", async () => {
  const waiting = deferred(),
    started = deferred(),
    storage = memoryStorage("A".repeat(64));
  let sent;
  const client = createClient({
    baseUrl: "https://api.integration.invalid/",
    storage,
    fetchImpl: async (url, options) => {
      if (url.endsWith("/logout")) {
        sent = options.headers.Authorization;
        started.resolve();
        return waiting.promise;
      }
      return loginResponse("B".repeat(64));
    },
  });
  const logout = client.logout();
  await started.promise;
  await client.login("buyer@example.invalid", "valid-password-123", "cliente");
  waiting.resolve(new Response(null, { status: 204 }));
  await logout;
  assert.equal(sent, "Bearer " + "A".repeat(64));
  assert.equal(await storage.get(), "B".repeat(64));
});

test("El registro exige que la API confirme una cuenta de comprador", async () => {
  let response;
  const client = createClient({
    baseUrl: "https://api.integration.invalid/",
    storage: memoryStorage(),
    fetchImpl: async () => response,
  });
  response = new Response("<html>OK</html>", { status: 200 });
  await assert.rejects(client.register({}), { status: 502 });
  response = Response.json(
    { id: "24", role: "Administrador" },
    { status: 201 },
  );
  await assert.rejects(client.register({}), { status: 502 });
  response = Response.json({ id: "24", role: "Cliente" }, { status: 201 });
  assert.equal((await client.register({})).id, "24");
});
