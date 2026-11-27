const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

// Endereza la hoja según un ángulo. El recuadro de un texto inclinado crece con
// su ancho: se recupera el alto real del renglón para no unir los vecinos.
function straighten(fragments, degrees) {
  const t = (degrees * Math.PI) / 180,
    cos = Math.cos(t),
    sin = Math.sin(t),
    a = Math.abs(sin),
    scale = Math.cos(2 * t);
  return fragments.map((f) => {
    const cx = f.x + f.width / 2,
      cy = f.y + f.height / 2,
      width = Math.max(1, (f.width * cos - f.height * a) / scale),
      height = (f.height * cos - f.width * a) / scale;
    return {
      ...f,
      x: cx * cos + cy * sin - width / 2,
      width,
      center: cy * cos - cx * sin,
      height,
    };
  });
}

// Dos textos que ocupan el mismo ancho no pueden estar en el mismo renglón.
const overlaps = (a, b) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) >
  Math.min(a.width, b.width) * 0.35;

// Una mayúscula o un número alto desplaza el centro del recuadro. Para letra
// irregular también comparamos la línea inferior, sin unir filas vecinas.
function sameHandwrittenRow(a, b) {
  const small = Math.min(a.height, b.height);
  const large = Math.max(a.height, b.height);
  const intersection =
    Math.min(a.center + a.height / 2, b.center + b.height / 2) -
    Math.max(a.center - a.height / 2, b.center - b.height / 2);
  const baseline = Math.abs(
    a.center + a.height / 2 - (b.center + b.height / 2),
  );
  return (
    Math.abs(a.center - b.center) <= small * 0.65 ||
    (large <= small * 3 &&
      intersection >= small * 0.75 &&
      baseline <= small * 0.3)
  );
}

function groupRows(fragments) {
  const rows = [];
  for (const fragment of [...fragments].sort(
    (a, b) => a.center - b.center || a.x - b.x,
  )) {
    const row = rows
      .filter(
        (row) =>
          // Todos deben ser compatibles: evita encadenar tres renglones.
          row.parts.every((part) => sameHandwrittenRow(part, fragment)) &&
          !row.parts.some((part) => overlaps(part, fragment)),
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
  return rows;
}

const spread = (rows) =>
  rows.reduce(
    (sum, row) =>
      sum + row.parts.reduce((s, p) => s + Math.abs(p.center - row.center), 0),
    0,
  );

// Solo corrige la inclinación si los recuadros la respaldan y los renglones
// quedan claramente mejor alineados; ante la duda conserva la foto como está.
function bestRows(fragments) {
  let best = { rows: groupRows(fragments) };
  best.error = spread(best.rows);
  if (fragments.length < 4) return best.rows;
  for (let step = 1; step <= 15; step++)
    for (const degrees of [step, -step]) {
      const turned = straighten(fragments, degrees);
      if (
        turned.some((f) => f.height <= 0) ||
        // Un renglón más bajo que el ancho de sus letras indica una hoja recta.
        median(turned.map((f) => (f.height * f.text.length) / f.width)) < 0.8
      )
        continue;
      const rows = groupRows(turned),
        error = spread(rows);
      if (
        rows.length < best.rows.length ||
        (rows.length === best.rows.length && error < best.error * 0.8)
      )
        best = { rows, error };
    }
  return best.rows;
}

// Reconstruye renglones a partir de posiciones, aunque ML Kit devuelva bloques en otro orden.
export function joinRecognizedLines(input) {
  if (!Array.isArray(input))
    throw new Error(
      "El lector no devolvió una lista válida. Vuelve a fotografiar la hoja.",
    );
  if (input.length > 400)
    throw new Error(
      "Hay demasiado texto. Fotografía una parte de la hoja para leerla con mayor rapidez.",
    );
  const located = [],
    unlocated = [];
  const seen = new Set();
  for (const entry of input ?? []) {
    if (typeof entry?.text !== "string") continue;
    const text = String(entry?.text ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    if (
      !["x", "y", "width", "height"].every(
        (key) => typeof entry[key] === "number" && Number.isFinite(entry[key]),
      ) ||
      entry.height <= 0 ||
      entry.width <= 0
    ) {
      unlocated.push(text);
      continue;
    }
    const key = JSON.stringify([
      text,
      entry.x,
      entry.y,
      entry.width,
      entry.height,
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    located.push({ ...entry, text, center: entry.y + entry.height / 2 });
  }
  const rows = bestRows(located);
  const text = [
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
  if (text.length > 4000)
    throw new Error(
      "La lectura es muy larga. Fotografía una parte de la lista.",
    );
  return text;
}
