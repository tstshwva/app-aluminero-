export const CATALOG_PAGE_SIZE = 12;
// Mantiene un máximo fijo de tarjetas, incluso después de recorrer el catálogo.
export function catalogPage(items, requestedPage, size = CATALOG_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pages - 1, Math.max(0, requestedPage));
  const start = page * size;
  return {
    page,
    pages,
    start,
    end: Math.min(start + size, items.length),
    items: items.slice(start, start + size),
  };
}
