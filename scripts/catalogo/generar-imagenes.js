// Genera una imagen individual por producto del catálogo importado.
// Son renders 3D generados por código (SVG convertido a WebP), no fotografías.
// Ejecutar desde la raíz: node scripts/catalogo/generar-imagenes.js
//
// Cada sección usa las medidas de la fuente cuando existen (diámetros, lados,
// anchos y alturas). Lo que la fuente no define (espesor de pared y la forma
// interior de perfiles especiales) se dibuja como representación ilustrativa y
// la app lo indica. Sustituye estas imágenes por fotografías o dibujos técnicos
// registrando una URL HTTPS en el producto desde la app Empresa.
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
// Formato horizontal 4:3.
const W = 1200,
  H = 900;

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
const circle = (r, n = 144) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
// Rectángulo con esquinas redondeadas.
function roundRect(x0, y0, x1, y1, r, n = 8) {
  const pts = [];
  const corners = [
    [x1 - r, y0 + r, -90],
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, 90],
    [x0 + r, y0 + r, 180],
  ];
  for (const [cx, cy, start] of corners)
    for (let i = 0; i <= n; i++) {
      const a = ((start + (90 * i) / n) * Math.PI) / 180;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  return pts;
}
// Perfil de pared delgada a partir de su línea media (aletas, canales, ganchos).
function strip(points, t) {
  const left = [],
    right = [];
  const off = (a, b, s) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy);
    return [(-dy / l) * s, (dx / l) * s];
  };
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0 || i === points.length - 1) {
      const [a, b] = i === 0 ? [p, points[1]] : [points[i - 1], p];
      const [ox, oy] = off(a, b, t / 2);
      left.push([p[0] + ox, p[1] + oy]);
      right.push([p[0] - ox, p[1] - oy]);
      continue;
    }
    // Unión en inglete entre los dos tramos.
    const a = points[i - 1],
      b = points[i + 1];
    const n1 = off(a, p, 1),
      n2 = off(p, b, 1);
    const mx = n1[0] + n2[0],
      my = n1[1] + n2[1];
    const k = t / 2 / Math.max(0.35, mx * n1[0] + my * n1[1]);
    left.push([p[0] + mx * k, p[1] + my * k]);
    right.push([p[0] - mx * k, p[1] - my * k]);
  }
  return [...left, ...right.reverse()];
}
// Placa base con aletas perpendiculares (rieles y guías).
function comb(width, base, fins, flip = false, totalH = 0) {
  const pts = [
    [0, 0],
    [width, 0],
  ];
  const sorted = [...fins].sort((a, b) => b.x - a.x);
  let cursorX = width;
  pts.push([width, base]);
  for (const f of sorted) {
    const x1 = Math.min(width, f.x + f.t / 2),
      x0 = Math.max(0, f.x - f.t / 2);
    if (x1 < cursorX) pts.push([x1, base]);
    pts.push([x1, f.h], [x0, f.h]);
    if (x0 > 0) pts.push([x0, base]);
    cursorX = x0;
  }
  if (cursorX > 0) pts.push([0, base]);
  const clean = pts.filter(
    (p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1],
  );
  return flip ? clean.map(([x, y]) => [x, totalH - y]) : clean;
}

const shapes = {
  tuboRedondo: ({ d, t }) => ({
    outer: circle(d / 2),
    holes: [circle(d / 2 - t)],
  }),
  tuboRect: ({ w, h, t }) => ({
    outer: rect(0, 0, w, h),
    holes: [rect(t, t, w - t, h - t)],
  }),
  tuboOrnamental: ({ w, h, t, r }) => ({
    outer: roundRect(0, 0, w, h, r),
    holes: [roundRect(t, t, w - t, h - t, Math.max(0.5, r - t))],
  }),
  tuboDosCeldas: ({ w, h, t }) => ({
    outer: rect(0, 0, w, h),
    holes: [
      rect(t, t, w / 2 - t / 2, h - t),
      rect(w / 2 + t / 2, t, w - t, h - t),
    ],
  }),
  tuboRanura: ({ w, h, t, ranura, fondo }) => {
    const s1 = w / 2 - ranura / 2,
      s2 = w / 2 + ranura / 2;
    return {
      outer: [
        [0, 0],
        [w, 0],
        [w, h],
        [s2, h],
        [s2, h - fondo],
        [s1, h - fondo],
        [s1, h],
        [0, h],
      ],
      holes: [
        [
          [t, t],
          [w - t, t],
          [w - t, h - t],
          [s2 + t, h - t],
          [s2 + t, h - fondo - t],
          [s1 - t, h - fondo - t],
          [s1 - t, h - t],
          [t, h - t],
        ],
      ],
    };
  },
  duela: ({ w, h, t, lengua }) => {
    const a = h * 0.32,
      b = h * 0.68;
    return {
      outer: [
        [0, 0],
        [w, 0],
        [w, a],
        [w + lengua, a],
        [w + lengua, b],
        [w, b],
        [w, h],
        [0, h],
        [0, b],
        [lengua, b],
        [lengua, a],
        [0, a],
      ],
      holes: [rect(lengua + t, t, w - t, h - t)],
    };
  },
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
  linea: ({ puntos, t }) => ({ outer: strip(puntos, t), holes: [] }),
  peine: ({ w, base, aletas, invertido = false, alto = 0 }) => ({
    outer: comb(w, base, aletas, invertido, alto),
    holes: [],
  }),
};

// Las notas aparecen en la ficha del producto.
const MEDIDA =
  "Sección exterior según las medidas de la fuente; espesor de pared ilustrativo.";
const SILUETA =
  "Representación ilustrativa: la fuente no define la geometría completa del perfil comercial.";
const ORNAMENTAL =
  "Medidas exteriores de la fuente; las esquinas redondeadas de la línea ornamental son ilustrativas.";
const spec = {
  // Tubos y barandales: Ø de la fuente.
  53883: { forma: "tuboRedondo", d: 76.2, t: 1.8, nota: MEDIDA },
  53896: { forma: "tuboRedondo", d: 60, t: 1.6, nota: MEDIDA },
  22196: { forma: "tuboRedondo", d: 50.8, t: 1.5, nota: MEDIDA },
  22197: { forma: "tuboRedondo", d: 25.4, t: 1.2, nota: MEDIDA },
  // Zoclos.
  8327: {
    forma: "tuboRanura",
    w: 85.5,
    h: 38.1,
    t: 1.6,
    ranura: 14,
    fondo: 18,
    nota: SILUETA,
  },
  9776: {
    forma: "linea",
    puntos: [
      [16, 0],
      [0, 0],
      [0, 98.8],
      [14, 98.8],
      [14, 88],
    ],
    t: 1.6,
    nota: SILUETA,
  },
  4843: {
    forma: "linea",
    puntos: [
      [12, 0],
      [0, 0],
      [0, 99],
      [6, 99],
      [6, 84],
      [11, 79],
      [11, 8],
    ],
    t: 1.5,
    nota: SILUETA,
  },
  // Serie 35.
  2273: {
    forma: "linea",
    puntos: [
      [6, 39.5],
      [0, 39.5],
      [0, 10],
      [10, 0],
      [39, 0],
      [39, 6],
    ],
    t: 1.6,
    nota: SILUETA,
  },
  2274: {
    forma: "linea",
    puntos: [
      [0, 30],
      [0, 14],
      [22, 14],
      [22, 0],
      [44.89, 0],
      [44.89, 6],
    ],
    t: 1.6,
    nota: SILUETA,
  },
  1087: {
    forma: "linea",
    puntos: [
      [3, 7],
      [0, 3.5],
      [4, 0],
      [80, 21],
      [84.74, 25],
      [81.5, 28.5],
    ],
    t: 1.7,
    nota: SILUETA,
  },
  6617: { forma: "duela", w: 111, h: 12, t: 1.2, lengua: 4, nota: SILUETA },
  // Recubrimientos.
  63299: {
    forma: "zeta",
    superior: 24.6,
    h: 32,
    inferior: 17.54,
    t: 1.6,
    nota: "Perfil Z con las medidas de la fuente (24.60, 32 y 17.54 mm); espesor ilustrativo.",
  },
  // Cancel de baño.
  11174: {
    forma: "peine",
    w: 50.8,
    base: 1.8,
    aletas: [
      { x: 0.9, h: 41.2, t: 1.8 },
      { x: 18, h: 26, t: 1.5 },
      { x: 32.8, h: 26, t: 1.5 },
      { x: 49.9, h: 41.2, t: 1.8 },
    ],
    nota: "Riel con canales de deslizamiento; ancho y alto de la fuente (50.8 × 41.2 mm), canales interiores ilustrativos.",
  },
  11035: {
    forma: "linea",
    puntos: [
      [26, 14.35],
      [31.7, 14.35],
      [31.7, 0],
      [0, 0],
      [0, 14.35],
    ],
    t: 1.4,
    nota: SILUETA,
  },
  10198: {
    forma: "peine",
    w: 41,
    base: 1.6,
    aletas: [
      { x: 0.8, h: 8, t: 1.6 },
      { x: 14, h: 13, t: 1.4 },
      { x: 27, h: 13, t: 1.4 },
      { x: 40.2, h: 8, t: 1.6 },
    ],
    nota: "Guía con carriles; ancho de la fuente (41 mm), altura y carriles ilustrativos.",
  },
  1046: {
    forma: "linea",
    puntos: [
      [0, 25],
      [0, 0],
      [44.4, 0],
      [44.4, 10],
      [40, 10],
    ],
    t: 1.6,
    nota: SILUETA,
  },
  // Puerta batiente 1750.
  92046: { forma: "escalon", w: 53.44, h: 44.5, t: 1.6, nota: SILUETA },
  9187: { forma: "tuboDosCeldas", w: 79.5, h: 43, t: 1.6, nota: SILUETA },
  9207: {
    forma: "peine",
    w: 47.5,
    base: 1.8,
    aletas: [
      { x: 0.9, h: 30, t: 1.8 },
      { x: 23.75, h: 12, t: 1.6 },
      { x: 46.6, h: 30, t: 1.8 },
    ],
    nota: "Cabezal con tope central; ancho de la fuente (47.5 mm), altura y tope ilustrativos.",
  },
  9183: { forma: "hache", w: 42.5, h: 42.5, t: 1.6, nota: SILUETA },
  11032: {
    forma: "angulo",
    a: 12.7,
    b: 19.05,
    t: 1.3,
    nota: "Ángulo según la medida nominal del nombre (1/2 × 3/4 pulgadas); espesor ilustrativo.",
  },
  // Ángulos, Tee y Solera.
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
  // Tubos cuadrados y rectangulares.
  2488: { forma: "tuboRect", w: 25.4, h: 25.4, t: 1.3, nota: MEDIDA },
  2489: { forma: "tuboRect", w: 38.1, h: 38.1, t: 1.5, nota: MEDIDA },
  2521: { forma: "tuboRect", w: 50.8, h: 25.4, t: 1.4, nota: MEDIDA },
  82521: {
    forma: "tuboOrnamental",
    w: 50.8,
    h: 25.4,
    t: 1.4,
    r: 6,
    nota: ORNAMENTAL,
  },
  9613: {
    forma: "tuboOrnamental",
    w: 76.2,
    h: 44.45,
    t: 1.6,
    r: 9,
    nota: ORNAMENTAL,
  },
  1122: { forma: "tuboRect", w: 76.2, h: 44.45, t: 1.6, nota: MEDIDA },
  11186: { forma: "tuboRect", w: 76.2, h: 25.4, t: 1.5, nota: MEDIDA },
  // Accesorios.
  12560: {
    forma: "linea",
    puntos: [
      [5, 3],
      [0, 0],
      [0, 10],
      [52.6, 10],
      [52.6, 0],
      [47.6, 3],
    ],
    t: 1.3,
    nota: SILUETA,
  },
  6370: {
    forma: "linea",
    puntos: [
      [3, 2.5],
      [0, 0],
      [0, 17.7],
      [14.8, 17.7],
      [14.8, 13],
    ],
    t: 1.3,
    nota: SILUETA,
  },
  7014: {
    forma: "linea",
    puntos: [
      [0, 0],
      [0, 11.3],
      [3, 11.3],
      [9.4, 2.5],
      [9.4, 0],
    ],
    t: 1.1,
    nota: SILUETA,
  },
  7013: {
    forma: "linea",
    puntos: [
      [0, 13],
      [0, 0],
      [24, 0],
      [24, 13],
    ],
    t: 1.6,
    nota: "Canal U con las medidas de la fuente (24 × 13 mm); espesor ilustrativo.",
  },
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
// Luz principal de estudio arriba a la izquierda y relleno a la derecha.
const KEY = norm([-0.5, 0.85, -0.6]),
  FILL = norm([0.8, 0.2, -0.4]);
const HALF = norm([KEY[0], KEY[1], KEY[2] - 1]);
// Aluminio satinado: gris frío, reflejo suave y amplio.
function metal(n, extra = 0, color = [190, 197, 205]) {
  const d = Math.max(0, dot(n, KEY)),
    f = Math.max(0, dot(n, FILL)),
    sp = Math.pow(Math.max(0, dot(n, HALF)), 10);
  const k = Math.max(0.3, 0.44 + 0.54 * d + 0.12 * f + extra);
  const c = (base) => Math.round(Math.min(255, base * k + 48 * sp));
  return color.map(c);
}
const rgb = (color, m = 1, add = 0) =>
  `rgb(${color.map((v) => Math.round(Math.max(0, Math.min(255, v * m + add)))).join(",")})`;
const fmt = (n) => n.toFixed(2);
const pathOf = (pts) =>
  "M" + pts.map(([x, y]) => fmt(x) + " " + fmt(y)).join(" L") + " Z";

function render(section, opts = {}) {
  const outer = ccw(section.outer),
    holes = section.holes.map(cw);
  const xs = outer.map((p) => p[0]),
    ys = outer.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const centre = (pts) => pts.map(([x, y]) => [x - cx, y - cy]);
  const O = centre(outer),
    Hs = holes.map(centre);
  const maxDim = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  // Longitud visible de la barra: más larga en perfiles pequeños.
  const L = opts.largo
    ? maxDim * opts.largo
    : maxDim * (2.4 + 1.8 * (1 - Math.min(1, maxDim / 111)));
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
  const holeWalls = Hs.map((h) => walls(h).filter((w) => w.visible));
  const front = O.map(([x, y]) => project([x, y, 0]));
  const frontHoles = Hs.map((h) => h.map(([x, y]) => project([x, y, 0])));
  const backHoles = Hs.map((h) => h.map(([x, y]) => project([x, y, L])));
  const all = [...outerWalls.flatMap((w) => w.quad), ...front];
  const minX = Math.min(...all.map((p) => p[0])),
    maxX = Math.max(...all.map((p) => p[0])),
    minY = Math.min(...all.map((p) => p[1])),
    maxY = Math.max(...all.map((p) => p[1]));
  // El producto ocupa cerca del 80 % del cuadro.
  const scale = Math.min(
    (W * 0.84) / (maxX - minX),
    (H * 0.76) / (maxY - minY),
  );
  const ox = W / 2 - ((minX + maxX) / 2) * scale,
    oy = H * 0.47 - ((minY + maxY) / 2) * scale;
  const tx = (pts) => pts.map(([x, y]) => [x * scale + ox, y * scale + oy]);
  let defs = "",
    body = "",
    g = 0;
  const face = (w, extra = 0) => {
    const [a, b, c, d] = tx(w.quad);
    const id = "g" + g++;
    const base = metal(w.n, extra, opts.color);
    const stops = [
      [0, 1.0, 4],
      [0.14, 1.06, 12],
      [0.34, 0.97, 0],
      [0.55, 1.04, 8],
      [0.78, 0.95, 0],
      [1, 0.9, -2],
    ]
      .map(
        ([o, m, add]) =>
          `<stop offset="${o}" stop-color="${rgb(base, m, add)}"/>`,
      )
      .join("");
    defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fmt((a[0] + b[0]) / 2)}" y1="${fmt((a[1] + b[1]) / 2)}" x2="${fmt((c[0] + d[0]) / 2)}" y2="${fmt((c[1] + d[1]) / 2)}">${stops}</linearGradient>`;
    return `<path d="${pathOf([a, b, c, d])}" fill="url(#${id})" stroke="url(#${id})" stroke-width="0.8" stroke-linejoin="round"/>`;
  };
  // Sombra de contacto alineada con la barra y sombra ambiental muy suave.
  const yMin = Math.min(...O.map((p) => p[1]));
  const bottom = O.filter((p) => Math.abs(p[1] - yMin) < 1e-6);
  const bx = bottom.reduce((s, p) => s + p[0], 0) / bottom.length;
  const [s0] = tx([project([bx, yMin, 0])]),
    [s1] = tx([project([bx, yMin, L])]);
  const ang = (Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) * 180) / Math.PI;
  const len = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
  const mx = (s0[0] + s1[0]) / 2 + Math.cos((ang * Math.PI) / 180) * 10,
    my = (s0[1] + s1[1]) / 2 + Math.sin((ang * Math.PI) / 180) * 10;
  const widthPx = (Math.max(...xs) - Math.min(...xs)) * scale * 0.55 + 18;
  const shadow =
    `<ellipse cx="${fmt(mx)}" cy="${fmt(my + 16)}" rx="${fmt(len / 2 + widthPx * 0.5)}" ry="${fmt(widthPx * 0.35 + 10)}" transform="rotate(${fmt(ang)} ${fmt(mx)} ${fmt(my + 16)})" fill="#2c3640" opacity="0.10" filter="url(#soft)"/>` +
    `<ellipse cx="${fmt(mx)}" cy="${fmt(my + 4)}" rx="${fmt(Math.max(10, len / 2 - 14))}" ry="${fmt(Math.max(4, widthPx * 0.12))}" transform="rotate(${fmt(ang)} ${fmt(mx)} ${fmt(my + 4)})" fill="#1f2830" opacity="0.2" filter="url(#tight)"/>`;
  for (const w of [...outerWalls].sort((p, q) => q.depth - p.depth))
    body += face(w);
  Hs.forEach((_, i) => {
    const clip = "c" + i;
    const fh = pathOf(tx(frontHoles[i]));
    defs += `<clipPath id="${clip}"><path d="${fh}"/></clipPath>`;
    body += `<g clip-path="url(#${clip})"><path d="${fh}" fill="url(#hueco)"/>`;
    body += `<path d="${pathOf(tx(backHoles[i]))}" fill="#f6f7f9"/>`;
    for (const w of [...holeWalls[i]].sort((p, q) => q.depth - p.depth))
      body += face(w, -0.22);
    body += "</g>";
  });
  // Corte frontal: aluminio mecanizado con borde definido.
  const capPts = tx(front);
  const cap = [pathOf(capPts), ...frontHoles.map((h) => pathOf(tx(h)))].join(
    " ",
  );
  const capA = capPts.reduce((m, p) => (p[0] + p[1] < m[0] + m[1] ? p : m));
  const capB = capPts.reduce((m, p) => (p[0] + p[1] > m[0] + m[1] ? p : m));
  defs += `<linearGradient id="cap" gradientUnits="userSpaceOnUse" x1="${fmt(capA[0])}" y1="${fmt(capA[1])}" x2="${fmt(capB[0])}" y2="${fmt(capB[1])}">${opts.corte ?? '<stop offset="0" stop-color="#f8fafb"/><stop offset="0.5" stop-color="#e1e6eb"/><stop offset="1" stop-color="#c4ccd4"/>'}</linearGradient>`;
  body += `<path d="${cap}" fill="url(#cap)" fill-rule="evenodd" stroke="#808a94" stroke-width="1.3" stroke-linejoin="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="hueco" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#48515a"/><stop offset="1" stop-color="#8a939b"/></linearGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>
<filter id="tight" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>${defs}</defs>
<rect width="${W}" height="${H}" fill="#ffffff"/>
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
// Ninguna sección puede repetirse entre productos distintos.
const firmas = new Map();
for (const p of productos) {
  const { nota, ...geo } = spec[p.codigo];
  const key = JSON.stringify(geo);
  if (firmas.has(key))
    throw new Error(`Geometría repetida: ${firmas.get(key)} y ${p.codigo}`);
  firmas.set(key, p.codigo);
}
for (const grupo of ["perfiles", "accesorios", "herrajes"]) {
  const carpeta = path.join(assets, grupo);
  await mkdir(carpeta, { recursive: true });
  // Solo se reemplazan las imágenes generadas (.webp) de cada carpeta.
  for (const archivo of await readdir(carpeta))
    if (archivo.endsWith(".webp")) await rm(path.join(carpeta, archivo));
}
await writeFile(path.join(assets, "herrajes/.gitkeep"), "");
const lines = [];
let bytes = 0;
for (const p of productos) {
  const s = spec[p.codigo];
  const svg = render(shapes[s.forma](s));
  const destino = path.join(assets, p.imagen);
  const info = await sharp(Buffer.from(svg))
    .webp({ quality: 86, effort: 6, smartSubsample: true })
    .toFile(destino);
  bytes += info.size;
  lines.push(
    `  ${JSON.stringify(p.codigo)}: { source: require("../assets/catalogo/${p.imagen}"), illustrative: true, note: ${JSON.stringify(s.nota)} },`,
  );
}
// Imágenes genéricas por tipo para productos sin imagen propia (por ejemplo,
// productos registrados desde la app). Se asignan por nombre con genericTypeOf.
const GENERICA =
  "Imagen genérica según el tipo de producto; no corresponde a un modelo específico.";
const genericas = {
  angulo: { seccion: shapes.angulo({ a: 25.4, b: 25.4, t: 1.6 }) },
  "tubo-cuadrado": { seccion: shapes.tuboRect({ w: 30, h: 30, t: 1.4 }) },
  "tubo-rectangular": { seccion: shapes.tuboRect({ w: 60, h: 30, t: 1.5 }) },
  "tubo-redondo": { seccion: shapes.tuboRedondo({ d: 38, t: 1.4 }) },
  "perfil-corrediza": {
    seccion: shapes.peine({
      w: 76,
      base: 1.8,
      aletas: [
        { x: 0.9, h: 22, t: 1.8 },
        { x: 22, h: 14, t: 1.6 },
        { x: 38, h: 18, t: 1.6 },
        { x: 54, h: 14, t: 1.6 },
        { x: 75.1, h: 22, t: 1.8 },
      ],
    }),
  },
  vidrio: {
    seccion: { outer: rect(0, 0, 120, 6), holes: [] },
    opciones: {
      largo: 1.1,
      color: [168, 206, 214],
      corte:
        '<stop offset="0" stop-color="#e3f5f6"/><stop offset="1" stop-color="#86bcc4"/>',
    },
  },
  rueda: {
    seccion: shapes.tuboRedondo({ d: 35, t: 11 }),
    opciones: { largo: 0.32 },
  },
  chapa: {
    seccion: {
      outer: roundRect(0, 0, 32, 70, 5),
      holes: [
        circle(4.5, 48).map(([x, y]) => [x + 16, y + 44]),
        rect(14.2, 28, 17.8, 40),
      ],
    },
    opciones: { largo: 0.45 },
  },
};
await mkdir(path.join(assets, "genericas"), { recursive: true });
for (const archivo of await readdir(path.join(assets, "genericas")))
  if (archivo.endsWith(".webp"))
    await rm(path.join(assets, "genericas", archivo));
const lineasGenericas = [];
for (const [tipo, g] of Object.entries(genericas)) {
  const svg = render(g.seccion, g.opciones);
  const info = await sharp(Buffer.from(svg))
    .webp({ quality: 86, effort: 6, smartSubsample: true })
    .toFile(path.join(assets, "genericas", tipo + ".webp"));
  bytes += info.size;
  lineasGenericas.push(
    `  ${JSON.stringify(tipo)}: { source: require("../assets/catalogo/genericas/${tipo}.webp"), illustrative: true, generic: true, note: ${JSON.stringify(GENERICA)} },`,
  );
}
await writeFile(
  path.join(root, "packages/mobile/src/catalogImages.js"),
  "// Generado por scripts/catalogo/generar-imagenes.js. No editar a mano.\n" +
    "// Renders ilustrativos incluidos en la app (1200 × 900), asociados por código.\n" +
    "// Una URL HTTPS registrada en el producto tiene prioridad sobre estas imágenes.\n" +
    "export const catalogImages = {\n" +
    lines.join("\n") +
    "\n};\n" +
    "export const genericImages = {\n" +
    lineasGenericas.join("\n") +
    "\n};\n",
);
console.log(
  `Imágenes generadas: ${productos.length} · ${Math.round(bytes / 1024)} KB en total`,
);
