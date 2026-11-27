import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
test("Las tarjetas tienen miniaturas acotadas de las mismas ilustraciones", async () => {
  const original = await readFile(
    "packages/mobile/src/catalogImages.js",
    "utf8",
  );
  const thumbs = await readFile(
    "packages/mobile/src/catalogThumbnails.js",
    "utf8",
  );
  const files = [
    ...new Set(
      [
        ...original.matchAll(/require\("\.\.\/assets\/(catalogo\/[^"\n]+)"\)/g),
      ].map((m) => m[1]),
    ),
  ];
  assert.ok(files.length > 100);
  for (const file of files) {
    assert.ok(thumbs.includes("../assets/miniaturas/" + file), file);
    const image = await sharp(
      "packages/mobile/assets/miniaturas/" + file,
    ).metadata();
    assert.ok(image.width <= 320 && image.height <= 240, file);
  }
});
