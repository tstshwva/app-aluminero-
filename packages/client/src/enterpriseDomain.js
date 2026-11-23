export function text(value, name, max = 160, optional = false) {
  const result = String(value ?? "").trim();
  if ((!optional && !result) || result.length > max)
    throw new Error(`Revisa ${name}.`);
  return result;
}
export function decimal(value, scale = 2, max = 999999999) {
  const input = String(value ?? "").trim();
  if (!new RegExp("^\\d+(?:\\.\\d{1," + scale + "})?$").test(input))
    throw new Error("Escribe un importe o cantidad válido.");
  const result = Number(input);
  if (!Number.isFinite(result) || result > max)
    throw new Error("El importe o cantidad está fuera de rango.");
  return result;
}
export const money = (value) => decimal(value).toFixed(2);
export const cents = (value) => Math.round(decimal(value) * 100);
export function calculateQuote(items, prices, taxRate, shipping, previous) {
  const rate = decimal(taxRate, 4, 1),
    shippingCents = cents(shipping);
  if (!items.length || items.length > 50 || prices.length !== items.length)
    throw new Error("Revisa los productos de la cotización.");
  const lines = items.map((item, index) => {
    const matches = prices.filter(
      (p) => String(p.itemId) === String(index + 1),
    );
    if (matches.length !== 1)
      throw new Error("Falta el precio de un material.");
    const milli = Math.round(decimal(item.quantity, 3) * 1000);
    if (milli <= 0) throw new Error("La cantidad debe ser mayor que cero.");
    const unit = cents(matches[0].unitPrice);
    const line = Math.round((unit * milli) / 1000);
    if (!Number.isSafeInteger(line))
      throw new Error("La cotización excede el importe permitido.");
    return {
      ...item,
      unitPrice: (unit / 100).toFixed(2),
      lineTotal: (line / 100).toFixed(2),
    };
  });
  const subtotal = lines.reduce((sum, item) => sum + cents(item.lineTotal), 0);
  const tax = Math.round(subtotal * rate),
    total = subtotal + tax + shippingCents;
  if (!Number.isSafeInteger(total) || total > 99999999900)
    throw new Error("La cotización excede el importe permitido.");
  return {
    items: lines,
    quote: {
      revision: (previous?.revision ?? 0) + 1,
      status: "Pendiente",
      tax_rate: String(rate),
      shipping: (shippingCents / 100).toFixed(2),
      subtotal: (subtotal / 100).toFixed(2),
      tax: (tax / 100).toFixed(2),
      total: (total / 100).toFixed(2),
      paid: "0.00",
      balance: (total / 100).toFixed(2),
    },
  };
}
export function nextStatus(from, to) {
  const allowed = {
    Solicitado: ["Cancelado"],
    Cotizado: ["Cancelado"],
    Confirmado: ["Preparando", "Cancelado"],
    Preparando: ["Listo", "Cancelado"],
    Listo: ["Entregado", "Cancelado"],
  };
  if (!allowed[from]?.includes(to))
    throw new Error(
      "Ese cambio de estado no está permitido. Actualiza el encargo.",
    );
}
