import test from "node:test";
import assert from "node:assert/strict";
import { readStaffOverHttps } from "../../packages/client/src/staffLookup.js";
const user = { uid: "account-1", getIdToken: async () => "test-token" };
test("Consulta HTTPS usa el token del usuario y acepta solo rol confirmado", async () => {
 const staff = await readStaffOverHttps("project", user, async (url, options) => {
  assert.match(url, /aluf_staff\/account-1$/);
  assert.equal(options.headers.Authorization, "Bearer test-token");
  return { ok: true, json: async () => ({ fields: { active: { booleanValue: true }, role: { stringValue: "Operador" } } }) };
 });
 assert.deepEqual(staff, { active: true, role: "Operador" });
});
test("Cuenta sin documento no obtiene acceso de Empresa", async () => {
 assert.equal(await readStaffOverHttps("project", user, async () => ({ status: 404 })), null);
});
test("Rechazo de permisos nunca concede acceso", async () => {
 await assert.rejects(readStaffOverHttps("project", user, async () => ({ status: 403, ok: false })), { code: "permission-denied" });
});
