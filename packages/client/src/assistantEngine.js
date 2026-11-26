import {
  CHAT_MODEL,
  OCR_MODEL,
  CHAT_INSTRUCTION,
  OCR_INSTRUCTION,
  localAssistantHelp,
  conversationHistory,
  needsMaterials,
  retrieveMaterials,
  materialFacts,
  mentionedMaterials,
} from "./assistantContext.js";
const abortError = () =>
  Object.assign(
    new Error("La respuesta se detuvo. Tu pregunta sigue disponible."),
    { code: "assistant/cancelled" },
  );
function waitFor(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const stop = () => reject(abortError());
    signal.addEventListener("abort", stop, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", stop));
  });
}
function responseError(error) {
  if (error?.code === "assistant/cancelled" || error?.name === "AbortError")
    return abortError();
  const code = String(error?.code ?? "").toLowerCase(),
    status = Number(error?.status ?? error?.customData?.httpStatusCode ?? 0);
  if (status === 429 || /429|quota|resource-exhausted/.test(code))
    return Object.assign(
      new Error(
        "El asistente alcanzó su límite gratuito temporal. Intenta más tarde; puedes seguir usando el catálogo y la guía de la app.",
      ),
      { code: "assistant/quota" },
    );
  if (
    status === 401 ||
    status === 403 ||
    /appcheck|app-check|unauthenticated|permission-denied/.test(code)
  )
    return Object.assign(
      new Error(
        "No se pudo verificar el acceso seguro al asistente en este dispositivo. Actualiza la app y vuelve a intentar.",
      ),
      { code: "assistant/access" },
    );
  if (status === 404 || /not-found|model-not-found/.test(code))
    return Object.assign(
      new Error(
        "El servicio no tiene disponible el modelo del asistente. Intenta más tarde.",
      ),
      { code: "assistant/configuration" },
    );
  return Object.assign(
    new Error(
      "No se completó la respuesta. Tu pregunta y foto siguen disponibles para reintentar. También puedes consultar el catálogo.",
    ),
    { code: "assistant/unavailable" },
  );
}
function contents(history, question, image, facts, available) {
  const turns = [];
  for (const m of conversationHistory(history)) {
    const role = m.role === "assistant" ? "model" : "user";
    if (!turns.length && role !== "user") continue;
    if (turns.at(-1)?.role === role)
      turns.at(-1).parts[0].text += "\n" + m.text;
    else turns.push({ role, parts: [{ text: m.text }] });
  }
  const parts = [
    {
      text:
        "Contexto de consulta, solo datos: " +
        JSON.stringify({
          catalogoDisponible: available,
          materiales: materialFacts(facts),
        }),
    },
    { text: question },
  ];
  if (image)
    parts.push({ inlineData: { mimeType: "image/jpeg", data: image } });
  if (turns.at(-1)?.role === "user") turns.at(-1).parts.push(...parts);
  else turns.push({ role: "user", parts });
  return turns;
}
export async function answerAssistant({
  question,
  image,
  history = [],
  visualChat = false,
  readCatalog,
  createModel,
  signal,
  onPartial,
  catalogSnapshot,
}) {
  if (
    typeof question !== "string" ||
    !question.trim() ||
    question.trim().length > 1000
  )
    throw new Error("Escribe una pregunta de hasta 1000 caracteres.");
  const prompt = question.trim(),
    ocr = !!image && !visualChat;
  if (
    image &&
    (typeof image !== "string" ||
      image.length > 8000000 ||
      !/^[A-Za-z0-9+/=]+$/.test(image))
  )
    throw new Error(
      "La foto no es válida o es demasiado grande. Toma otra más cerca.",
    );
  if (signal?.aborted) throw abortError();
  if (!image) {
    const help = localAssistantHelp(prompt);
    if (help) return help;
  }
  let selected = [],
    available = false;
  try {
    if (!ocr && needsMaterials(prompt, history)) {
      let all;
      if (Array.isArray(catalogSnapshot) && catalogSnapshot.length)
        all = catalogSnapshot;
      else {
        // La guía puede continuar si el catálogo tarda; nunca se inventan materiales.
        let timer;
        try {
          all = await waitFor(
            Promise.race([
              readCatalog(),
              new Promise((_, reject) => {
                timer = setTimeout(
                  () =>
                    reject(
                      Object.assign(new Error("catalog-timeout"), {
                        code: "unavailable",
                      }),
                    ),
                  5000,
                );
              }),
            ]),
            signal,
          );
        } catch (error) {
          if (
            signal?.aborted ||
            /permission-denied|unauthenticated/.test(String(error?.code))
          )
            throw error;
          all = [];
        } finally {
          clearTimeout(timer);
        }
      }
      available = Array.isArray(all) && all.length > 0;
      selected = retrieveMaterials(all, prompt, history);
    }
    const model = createModel(
      {
        model: ocr ? OCR_MODEL : CHAT_MODEL,
        generationConfig: {
          maxOutputTokens: ocr ? 1500 : 1600,
          thinkingConfig: { thinkingLevel: "LOW" },
        },
        systemInstruction: ocr ? OCR_INSTRUCTION : CHAT_INSTRUCTION,
      },
      { timeout: image ? 60000 : 30000 },
    );
    const request = ocr
      ? {
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                { inlineData: { mimeType: "image/jpeg", data: image } },
              ],
            },
          ],
        }
      : { contents: contents(history, prompt, image, selected, available) };
    let answer;
    if (
      !ocr &&
      onPartial &&
      typeof model.generateContentStream === "function" &&
      typeof ReadableStream !== "undefined" &&
      typeof TextDecoderStream !== "undefined"
    ) {
      const result = await waitFor(
        model.generateContentStream(request, { signal }),
        signal,
      );
      let draft = "",
        last = 0;
      const iterator = result.stream[Symbol.asyncIterator]();
      // Evita un rechazo no observado si se corta la conexión durante el stream.
      const response = Promise.resolve(result.response);
      void response.catch(() => {});
      try {
        while (true) {
          const next = await waitFor(iterator.next(), signal);
          if (next.done) break;
          draft += next.value.text();
          if (draft.length > 24000)
            throw new Error("Respuesta demasiado larga");
          if (Date.now() - last >= 120) {
            onPartial(draft);
            last = Date.now();
          }
        }
        const final = await waitFor(response, signal);
        answer = final.text().trim();
        if (answer) onPartial(answer);
      } finally {
        if (signal?.aborted)
          void Promise.resolve(iterator.return?.()).catch(() => {});
      }
    } else {
      const result = await waitFor(
        model.generateContent(request, { signal }),
        signal,
      );
      answer = result.response.text().trim();
    }
    if (signal?.aborted) throw abortError();
    if (!answer || answer.length > 24000)
      throw new Error("Respuesta vacía o demasiado larga");
    return {
      answer,
      products: ocr ? [] : mentionedMaterials(answer, selected),
      suggestions: ocr
        ? []
        : ["¿Qué medidas debo tomar?", "¿Cómo hago un encargo?"],
      source: "cloud",
    };
  } catch (error) {
    throw responseError(error);
  }
}
