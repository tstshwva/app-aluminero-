import test from "node:test";
import assert from "node:assert/strict";
import { canAttemptNetwork } from "../../packages/mobile/src/networkState.js";

test("Una prueba de alcance negativa no bloquea Firebase en Wi-Fi o datos", () => {
  for (const type of ["WIFI", "CELLULAR"]) {
    assert.equal(
      canAttemptNetwork({
        type,
        isConnected: true,
        isInternetReachable: false,
      }),
      true,
    );
  }
});
test("Sin enlace se conserva el modo sin conexión; un estado desconocido permite intentar", () => {
  assert.equal(canAttemptNetwork({ type: "NONE" }), false);
  assert.equal(canAttemptNetwork({ isConnected: false }), false);
  assert.equal(canAttemptNetwork({ isConnected: null }), true);
});
