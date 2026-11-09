// Registra en la base los productos del catálogo normalizado que aún no existen.
// Sin argumentos solo muestra el plan. Con --aplicar crea categorías y productos.
// Uso desde la raíz:
//   node --env-file-if-exists=.env scripts/catalogo/importar-catalogo.js
//   node --env-file-if-exists=.env scripts/catalogo/importar-catalogo.js --aplicar
// Se puede repetir sin duplicar productos: el código es la clave.
import data from "../../packages/catalog/src/data.js";
import { createDatabase } from "../../server/src/database.js";
import { importCatalog } from "../../server/src/catalog-import.js";

const apply = process.argv.includes("--aplicar");
let pool;
try {
  pool = createDatabase();
  const report = await importCatalog(pool, data.productos, { apply });
  console.log(
    apply
      ? "Importación aplicada."
      : "Simulación: no se modificó la base. Usa --aplicar para registrar.",
  );
  console.log(`Productos en el catálogo: ${data.productos.length}`);
  console.log(`${apply ? "Creados" : "Por crear"}: ${report.created.length}`);
  console.log(`Ya registrados (sin cambios): ${report.existing.length}`);
  for (const e of report.existing.filter((x) => x.registeredAs !== x.code))
    console.log(
      `  ${e.code} ya existe con el código alterno ${e.registeredAs}.`,
    );
  if (report.newCategories.length)
    console.log(
      `Categorías ${apply ? "creadas" : "por crear"}: ${report.newCategories.join(", ")}`,
    );
  if (report.withoutCode.length)
    console.log(
      `Sin código (no se importan hasta confirmarlo): ${report.withoutCode.join(", ")}`,
    );
  console.log("Pendientes de validación: docs/catalogo-revision.md");
} catch (error) {
  console.error("No se pudo importar el catálogo: " + error.message);
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
