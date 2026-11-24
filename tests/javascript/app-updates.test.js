import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canAttemptNetwork } from "../../packages/mobile/src/networkState.js";

async function setup(options = {}) {
  const alerts = [],
    effects = [];
  let downloads = 0,
    reloads = 0,
    appListener,
    networkListener,
    status;
  const network = {
    type: "CELLULAR",
    isConnected: true,
    isInternetReachable: true,
    ...options.network,
  };
  const native = { ...options.native };
  const updates = {
    isEnabled: true,
    updateId: "installed-version",
    useUpdates: () => native,
    checkForUpdateAsync: async () => ({ isAvailable: true }),
    fetchUpdateAsync: async () => {
      downloads++;
      return options.fetch
        ? options.fetch()
        : { isNew: true, manifest: { id: "new-version" } };
    },
    reloadAsync: async () => {
      reloads++;
      if (options.reloadFails) throw new Error("reload");
    },
    ...options.updates,
  };
  globalThis.__updateTest = {
    canAttemptNetwork,
    useRef: (value) => ({ current: value }),
    useState: (value) => [
      value,
      (next) => {
        status = next;
      },
    ],
    useEffect: (fn) => {
      const cleanup = fn();
      if (cleanup) effects.push(cleanup);
    },
    Alert: { alert: (...args) => alerts.push(args) },
    AppState: {
      addEventListener: (_event, cb) => {
        appListener = cb;
        return { remove() {} };
      },
    },
    Updates: updates,
    Network: {
      NetworkStateType: { WIFI: "WIFI" },
      getNetworkStateAsync: async () => network,
      addNetworkStateListener: (cb) => {
        networkListener = cb;
        return { remove() {} };
      },
    },
  };
  let source = await readFile("packages/mobile/src/useAppUpdates.js", "utf8");
  source = source.replace(/import[^;]+;/g, "");
  source =
    "const {canAttemptNetwork,useEffect,useState,useRef,Alert,AppState,Updates,Network}=globalThis.__updateTest;\n" +
    source;
  const mod = await import(
    "data:text/javascript;base64," +
      Buffer.from(source + "\n//" + Math.random()).toString("base64")
  );
  const controls = mod.useAppUpdates();
  await new Promise((resolve) => setImmediate(resolve));
  return {
    alerts,
    native,
    network,
    controls,
    status: () => status,
    downloads: () => downloads,
    reloads: () => reloads,
    resume: () => appListener("active"),
    networkEvent: () => networkListener(network),
    cleanup: () => effects.forEach((fn) => fn()),
  };
}
const press = (s, text, index = 0) =>
  s.alerts[index][2].find((button) => button.text === text).onPress();

test("Solicita permiso con datos y solo ofrece aplicar después de una descarga nueva", async () => {
  const s = await setup();
  assert.match(s.alerts[0][1], /datos móviles/);
  assert.equal(s.downloads(), 0);
  await press(s, "Descargar");
  assert.equal(s.status().phase, "ready");
  assert.equal(s.downloads(), 1);
  await press(s, "Aplicar ahora", 1);
  assert.equal(s.reloads(), 1);
  s.cleanup();
});
test("Posponer no descarga ni consume datos de la actualización", async () => {
  const s = await setup();
  press(s, "Después");
  assert.equal(s.downloads(), 0);
  s.cleanup();
});
test("Alcance negativo con enlace Wi-Fi permite consultar actualizaciones", async () => {
  const s = await setup({
    network: { type: "WIFI", isInternetReachable: false },
  });
  assert.equal(s.alerts[0][0], "Actualización disponible");
  s.cleanup();
});
test("fetch isNew false no anuncia actualización lista ni permite aplicar", async () => {
  const s = await setup({ fetch: async () => ({ isNew: false }) });
  await press(s, "Descargar");
  assert.equal(s.status().phase, "error");
  assert.equal(s.alerts.length, 1);
  await s.controls.apply();
  assert.equal(s.reloads(), 0);
  await s.controls.check();
  assert.equal(s.alerts.length, 2);
  s.cleanup();
});
test("Una actualización ya descargada se puede aplicar sin internet ni otra descarga", async () => {
  const s = await setup({
    network: { isConnected: false },
    native: { isUpdatePending: true },
  });
  assert.equal(s.status().phase, "ready");
  assert.equal(s.alerts.length, 0);
  await s.controls.apply();
  assert.equal(s.reloads(), 1);
  assert.equal(s.downloads(), 0);
  s.cleanup();
});
test("Descarga fallida permite reintentar inmediatamente sin avisar éxito", async () => {
  const s = await setup({
    fetch: async () => {
      throw new Error("network");
    },
  });
  await press(s, "Descargar");
  assert.equal(s.status().phase, "error");
  assert.equal(s.alerts.length, 1);
  await s.controls.check();
  assert.equal(s.alerts.length, 2);
  s.cleanup();
});
test("Si Wi-Fi cambia a datos vuelve a pedir permiso sin descargar", async () => {
  const s = await setup({ network: { type: "WIFI" } });
  s.network.type = "CELLULAR";
  await press(s, "Descargar");
  assert.equal(s.downloads(), 0);
  assert.equal(s.status().phase, "error");
  await s.controls.check();
  assert.match(s.alerts[1][1], /datos móviles/);
  s.cleanup();
});
test("Descargas simultáneas y eventos de red no duplican el trabajo", async () => {
  let finish;
  const s = await setup({
    fetch: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const first = press(s, "Descargar");
  await new Promise((resolve) => setImmediate(resolve));
  await press(s, "Descargar");
  s.resume();
  s.networkEvent();
  assert.equal(s.downloads(), 1);
  assert.equal(s.alerts.length, 1);
  finish({ isNew: true });
  await first;
  s.resume();
  assert.equal(s.status().phase, "ready");
  s.cleanup();
});
test("Un reinicio fallido conserva Aplicar y permite otro intento", async () => {
  const s = await setup({
    native: { isUpdatePending: true },
    reloadFails: true,
  });
  await s.controls.apply();
  assert.equal(s.status().phase, "ready");
  await s.controls.apply();
  assert.equal(s.reloads(), 2);
  s.cleanup();
});
test("Cierre durante una descarga no muestra diálogos ni reinicia después", async () => {
  let finish;
  const s = await setup({
    fetch: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const first = press(s, "Descargar");
  await new Promise((resolve) => setImmediate(resolve));
  s.cleanup();
  finish({ isNew: true });
  await first;
  assert.equal(s.alerts.length, 1);
  assert.equal(s.reloads(), 0);
});
