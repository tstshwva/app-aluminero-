import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { joinRecognizedLines } from "../../packages/mobile/src/ocrLines.js";
import { localOcrDeadline } from "../../packages/mobile/src/localOcrDeadline.js";
async function reader(native) {
  globalThis.__iosReader = { native, joinRecognizedLines, localOcrDeadline };
  let source = await readFile(
    "packages/mobile/src/localTextReader.ios.js",
    "utf8",
  );
  source = source.replace(/import[^;]+;/g, "");
  source =
    "const {native,joinRecognizedLines,localOcrDeadline}=globalThis.__iosReader;const requireOptionalNativeModule=()=>native;const File=class {};\n" +
    source;
  return import(
    "data:text/javascript;base64," +
      Buffer.from(source + "\n//" + Math.random()).toString("base64")
  );
}
test("iOS conserva la URI local y ordena coordenadas del lector Vision", async () => {
  const mod = await reader({
    isSupported: true,
    extractTextLinesFromImage: async (uri) => {
      assert.equal(uri, "file:///hoja.jpg");
      return [
        { text: "Cabezal de 1750", x: 10, y: 60, width: 120, height: 20 },
        { text: "Adaptador mosquitero", x: 10, y: 10, width: 160, height: 20 },
      ];
    },
  });
  assert.equal(
    await mod.readLocalText("file:///hoja.jpg"),
    "Adaptador mosquitero\nCabezal de 1750",
  );
});
test("iOS conserva compatibilidad con el lector anterior y permite detectar su ausencia", async () => {
  const old = await reader({
    isSupported: true,
    extractTextFromImage: async (uri) => {
      assert.equal(uri, "file:///hoja.jpg");
      return ["Riel", "Cabezal"];
    },
  });
  assert.equal(await old.readLocalText("file:///hoja.jpg"), "Riel\nCabezal");
  const absent = await reader(null);
  assert.equal(absent.localTextAvailable, false);
  await assert.rejects(absent.readLocalText("file:///hoja.jpg"), /iPhone/);
});
