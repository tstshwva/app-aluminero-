import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import React, { act } from "react";
import Renderer from "react-test-renderer";
import { canAttemptNetwork } from "../../packages/mobile/src/networkState.js";
const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
async function mount({
  wifiOnly = false,
  fail = false,
  connected = true,
  reachable = false,
  type = "WIFI",
} = {}) {
  const values = new Map();
  const sent = [];
  let notify, result, tree;
  const state = {
    type,
    isConnected: connected,
    isInternetReachable: reachable,
  };
  globalThis.__outbox = {
    canAttemptNetwork,
    Platform: { OS: "android" },
    AppState: { addEventListener: () => ({ remove() {} }) },
    Network: {
      getNetworkStateAsync: async () => state,
      NetworkStateType: { WIFI: "WIFI" },
      addNetworkStateListener: (cb) => {
        notify = cb;
        return { remove() {} };
      },
    },
    SecureStore: {
      getItemAsync: async (k) =>
        k === "aluformix.orders.wifi" ? String(wifiOnly) : null,
      setItemAsync: async (k, v) => {
        if (k === "aluformix.orders.wifi") wifiOnly = v === "true";
      },
      deleteItemAsync: async () => {},
    },
  };
  let source = await readFile("packages/mobile/src/orderOutbox.js", "utf8");
  source = source
    .replace(
      'from "react";',
      'from "' + pathToFileURL(require.resolve("react")).href + '";',
    )
    .replace(
      /import[^;]+from "(react-native|expo-network|expo-secure-store|\.\/networkState)";/g,
      "",
    );
  source =
    "const {canAttemptNetwork,Platform,AppState,Network,SecureStore}=globalThis.__outbox;\n" +
    source;
  const { useOrderOutbox } = await import(
    "data:text/javascript;base64," +
      Buffer.from(source + "\n//" + Math.random()).toString("base64")
  );
  const client = {
    offlineStore: {
      get: async (k) => values.get(k) ?? null,
      set: async (k, v) => values.set(k, structuredClone(v)),
    },
    createOrder: async (order) => {
      if (fail) throw new Error("network");
      sent.push(order);
    },
  };
  function Harness() {
    result = useOrderOutbox(client, "owner-a", true);
    return null;
  }
  const flush = async () =>
    act(async () => {
      for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
    });
  await act(async () => {
    tree = Renderer.create(React.createElement(Harness));
  });
  await flush();
  return {
    sent,
    state,
    values,
    flush,
    get: () => result,
    network: () => notify(),
    close: () => act(async () => tree.unmount()),
  };
}
test("Pedidos sincronizan con enlace activo aunque falle la prueba de alcance", async () => {
  const s = await mount();
  await act(async () =>
    s.get().actions.enqueue({ requestKey: "one", items: [{ productId: "p" }] }),
  );
  await s.flush();
  assert.equal(s.sent.length, 1);
  assert.equal(s.sent[0].expectedOwnerUid, "owner-a");
  assert.equal(s.get().pending.length, 0);
  await s.close();
});
test("Solo Wi-Fi conserva el pedido con datos y lo envía al volver a Wi-Fi", async () => {
  const s = await mount({ wifiOnly: true, type: "CELLULAR" });
  await act(async () => s.get().actions.enqueue({ requestKey: "one" }));
  await s.flush();
  assert.equal(s.sent.length, 0);
  assert.equal(s.get().pending.length, 1);
  s.state.type = "WIFI";
  await act(async () => s.network());
  await s.flush();
  assert.equal(s.sent.length, 1);
  await s.close();
});
test("Un envío fallido mantiene el pedido guardado para reintentar", async () => {
  const s = await mount({ fail: true });
  await act(async () => s.get().actions.enqueue({ requestKey: "one" }));
  await s.flush();
  assert.equal(s.get().pending.length, 1);
  assert.equal(s.get().syncError, true);
  await s.close();
});
