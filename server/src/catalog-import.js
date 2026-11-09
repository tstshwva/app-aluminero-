// Importación idempotente del catálogo normalizado (packages/catalog).
// Reglas: el código identifica al producto; si el código o un código alterno ya
// existe, el registro se conserva sin cambios. Solo se crean categorías y
// productos que faltan. No se guardan imágenes en la base: la app asocia sus
// imágenes ilustrativas por código y una URL HTTPS registrada tiene prioridad.
import { rows, transaction } from "./database.js";

const LIMITS = {
  code: 40,
  name: 150,
  unit: 30,
  finish: 60,
  category: 80,
  description: 4000,
};

export function catalogRows(productos) {
  const seen = new Set();
  return productos.map((p) => {
    const row = {
      category: p.categoria_bd,
      code: p.codigo,
      alternates: p.codigos_alternos ?? [],
      name: p.nombre,
      description: p.descripcion ?? null,
      unit: p.unidad,
      finish: p.acabados?.length ? p.acabados.join(", ") : "Por confirmar",
      lengthMm: p.longitud_mm ?? null,
      // products.price es obligatorio: 0.00 significa «Consultar precio».
      price: p.precio == null ? "0.00" : Number(p.precio).toFixed(2),
    };
    for (const [field, max] of Object.entries(LIMITS)) {
      const value = field === "category" ? row.category : row[field];
      if (field !== "description" && !value)
        throw new Error(`Falta ${field} en ${p.codigo}.`);
      if (value && String(value).length > max)
        throw new Error(`${field} de ${p.codigo} supera ${max} caracteres.`);
    }
    if (!/^\d{1,10}\.\d{2}$/.test(row.price))
      throw new Error(`Precio inválido en ${p.codigo}.`);
    for (const code of [row.code, ...row.alternates]) {
      if (seen.has(code))
        throw new Error(`Código repetido en el catálogo: ${code}.`);
      seen.add(code);
    }
    return row;
  });
}

// apply=false solo consulta y devuelve el plan. apply=true lo ejecuta en una
// transacción; ante cualquier error no queda ningún cambio parcial.
export async function importCatalog(pool, productos, { apply = false } = {}) {
  const items = catalogRows(productos);
  const work = async (db) => {
    const categories = new Map(
      (await rows(db, "SELECT id,name FROM categories")).map((c) => [
        String(c.name).toLowerCase(),
        String(c.id),
      ]),
    );
    const report = { created: [], existing: [], newCategories: [] };
    for (const item of items) {
      let found = null;
      for (const code of [item.code, ...item.alternates]) {
        [found] = await rows(db, "SELECT id,code FROM products WHERE code=?", [
          code,
        ]);
        if (found) break;
      }
      if (found) {
        report.existing.push({
          code: item.code,
          registeredAs: String(found.code),
          id: String(found.id),
        });
        continue;
      }
      let categoryId = categories.get(item.category.toLowerCase());
      if (!categoryId) {
        report.newCategories.push(item.category);
        if (apply) {
          const saved = await rows(
            db,
            "INSERT INTO categories(name) VALUES(?)",
            [item.category],
          );
          categoryId = String(saved.insertId);
        } else categoryId = "nueva";
        categories.set(item.category.toLowerCase(), categoryId);
      }
      if (apply)
        await rows(
          db,
          "INSERT INTO products(category_id,code,name,description,unit,finish,length_mm,price,minimum_stock,image_url,active) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          [
            categoryId,
            item.code,
            item.name,
            item.description,
            item.unit,
            item.finish,
            item.lengthMm,
            item.price,
            "0.000",
            null,
            true,
          ],
        );
      report.created.push(item.code);
    }
    return report;
  };
  if (!apply) {
    const db = await pool.getConnection();
    try {
      return await work(db);
    } finally {
      await db.release();
    }
  }
  return transaction(pool, work);
}
