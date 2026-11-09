// Normaliza los catálogos JSON recibidos y genera:
//   packages/catalog/src/data.js     datos combinados para la app, la API y la importación
//   docs/catalogo-revision.md        diferencias entre fuentes para revisión administrativa
// Ejecutar desde la raíz: node scripts/catalogo/normalizar-catalogo.js
// El resultado es determinista: repetirlo con las mismas fuentes produce los mismos archivos.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const fuentes = path.join(root, "database/catalogo/fuentes");
const PRINCIPAL = "catalogo_principal_aluminio.json";
const ADICIONAL = "catalogo_adicional_aluminio.json";

// Decisiones de curación explícitas. Cualquier criterio que no venga de las
// fuentes queda aquí, documentado y marcado para validación.
const ALIAS = [
  {
    codigo: "92046",
    alternos: ["9204"],
    detalle:
      "El catálogo adicional registra «Cerco Puerta de 1750» con el código #9204 y el catálogo principal con #92046. " +
      "Se registra una sola ficha con #92046 (catálogo principal) y #9204 queda como código alterno buscable hasta confirmar el código del fabricante.",
  },
];
const GRUPOS = ["Perfiles", "Accesorios", "Herrajes"];
const STOP = new Set(["de", "del", "la", "el", "para", "y", "con", "en"]);

const limpiarCodigo = (codigo) => {
  const valor = String(codigo ?? "")
    .trim()
    .replace(/^#/, "");
  if (!/^[0-9A-Za-z-]{1,40}$/.test(valor))
    throw new Error(`Código no válido en la fuente: ${codigo}`);
  return valor;
};
const sinAcentos = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
const comparable = (texto) =>
  sinAcentos(String(texto ?? ""))
    .toLowerCase()
    .replace(/["”″]/g, " pulgadas")
    .replace(/\bpulgada\b/g, "pulgadas")
    .replace(/[×x]/g, " x ")
    .replace(/\s+/g, " ")
    .trim();
export const slug = (texto) =>
  sinAcentos(texto)
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .join("-");

// Texto de medidas copiado literalmente de la descripción original.
function dimensiones(descripcion) {
  const texto = String(descripcion ?? "");
  const tras = texto.includes(";") ? texto.slice(texto.indexOf(";") + 1) : "";
  if (tras.trim()) {
    const valor = tras.trim().replace(/\.$/, "");
    return {
      texto: valor.charAt(0).toUpperCase() + valor.slice(1),
      aproximadas: /aproximad/i.test(valor),
    };
  }
  const espesor = texto.match(/espesor indicado de [\d.]+ mm/i);
  if (espesor)
    return {
      texto: espesor[0].charAt(0).toUpperCase() + espesor[0].slice(1),
      aproximadas: false,
    };
  return null;
}

// Unidad corta compatible con products.unit (30 caracteres) sin inventar longitudes.
function unidad(principal, adicional) {
  const textos = [adicional?.unidad_medida, principal?.unidad_medida].filter(
    Boolean,
  );
  if (textos.some((t) => /^barra de 6 m$/i.test(t.trim())))
    return { unidad: "Barra de 6 m", longitud_mm: 6000 };
  const base = textos[0] ?? "";
  if (/^barra/i.test(base)) return { unidad: "Barra", longitud_mm: null };
  if (/pieza/i.test(base))
    return { unidad: "Pieza (por confirmar)", longitud_mm: null };
  return { unidad: base.slice(0, 30), longitud_mm: null };
}

async function leer(nombre) {
  return JSON.parse(await readFile(path.join(fuentes, nombre), "utf8"));
}

export async function normalizar() {
  const principal = await leer(PRINCIPAL);
  const adicional = await leer(ADICIONAL);
  const aliasDe = new Map();
  for (const a of ALIAS)
    for (const alt of a.alternos) aliasDe.set(alt, a.codigo);

  // Catálogo principal: grupo → subcategoría → productos.
  const registros = new Map();
  const orden = [];
  for (const [grupo, subcategorias] of Object.entries(principal)) {
    if (!GRUPOS.includes(grupo)) throw new Error(`Grupo desconocido: ${grupo}`);
    for (const [subcategoria, productos] of Object.entries(subcategorias)) {
      for (const original of productos) {
        const codigo = limpiarCodigo(original.codigo);
        if (registros.has(codigo))
          throw new Error(
            `Código duplicado en el catálogo principal: ${codigo}`,
          );
        registros.set(codigo, {
          codigo,
          grupo,
          subcategoria,
          principal: original,
          adicional: null,
          seccionAdicional: null,
        });
        orden.push(codigo);
      }
    }
  }
  // Catálogo adicional: sección → productos. Se asocia por código (o alias).
  const soloAdicional = [];
  for (const [seccion, productos] of Object.entries(adicional)) {
    for (const original of productos) {
      const codigoFuente = limpiarCodigo(original.codigo);
      const codigo = aliasDe.get(codigoFuente) ?? codigoFuente;
      const registro = registros.get(codigo);
      if (!registro) {
        soloAdicional.push({ seccion, original });
        continue;
      }
      if (registro.adicional)
        throw new Error(
          `Código duplicado en el catálogo adicional: ${codigoFuente}`,
        );
      registro.adicional = original;
      registro.seccionAdicional = seccion;
    }
  }
  // Productos que solo existen en el catálogo adicional: se conservan con su
  // clasificación original y se marcan para validar.
  for (const { seccion, original } of soloAdicional) {
    const codigo = limpiarCodigo(original.codigo);
    const grupo = GRUPOS.includes(original.categoria)
      ? original.categoria
      : "Perfiles";
    registros.set(codigo, {
      codigo,
      grupo,
      subcategoria: seccion,
      principal: null,
      adicional: original,
      seccionAdicional: seccion,
    });
    orden.push(codigo);
  }

  const productos = [];
  const diferencias = [];
  for (const codigo of orden) {
    const r = registros.get(codigo);
    const base = r.principal ?? r.adicional;
    const revision = [];
    const alias = ALIAS.find((a) => a.codigo === codigo);
    if (alias) revision.push({ tipo: "codigo", detalle: alias.detalle });
    if (r.principal && r.adicional) {
      if (r.principal.categoria !== r.adicional.categoria)
        revision.push({
          tipo: "clasificacion",
          detalle:
            `Catálogo principal: ${r.principal.categoria} / ${r.subcategoria}. ` +
            `Catálogo adicional: ${r.adicional.categoria} / ${r.seccionAdicional}. ` +
            `Se muestra con la clasificación del catálogo principal hasta validarla.`,
        });
      if (comparable(r.principal.nombre) !== comparable(r.adicional.nombre))
        diferencias.push({
          codigo,
          campo: "Nombre",
          principal: r.principal.nombre,
          adicional: r.adicional.nombre,
          criterio:
            "Se usa el nombre del catálogo principal; el otro se conserva y es buscable.",
        });
      if (r.principal.unidad_medida !== r.adicional.unidad_medida)
        diferencias.push({
          codigo,
          campo: "Unidad",
          principal: r.principal.unidad_medida,
          adicional: r.adicional.unidad_medida,
          criterio:
            "Se conserva la barra de 6 m indicada expresamente en el catálogo adicional.",
        });
      if (
        JSON.stringify(r.principal.acabados_variantes) !==
        JSON.stringify(r.adicional.acabados_variantes)
      )
        diferencias.push({
          codigo,
          campo: "Acabados",
          principal: r.principal.acabados_variantes.join(", ") || "(sin dato)",
          adicional: r.adicional.acabados_variantes.join(", ") || "(sin dato)",
          criterio:
            "Se usan los acabados listados en la fuente que los indica.",
        });
      if (comparable(r.subcategoria) !== comparable(r.seccionAdicional))
        diferencias.push({
          codigo,
          campo: "Sección",
          principal: r.subcategoria,
          adicional: r.seccionAdicional,
          criterio: "Se usa la subcategoría del catálogo principal.",
        });
    } else if (!r.principal) {
      revision.push({
        tipo: "fuente",
        detalle:
          "Solo aparece en el catálogo adicional; confirma su clasificación.",
      });
    }
    const acabados = [
      ...new Set([
        ...(r.adicional?.acabados_variantes ?? []),
        ...(r.principal?.acabados_variantes ?? []),
      ]),
    ];
    const precios = [
      r.principal?.precio_estimado,
      r.adicional?.precio_estimado,
    ].filter((p) => typeof p === "number");
    const precio = precios.find((p) => p > 0) ?? null;
    if (
      precios.filter((p) => p > 0).length > 1 &&
      new Set(precios.filter((p) => p > 0)).size > 1
    )
      revision.push({
        tipo: "precio",
        detalle: `Las fuentes indican precios distintos: ${precios.join(" y ")}.`,
      });
    const { unidad: u, longitud_mm } = unidad(r.principal, r.adicional);
    const ruta = `${r.grupo.toLowerCase()}/${codigo}-${slug(base.nombre)}.webp`;
    productos.push({
      codigo,
      codigos_alternos: alias ? alias.alternos : [],
      nombre: base.nombre,
      nombres_alternos:
        r.principal &&
        r.adicional &&
        comparable(r.principal.nombre) !== comparable(r.adicional.nombre)
          ? [r.adicional.nombre]
          : [],
      grupo: r.grupo,
      subcategoria: r.subcategoria,
      categoria_bd: `${r.grupo} / ${r.subcategoria}`,
      unidad: u,
      longitud_mm,
      acabados,
      precio,
      descripcion: base.descripcion_breve,
      dimensiones: dimensiones(
        r.principal?.descripcion_breve ?? r.adicional?.descripcion_breve,
      ),
      imagen: ruta,
      revision,
      fuentes: {
        principal: r.principal,
        adicional: r.adicional
          ? { seccion: r.seccionAdicional, ...r.adicional }
          : null,
      },
    });
  }
  const herrajes = Object.keys(principal.Herrajes ?? {});
  return { productos, diferencias, notasFuente: { Herrajes: herrajes } };
}

function informe({ productos, diferencias }) {
  const validar = productos.filter((p) => p.revision.length);
  const lineas = [
    "# Revisión del catálogo importado",
    "",
    "Archivo generado por scripts/catalogo/normalizar-catalogo.js a partir de database/catalogo/fuentes. No editar a mano.",
    "",
    `- Productos únicos: ${productos.length}`,
    `- Perfiles: ${productos.filter((p) => p.grupo === "Perfiles").length} · Accesorios: ${productos.filter((p) => p.grupo === "Accesorios").length} · Herrajes: ${productos.filter((p) => p.grupo === "Herrajes").length}`,
    `- Con precio pendiente de captura (precio_estimado = 0.0): ${productos.filter((p) => p.precio === null).length}`,
    `- Con longitud de barra por confirmar: ${productos.filter((p) => p.unidad === "Barra").length}`,
    `- Sin acabados indicados en las fuentes: ${productos.filter((p) => !p.acabados.length).length}`,
    `- Marcados para validación administrativa: ${validar.length}`,
    "",
    "## Registros que requieren validación",
    "",
    "| Código | Producto | Motivo |",
    "| --- | --- | --- |",
    ...validar.flatMap((p) =>
      p.revision.map((r) => `| ${p.codigo} | ${p.nombre} | ${r.detalle} |`),
    ),
    "",
    "## Diferencias de detalle entre fuentes",
    "",
    "Estas diferencias no bloquean el registro. Se indica el criterio aplicado y ambos valores se conservan en data.js (campo fuentes).",
    "",
    "| Código | Campo | Catálogo principal | Catálogo adicional | Criterio |",
    "| --- | --- | --- | --- | --- |",
    ...diferencias.map(
      (d) =>
        `| ${d.codigo} | ${d.campo} | ${d.principal} | ${d.adicional} | ${d.criterio} |`,
    ),
    "",
    "## Herrajes",
    "",
    "Las fuentes no identifican herrajes. La categoría está preparada: crea categorías con el formato «Herrajes / Subcategoría» desde la app Empresa.",
    "",
  ];
  return lineas.join("\n");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const resultado = await normalizar();
  const datos = {
    version: 1,
    fuentes: [PRINCIPAL, ADICIONAL],
    productos: resultado.productos,
  };
  await writeFile(
    path.join(root, "packages/catalog/src/data.js"),
    "// Generado por scripts/catalogo/normalizar-catalogo.js. No editar a mano.\n" +
      "export default " +
      JSON.stringify(datos, null, 2) +
      ";\n",
  );
  await writeFile(
    path.join(root, "docs/catalogo-revision.md"),
    informe(resultado),
  );
  console.log(
    `Productos: ${resultado.productos.length}. Diferencias de detalle: ${resultado.diferencias.length}. Para validar: ${resultado.productos.filter((p) => p.revision.length).length}.`,
  );
}
