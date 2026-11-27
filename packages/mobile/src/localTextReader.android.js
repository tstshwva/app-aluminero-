import { requireOptionalNativeModule } from "expo-modules-core";
import { File } from "expo-file-system";
import { joinRecognizedLines } from "./ocrLines.js";
import { localOcrDeadline } from "./localOcrDeadline.js";
const reader = requireOptionalNativeModule("ExpoTextExtractor");
export const localTextAvailable = !!reader?.isSupported;
export const handwritingAvailable =
  typeof reader?.extractHandwrittenLinesFromImage === "function";
export async function readHandwrittenText(uri) {
  if (!handwritingAvailable)
    throw new Error("Instala el APK nuevo para releer por renglones.");
  return joinRecognizedLines(
    await localOcrDeadline(() => reader.extractHandwrittenLinesFromImage(uri)),
  );
}
export async function readLocalText(uri) {
  if (!localTextAvailable)
    throw new Error(
      "Instala el APK actualizado para activar el escáner local.",
    );
  if (typeof reader.extractTextLinesFromImage === "function")
    return joinRecognizedLines(
      await localOcrDeadline(() => reader.extractTextLinesFromImage(uri)),
    );
  const blocks = await localOcrDeadline(() =>
    reader.extractTextFromImage(uri.replace(/^file:\/\//, "")),
  );
  return joinRecognizedLines(
    blocks
      .filter((block) => typeof block === "string")
      .flatMap((text) => text.split(/\r?\n/).map((text) => ({ text }))),
  );
}
export async function readPhotoBase64(photo) {
  return photo.base64 ?? (await new File(photo.uri).base64());
}
