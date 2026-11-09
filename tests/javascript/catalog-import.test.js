import test from "node:test";
import assert from "node:assert/strict";
import data from "../../packages/catalog/src/data.js";
import { importCatalog } from "../../server/src/catalog-import.js";

// Base en memoria que entiende solo las consultas de la importación.
function memoryPool({ products = [], categories = [] } = {}) {
  const state = {
    products: products.map((p) => ({ ...p })),
    categories: categories.map((c) => ({ ...c })),
    commits: 0,
    rollbacks: 0,
  };
  let next = 1000;
  const db = {
    async execute(sql, values) {
      if (sql.startsWith("SELECT id,name FROM categories"))
        return [state.categories.map((c) => ({ ...c }))];
      if (sql.startsWith("SELECT id,code FROM products WHERE code=?"))
        return [state.products.filter((p) => p.code === values[0])];
      if (sql.startsWith("INSERT INTO categories")) {
        if (state.categories.some((c) => c.name === values[0]))
          throw new Error("UQ");
        const id = next++;
        state.categories.push({ id, name: values[0] });
        return [{ insertId: id }];
      }
      if (sql.startsWith("INSERT INTO products")) {
        if (state.products.some((p) => p.code === values[1]))
          throw new Error("UQ_products_code");
        const id = next++;
        const [
          category_id,
          code,
          name,
          description,
          unit,
          finish,
          length_mm,
          price,
          minimum_stock,
          image_url,
          active,
        ] = values;
        state.products.push({
          id,
          category_id,
          code,
          name,
          description,
          unit,
          finish,
          length_mm,
          price,
          minimum_stock,
          image_url,
          active,
        });
        return [{ insertId: id }];
      }
      throw new Error("Consulta no prevista: " + sql);
    },
    async beginTransaction() {},
    async commit() {
      state.commits++;
    },
    async rollback() {
      state.rollbacks++;
    },
    async release() {},
  };
  return { state, pool: { getConnection: async () => db } };
}

test("La importación es idempotente, conserva registros existentes y reconoce el código alterno", async () => {
  const existente = {
    id: 1,
    category_id: 7,
    code: "9204",
    name: "Cerco registrado por la empresa",
    price: "350.00",
  };
  const { state, pool } = memoryPool({
    products: [existente],
    categories: [{ id: 7, name: "Perfiles / Puerta batiente 1750" }],
  });
  const simulacion = await importCatalog(pool, data.productos);
  assert.equal(state.products.length, 1, "La simulación no escribe");
  assert.equal(simulacion.created.length, 36);
  assert.deepEqual(simulacion.existing, [
    { code: "92046", registeredAs: "9204", id: "1" },
  ]);

  const primera = await importCatalog(pool, data.productos, { apply: true });
  assert.equal(primera.created.length, 36);
  assert.equal(state.products.length, 37);
  assert.deepEqual(
    state.products[0],
    existente,
    "El registro previo no cambia",
  );
  assert.equal(state.products.filter((p) => p.code === "92046").length, 0);
  const tubo = state.products.find((p) => p.code === "2488");
  assert.equal(tubo.price, "0.00");
  assert.equal(tubo.unit, "Barra de 6 m");
  assert.equal(tubo.length_mm, 6000);
  assert.equal(tubo.finish, "Natural, Blanco, Negro");
  assert.equal(tubo.image_url, null);
  const pasamanos = state.products.find((p) => p.code === "53883");
  assert.equal(pasamanos.unit, "Barra");
  assert.equal(pasamanos.length_mm, null);
  assert.equal(pasamanos.finish, "Por confirmar");
  assert.equal(
    new Set(state.categories.map((c) => c.name)).size,
    state.categories.length,
  );
  assert.ok(
    state.categories.some(
      (c) => c.name === "Accesorios / Accesorios para vidrio",
    ),
  );

  const segunda = await importCatalog(pool, data.productos, { apply: true });
  assert.equal(segunda.created.length, 0);
  assert.equal(segunda.existing.length, 37);
  assert.equal(state.products.length, 37);
  assert.equal(state.rollbacks, 0);
});

test("Un error durante la importación revierte la transacción", async () => {
  const { state, pool } = memoryPool();
  const db = await pool.getConnection();
  const original = db.execute;
  let inserted = 0;
  db.execute = async (sql, values) => {
    if (sql.startsWith("INSERT INTO products") && ++inserted === 5)
      throw new Error("falla simulada");
    return original(sql, values);
  };
  await assert.rejects(
    importCatalog(pool, data.productos, { apply: true }),
    /falla simulada/,
  );
  assert.equal(state.rollbacks, 1);
});
