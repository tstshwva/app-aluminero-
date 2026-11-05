import test from "node:test";
import assert from "node:assert/strict";
import { createAssistant } from "../../server/src/assistant.js";
test("IA requiere configuración externa y no entrega secretos al cliente", async () => {
  assert.equal(createAssistant({}), null);
  let sent;
  const assistant = createAssistant(
    {
      GEMINI_API_KEY: "test-only-not-a-real-secret",
      GEMINI_MODEL: "model-test",
    },
    async (url, options) => {
      sent = { url, options };
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: "Revisa el perfil del catálogo." }] },
            },
          ],
        }),
      };
    },
  );
  const result = await assistant("Necesito un perfil", [
    { code: "P-01", name: "Perfil" },
  ]);
  assert.equal(result.answer, "Revisa el perfil del catálogo.");
  assert.equal(
    sent.options.headers["x-goog-api-key"],
    "test-only-not-a-real-secret",
  );
  assert.ok(!sent.url.includes("test-only-not-a-real-secret"));
  assert.equal(sent.options.redirect, "error");
  assert.ok(!JSON.stringify(result).includes("secret"));
  await assert.rejects(
    () => assistant("Otra consulta", []),
    (e) => e.status === 429,
  );
});
test("Fallo del proveedor de IA se comunica sin simular respuesta", async () => {
  const assistant = createAssistant(
    { GEMINI_API_KEY: "test", GEMINI_MODEL: "model-test" },
    async () => ({ ok: false }),
  );
  await assert.rejects(
    () => assistant("Consulta", []),
    (e) => e.status === 503,
  );
});
