import { createAssistant } from "../server/src/assistant.js";

try {
  const assistant = createAssistant();
  if (!assistant) {
    console.error(
      "Configura GEMINI_API_KEY y GEMINI_MODEL en .env del servidor.",
    );
    process.exitCode = 1;
  } else {
    await assistant("¿Qué perfil del catálogo puedo revisar para un marco?", [
      { code: "PRUEBA-01", name: "Perfil de aluminio", unit: "pieza" },
    ]);
    console.log(
      "Gemini devolvió una respuesta de texto con el catálogo de prueba.",
    );
  }
} catch {
  console.error(
    "Falló la verificación de Gemini. Revisa acceso, cuota y modelo.",
  );
  process.exitCode = 1;
}
