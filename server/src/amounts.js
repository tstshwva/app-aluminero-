import { ApiError } from "./errors.js";
export function decimal(
  value,
  scale = 2,
  positive = false,
  max = "9999999999.99",
) {
  if (
    typeof value !== "string" ||
    !new RegExp(`^(0|[1-9][0-9]{0,11})(\\.[0-9]{1,${scale}})?$`).test(value)
  )
    throw new ApiError(400, "Importe o cantidad inválidos. Usa punto decimal.");
  const convert = (input) => {
    const [whole, fraction = ""] = input.split(".");
    return (
      BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, "0"))
    );
  };
  const units = convert(value);
  if (units > convert(max) || (positive && units === 0n))
    throw new ApiError(400, "Importe o cantidad fuera de rango.");
  return units;
}
export function format(value, scale = 2) {
  const factor = 10n ** BigInt(scale);
  return `${value / factor}.${(value % factor).toString().padStart(scale, "0")}`;
}
export function totals(items, taxRate, shipping) {
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      (decimal(item.unit_price) *
        decimal(item.quantity, 3, true, "999999999.999") +
        500n) /
        1000n,
    0n,
  );
  const tax =
    (subtotal * decimal(taxRate, 4, false, "1.0000") + 5000n) / 10000n;
  const total = subtotal + tax + decimal(shipping);
  if (total > 99999999999999n)
    throw new ApiError(400, "La cotización supera el límite permitido.");
  return {
    subtotal: format(subtotal),
    tax: format(tax),
    shipping: format(decimal(shipping)),
    total: format(total),
  };
}
