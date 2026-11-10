export const lengthUnits = ["cm", "m", "mm"];
const scale = { cm: 10, m: 1000, mm: 1 };

export function toMillimeters(
  value,
  unit,
  { max = 1000000, optional = false } = {},
) {
  const input = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (optional && input === "") return null;
  const match = /^(?:\d{1,7}(?:\.\d{1,3})?|\.\d{1,3})$/.test(input);
  if (!match || !lengthUnits.includes(unit))
    throw new Error(
      "Escribe una medida positiva. Puedes usar punto o coma decimal.",
    );
  const [whole, fraction = ""] = input.split(".");
  const thousandths =
    (Number(whole) * 1000 + Number(fraction.padEnd(3, "0"))) * scale[unit];
  if (thousandths <= 0) throw new Error("La medida debe ser mayor que cero.");
  if (thousandths % 1000)
    throw new Error("Usa una medida con precisión de un milímetro.");
  const millimeters = thousandths / 1000;
  if (millimeters > max)
    throw new Error("La medida máxima es " + displayLength(max) + ".");
  return millimeters;
}

export function displayLength(value) {
  if (value == null || value === "" || !Number.isFinite(Number(value)))
    return "";
  const mm = Number(value);
  return mm >= 1000 ? mm / 1000 + " m" : mm / 10 + " cm";
}
