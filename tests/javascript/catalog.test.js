import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import data from "../../packages/catalog/src/data.js";
import {
  catalogInfo,
  classify,
  filterCatalog,
  finishesOf,
  genericTypeOf,
  priceLabel,
  searchProducts,
  subcategoriesFor,
  unitLabel,
} from "../../packages/catalog/src/index.js";
import { normalizar } from "../../scripts/catalogo/normalizar-catalogo.js";
import { catalogRows } from "../../server/src/catalog-import.js";

const principal = JSON.parse(
  await readFile(
    "database/catalogo/fuentes/catalogo_principal_aluminio.json",
    "utf8",
  ),
);
const adicional = JSON.parse(
  await readFile(
    "database/catalogo/fuentes/catalogo_adicional_aluminio.json",
    "utf8",
  ),
);
const fuente = [
  ...Object.values(principal).flatMap((g) => Object.values(g).flat()),
  ...Object.values(adicional).flat(),
];
const productos = data.productos;
// Productos como los devuelve la API después de importar.
const rows = catalogRows(productos).map((r, i) => ({
  id: String(i + 1),
  category_id: r.category,
  code: r.code,
  name: r.name,
  description: r.description,
  unit: r.unit,
  finish: r.finish,
  length_mm: r.lengthMm,
  price: r.price,
  active: 1,
}));
const categoryNameOf = (p) => p.category_id;

test("El catálogo combina las dos fuentes sin duplicados ni códigos inventados", () => {
  assert.equal(productos.length, 37);
  const codigos = productos.flatMap((p) => [p.codigo, ...p.codigos_alternos]);
  assert.equal(new Set(codigos).size, codigos.length);
  const deFuente = new Set(fuente.map((p) => p.codigo.replace(/^#/, "")));
  for (const c of codigos)
    assert.ok(deFuente.has(c), "Código en la fuente: " + c);
  for (const c of deFuente)
    assert.ok(codigos.includes(c), "Código importado: " + c);
  assert.equal(productos.filter((p) => p.grupo === "Perfiles").length, 33);
  assert.equal(productos.filter((p) => p.grupo === "Accesorios").length, 4);
  assert.equal(productos.filter((p) => p.grupo === "Herrajes").length, 0);
});

test("Las discrepancias señaladas quedan marcadas y conservan los valores originales", () => {
  const cerco = catalogInfo("9204");
  assert.equal(cerco.codigo, "92046");
  assert.deepEqual(cerco.codigos_alternos, ["9204"]);
  assert.equal(cerco.revision[0].tipo, "codigo");
  assert.equal(cerco.fuentes.adicional.codigo, "#9204");
  for (const code of ["6370", "7014", "7013"]) {
    const p = catalogInfo(code);
    assert.equal(p.grupo, "Accesorios");
    assert.equal(p.revision[0].tipo, "clasificacion");
    assert.equal(p.fuentes.adicional.categoria, "Perfiles");
    assert.equal(p.fuentes.principal.categoria, "Accesorios");
  }
  assert.equal(productos.filter((p) => p.revision.length).length, 4);
});

test("Precios, unidades, acabados y medidas no se inventan", () => {
  for (const p of productos) {
    const originales = [p.fuentes.principal, p.fuentes.adicional].filter(
      Boolean,
    );
    assert.ok(originales.every((o) => o.precio_estimado === 0));
    assert.equal(p.precio, null);
    const acabados = [
      ...new Set(originales.flatMap((o) => o.acabados_variantes)),
    ];
    assert.deepEqual([...p.acabados].sort(), acabados.sort());
    const seisMetros = originales.some(
      (o) => o.unidad_medida === "Barra de 6 m",
    );
    assert.equal(p.unidad === "Barra de 6 m", seisMetros);
    assert.equal(p.longitud_mm, seisMetros ? 6000 : null);
    if (p.dimensiones)
      assert.ok(
        originales.some((o) =>
          o.descripcion_breve
            .toLowerCase()
            .includes(p.dimensiones.texto.toLowerCase()),
        ),
        "Medida literal de la fuente en " + p.codigo,
      );
  }
  assert.equal(priceLabel("0.00"), "Consultar precio");
  assert.equal(priceLabel("125.50"), "$125.50");
  const sinLongitud = rows.find((r) => r.code === "53883");
  assert.equal(unitLabel(sinLongitud), "Barra · Longitud por confirmar");
  assert.equal(unitLabel(rows.find((r) => r.code === "2488")), "Barra de 6 m");
  assert.deepEqual(finishesOf(sinLongitud), []);
  assert.deepEqual(finishesOf(rows.find((r) => r.code === "2488")), [
    "Natural",
    "Blanco",
    "Negro",
  ]);
});

test("Cada producto tiene su propia imagen y los datos generados están al día", async () => {
  const mapa = await readFile("packages/mobile/src/catalogImages.js", "utf8");
  const rutas = new Set();
  for (const p of productos) {
    assert.match(
      p.imagen,
      new RegExp(`^(perfiles|accesorios)/${p.codigo}-[a-z0-9-]+\\.webp$`),
    );
    await access("packages/mobile/assets/catalogo/" + p.imagen);
    assert.ok(
      mapa.includes(
        `"${p.codigo}": { source: require("../assets/catalogo/${p.imagen}")`,
      ),
    );
    rutas.add(p.imagen);
  }
  assert.equal(rutas.size, productos.length);
  const regenerado = await normalizar();
  assert.deepEqual(regenerado.productos, productos);
});

test("Estructura, filtros combinables y búsqueda del catálogo", () => {
  assert.deepEqual(subcategoriesFor("Perfiles", rows, categoryNameOf), [
    "Tubos y barandales",
    "Zoclos",
    "Serie 35",
    "Recubrimientos",
    "Cancel de baño",
    "Puerta batiente 1750",
    "Ángulos, Tee y Solera",
    "Tubos cuadrados",
    "Tubos rectangulares",
  ]);
  assert.deepEqual(subcategoriesFor("Accesorios", rows, categoryNameOf), [
    "Zoclos",
    "Puerta batiente 1750",
    "Accesorios para vidrio",
  ]);
  const codes = (list) => list.map((p) => p.code);
  assert.deepEqual(codes(searchProducts(rows, "2488", categoryNameOf)), [
    "2488",
  ]);
  assert.deepEqual(codes(searchProducts(rows, "PASAMANOS", categoryNameOf)), [
    "53883",
    "53896",
  ]);
  assert.deepEqual(
    codes(searchProducts(rows, "cancel de baño", categoryNameOf)).sort(),
    ["10198", "1046", "11035", "11174"],
  );
  assert.deepEqual(codes(searchProducts(rows, "9204", categoryNameOf)), [
    "92046",
  ]);
  assert.ok(
    codes(searchProducts(rows, "38.1", categoryNameOf)).includes("2489"),
  );
  assert.equal(
    codes(
      searchProducts(rows, "Tubo cuadrado de 1 pulgada", categoryNameOf),
    )[0],
    "2488",
  );
  assert.deepEqual(
    codes(filterCatalog(rows, { glass: true, categoryNameOf })),
    ["7013", "7014"],
  );
  assert.deepEqual(
    codes(
      filterCatalog(rows, {
        group: "Perfiles",
        subcategory: "Tubos cuadrados",
        order: "codigo",
        categoryNameOf,
      }),
    ),
    ["2488", "2489"],
  );
  assert.deepEqual(
    codes(
      filterCatalog(rows, {
        favoritesOnly: true,
        favorites: new Set(["1", "30"]),
        categoryNameOf,
      }),
    ).sort(),
    [rows[0].code, rows[29].code].sort(),
  );
  assert.equal(
    filterCatalog(rows, { group: "Herrajes", categoryNameOf }).length,
    0,
  );
  assert.deepEqual(classify({ code: "X-1" }, "Herrajes / Bisagras"), {
    group: "Herrajes",
    subcategory: "Bisagras",
  });
  assert.equal(genericTypeOf('Perfil serie 3" corredizo'), "perfil-corrediza");
  assert.equal(genericTypeOf('Tubo cuadrado 1"'), "tubo-cuadrado");
  assert.equal(genericTypeOf('Ángulo 3/4"'), "angulo");
  assert.equal(genericTypeOf("Vidrio claro 6 mm"), "vidrio");
  assert.equal(genericTypeOf("Rueda para corrediza 35"), "rueda");
  assert.equal(genericTypeOf("Chapa de seguridad"), "chapa");
  assert.equal(genericTypeOf("Tornillo"), null);
  assert.deepEqual(classify({ code: "X-2" }, "Vidrio"), {
    group: "Otros",
    subcategory: "Vidrio",
  });
});
