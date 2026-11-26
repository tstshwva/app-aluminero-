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

test("Evita duplicados del lector sin borrar dos renglones iguales y limita hojas excesivas", () => {
  const box = { text: "Riel", x: 0, y: 0, width: 100, height: 20 };
  assert.equal(
    joinRecognizedLines([box, { ...box }, { ...box, y: 60 }]),
    "Riel\nRiel",
  );
  assert.throws(
    () => joinRecognizedLines(Array(401).fill(box)),
    /demasiado texto/,
  );
  assert.throws(() => joinRecognizedLines(null), /lista válida/);
});
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

test("Una hoja inclinada conserva sus renglones y una recta no se altera", () => {
  const rows = [
    ["Adaptador", "mosquitero"],
    ["Cabezal de", "1750"],
    ["Cabezal y", "zoclo"],
    ["Tubo cuadrado", "de 1 pulgada"],
  ];
  const expected = rows.map((r) => r.join(" ")).join("\n");
  for (const degrees of [-10, -8, -6, -3, 0, 3, 6, 8, 10]) {
    const t = (degrees * Math.PI) / 180;
    const boxes = rows.flatMap((row, i) =>
      row.map((text, k) => {
        const x = k * 450,
          y = i * 60;
        const corners = [
          [x, y],
          [x + 250, y],
          [x, y + 34],
          [x + 250, y + 34],
        ].map(([a, b]) => [
          a * Math.cos(t) - b * Math.sin(t),
          a * Math.sin(t) + b * Math.cos(t),
        ]);
        const xs = corners.map((c) => c[0]),
          ys = corners.map((c) => c[1]);
        const left = Math.min(...xs),
          top = Math.min(...ys);
        return {
          text,
          x: left,
          y: top,
          width: Math.max(...xs) - left,
          height: Math.max(...ys) - top,
        };
      }),
    );
    assert.equal(joinRecognizedLines(boxes), expected, degrees + " grados");
  }
});
test("Una hoja recta con columnas incompletas no mezcla renglones distintos", () => {
  const box = (text, x, y) => ({ text, x, y, width: 200, height: 30 });
  assert.equal(
    joinRecognizedLines([
      box("2 pzas", 0, 0),
      box("Riel triple", 450, 50),
      box("3 pzas", 0, 100),
      box("Riel doble", 450, 150),
    ]),
    "2 pzas\nRiel triple\n3 pzas\nRiel doble",
  );
});
test("Letras y números confundidos se corrigen solo contra el catálogo y piden revisión", () => {
  for (const [line, code] of [
    ["Cabezal de l750", "9207"],
    ["Cabezal de 175O", "9207"],
    ["Cabeza1 de 1750", "9207"],
    ["I5311", "15311"],
    ["153l1", "15311"],
    ["O7333", "07333"],
    ["1 5 3 1 1", "15311"],
    ["Tub0 cuadrado de 1 pulgada", "2488"],
    ["Angul0 de 1 pulgada", "1304"],
  ]) {
    const [row] = matchList(line, products);
    assert.equal(row.options[0]?.code, code, line);
    assert.equal(row.review, true, line);
    assert.equal(row.quantity, null, line);
    assert.equal(row.line, line);
  }
  const [two] = matchList("2 pzas 72O54", products);
  assert.equal(two.quantity, "2");
  assert.equal(two.options[0].code, "72054");
  assert.equal(matchList("l0 pzas Riel triple", products)[0].quantity, "10");
  const [dash] = matchList("2 - Riel triple", products);
  assert.equal(dash.quantity, "2");
  assert.equal(dash.review, true);
  // Un código correcto no se toca y uno inexistente no se fuerza.
  assert.equal(matchList("07333", products)[0].review, false);
  assert.equal(matchList("9Z9S9", products)[0].options.length, 0);
});
