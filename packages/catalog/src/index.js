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
  byCode.set(p.codigo, p);
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
export const catalogInfo = (code) => byCode.get(cleanCode(code)) ?? null;

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
      info?.nombres_alternos.join(" "),
      info?.dimensiones?.texto,
      info?.fuentes?.adicional?.seccion,
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

export const reviewNotes = (product) =>
  catalogInfo(product?.code)?.revision ?? [];
