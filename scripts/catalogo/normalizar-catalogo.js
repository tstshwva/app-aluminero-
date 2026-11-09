// Normaliza el catálogo maestro de ALUFORMIX y genera:
//   packages/catalog/src/data.js     datos para la app, la API y la importación
//   docs/catalogo-revision.md        conflictos, pendientes y conteos para revisión
// Fuente única: database/catalogo/fuentes/catalogo_maestro_ALUFORMIX.json.
// Los JSON de database/catalogo/historicos ya están conciliados dentro del
// maestro y no se vuelven a importar.
// Ejecutar desde la raíz: node scripts/catalogo/normalizar-catalogo.js
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const MAESTRO = "database/catalogo/fuentes/catalogo_maestro_ALUFORMIX.json";
const GRUPOS = ["Perfiles", "Accesorios", "Herrajes"];
const STOP = new Set(["de", "del", "la", "el", "para", "y", "con", "en"]);

const sinAcentos = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const slug = (texto) =>
  sinAcentos(String(texto))
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .join("-");
// Nombre de archivo seguro; el código original se conserva en los datos.
const archivoSeguro = (codigo) =>
  String(codigo)
    .replace(/[^0-9A-Za-z]+/g, "-")
    .replace(/^-|-$/g, "");

// Unidad corta para products.unit (30 caracteres) sin suponer barras de 6 m.
function unidad(texto) {
  const t = String(texto ?? "");
  if (/^barra de 6(\.00)? m/i.test(t))
    return { unidad: "Barra de 6 m", longitud_mm: 6000 };
  if (/^pieza; cantidad por armado/i.test(t))
    return { unidad: "Pieza", longitud_mm: null };
  if (/^pieza/i.test(t))
    return { unidad: "Pieza (por confirmar)", longitud_mm: null };
  return { unidad: "Por confirmar", longitud_mm: null };
}

export async function normalizar() {
  const maestro = JSON.parse(await readFile(path.join(root, MAESTRO), "utf8"));
  const vistos = new Set();
  const productos = maestro.productos.map((p, indice) => {
    if (!GRUPOS.includes(p.categoria))
      throw new Error(`Categoría desconocida: ${p.categoria}`);
    if (p.codigo != null && typeof p.codigo !== "string")
      throw new Error(`El código debe ser texto: ${p.codigo}`);
    const codigo = p.codigo == null ? null : p.codigo.trim();
    for (const c of [codigo, ...p.alias_o_lecturas_alternativas].filter(
      Boolean,
    )) {
      if (vistos.has(c)) throw new Error(`Código o alias repetido: ${c}`);
      vistos.add(c);
    }
    const { unidad: u, longitud_mm } = unidad(p.unidad_medida);
    const sistemas = [
      ...new Set([
        ...(maestro.sistemas_y_familias.some(
          (s) => s.nombre === p.familia_sistema && s.tipo.startsWith("sistema"),
        )
          ? [p.familia_sistema]
          : []),
        ...p.usado_en,
      ]),
    ];
    const base = codigo ? archivoSeguro(codigo) : `sin-codigo-${indice + 1}`;
    return {
      codigo,
      codigos_alternos: p.alias_o_lecturas_alternativas,
      nombre: p.nombre,
      grupo: p.categoria,
      subcategoria: p.subcategoria,
      familia: p.familia_sistema,
      sistemas,
      categoria_bd: `${p.categoria} / ${p.subcategoria}`,
      unidad: u,
      unidad_fuente: p.unidad_medida,
      longitud_mm,
      acabados: p.acabados_variantes,
      precio: p.precio_mxn,
      descripcion: p.descripcion_breve,
      dimensiones: p.dimensiones_texto_fuente
        ? { texto: p.dimensiones_texto_fuente, mm: p.dimensiones_mm }
        : null,
      estado: p.estado_validacion,
      revision: p.notas_validacion.map((detalle) => ({
        tipo: p.estado_validacion,
        detalle,
      })),
      fuentes: p.fuente,
      imagen: `${p.categoria.toLowerCase()}/${base}-${slug(p.nombre)}.webp`,
    };
  });
  const sistemas = maestro.sistemas_y_familias.map((s) => ({
    nombre: s.nombre,
    tipo: s.tipo,
    fuentes: s.fuentes,
    componentes: productos.filter(
      (p) => p.familia === s.nombre || p.sistemas.includes(s.nombre),
    ).length,
  }));
  return {
    version: 2,
    fuente: path.basename(MAESTRO),
    productos,
    sistemas,
    fuentes_pdf: maestro.fuentes_pdf,
    conflictos: maestro.conflictos_y_validaciones_pendientes,
    guia_c100: maestro.guia_tecnica_C100_MID,
    metadatos: {
      total: maestro.metadata.total_registros,
      marca_fuente: maestro.metadata.marca_que_aparece_en_las_fuentes,
    },
  };
}

function informe(d) {
  const cuenta = (f) =>
    Object.entries(
      d.productos.reduce((m, p) => ({ ...m, [f(p)]: (m[f(p)] ?? 0) + 1 }), {}),
    )
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
  const pendientes = d.productos.filter(
    (p) => p.estado !== "verificado" || p.revision.length,
  );
  return [
    "# Revisión del catálogo maestro",
    "",
    "Archivo generado por scripts/catalogo/normalizar-catalogo.js a partir de database/catalogo/fuentes/catalogo_maestro_ALUFORMIX.json. No editar a mano.",
    "",
    `- Registros: ${d.productos.length} (el maestro declara ${d.metadatos.total}).`,
    `- Por categoría: ${cuenta((p) => p.grupo)}.`,
    `- Por estado: ${cuenta((p) => p.estado)}.`,
    `- Sin código: ${d.productos.filter((p) => !p.codigo).length}. Con alias o lectura alternativa: ${d.productos.filter((p) => p.codigos_alternos.length).length}.`,
    `- Precio pendiente: ${d.productos.filter((p) => p.precio == null).length}. Barra de 6 m respaldada por la fuente: ${d.productos.filter((p) => p.longitud_mm === 6000).length}. Unidad por confirmar: ${d.productos.filter((p) => p.unidad === "Por confirmar").length}.`,
    "",
    "## Conflictos documentados en el maestro",
    "",
    "| Tema | Referencias | Acción |",
    "| --- | --- | --- |",
    ...d.conflictos.map(
      (c) => `| ${c.tema} | ${c.referencias.join("<br>")} | ${c.accion} |`,
    ),
    "",
    "## Registros con estado distinto de verificado o con notas",
    "",
    "| Código | Producto | Estado | Notas | Fuente |",
    "| --- | --- | --- | --- | --- |",
    ...pendientes.map(
      (p) =>
        `| ${p.codigo ?? "(sin código)"}${p.codigos_alternos.length ? " · alias " + p.codigos_alternos.join(", ") : ""} | ${p.nombre} | ${p.estado} | ${p.revision.map((r) => r.detalle).join("<br>") || "—"} | ${p.fuentes.map((f) => `${f.archivo} pág. ${f.paginas_pdf.join(", ")}`).join("<br>")} |`,
    ),
    "",
  ].join("\n");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const datos = await normalizar();
  if (datos.productos.length !== datos.metadatos.total)
    throw new Error(
      `Se esperaban ${datos.metadatos.total} registros y hay ${datos.productos.length}.`,
    );
  await writeFile(
    path.join(root, "packages/catalog/src/data.js"),
    "// Generado por scripts/catalogo/normalizar-catalogo.js. No editar a mano.\n" +
      "export default " +
      JSON.stringify(datos, null, 2) +
      ";\n",
  );
  await writeFile(path.join(root, "docs/catalogo-revision.md"), informe(datos));
  console.log(
    `Registros: ${datos.productos.length}. Sistemas y familias: ${datos.sistemas.length}. Con revisión: ${datos.productos.filter((p) => p.estado !== "verificado").length}.`,
  );
}
