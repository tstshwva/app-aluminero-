// Reglas compartidas del catálogo: clasificación, presentación de precios y
// unidades, acabados y búsqueda. No depende de React Native ni del servidor.
import data from "./data.js";

export const GROUPS = ["Perfiles", "Accesorios", "Herrajes"];
export const CATEGORY_SEPARATOR = " / ";
// Acceso rápido «Vidrio»: muestra los accesorios para vidrio y las categorías
// llamadas Vidrio sin duplicar registros.
export const GLASS_SUBCATEGORY = "Accesorios para vidrio";

export const catalogProducts = data.productos;
const byCode = new Map();
for (const p of catalogProducts) {
  if (p.codigo) byCode.set(p.codigo, p);
  for (const alt of p.codigos_alternos) byCode.set(alt, p);
}

// Orden de subcategorías tal como aparece en las fuentes.
export const SUBCATEGORY_ORDER = Object.fromEntries(
  GROUPS.map((g) => [
    g,
    [
      ...new Set(
        catalogProducts.filter((p) => p.grupo === g).map((p) => p.subcategoria),
      ),
    ],
  ]),
);

export const cleanCode = (code) =>
  String(code ?? "")
    .trim()
    .replace(/^#/, "");
const byCodeLower = new Map();
for (const p of catalogProducts)
  for (const c of [p.codigo, ...p.codigos_alternos].filter(Boolean))
    byCodeLower.set(c.toLowerCase(), p);
export const catalogInfo = (code) =>
  byCode.get(cleanCode(code)) ??
  byCodeLower.get(cleanCode(code).toLowerCase()) ??
  null;

// Clasifica cualquier producto: primero por su categoría («Grupo / Subcategoría»),
// después por los datos importados y, si no coincide, como «Otros».
export function classify(product, categoryName = "") {
  const name = String(categoryName ?? "").trim();
  const [head, ...rest] = name.split(CATEGORY_SEPARATOR);
  const group = GROUPS.find(
    (g) => g.toLowerCase() === head.trim().toLowerCase(),
  );
  if (group)
    return {
      group,
      subcategory: rest.join(CATEGORY_SEPARATOR).trim() || "General",
    };
  const info = catalogInfo(product?.code);
  if (info) return { group: info.grupo, subcategory: info.subcategoria };
  return { group: "Otros", subcategory: name || "Sin categoría" };
}

// Un precio 0 o ausente significa que está pendiente de captura.
export function isPricePending(price) {
  const n = Number(price);
  return price == null || price === "" || !Number.isFinite(n) || n <= 0;
}
export const priceLabel = (price) =>
  isPricePending(price) ? "Consultar precio" : "$" + price;

export function finishesOf(product) {
  return String(product?.finish ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f && !/^por confirmar$/i.test(f));
}

export function unitLabel(product) {
  const unit = String(product?.unit ?? "").trim();
  if (/^barra/i.test(unit) && !product?.length_mm && !/\d/.test(unit))
    return unit + " · Longitud por confirmar";
  return unit;
}

export function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/["”″]/g, " pulgada ")
    .replace(/(\d)\s*[x×]\s*(?=\d)/g, "$1 x ")
    .replace(/[×]/g, " x ")
    .replace(/#/g, " ")
    .replace(/ø/g, " ø ")
    .replace(/[^a-z0-9./ø]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(stem)
    .join(" ");
}
const STOP = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "para",
  "y",
  "con",
  "en",
  "un",
  "una",
]);
function stem(word) {
  if (/^\d/.test(word) || word.length <= 3) return word;
  if (word.endsWith("es") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}
const SYNONYMS = {
  pulg: "pulgada",
  in: "pulgada",
  bano: "bano",
  barandal: "barandal pasamano",
  angular: "angulo",
  vidrio: "vidrio",
};

// Texto indexado de un producto, incluidos los datos importados.
export function searchText(product, categoryName = "") {
  const info = catalogInfo(product?.code);
  const { group, subcategory } = classify(product, categoryName);
  return normalizeText(
    [
      product?.code,
      product?.name,
      product?.description,
      product?.unit,
      product?.finish,
      categoryName,
      group,
      subcategory,
      info?.codigos_alternos.join(" "),
      info?.familia,
      info?.sistemas.join(" "),
      info?.dimensiones?.texto,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

// Las palabras se buscan por prefijo; los números completos, salvo códigos
// parciales de tres cifras o más («920» encuentra 9207).
function matchesWord(words, token) {
  if (/^\d/.test(token))
    return words.some(
      (w) =>
        w === token ||
        (token.length >= 3 && /^\d+$/.test(w) && w.startsWith(token)),
    );
  return words.some((w) => w.startsWith(token));
}

export function queryTokens(query) {
  return normalizeText(query)
    .split(" ")
    .filter((t) => t && !STOP.has(t))
    .map((t) => SYNONYMS[t] ?? t);
}

// Devuelve los productos que contienen todas las palabras de la búsqueda.
// Los códigos exactos aparecen primero.
export function searchProducts(products, query, categoryNameOf = () => "") {
  const tokens = queryTokens(query);
  if (!tokens.length) return products;
  const code = cleanCode(query).toLowerCase();
  const phrase = normalizeText(query);
  return products
    .map((p) => {
      const words = searchText(p, categoryNameOf(p)).split(" ");
      if (
        !tokens.every((t) =>
          t.split(" ").some((part) => matchesWord(words, part)),
        )
      )
        return null;
      const info = catalogInfo(p.code);
      const exact =
        String(p.code).toLowerCase() === code ||
        Boolean(info?.codigos_alternos.includes(code));
      const name = normalizeText(p.name);
      const nameWords = name.split(" ");
      const score = exact
        ? 0
        : name.includes(phrase)
          ? 1
          : tokens.every((t) =>
                t.split(" ").some((part) => matchesWord(nameWords, part)),
              )
            ? 2
            : 3;
      return { p, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.p);
}

export function sortProducts(products, order = "nombre") {
  const list = [...products];
  if (order === "codigo")
    return list.sort((a, b) =>
      String(a.code).localeCompare(String(b.code), "es", { numeric: true }),
    );
  return list.sort((a, b) =>
    String(a.name).localeCompare(String(b.name), "es", {
      sensitivity: "base",
      numeric: true,
    }),
  );
}

// Aplica grupo, subcategoría, vidrio, favoritos, búsqueda y orden en conjunto.
export function filterCatalog(
  products,
  {
    group = "",
    subcategory = "",
    glass = false,
    favoritesOnly = false,
    favorites = new Set(),
    query = "",
    order = "nombre",
    categoryNameOf = () => "",
  } = {},
) {
  const filtered = products.filter((p) => {
    const c = classify(p, categoryNameOf(p));
    if (group && c.group !== group) return false;
    if (subcategory && c.subcategory !== subcategory) return false;
    if (
      glass &&
      c.subcategory !== GLASS_SUBCATEGORY &&
      !/^vidrio$/i.test(categoryNameOf(p).trim())
    )
      return false;
    if (favoritesOnly && !favorites.has(String(p.id))) return false;
    return true;
  });
  const searched = searchProducts(filtered, query, categoryNameOf);
  return query.trim() ? searched : sortProducts(searched, order);
}

// Subcategorías presentes para un grupo, en el orden de las fuentes y después alfabético.
export function subcategoriesFor(group, products, categoryNameOf = () => "") {
  const present = new Set(
    products
      .map((p) => classify(p, categoryNameOf(p)))
      .filter((c) => c.group === group)
      .map((c) => c.subcategory),
  );
  const known = (SUBCATEGORY_ORDER[group] ?? []).filter((s) => present.has(s));
  const extra = [...present]
    .filter((s) => !known.includes(s))
    .sort((a, b) => a.localeCompare(b, "es"));
  return [...known, ...extra];
}

// Tipo genérico de imagen para productos sin imagen propia, según su nombre.
// El orden importa: las reglas más específicas van primero.
const GENERIC_RULES = [
  ["calza", /\b(calza|separador).*\b(neopreno|vidrio)|\bneopreno/],
  ["solera", /\b(solera|pletina)/],
  ["empaque", /\b(empaque|junta de goma|burlete)/],
  ["vidrio", /\b(vidrio|cristal|espejo)/],
  ["rueda", /\b(rueda|carretilla|rodaja|balero)/],
  ["chapa", /\b(chapa|cerradura|jaladera|manija|pasador)/],
  ["angulo", /\bangulo/],
  ["tubo-cuadrado", /\btubo\b.*\bcuadrad/],
  ["tubo-rectangular", /\btubo\b.*\brectangul/],
  ["tubo-redondo", /\b(tubo|pasamano)/],
  [
    "perfil-corrediza",
    /\b(corrediz|riel|perfil|marco|canal|zoclo|jamba|cabezal)/,
  ],
];
export function genericTypeOf(name) {
  const text = String(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return GENERIC_RULES.find(([, rule]) => rule.test(text))?.[0] ?? null;
}

// Notas de los registros que no están verificados contra el plano.
export function reviewNotes(product) {
  const info = catalogInfo(product?.code);
  if (!info || info.estado === "verificado") return [];
  return info.revision.length
    ? info.revision
    : [
        {
          tipo: info.estado,
          detalle: "Revisar cotas y datos contra el plano de origen.",
        },
      ];
}

// ---------- Sistemas ----------
export const catalogSystems = data.sistemas;
export const technicalSources = data.fuentes_pdf;
export const catalogConflicts = data.conflictos;
export const c100Guide = data.guia_c100;
export const VALIDATION_LABELS = {
  verificado: "Verificado con el plano",
  requiere_validacion: "Requiere validación",
  requiere_revision_dimensional: "Cotas por revisar",
  requiere_codigo: "Código pendiente",
};
// Sistemas de cancelería (no familias de perfiles sueltos).
export const systemsOnly = () =>
  catalogSystems.filter((s) => s.tipo.startsWith("sistema"));
// Componentes registrados en el maestro para un sistema o familia.
export const systemComponents = (name) =>
  catalogProducts.filter(
    (p) => p.familia === name || p.sistemas.includes(name),
  );

// Tabla de descuentos C-100 MID, 2 hojas corredizas con mosquitero (guía,
// PDF pág. 8). Se transcribe tal como aparece; no se extrapola a otros sistemas.
export const C100_CUTS = [
  {
    pda: 1,
    clave: "72054",
    seccion: "A",
    descripcion: "Riel triple cabezal",
    cantidad: 2,
    regla: "L",
    corte: null,
    calc: (L) => L,
  },
  {
    pda: 2,
    clave: "72054",
    seccion: "B",
    descripcion: "Riel triple jamba",
    cantidad: 2,
    regla: "H",
    corte: null,
    calc: (L, H) => H,
  },
  {
    pda: 3,
    clave: "72056",
    seccion: "C",
    descripcion: "Cerco 24 mm horizontal",
    cantidad: 2,
    regla: "L / 2 + 3",
    corte: "45°",
    calc: (L) => L / 2 + 3,
  },
  {
    pda: 4,
    clave: "72056",
    seccion: "D",
    descripcion: "Cerco 24 mm vertical",
    cantidad: 2,
    regla: "H − 78",
    corte: "45°",
    calc: (L, H) => H - 78,
  },
  {
    pda: 5,
    clave: "72059",
    seccion: "E",
    descripcion: "Adaptador 12 mm",
    cantidad: null,
    regla: "Ensambla con la 72056 al corte",
    corte: "45°",
    calc: null,
  },
  {
    pda: 6,
    clave: "72058",
    seccion: "F",
    descripcion: "Aleta",
    cantidad: 2,
    regla: "H − 78",
    corte: "90°",
    calc: (L, H) => H - 78,
  },
  {
    pda: 7,
    clave: "72015",
    seccion: "G",
    descripcion: "Adaptador mosquitero",
    cantidad: null,
    regla: "Ensambla con la 72056 al corte",
    corte: "45°",
    calc: null,
  },
  {
    pda: 8,
    clave: "72016",
    seccion: "H",
    descripcion: "Porta felpas",
    cantidad: 2,
    regla: "H − 94",
    corte: "90°",
    calc: (L, H) => H - 94,
  },
];
// Calcula cortes y vidrio en milímetros. Solo admite medidas positivas.
export function c100Cuts(L, H) {
  const ancho = Number(L),
    alto = Number(H);
  if (
    !Number.isFinite(ancho) ||
    !Number.isFinite(alto) ||
    ancho <= 0 ||
    alto <= 0
  )
    throw new Error("Indica ancho y alto totales en milímetros.");
  const round = (n) => Math.round(n * 10) / 10;
  const vidrio = { LF: round(ancho / 2 - 138), HF: round(alto - 212) };
  if (vidrio.LF <= 0 || vidrio.HF <= 0)
    throw new Error("Las medidas no producen un vidrio válido con esta tabla.");
  return {
    cortes: C100_CUTS.map((c) => ({
      ...c,
      medida: c.calc ? round(c.calc(ancho, alto)) : null,
    })),
    vidrio,
  };
}
