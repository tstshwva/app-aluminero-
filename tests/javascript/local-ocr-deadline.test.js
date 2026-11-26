import test from "node:test";
import assert from "node:assert/strict";
import { localOcrDeadline } from "../../packages/mobile/src/localOcrDeadline.js";
test("Una lectura nativa que no termina libera la espera con un error útil", async () => {
  await assert.rejects(
    localOcrDeadline(() => new Promise(() => {}), 10),
    (e) =>
      e.code === "ocr/timeout" &&
      e.message.includes("lista anterior se conserva"),
  );
  assert.equal(await localOcrDeadline(async () => "Riel", 50), "Riel");
});
test("Un fallo nativo conserva su error y una respuesta tardía no cambia el resultado vencido", async () => {
  const failure = new Error("No se pudo abrir la imagen");
  await assert.rejects(
    localOcrDeadline(() => {
      throw failure;
    }, 50),
    (e) => e === failure,
  );
  let finish;
  const pending = localOcrDeadline(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    10,
  );
  await assert.rejects(pending, { code: "ocr/timeout" });
  finish("tardío");
  await assert.rejects(pending, { code: "ocr/timeout" });
});
