// Reconstruye renglones a partir de posiciones, aunque ML Kit devuelva bloques en otro orden.
export function joinRecognizedLines(input) {
  const located = [],
    unlocated = [];
  for (const entry of input ?? []) {
    const text = String(entry?.text ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    if (
      !["x", "y", "width", "height"].every(
        (key) => typeof entry[key] === "number" && Number.isFinite(entry[key]),
      ) ||
      entry.height <= 0
    ) {
      unlocated.push(text);
      continue;
    }
    located.push({ ...entry, text, center: entry.y + entry.height / 2 });
  }
  located.sort((a, b) => a.center - b.center || a.x - b.x);
  const rows = [];
  for (const fragment of located) {
    const row = rows
      .filter(
        (row) =>
          Math.abs(row.center - fragment.center) <=
          Math.min(row.height, fragment.height) * 0.65,
      )
      .sort(
        (a, b) =>
          Math.abs(a.center - fragment.center) -
          Math.abs(b.center - fragment.center),
      )[0];
    if (row) {
      row.parts.push(fragment);
      row.center =
        row.parts.reduce((sum, p) => sum + p.center, 0) / row.parts.length;
      row.height = Math.min(row.height, fragment.height);
    } else
      rows.push({
        center: fragment.center,
        height: fragment.height,
        parts: [fragment],
      });
  }
  return [
    ...rows
      .sort((a, b) => a.center - b.center)
      .map((row) =>
        row.parts
          .sort((a, b) => a.x - b.x)
          .map((p) => p.text)
          .join(" "),
      ),
    ...unlocated,
  ]
    .join("\n")
    .trim();
}
