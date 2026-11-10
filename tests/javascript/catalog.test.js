import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import data from "../../packages/catalog/src/data.js";
import {
  C100_CUTS,
  c100Cuts,
  catalogInfo,
  classify,
  filterCatalog,
  finishesOf,
  genericTypeOf,
  priceLabel,
  reviewNotes,
  searchProducts,
  subcategoriesFor,
  systemComponents,
  systemsOnly,
  unitLabel,
} from "../../packages/catalog/src/index.js";
import { normalizar } from "../../scripts/catalogo/normalizar-catalogo.js";
import { catalogRows } from "../../server/src/catalog-import.js";

const maestro = JSON.parse(
  await readFile(
    "database/catalogo/fuentes/catalogo_maestro_ALUFORMIX.json",
    "utf8",
  ),
);
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
const codes = (list) => list.map((p) => p.code);

test("Los 125 registros del maestro se tratan una sola vez y los códigos son texto", () => {
  assert.equal(productos.length, 125);
  assert.equal(maestro.productos.length, 125);
  const conCodigo = productos.filter((p) => p.codigo);
  assert.equal(conCodigo.length, 124);
  assert.ok(conCodigo.every((p) => typeof p.codigo === "string"));
  const todos = productos
    .flatMap((p) => [p.codigo, ...p.codigos_alternos])
    .filter(Boolean);
  assert.equal(new Set(todos).size, todos.length);
  assert.deepEqual(
    productos.map((p) => p.codigo),
    maestro.productos.map((p) => p.codigo),
    "Mismos códigos y en el mismo orden que el maestro",
  );
  assert.equal(catalogInfo("07333").nombre, "Perfil mosquitero");
  assert.equal(catalogInfo("02082").codigo, "02082");
  assert.equal(catalogInfo("7333"), null, "No se pierde el cero inicial");
  assert.equal(productos.filter((p) => p.grupo === "Perfiles").length, 92);
  assert.equal(productos.filter((p) => p.grupo === "Accesorios").length, 21);
  assert.equal(productos.filter((p) => p.grupo === "Herrajes").length, 12);
});

test("Los conflictos quedan visibles y no se resuelven inventando datos", () => {
  const cerco = catalogInfo("92046");
  assert.equal(cerco.codigo, "9204");
  assert.equal(cerco.estado, "requiere_validacion");
  assert.equal(catalogInfo("GT54/40.03A").codigo, "GT45/40.03A");
  assert.equal(catalogInfo("GN-481").estado, "requiere_validacion");
  assert.equal(catalogInfo("M.P. / F-608").estado, "requiere_validacion");
  for (const c of ["78410", "18409"]) {
    assert.equal(catalogInfo(c).estado, "requiere_validacion");
    assert.doesNotMatch(catalogInfo(c).nombre, /^(?!Perfil código)/);
  }
  for (const [a, b] of [
    ["F-306E", "F306"],
    ["F305", "UN-305T"],
    ["E-126/6.5", "195-15 PENS"],
  ])
    assert.notEqual(catalogInfo(a), catalogInfo(b));
  const calza = productos.find((p) => !p.codigo);
  assert.match(calza.nombre, /calza/i);
  assert.equal(calza.estado, "requiere_codigo");
  assert.equal(catalogRows(productos).length, 124, "Sin código no se importa");
  assert.ok(reviewNotes({ code: "9204" }).length);
  assert.deepEqual(reviewNotes({ code: "2488" }), []);
});

test("Precios, unidades y longitudes respetan las fuentes", () => {
  assert.ok(productos.every((p) => p.precio === null));
  assert.equal(priceLabel("0.00"), "Consultar precio");
  for (const p of productos) {
    const fuente = maestro.productos.find(
      (m) => m.codigo === p.codigo && m.nombre === p.nombre,
    );
    const seisMetros = /^barra de 6(\.00)? m/i.test(fuente.unidad_medida);
    assert.equal(
      p.longitud_mm,
      seisMetros ? 6000 : null,
      p.codigo + " longitud",
    );
    assert.equal(p.unidad_fuente, fuente.unidad_medida);
    assert.deepEqual(p.acabados, fuente.acabados_variantes);
    assert.equal(p.dimensiones?.texto ?? null, fuente.dimensiones_texto_fuente);
  }
  assert.equal(productos.filter((p) => p.longitud_mm === 6000).length, 36);
  const rowOf = (c) => rows.find((r) => r.code === c);
  assert.equal(unitLabel(rowOf("53883")), "Por confirmar");
  assert.equal(rowOf("53883").length_mm, null);
  assert.equal(unitLabel(rowOf("2488")), "Barra de 6 m");
  assert.deepEqual(finishesOf(rowOf("72054")), [
    "Gris titanium",
    "Negro anodizado",
    "Madera texturizada",
  ]);
});

test("Imágenes: cada render existe y el manifiesto cubre todos los registros", async () => {
  const mapa = await readFile("packages/mobile/src/catalogImages.js", "utf8");
  const manifest = JSON.parse(
    await readFile("database/catalogo/image-manifest.json", "utf8"),
  );
  const deProductos = manifest.imagenes.filter(
    (i) => i.tipo !== "ilustracion_de_sistema",
  );
  assert.equal(deProductos.length, 125);
  assert.equal(manifest.resumen.pendiente ?? 0, 0);
  const rutas = new Set();
  for (const item of deProductos) {
    assert.ok(
      ["ilustrativa", "pendiente", "validada", "generada"].includes(
        item.estado,
      ),
    );
    if (item.estado === "pendiente") {
      assert.equal(item.ruta, null);
      continue;
    }
    await access(item.ruta);
    const key = item.codigo ?? item.ruta.split("/catalogo/")[1];
    assert.ok(
      mapa.includes(`"${key}": { source: require("../assets/catalogo/`),
    );
    rutas.add(item.ruta);
  }
  assert.equal(
    rutas.size,
    deProductos.filter((i) => i.ruta).length,
    "Una imagen por producto",
  );
  assert.ok(
    manifest.imagenes.filter((i) => i.tipo === "ilustracion_de_sistema")
      .length >= 8,
  );
  const regenerado = await normalizar();
  assert.deepEqual(
    regenerado.productos,
    productos,
    "data.js está al día con el maestro",
  );
});

test("Estructura, filtros combinables y búsqueda global", () => {
  assert.ok(
    subcategoriesFor("Perfiles", rows, categoryNameOf).includes("C-100 MID"),
  );
  assert.ok(
    subcategoriesFor("Herrajes", rows, categoryNameOf).includes(
      "Accesorios C-100 MID",
    ),
  );
  assert.deepEqual(codes(searchProducts(rows, "2488", categoryNameOf)), [
    "2488",
  ]);
  assert.deepEqual(codes(searchProducts(rows, "07333", categoryNameOf)), [
    "07333",
  ]);
  assert.deepEqual(
    codes(searchProducts(rows, "PASAMANOS", categoryNameOf)).sort(),
    ["53883", "53896"],
  );
  assert.ok(
    codes(searchProducts(rows, "c-100 mid", categoryNameOf)).length >= 30,
  );
  assert.deepEqual(codes(searchProducts(rows, "92046", categoryNameOf)), [
    "9204",
  ]);
  assert.equal(
    codes(
      searchProducts(rows, "Tubo cuadrado de 1 pulgada", categoryNameOf),
    )[0],
    "2488",
  );
  assert.ok(
    codes(filterCatalog(rows, { glass: true, categoryNameOf })).every((c) =>
      ["7013", "7014"].includes(c),
    ),
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
  assert.equal(
    filterCatalog(rows, { group: "Herrajes", categoryNameOf }).length,
    12,
  );
  assert.deepEqual(classify({ code: "X-1" }, "Herrajes / Bisagras"), {
    group: "Herrajes",
    subcategory: "Bisagras",
  });
  assert.equal(genericTypeOf('Tubo cuadrado 1"'), "tubo-cuadrado");
  assert.equal(genericTypeOf("Tornillo"), null);
});

test("Sistemas y calculadora C-100 MID según la tabla de la guía", () => {
  assert.deepEqual(
    systemsOnly().map((s) => s.nombre),
    [
      "Ventana corrediza 1380",
      "Ventana corrediza 1500",
      "Puerta y ventana fija 2000",
      "Puerta y ventana corrediza 2000",
      "Puerta y ventana fija 3000",
      "Puerta y ventana corrediza 3000",
      "Corrediza C-80",
      "C-100 MID",
    ],
  );
  assert.equal(systemComponents("C-100 MID").length, 33);
  assert.equal(systemComponents("Corrediza C-80").length, 11);
  assert.equal(C100_CUTS.length, 8);
  const r = c100Cuts(2000, 1500);
  assert.deepEqual(r.vidrio, { LF: 862, HF: 1288 });
  assert.deepEqual(
    r.cortes.map((c) => c.medida),
    [2000, 1500, 1003, 1422, null, 1422, null, 1406],
  );
  assert.throws(() => c100Cuts(0, 1500));
  assert.throws(() => c100Cuts(200, 150), /vidrio/);
});
