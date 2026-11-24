import test from "node:test";
import assert from "node:assert/strict";
import { joinRecognizedLines } from "../../packages/mobile/src/ocrLines.js";
import {
  catalogProducts,
  matchList,
} from "../../packages/catalog/src/index.js";
const products = catalogProducts.map((p) => ({
  id: p.codigo,
  code: p.codigo,
  name: p.nombre,
  active: 1,
}));
test("Reconstruye la hoja por posición, aunque los bloques lleguen como columnas desordenadas", () => {
  const box = (text, x, y, width = 160) => ({ text, x, y, width, height: 30 });
  const result = joinRecognizedLines([
    box("Adaptado", 10, 10),
    box("C.bezul de 1750", 10, 75, 260),
    box("Cabezul y", 10, 140),
    box("mosquitero", 190, 12),
    box("Zocio", 190, 142),
  ]);
  assert.equal(result, "Adaptado mosquitero\nC.bezul de 1750\nCabezul y Zocio");
});
test("Lecturas de las capturas encuentran candidatos reales y requieren confirmación", () => {
  const result = matchList(
    "Adaptado moqule\nC.bezul de 1750\nCabezul y Zo cio",
    products,
  );
  assert.equal(result[0].options[0].code, "72015");
  assert.equal(result[1].options[0].code, "9207");
  assert.ok(["15311", "11837"].includes(result[2].options[0].code));
  assert.ok(result.every((row) => row.review));
  assert.equal(result[1].line, "C.bezul de 1750");
});
test("No convierte etiquetas ajenas o medidas erróneas en materiales inventados", () => {
  const rows = matchList(
    "Halaptado XX\nPermanent\nMark\nCabezul de 1759",
    products,
  );
  assert.ok(rows.every((row) => row.options.length === 0));
  const item = {
    id: "1",
    code: "SKU",
    name: "Perfil cuadrado 1750",
    active: 1,
  };
  assert.equal(matchList("Perfil cuadrado 1759", [item])[0].options.length, 0);
});
test("La lectura exacta conserva cantidades y no requiere corrección aproximada", () => {
  const row = matchList("2 pzas Cabezal de 1750", products)[0];
  assert.equal(row.quantity, "2");
  assert.equal(row.options[0].code, "9207");
  assert.equal(row.review, false);
});
test("Tolera fragmentos de una misma palabra y el conector de1750 sin alterar números", () => {
  assert.equal(
    matchList("Adaptado mo>qu le", products)[0].options[0].code,
    "72015",
  );
  assert.equal(
    matchList("C.bezul de1750", products)[0].options[0].code,
    "9207",
  );
  assert.equal(
    matchList("Adaptador mosqui tero", products)[0].options[0].code,
    "72015",
  );
});
