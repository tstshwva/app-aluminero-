import { requireOptionalNativeModule } from "expo-modules-core";
import { File } from "expo-file-system";
import { joinRecognizedLines } from "./ocrLines.js";
const reader = requireOptionalNativeModule("ExpoTextExtractor");
export const localTextAvailable = !!reader?.isSupported;
export async function readLocalText(uri) {
  if (!localTextAvailable)
    throw new Error(
      "Instala el APK actualizado para activar el escáner local.",
    );
  if (typeof reader.extractTextLinesFromImage === "function")
    return joinRecognizedLines(await reader.extractTextLinesFromImage(uri));
  const blocks = await reader.extractTextFromImage(
    uri.replace(/^file:\/\//, ""),
  );
  return blocks
    .filter((block) => typeof block === "string")
    .join("\n")
    .trim();
}
export async function readPhotoBase64(photo) {
  return photo.base64 ?? (await new File(photo.uri).base64());
}
