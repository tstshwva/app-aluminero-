import test from "node:test";
import assert from "node:assert/strict";
import { withMaterialGuide } from "../../packages/mobile/src/materialGuide.js";
const products = [
  {
    id: "p",
    code: "72015",
    name: "Adaptador mosquitero",
    unit: "barra",
    active: 1,
    price: "999",
  },
  { id: "secret", code: "999", name: "Material inactivo", active: 0 },
];
const make = (extra = {}) =>
  withMaterialGuide({
    offlineIdentity: async () => "owner",
    offlineProducts: async () => products,
    assistant: () => assert.fail("No llamar al modelo remoto"),
    products: () => assert.fail("No descargar datos en una consulta local"),
    ...extra,
  });
test("La guía usa el catálogo local, tolera errores y nunca llama a Gemini", async () => {
  const r = await make().assistant("Necesito adaptado moqule");
  assert.equal(r.source, "local");
  assert.equal(r.products[0].code, "72015");
  assert.equal(r.products[0].review, true);
  assert.ok(!JSON.stringify(r).includes("999"));
});
test("Texto OCR mantiene renglones y deja ilegibles sin coincidencias automáticas", async () => {
  const r = await make().assistant("Busca mi lista", undefined, [], {
    recognizedText:
      "2 pzas Adaptado mosquitero\nCabezal [ilegible]\nPermanent Mark",
  });
  assert.match(r.answer, /2 pzas Adaptado mosquitero/);
  assert.match(r.answer, /corrige la parte ilegible/);
  assert.match(r.answer, /Sin coincidencia segura/);
  assert.equal(r.products.length, 1);
  assert.equal(r.products[0].review, true);
});
test("El modo local rechaza fotos base64 y valida tamaños antes de buscar", async () => {
  const guide = make({ offlineProducts: () => assert.fail("No leer") });
  await assert.rejects(guide.assistant("Busca", "Zm90bw=="), /teléfono/);
  await assert.rejects(guide.assistant("x".repeat(1001)), /1000/);
  await assert.rejects(
    guide.assistant("Busca", undefined, [], {
      recognizedText: "x".repeat(4001),
    }),
    /4000/,
  );
});
test("Guía de uso funciona sin catálogo y una pregunta general explica sus límites", async () => {
  const r = await make({
    offlineProducts: () => assert.fail("No leer"),
  }).assistant("¿Cómo hago un encargo?");
  assert.match(r.answer, /carrito/);
  assert.equal(r.source, "local");
  const unknown = await make().assistant("Explícame la historia de Francia");
  assert.match(unknown.answer, /no un chat general/);
});
test("Si falta la descarga se explica cómo habilitar la búsqueda sin hacer red", async () => {
  const r = await make({
    offlineProducts: async () => {
      throw Error("missing");
    },
  }).assistant("Busco riel");
  assert.match(r.answer, /Catálogo con conexión una vez/);
  assert.deepEqual(r.products, []);
});
test("La orientación recuerda apertura y medidas previas sin inventar una lista de fabricación", async () => {
  const r = await make().assistant("¿Y ahora?", undefined, [
    { role: "user", text: "Ventana corrediza de 120 por 100 cm" },
  ]);
  assert.match(r.answer, /Ya indicaste apertura y medidas/);
  assert.ok(!r.answer.includes("¿Cuál es el ancho"));
});
test("Cambio de cuenta durante la lectura local descarta los resultados y cancelar no responde", async () => {
  let uid = "a";
  const guide = make({
    offlineIdentity: async () => uid,
    offlineProducts: async () => {
      uid = "b";
      return products;
    },
  });
  await assert.rejects(guide.assistant("Busco adaptador"), /sesión cambió/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    make().assistant("Hola", undefined, [], { signal: controller.signal }),
    { code: "assistant/cancelled" },
  );
});
