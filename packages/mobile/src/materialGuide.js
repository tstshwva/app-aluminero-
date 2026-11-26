import { matchList, normalizeText } from "@aluformix/catalog";
import {
  localAssistantHelp,
  retrieveMaterials,
} from "../../client/src/assistantContext.js";

const cancelled = () =>
  Object.assign(new Error("Consulta detenida."), {
    code: "assistant/cancelled",
  });
const result = (answer, products = [], suggestions = []) => ({
  answer,
  products,
  suggestions,
  source: "local",
});
const cards = (products) =>
  products.slice(0, 6).map((p) => ({
    id: String(p.id),
    code: String(p.code),
    name: String(p.name),
    unit: String(p.unit ?? ""),
    review: p.assistantReview === true,
  }));

// No usa fetch, Firebase AI, claves, fotos base64 ni un modelo generativo.
export function withMaterialGuide(base) {
  return {
    ...base,
    assistantMode: "local-ocr",
    async assistant(question, image, history = [], options = {}) {
      if (options.signal?.aborted) throw cancelled();
      const uid = await base.offlineIdentity();
      if (!uid) throw new Error("Inicia sesión para continuar.");
      if (
        typeof question !== "string" ||
        !question.trim() ||
        question.trim().length > 1000
      )
        throw new Error("Escribe una pregunta de hasta 1000 caracteres.");
      if (image)
        throw new Error(
          "Esta guía lee la foto en el teléfono. Vuelve a fotografiar la lista con el lector local.",
        );
      const text = options.recognizedText ?? "";
      if (typeof text !== "string" || text.length > 4000)
        throw new Error("Divide tu lista en partes de hasta 4000 caracteres.");
      const q = normalizeText(question);
      const help = !text && localAssistantHelp(question);
      if (help) return { ...help, source: "local" };
      if (!text && /(?:que|como).*(?:medir|medidas|mido)|que medidas/.test(q))
        return result(
          "Mide el ancho y alto del hueco en tres puntos y anota las unidades (cm o m). Indica si la ventana será corrediza o abatible. La distribuidora debe confirmar el sistema y las medidas de fabricación; una foto no permite obtener medidas exactas.",
          [],
          ["Necesito materiales para una ventana"],
        );
      let products;
      try {
        products = await base.offlineProducts();
      } catch {
        if ((await base.offlineIdentity()) !== uid)
          throw new Error("La sesión cambió. Vuelve a abrir la guía.");
        return result(
          "Para buscar materiales aquí, abre Catálogo con conexión una vez. Después usaré la copia de tu cuenta en este teléfono, sin enviar preguntas ni fotos. También puedo explicarte cómo hacer un encargo o tomar medidas.",
          [],
          ["¿Cómo hago un encargo?", "¿Qué medidas debo tomar?"],
        );
      }
      if ((await base.offlineIdentity()) !== uid)
        throw new Error("La sesión cambió. Vuelve a abrir la guía.");
      if (options.signal?.aborted) throw cancelled();
      const active = products.filter(
        (p) => Number(p.active) === 1 && p.id != null && p.code && p.name,
      );
      if (text.trim()) {
        const rows = matchList(text, active);
        const selected = new Map();
        const lines = rows.slice(0, 12).map((row, i) => {
          if (/\[ilegible\]/i.test(row.line))
            return `${i + 1}. ${row.line}: corrige la parte ilegible antes de buscar.`;
          for (const p of row.options.slice(0, 2))
            selected.set(String(p.id), { ...p, assistantReview: true });
          return `${i + 1}. ${row.line}\n${
            row.options.length
              ? "Posibles coincidencias: " +
                row.options
                  .slice(0, 2)
                  .map((p) => `${p.name} (${p.code})`)
                  .join("; ") +
                ". Confirma el código y la presentación."
              : "Sin coincidencia segura. Corrige el nombre o busca su código en Catálogo."
          }`;
        });
        if (!rows.length)
          return result(
            "No hay materiales legibles. Vuelve a fotografiar solo la hoja o escribe un material por renglón.",
          );
        return result(
          lines.join("\n\n") +
            (rows.length > 12
              ? "\n\nMostré 12 renglones. Usa Leer lista con la cámara para revisar la lista completa."
              : "") +
            "\n\nNo he agregado productos al encargo ni confirmado precios o existencias.",
          cards([...selected.values()]),
          ["¿Cómo hago un encargo?", "¿Qué medidas debo tomar?"],
        );
      }
      const prior = (Array.isArray(history) ? history : [])
        .filter((m) => m?.role === "user" && typeof m.text === "string")
        .slice(-4)
        .map((m) => m.text.slice(0, 1000));
      const context = normalizeText([...prior, question].join(" "));
      const selected = retrieveMaterials(active, question, history, 6);
      if (/ventana|puerta|cancel/.test(context)) {
        const opening = /corrediz|abatib|fij[oa]|proyectab|oscilobat/.test(
          context,
        );
        const dimensions =
          /\d+(?:[.,]\d+)?\s*(?:mm|cm|m|metros?|centimetros?)?\s*(?:x|por)\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m|metros?|centimetros?)\b/.test(
            context,
          );
        const ask = [
          !opening && "¿Será corrediza, abatible o fija?",
          !dimensions && "¿Cuál es el ancho y alto, con sus unidades (cm o m)?",
        ].filter(Boolean);
        const answer =
          "Para orientarte: el marco delimita la ventana, los rieles guían las hojas corredizas y los sellos ayudan a cerrar sus uniones. La lista exacta depende del sistema y la apertura. " +
          (ask.length
            ? ask.join(" ")
            : "Ya indicaste apertura y medidas. Confirma con la distribuidora la línea o sistema, el acabado y los accesorios compatibles antes de encargar.");
        return result(
          answer +
            (selected.length
              ? "\n\nPuedes revisar estos materiales del catálogo guardado; son candidatos, no una lista definitiva."
              : ""),
          cards(selected.map((p) => ({ ...p, assistantReview: true }))),
          ["¿Qué medidas debo tomar?", "¿Cómo hago un encargo?"],
        );
      }
      if (selected.length)
        return result(
          "Encontré estos candidatos en tu catálogo guardado:\n" +
            selected.map((p) => `${p.name} · código ${p.code}`).join("\n") +
            "\n\nConfirma la línea, presentación y código. Esta guía no confirma existencias ni precios y no agrega productos automáticamente.",
          cards(selected),
          ["¿Cómo hago un encargo?"],
        );
      return result(
        "Puedo buscar materiales por nombre o código, revisar una lista fotografiada y explicarte cómo usar Aluformix. Soy una guía local de materiales, no un chat general. Escribe el material o describe la apertura de tu ventana.",
        [],
        ["Necesito materiales para una ventana", "¿Cómo hago un encargo?"],
      );
    },
  };
}
