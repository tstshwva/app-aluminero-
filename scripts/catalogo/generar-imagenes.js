// Genera una imagen individual por producto del catálogo importado.
// Son ilustraciones vectoriales (SVG convertido a WebP), no fotografías.
// Ejecutar desde la raíz: node scripts/catalogo/generar-imagenes.js
//
// Cada sección usa las medidas de la fuente cuando existen. Lo que la fuente no
// define (espesor de pared, alturas faltantes o la forma de perfiles especiales)
// se dibuja como representación ilustrativa y así se indica en la app.
import { mkdir, readdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import data from "../../packages/catalog/src/data.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const assets = path.join(root, "packages/mobile/assets/catalogo");
const SIZE = 1024;

// ---------- Secciones (milímetros, eje Y hacia arriba) ----------
const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
const area = (pts) =>
  pts.reduce((a, [x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length];
    return a + x * ny - nx * y;
  }, 0) / 2;
const ccw = (pts) => (area(pts) > 0 ? pts : [...pts].reverse());
const cw = (pts) => (area(pts) < 0 ? pts : [...pts].reverse());
const circle = (r, n = 120) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });

const shapes = {
  tuboRedondo: ({ d, t }) => ({
    outer: circle(d / 2),
    holes: [circle(d / 2 - t)],
  }),
  tuboRect: ({ w, h, t }) => ({
    outer: rect(0, 0, w, h),
    holes: [rect(t, t, w - t, h - t)],
  }),
  angulo: ({ a, b, t }) => ({
    outer: [
      [0, 0],
      [a, 0],
      [a, t],
      [t, t],
      [t, b],
      [0, b],
    ],
    holes: [],
  }),
  tee: ({ w, h, t }) => ({
    outer: [
      [-w / 2, h - t],
      [-t / 2, h - t],
      [-t / 2, 0],
      [t / 2, 0],
      [t / 2, h - t],
      [w / 2, h - t],
      [w / 2, h],
      [-w / 2, h],
    ],
    holes: [],
  }),
  canal: ({ w, h, t }) => ({
    outer: [
      [0, 0],
      [w, 0],
      [w, h],
      [w - t, h],
      [w - t, t],
      [t, t],
      [t, h],
      [0, h],
    ],
    holes: [],
  }),
  canalInvertido: ({ w, h, t }) => ({
    outer: [
      [0, h],
      [0, 0],
      [t, 0],
      [t, h - t],
      [w - t, h - t],
      [w - t, 0],
      [w, 0],
      [w, h],
    ],
    holes: [],
  }),
  marco: ({ w, h, ceja, t }) => ({
    outer: [
      [0, 0],
      [w, 0],
      [w, ceja],
      [w - t, ceja],
      [w - t, t],
      [t, t],
      [t, h],
      [0, h],
    ],
    holes: [],
  }),
  zeta: ({ superior, h, inferior, t }) => ({
    outer: [
      [0, 0],
      [inferior, 0],
      [inferior, t],
      [t, t],
      [t, h],
      [-superior + t, h],
      [-superior + t, h - t],
      [0, h - t],
    ],
    holes: [],
  }),
  escalon: ({ w, h, t }) => {
    const s = h * 0.56,
      x = w * 0.58;
    return {
      outer: [
        [0, 0],
        [w, 0],
        [w, s],
        [x, s],
        [x, h],
        [0, h],
      ],
      holes: [rect(t, t, w - t, s - t), rect(t, s + t * 0.5, x - t, h - t)],
    };
  },
  hache: ({ w, h, t }) => ({
    outer: [
      [0, 0],
      [t, 0],
      [t, h / 2 - t / 2],
      [w - t, h / 2 - t / 2],
      [w - t, 0],
      [w, 0],
      [w, h],
      [w - t, h],
      [w - t, h / 2 + t / 2],
      [t, h / 2 + t / 2],
      [t, h],
      [0, h],
    ],
    holes: [],
  }),
  lama: ({ w, t, grados }) => {
    const a = (grados * Math.PI) / 180,
      c = Math.cos(a),
      s = Math.sin(a);
    return {
      outer: [
        [0, 0],
        [w * c, w * s],
        [w * c - t * s, w * s + t * c],
        [-t * s, t * c],
      ],
      holes: [],
    };
  },
};

// Medidas de la fuente; los valores marcados con «ilustrativo» no aparecen en ella.
const MEDIDA =
  "Sección exterior según las medidas de la fuente; espesor de pared ilustrativo.";
const SILUETA =
  "Silueta ilustrativa: la fuente no define la geometría completa del perfil comercial.";
const spec = {
  53883: { forma: "tuboRedondo", d: 76.2, t: 1.6, nota: MEDIDA },
  53896: { forma: "tuboRedondo", d: 60, t: 1.5, nota: MEDIDA },
  22196: { forma: "tuboRedondo", d: 50.8, t: 1.3, nota: MEDIDA },
  22197: { forma: "tuboRedondo", d: 25.4, t: 1.0, nota: MEDIDA },
  8327: { forma: "tuboRect", w: 85.5, h: 38.1, t: 1.5, nota: SILUETA },
  9776: { forma: "marco", w: 30, h: 98.8, ceja: 22, t: 1.5, nota: SILUETA },
  4843: { forma: "angulo", a: 16, b: 99, t: 1.5, nota: SILUETA },
  2273: { forma: "marco", w: 39, h: 39.5, ceja: 20, t: 1.5, nota: SILUETA },
  2274: { forma: "canal", w: 44.89, h: 30, t: 1.5, nota: SILUETA },
  1087: { forma: "lama", w: 84.74, t: 2.2, grados: -14, nota: SILUETA },
  6617: { forma: "tuboRect", w: 111, h: 12, t: 1.2, nota: SILUETA },
  63299: {
    forma: "zeta",
    superior: 24.6,
    h: 32,
    inferior: 17.54,
    t: 1.5,
    nota: SILUETA,
  },
  11174: { forma: "canalInvertido", w: 50.8, h: 41.2, t: 1.5, nota: SILUETA },
  11035: { forma: "canal", w: 31.7, h: 14.35, t: 1.3, nota: SILUETA },
  10198: { forma: "canal", w: 41, h: 12, t: 1.4, nota: SILUETA },
  1046: { forma: "marco", w: 44.4, h: 25, ceja: 12, t: 1.5, nota: SILUETA },
  92046: { forma: "escalon", w: 53.44, h: 44.5, t: 1.6, nota: SILUETA },
  9187: { forma: "tuboRect", w: 79.5, h: 43, t: 1.6, nota: SILUETA },
  9207: { forma: "canalInvertido", w: 47.5, h: 30, t: 1.5, nota: SILUETA },
  9183: { forma: "hache", w: 42.5, h: 42.5, t: 1.6, nota: SILUETA },
  11032: {
    forma: "angulo",
    a: 12.7,
    b: 19.05,
    t: 1.3,
    nota: "Ángulo según la medida nominal del nombre (1/2 × 3/4 pulgadas); espesor ilustrativo.",
  },
  1304: { forma: "angulo", a: 25.4, b: 25.4, t: 1.6, nota: MEDIDA },
  1301: { forma: "angulo", a: 12.6, b: 12, t: 1.2, nota: MEDIDA },
  1303: { forma: "angulo", a: 19.05, b: 19.05, t: 1.4, nota: MEDIDA },
  1613: { forma: "tee", w: 25.6, h: 25.6, t: 1.6, nota: MEDIDA },
  14: {
    forma: "angulo",
    a: 38.1,
    b: 38.1,
    t: 3,
    nota: "Ángulo según las medidas de la fuente (1.5 × 1.5 pulgadas, espesor 3 mm).",
  },
  2488: { forma: "tuboRect", w: 25.4, h: 25.4, t: 1.2, nota: MEDIDA },
  2489: { forma: "tuboRect", w: 38.1, h: 38.1, t: 1.4, nota: MEDIDA },
  2521: { forma: "tuboRect", w: 50.8, h: 25.4, t: 1.3, nota: MEDIDA },
  82521: {
    forma: "tuboRect",
    w: 50.8,
    h: 25.4,
    t: 1.3,
    nota: MEDIDA + " La fuente no dibuja el detalle ornamental.",
  },
  9613: {
    forma: "tuboRect",
    w: 76.2,
    h: 44.45,
    t: 1.6,
    nota: MEDIDA + " La fuente no dibuja el detalle ornamental.",
  },
  1122: { forma: "tuboRect", w: 76.2, h: 44.45, t: 1.6, nota: MEDIDA },
  11186: { forma: "tuboRect", w: 76.2, h: 25.4, t: 1.5, nota: MEDIDA },
  12560: { forma: "canalInvertido", w: 52.6, h: 10, t: 1.2, nota: SILUETA },
  6370: { forma: "marco", w: 14.8, h: 17.7, ceja: 6, t: 1.2, nota: SILUETA },
  7014: { forma: "marco", w: 9.4, h: 11.3, ceja: 4, t: 1, nota: SILUETA },
  7013: { forma: "canal", w: 24, h: 13, t: 1.5, nota: SILUETA },
};

// ---------- Proyección 3D y sombreado ----------
const YAW = (34 * Math.PI) / 180,
  PITCH = (-22 * Math.PI) / 180;
const rotate = ([x, y, z]) => {
  const x1 = x * Math.cos(YAW) + z * Math.sin(YAW);
  const z1 = -x * Math.sin(YAW) + z * Math.cos(YAW);
  return [
    x1,
    y * Math.cos(PITCH) - z1 * Math.sin(PITCH),
    y * Math.sin(PITCH) + z1 * Math.cos(PITCH),
  ];
};
const project = (p) => {
  const [x, y, z] = rotate(p);
  return [x, -y, z];
};
const norm = (v) => {
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Luz principal de estudio arriba a la izquierda y luz de relleno a la derecha.
const KEY = norm([-0.5, 0.85, -0.6]),
  FILL = norm([0.8, 0.2, -0.4]);
const HALF = norm([KEY[0], KEY[1], KEY[2] - 1]);
// Aluminio natural: gris frío y claro.
function metal(n, extra = 0) {
  const d = Math.max(0, dot(n, KEY)),
    f = Math.max(0, dot(n, FILL)),
    sp = Math.pow(Math.max(0, dot(n, HALF)), 18);
  const k = Math.max(0.28, 0.44 + 0.56 * d + 0.1 * f + extra);
  const c = (base) => Math.round(Math.min(255, base * k + 70 * sp));
  return [c(192), c(199), c(207)];
}
const rgb = (color, m = 1, add = 0) =>
  `rgb(${color.map((v) => Math.round(Math.max(0, Math.min(255, v * m + add)))).join(",")})`;
const fmt = (n) => n.toFixed(2);
const pathOf = (pts) =>
  "M" + pts.map(([x, y]) => fmt(x) + " " + fmt(y)).join(" L") + " Z";

function render(section) {
  const outer = ccw(section.outer),
    holes = section.holes.map(cw);
  const xs = outer.map((p) => p[0]),
    ys = outer.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const centre = (pts) => pts.map(([x, y]) => [x - cx, y - cy]);
  const O = centre(outer),
    H = holes.map(centre);
  const maxDim = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  const L = maxDim * (2.1 + 1.7 * (1 - Math.min(1, maxDim / 111)));
  const walls = (pts) =>
    pts.map((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const n = norm([b[1] - a[1], -(b[0] - a[0]), 0]);
      const quad = [
        [...a, 0],
        [...b, 0],
        [...b, L],
        [...a, L],
      ].map(project);
      return {
        n,
        quad,
        depth: quad.reduce((s, p) => s + p[2], 0) / 4,
        visible: rotate(n)[2] < -1e-6,
      };
    });
  const outerWalls = walls(O).filter((w) => w.visible);
  const holeWalls = H.map((h) => walls(h).filter((w) => w.visible));
  const front = O.map(([x, y]) => project([x, y, 0]));
  const frontHoles = H.map((h) => h.map(([x, y]) => project([x, y, 0])));
  const backHoles = H.map((h) => h.map(([x, y]) => project([x, y, L])));
  const all = [...outerWalls.flatMap((w) => w.quad), ...front];
  const minX = Math.min(...all.map((p) => p[0])),
    maxX = Math.max(...all.map((p) => p[0])),
    minY = Math.min(...all.map((p) => p[1])),
    maxY = Math.max(...all.map((p) => p[1]));
  // El producto ocupa cerca de tres cuartas partes del cuadro para que se
  // reconozca también en miniatura.
  const scale = Math.min(
    (SIZE * 0.78) / (maxX - minX),
    (SIZE * 0.64) / (maxY - minY),
  );
  const ox = SIZE / 2 - ((minX + maxX) / 2) * scale,
    oy = SIZE * 0.47 - ((minY + maxY) / 2) * scale;
  const tx = (pts) => pts.map(([x, y]) => [x * scale + ox, y * scale + oy]);
  let defs = "",
    body = "",
    g = 0;
  // Cara lateral con reflejos alargados de aluminio cepillado.
  const face = (w, extra = 0) => {
    const [a, b, c, d] = tx(w.quad);
    const id = "g" + g++;
    const base = metal(w.n, extra);
    const stops = [
      [0, 1.02, 6],
      [0.12, 1.08, 14],
      [0.3, 0.96, 0],
      [0.52, 1.05, 10],
      [0.74, 0.93, 0],
      [1, 0.86, -4],
    ]
      .map(
        ([o, m, add]) =>
          `<stop offset="${o}" stop-color="${rgb(base, m, add)}"/>`,
      )
      .join("");
    defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fmt((a[0] + b[0]) / 2)}" y1="${fmt((a[1] + b[1]) / 2)}" x2="${fmt((c[0] + d[0]) / 2)}" y2="${fmt((c[1] + d[1]) / 2)}">${stops}</linearGradient>`;
    return `<path d="${pathOf([a, b, c, d])}" fill="url(#${id})" stroke="url(#${id})" stroke-width="0.9" stroke-linejoin="round"/>`;
  };
  // Sombra de contacto alineada con la barra y sombra ambiental amplia.
  const yMin = Math.min(...O.map((p) => p[1]));
  const bottom = O.filter((p) => p[1] === yMin);
  const bx = bottom.reduce((s, p) => s + p[0], 0) / bottom.length;
  const [s0] = tx([project([bx, yMin, 0])]),
    [s1] = tx([project([bx, yMin, L])]);
  const ang = (Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) * 180) / Math.PI;
  const len = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
  const mx = (s0[0] + s1[0]) / 2 + Math.cos((ang * Math.PI) / 180) * 10,
    my = (s0[1] + s1[1]) / 2 + Math.sin((ang * Math.PI) / 180) * 10;
  const widthPx = (Math.max(...xs) - Math.min(...xs)) * scale * 0.55 + 18;
  const shadow =
    `<ellipse cx="${fmt(mx)}" cy="${fmt(my + 18)}" rx="${fmt(len / 2 + widthPx * 0.6)}" ry="${fmt(widthPx * 0.42 + 10)}" transform="rotate(${fmt(ang)} ${fmt(mx)} ${fmt(my + 18)})" fill="#2c3640" opacity="0.13" filter="url(#soft)"/>` +
    `<ellipse cx="${fmt(mx)}" cy="${fmt(my + 5)}" rx="${fmt(Math.max(10, len / 2 - 14))}" ry="${fmt(Math.max(5, widthPx * 0.16))}" transform="rotate(${fmt(ang)} ${fmt(mx)} ${fmt(my + 5)})" fill="#1f2830" opacity="0.22" filter="url(#tight)"/>`;
  for (const w of [...outerWalls].sort((p, q) => q.depth - p.depth))
    body += face(w);
  H.forEach((_, i) => {
    const clip = "c" + i;
    const fh = pathOf(tx(frontHoles[i]));
    defs += `<clipPath id="${clip}"><path d="${fh}"/></clipPath>`;
    body += `<g clip-path="url(#${clip})"><path d="${fh}" fill="url(#hueco)"/>`;
    body += `<path d="${pathOf(tx(backHoles[i]))}" fill="#f3f5f7"/>`;
    for (const w of [...holeWalls[i]].sort((p, q) => q.depth - p.depth))
      body += face(w, -0.2);
    body += "</g>";
  });
  // Corte frontal: aluminio mecanizado más claro con borde iluminado.
  const capPts = tx(front);
  const cap = [pathOf(capPts), ...frontHoles.map((h) => pathOf(tx(h)))].join(
    " ",
  );
  const capA = capPts.reduce((m, p) => (p[0] + p[1] < m[0] + m[1] ? p : m));
  const capB = capPts.reduce((m, p) => (p[0] + p[1] > m[0] + m[1] ? p : m));
  defs += `<linearGradient id="cap" gradientUnits="userSpaceOnUse" x1="${fmt(capA[0])}" y1="${fmt(capA[1])}" x2="${fmt(capB[0])}" y2="${fmt(capB[1])}"><stop offset="0" stop-color="#f7f9fb"/><stop offset="0.45" stop-color="#e2e7ec"/><stop offset="1" stop-color="#c3cbd3"/></linearGradient>`;
  body += `<path d="${cap}" fill="url(#cap)" fill-rule="evenodd" stroke="#7d8790" stroke-width="1.6" stroke-linejoin="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<defs><radialGradient id="bg" cx="50%" cy="38%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#f5f7f9"/><stop offset="1" stop-color="#eef1f4"/></radialGradient>
<linearGradient id="hueco" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c555d"/><stop offset="1" stop-color="#8a939b"/></linearGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
<filter id="tight" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>${defs}</defs>
<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
${shadow}
${body}
</svg>`;
}

// ---------- Generación ----------
const productos = data.productos;
const faltan = productos.filter((p) => !spec[p.codigo]);
if (faltan.length)
  throw new Error(
    "Falta la forma de: " + faltan.map((p) => p.codigo).join(", "),
  );
for (const grupo of ["perfiles", "accesorios", "herrajes"]) {
  const carpeta = path.join(assets, grupo);
  await mkdir(carpeta, { recursive: true });
  // Solo se reemplazan las imágenes generadas (.webp) de cada carpeta.
  for (const archivo of await readdir(carpeta))
    if (archivo.endsWith(".webp")) await rm(path.join(carpeta, archivo));
}
await writeFile(path.join(assets, "herrajes/.gitkeep"), "");
const lines = [];
for (const p of productos) {
  const s = spec[p.codigo];
  const svg = render(shapes[s.forma](s));
  const destino = path.join(assets, p.imagen);
  await sharp(Buffer.from(svg))
    .webp({ quality: 88, effort: 6, smartSubsample: true })
    .toFile(destino);
  lines.push(
    `  ${JSON.stringify(p.codigo)}: { source: require("../assets/catalogo/${p.imagen}"), illustrative: true, note: ${JSON.stringify(s.nota)} },`,
  );
}
await writeFile(
  path.join(root, "packages/mobile/src/catalogImages.js"),
  "// Generado por scripts/catalogo/generar-imagenes.js. No editar a mano.\n" +
    "// Imágenes ilustrativas incluidas en la app, asociadas por código de producto.\n" +
    "// Una URL HTTPS registrada en el producto tiene prioridad sobre estas imágenes.\n" +
    "export const catalogImages = {\n" +
    lines.join("\n") +
    "\n};\n",
);
console.log(`Imágenes generadas: ${productos.length}`);
