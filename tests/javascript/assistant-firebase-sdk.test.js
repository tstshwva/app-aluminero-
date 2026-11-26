import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { initializeAppCheck, CustomProvider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { answerAssistant } from "../../packages/client/src/assistantEngine.js";

test("El SDK real de Firebase envía chat multimodal con App Check y procesa SSE", async () => {
  const original = globalThis.fetch;
  let request;
  const app = initializeApp(
    {
      projectId: "test-aluformix",
      apiKey: "test-only-api-key",
      appId: "1:2:android:test",
    },
    "assistant-test-" + Date.now(),
  );
  initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: async () => ({
        token: "test-only-appcheck",
        expireTimeMillis: Date.now() + 3600000,
      }),
    }),
    isTokenAutoRefreshEnabled: false,
  });
  globalThis.fetch = async (url, options) => {
    request = {
      url: String(url),
      body: JSON.parse(options.body),
      headers: new Headers(options.headers),
    };
    const chunk = (text) =>
      "data: " +
      JSON.stringify({
        candidates: [
          {
            content: { role: "model", parts: [{ text }] },
            finishReason: "STOP",
            index: 0,
          },
        ],
      }) +
      "\n\n";
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(chunk("Mide primero el ancho ")),
          );
          controller.enqueue(
            new TextEncoder().encode(chunk("y el alto de tu ventana.")),
          );
          controller.close();
        },
      }),
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    );
  };
  try {
    const partial = [];
    const result = await answerAssistant({
      question: "¿Qué debo medir para mi ventana?",
      image: "Zm90bw==",
      visualChat: true,
      catalogSnapshot: [
        { id: "p", name: "Riel", code: "101", active: 1, unit: "barra" },
      ],
      history: [
        { role: "user", text: "Quiero una ventana" },
        { role: "assistant", text: "¿Corrediza?" },
      ],
      onPartial: (text) => partial.push(text),
      createModel: (settings, options) =>
        getGenerativeModel(
          getAI(app, { backend: new GoogleAIBackend() }),
          settings,
          { ...options, baseUrl: "https://firebase-unit.invalid" },
        ),
    });
    assert.match(request.url, /gemini-3.8-flash:streamGenerateContent/);
    assert.equal(
      request.headers.get("X-Firebase-AppCheck"),
      "test-only-appcheck",
    );
    assert.deepEqual(
      request.body.contents.map((c) => c.role),
      ["user", "model", "user"],
    );
    assert.equal(
      request.body.contents.at(-1).parts.at(-1).inlineData.mimeType,
      "image/jpeg",
    );
    assert.equal(
      request.body.generationConfig.thinkingConfig.thinkingLevel,
      "LOW",
    );
    assert.equal(
      result.answer,
      "Mide primero el ancho y el alto de tu ventana.",
    );
    assert.equal(partial.at(-1), result.answer);
  } finally {
    globalThis.fetch = original;
    await deleteApp(app);
  }
});
