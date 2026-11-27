// Miniaturas de las mismas ilustraciones, sin redibujarlas ni cambiar productos.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = await readFile(path.join(root, "packages/mobile/src/catalogImages.js"), "utf8");
const files = [...new Set([...source.matchAll(/require\("\.\.\/assets\/(catalogo\/[^"\n]+)"\)/g)].map(m => m[1]))];
let originalPixels = 0, thumbnailPixels = 0;
for (const file of files) {
  const input = path.join(root, "packages/mobile/assets", file);
  const output = path.join(root, "packages/mobile/assets/miniaturas", file);
  await mkdir(path.dirname(output), { recursive: true });
  const original = await sharp(input).metadata();
  const result = await sharp(input).resize({width:320,height:240,fit:"inside",withoutEnlargement:true}).webp({quality:80}).toFile(output);
  originalPixels += original.width * original.height;
  thumbnailPixels += result.width * result.height;
}
const registry = source
  .replace(/catalogImages/g, "catalogThumbnails")
  .replace(/genericImages/g, "genericThumbnails")
  .replace(/systemImages/g, "systemThumbnails")
  .replace(/\.\.\/assets\/catalogo\//g, "../assets/miniaturas/catalogo/");
await writeFile(path.join(root, "packages/mobile/src/catalogThumbnails.js"), "// Generado por scripts/catalogo/generar-miniaturas.mjs: máximo 320 × 240.\n" + registry.split("\n").filter(line=>!line.startsWith("//")).join("\n"));
console.log(JSON.stringify({ images:files.length, originalPixels, thumbnailPixels, pixelReductionPercent:100*(1-thumbnailPixels/originalPixels) }));
