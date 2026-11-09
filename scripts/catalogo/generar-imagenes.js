// Genera las imágenes del catálogo maestro de ALUFORMIX:
//   - un render 3D por producto cuya sección se modeló a partir del plano,
//   - una ilustración por sistema de cancelería (conjunto armado),
//   - imágenes genéricas por tipo para productos ajenos al catálogo maestro,
//   - packages/mobile/src/catalogImages.js y database/catalogo/image-manifest.json.
// Son renders generados por código (SVG → WebP), independientes del arte de los
// documentos del proveedor; no se copian páginas, dibujos ni logotipos.
// Los registros sin sección modelada quedan como «pendiente» en el manifiesto y
// la app muestra «Imagen técnica pendiente de validar».
// Ejecutar desde la raíz: node scripts/catalogo/generar-imagenes.js
import { mkdir, readdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import data from "../../packages/catalog/src/data.js";
import { seccionesSistemas } from "./secciones-sistemas.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const assets = path.join(root, "packages/mobile/assets/catalogo");
const W = 1200,
  H = 900;

// ---------- Geometría (milímetros, eje Y hacia arriba) ----------
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
const circle = (r, n = 144, cx = 0, cy = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
const arc = (cx, cy, r, a0, a1, n = 24) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
// Pared delgada a partir de su línea media.
function strip(points, t) {
  const left = [],
    right = [];
  const off = (a, b, s) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
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
    const n1 = off(points[i - 1], p, 1),
      n2 = off(p, points[i + 1], 1);
    const mx = n1[0] + n2[0],
      my = n1[1] + n2[1];
    const k = t / 2 / Math.max(0.35, mx * n1[0] + my * n1[1]);
    left.push([p[0] + mx * k, p[1] + my * k]);
    right.push([p[0] - mx * k, p[1] - my * k]);
  }
  return [...left, ...right.reverse()];
}
// Una sección se compone de piezas: { outer, holes }.
const solid = (outer, holes = []) => ({ outer, holes });
const wall = (points, t) => solid(strip(points, t));
const box = (x0, y0, x1, y1, t) =>
  solid(rect(x0, y0, x1, y1), [rect(x0 + t, y0 + t, x1 - t, y1 - t)]);
const ring = (d, t) => solid(circle(d / 2), [circle(d / 2 - t)]);
const angle = (a, b, t) =>
  solid([
    [0, 0],
    [a, 0],
    [a, t],
    [t, t],
    [t, b],
    [0, b],
  ]);
// Pasamanos: aro con ranura superior y dos aletas interiores (según plano).
function handrail(d, t, slot, depth, finY, finL) {
  const r = d / 2,
    half = slot / 2,
    a0 = (Math.asin(half / r) * 180) / Math.PI;
  const path = [
    [-half, r],
    [-half, r - depth],
    [half, r - depth],
    [half, r],
    ...arc(0, 0, r - t / 2, 90 - a0, -270 + a0, 120).slice(1),
  ];
  return [
    wall(path, t),
    solid(rect(-r + t * 0.6, finY - t / 2, -r + finL, finY + t / 2)),
    solid(rect(r - finL, finY - t / 2, r - t * 0.6, finY + t / 2)),
  ];
}

// Notas: lo que viene del plano y lo que es ilustrativo.
const PLANO =
  "Sección modelada a partir del plano de origen; espesor de pared ilustrativo.";
const PLANO_SIMPLE =
  "Silueta simplificada a partir del plano de origen; detalles finos (dentados, radios y ranuras menores) omitidos.";
// Secciones modeladas por código. Medidas en mm tomadas de las cotas del plano.
const SECCIONES = {
  53883: { piezas: handrail(76.2, 1.8, 11.5, 9, 10, 8), nota: PLANO },
  53896: { piezas: handrail(60, 1.6, 9, 7.5, 7, 6.5), nota: PLANO },
  22196: { piezas: [ring(50.8, 1.5)], nota: PLANO },
  22197: { piezas: [ring(25.4, 1.2)], nota: PLANO },
  8327: {
    piezas: [
      solid([
        [0, 40.8],
        [14, 39],
        [85.5, 39],
        [85.5, 43],
        [14, 43],
        [5, 42.4],
      ]),
      solid([
        [0, 2.2],
        [5, 0.6],
        [14, 0],
        [85.5, 0],
        [85.5, 4],
        [14, 4],
      ]),
      solid(rect(19, 3.5, 22, 39.5)),
    ],
    nota: PLANO_SIMPLE,
  },
  9776: {
    piezas: [
      solid([
        [0, 1.5],
        [1.5, 0],
        [87.3, 0],
        [88.8, 1.5],
        [88.8, 4],
        [0, 4],
      ]),
      solid(rect(33, 3.5, 37.5, 98.8)),
      solid(rect(51.5, 3.5, 56, 98.8)),
    ],
    nota: PLANO_SIMPLE,
  },
  4843: {
    piezas: [
      wall(
        [[0, 11.85], [89, 11.85], ...arc(89, 1.85, 10, 90, 0, 12).slice(1)],
        1.5,
      ),
      wall(
        [
          [10, 11.85],
          [10, 4],
          [13, 4],
        ],
        1.4,
      ),
      wall(
        [
          [66, 11.85],
          [66, 4],
          [63, 4],
        ],
        1.4,
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  12560: {
    piezas: [
      solid(rect(0, 0, 52.6, 1.4)),
      wall(
        [
          [3, 1],
          [3, 4.8],
          [1.2, 6.45],
        ],
        1.2,
      ),
      wall(
        [
          [49.6, 1],
          [49.6, 4.8],
          [51.4, 6.45],
        ],
        1.2,
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  2273: {
    piezas: [
      box(0, 0, 39, 13, 1.5),
      solid(rect(33.5, 12.5, 35, 37.5)),
      wall(
        [
          [34.25, 37],
          [34.25, 39.5],
          [37.5, 39.5],
        ],
        1.5,
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  2274: {
    piezas: [
      solid(
        [
          [0, 0],
          [36, 0],
          ...arc(36, 15, 15, -90, 90, 18).slice(1, -1),
          [36, 30],
          [7, 30],
          [7, 13],
          [0, 13],
        ],
        [
          rect(8.6, 1.6, 24, 28.4),
          [
            [25.6, 1.6],
            [36, 1.6],
            ...arc(36, 15, 13.4, -90, 90, 16).slice(1, -1),
            [36, 28.4],
            [25.6, 28.4],
          ],
        ],
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  1087: {
    piezas: [
      wall(
        [
          [0, 0],
          [5, 5.5],
          [76, 9],
          [83, 21],
          [84.74, 23.41],
        ],
        1.6,
      ),
      wall(
        [
          [13, 7],
          [13, 3.5],
          [17, 3.5],
          [17, 6],
        ],
        1.2,
      ),
      wall(
        [
          [66, 8.6],
          [66, 5],
          [70, 5],
          [70, 7.6],
        ],
        1.2,
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  6617: {
    piezas: [
      wall(
        [
          [0, 3.6],
          [1.2, 5.35],
          [101, 5.35],
          [101, 0.75],
          [110.2, 0.75],
          [110.2, 4],
        ],
        1.5,
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  63299: {
    piezas: [
      wall(
        [
          [0, 29.8],
          [0, 31.3],
          [24.6, 31.3],
          [37, 0.7],
          [54.1, 0.7],
          [54.1, 2],
        ],
        1.4,
      ),
    ],
    nota: PLANO,
  },
  11174: {
    piezas: [
      solid(rect(0, 49, 41.2, 50.8)),
      solid(rect(0, 0, 1.6, 50.8)),
      solid(rect(39.6, 0, 41.2, 50.8)),
      solid(rect(10, 41.5, 11.5, 49.5)),
      solid(rect(29.7, 41.5, 31.2, 49.5)),
      wall(
        [
          [1.6, 25],
          [8.5, 25],
          [10, 23],
        ],
        1.4,
      ),
      wall(
        [
          [39.6, 25],
          [32.7, 25],
          [31.2, 23],
        ],
        1.4,
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  11035: {
    piezas: [
      box(14, 0, 31.7, 14.35, 1.4),
      solid(rect(0, 0, 14.5, 1.4)),
      wall(
        [
          [0, 11.5],
          [6, 12.6],
          [11, 12.1],
          [14.5, 13.6],
        ],
        1.3,
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  10198: {
    piezas: [
      wall(
        [
          [0, 12.6],
          [41, 15.2],
        ],
        1.6,
      ),
      solid(rect(0, 8, 1.6, 13.3)),
      solid(rect(12.5, 3, 14, 13.8)),
      solid(rect(24.5, 3, 26, 14.6)),
      solid(rect(39.4, 0, 41, 16)),
    ],
    nota: PLANO_SIMPLE,
  },
  1046: {
    piezas: [
      box(0, 0, 18, 14.2, 1.4),
      solid(rect(17.5, 0, 44.4, 1.4)),
      wall(
        [
          [17.5, 13.5],
          [28, 13.5],
          [33, 11],
          [44.4, 11],
        ],
        1.3,
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  9204: {
    piezas: [
      solid(
        [
          [4.5, 0],
          [53.44, 0],
          [53.44, 14],
          [50.5, 14],
          [50.5, 18],
          [53.44, 18],
          [53.44, 28],
          [50.5, 28],
          [50.5, 32],
          [53.44, 32],
          [53.44, 44.5],
          [4.5, 44.5],
          ...arc(26, 22.25, 26.5, 123, 237, 18).slice(1, -1),
        ],
        [
          [
            [6, 1.6],
            [48.9, 1.6],
            [48.9, 42.9],
            [6, 42.9],
            ...arc(26, 22.25, 24.9, 125, 235, 16).slice(1, -1),
          ],
        ].map((h) => h),
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  9187: {
    piezas: [
      solid(rect(0, 41.4, 79.5, 43)),
      solid(rect(0, 0, 79.5, 1.6)),
      solid(rect(0, 0, 1.6, 43)),
      solid(rect(45, 0, 46.6, 43)),
      solid(rect(1.6, 26, 5, 29)),
      solid(rect(1.6, 14, 5, 17)),
    ],
    nota: PLANO_SIMPLE,
  },
  9207: {
    piezas: [
      solid(rect(0, 41.4, 47.5, 43)),
      solid(rect(0, 0, 47.5, 1.6)),
      solid(rect(0, 0, 1.6, 43)),
      solid(rect(31, 0, 32.6, 43)),
      solid(rect(1.6, 26, 5, 29)),
      solid(rect(1.6, 14, 5, 17)),
    ],
    nota: PLANO_SIMPLE,
  },
  9183: {
    piezas: [
      solid(
        [
          [0, 0],
          [9, 0],
          [9, 2.5],
          [15, 2.5],
          [15, 0],
          [27.5, 0],
          [27.5, 2.5],
          [33.5, 2.5],
          [33.5, 0],
          [42.5, 0],
          [42.5, 42.5],
          [33.5, 42.5],
          [33.5, 40],
          [27.5, 40],
          [27.5, 42.5],
          [15, 42.5],
          [15, 40],
          [9, 40],
          [9, 42.5],
          [0, 42.5],
        ],
        [rect(1.6, 4.1, 40.9, 38.4)],
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  11032: {
    piezas: [
      wall(
        [
          [2.4, 12.5],
          [0.7, 12.5],
          [0.7, 0.7],
          [19, 0.4],
        ],
        1.4,
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  1304: { piezas: [angle(25.4, 25.4, 1.6)], nota: PLANO },
  1301: { piezas: [angle(12.6, 12, 1.2)], nota: PLANO },
  1303: { piezas: [angle(19.05, 19.05, 1.4)], nota: PLANO },
  1613: {
    piezas: [
      solid(rect(-12.8, 24, 12.8, 25.6)),
      solid(rect(-0.8, 0, 0.8, 24.2)),
    ],
    nota: PLANO,
  },
  14: {
    piezas: [angle(37.5, 37.5, 3)],
    nota: "Ángulo según el plano (37.5 × 37.5 mm, espesor 3 mm).",
  },
  2488: { piezas: [box(0, 0, 25.4, 25.4, 1.3)], nota: PLANO },
  2489: { piezas: [box(0, 0, 38.1, 38.1, 1.5)], nota: PLANO },
  2521: { piezas: [box(0, 0, 50.8, 25.4, 1.4)], nota: PLANO },
  82521: {
    piezas: [box(0, 0, 50.8, 25.4, 1.4)],
    nota:
      PLANO +
      " El plano dibuja la misma sección exterior que el tubo normal 2521.",
  },
  9613: {
    piezas: [box(0, 0, 76.2, 44.45, 1.6)],
    nota:
      PLANO +
      " El plano dibuja la misma sección exterior que el tubo normal 1122.",
  },
  1122: { piezas: [box(0, 0, 76.2, 44.45, 1.6)], nota: PLANO },
  11186: { piezas: [box(0, 0, 76.2, 25.4, 1.5)], nota: PLANO },
  6370: {
    piezas: [
      wall(
        [
          [2.5, 0.7],
          [0.75, 0.7],
          [0.75, 16.3],
          [14.05, 16.3],
          [14.05, 3],
          [12.5, 1.5],
        ],
        1.4,
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  7014: {
    piezas: [
      wall(
        [
          [2.5, 11.3],
          [0.7, 11.3],
          [0.7, 0.7],
          [8.7, 0.7],
          [8.7, 6],
          [7, 7.5],
        ],
        1.3,
      ),
    ],
    nota: PLANO_SIMPLE,
  },
  7013: {
    piezas: [
      wall(
        [
          [0.75, 5],
          [0.75, 0.75],
          [8, 0.75],
          [8, 5],
          [12, 5],
          [12, 0.75],
          [22.5, 0.75],
          [22.5, 12.25],
          [19, 12.25],
        ],
        1.5,
      ),
    ],
    nota: PLANO_SIMPLE,
  },
};
// Lote de sistemas (mosquiteros, corredizas, fijas, C-80 y C-100 MID).
const NOTA_FLEXIBLE =
  "Representación ilustrativa según el dibujo del manual; el material y las medidas exactas no están acotados.";
const NOTA_PLANA =
  "Pieza plana representada según el dibujo del manual; sin cotas en la fuente, proporciones ilustrativas.";
for (const [codigo, valor] of Object.entries(
  seccionesSistemas({ rect, solid, wall, arc }),
)) {
  const entrada = Array.isArray(valor) ? { piezas: valor } : valor;
  SECCIONES[codigo] = {
    ...entrada,
    nota: entrada.opciones?.color
      ? NOTA_FLEXIBLE
      : ["GN-608", "GN-554"].includes(codigo)
        ? NOTA_PLANA
        : PLANO_SIMPLE,
  };
}
// Perfiles idénticos en el plano: se permite repetir su geometría.
const MISMA_SECCION_EN_PLANO = [
  ["2521", "82521"],
  ["1122", "9613"],
];

// ---------- Proyección y sombreado ----------
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
  const l = Math.hypot(...v) || 1;
  return v.map((c) => c / l);
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const KEY = norm([-0.5, 0.85, -0.6]),
  FILL = norm([0.8, 0.2, -0.4]);
const HALF = norm([KEY[0], KEY[1], KEY[2] - 1]);
function metal(n, extra = 0, color = [190, 197, 205]) {
  const d = Math.max(0, dot(n, KEY)),
    f = Math.max(0, dot(n, FILL)),
    sp = Math.pow(Math.max(0, dot(n, HALF)), 10);
  const k = Math.max(0.3, 0.44 + 0.54 * d + 0.12 * f + extra);
  return color.map((base) => Math.round(Math.min(255, base * k + 48 * sp)));
}
const rgb = (c, m = 1, add = 0) =>
  `rgb(${c.map((v) => Math.round(Math.max(0, Math.min(255, v * m + add)))).join(",")})`;
const fmt = (n) => n.toFixed(2);
const pathOf = (pts) =>
  "M" + pts.map(([x, y]) => fmt(x) + " " + fmt(y)).join(" L") + " Z";

function render(piezas, opts = {}) {
  const parts = piezas.map((p) => ({
    outer: ccw(p.outer),
    holes: p.holes.map(cw),
  }));
  const pts = parts.flatMap((p) => p.outer);
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const centre = (list) => list.map(([x, y]) => [x - cx, y - cy]);
  const P = parts.map((p) => ({
    outer: centre(p.outer),
    holes: p.holes.map(centre),
  }));
  const maxDim = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  const L = opts.largo
    ? maxDim * opts.largo
    : maxDim * (2.4 + 1.8 * (1 - Math.min(1, maxDim / 111)));
  const walls = (list) =>
    list.map((a, i) => {
      const b = list[(i + 1) % list.length];
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
        depth: quad.reduce((s, q) => s + q[2], 0) / 4,
        visible: rotate(n)[2] < -1e-6,
      };
    });
  const outerWalls = P.flatMap((p) => walls(p.outer).filter((w) => w.visible));
  const holes = P.flatMap((p) => p.holes);
  const holeWalls = holes.map((h) => walls(h).filter((w) => w.visible));
  const fronts = P.map((p) => p.outer.map(([x, y]) => project([x, y, 0])));
  const frontHoles = holes.map((h) => h.map(([x, y]) => project([x, y, 0])));
  const backHoles = holes.map((h) => h.map(([x, y]) => project([x, y, L])));
  const all = [...outerWalls.flatMap((w) => w.quad), ...fronts.flat()];
  const minX = Math.min(...all.map((p) => p[0])),
    maxX = Math.max(...all.map((p) => p[0])),
    minY = Math.min(...all.map((p) => p[1])),
    maxY = Math.max(...all.map((p) => p[1]));
  const scale = Math.min(
    (W * 0.84) / (maxX - minX),
    (H * 0.76) / (maxY - minY),
  );
  const ox = W / 2 - ((minX + maxX) / 2) * scale,
    oy = H * 0.47 - ((minY + maxY) / 2) * scale;
  const tx = (list) => list.map(([x, y]) => [x * scale + ox, y * scale + oy]);
  let defs = "",
    body = "",
    g = 0;
  const face = (w, extra = 0) => {
    const [a, b, c, d] = tx(w.quad);
    const id = "g" + g++;
    const base = metal(w.n, extra, opts.color);
    const stops = [
      [0, 1, 4],
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
  // Sombras.
  const yMin = Math.min(...P.flatMap((p) => p.outer.map((q) => q[1])));
  const x0 = Math.min(...P.flatMap((p) => p.outer.map((q) => q[0]))),
    x1 = Math.max(...P.flatMap((p) => p.outer.map((q) => q[0])));
  const [s0] = tx([project([(x0 + x1) / 2, yMin, 0])]),
    [s1] = tx([project([(x0 + x1) / 2, yMin, L])]);
  const ang = (Math.atan2(s1[1] - s0[1], s1[0] - s0[0]) * 180) / Math.PI;
  const len = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
  const mx = (s0[0] + s1[0]) / 2 + Math.cos((ang * Math.PI) / 180) * 10,
    my = (s0[1] + s1[1]) / 2 + Math.sin((ang * Math.PI) / 180) * 10;
  const widthPx = (x1 - x0) * scale * 0.55 + 18;
  const shadow =
    `<ellipse cx="${fmt(mx)}" cy="${fmt(my + 16)}" rx="${fmt(len / 2 + widthPx * 0.5)}" ry="${fmt(widthPx * 0.35 + 10)}" transform="rotate(${fmt(ang)} ${fmt(mx)} ${fmt(my + 16)})" fill="#2c3640" opacity="0.10" filter="url(#soft)"/>` +
    `<ellipse cx="${fmt(mx)}" cy="${fmt(my + 4)}" rx="${fmt(Math.max(10, len / 2 - 14))}" ry="${fmt(Math.max(4, widthPx * 0.12))}" transform="rotate(${fmt(ang)} ${fmt(mx)} ${fmt(my + 4)})" fill="#1f2830" opacity="0.2" filter="url(#tight)"/>`;
  for (const w of [...outerWalls].sort((p, q) => q.depth - p.depth))
    body += face(w);
  holes.forEach((_, i) => {
    const fh = pathOf(tx(frontHoles[i]));
    defs += `<clipPath id="c${i}"><path d="${fh}"/></clipPath>`;
    body += `<g clip-path="url(#c${i})"><path d="${fh}" fill="url(#hueco)"/><path d="${pathOf(tx(backHoles[i]))}" fill="#f6f7f9"/>`;
    for (const w of [...holeWalls[i]].sort((p, q) => q.depth - p.depth))
      body += face(w, -0.22);
    body += "</g>";
  });
  // Cara de corte de cada pieza.
  const capAll = fronts.map(tx).flat();
  const capA = capAll.reduce((m, p) => (p[0] + p[1] < m[0] + m[1] ? p : m));
  const capB = capAll.reduce((m, p) => (p[0] + p[1] > m[0] + m[1] ? p : m));
  defs += `<linearGradient id="cap" gradientUnits="userSpaceOnUse" x1="${fmt(capA[0])}" y1="${fmt(capA[1])}" x2="${fmt(capB[0])}" y2="${fmt(capB[1])}">${opts.corte ?? '<stop offset="0" stop-color="#f8fafb"/><stop offset="0.5" stop-color="#e1e6eb"/><stop offset="1" stop-color="#c4ccd4"/>'}</linearGradient>`;
  let h = 0;
  P.forEach((p, i) => {
    const cap = [
      pathOf(tx(fronts[i])),
      ...p.holes.map(() => pathOf(tx(frontHoles[h++]))),
    ].join(" ");
    body += `<path d="${cap}" fill="url(#cap)" fill-rule="evenodd" stroke="#808a94" stroke-width="1.3" stroke-linejoin="round"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="hueco" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#48515a"/><stop offset="1" stop-color="#8a939b"/></linearGradient>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>
<filter id="tight" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>${defs}</defs>
<rect width="${W}" height="${H}" fill="#ffffff"/>
${shadow}
${body}
</svg>`;
}

// ---------- Ilustración de sistemas (conjunto armado en alzado) ----------
function systemSvg(tipo) {
  const frame = (x, y, w, h, t, fill = "url(#al)") =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="#7d8790" stroke-width="2"/>` +
    `<rect x="${x + t}" y="${y + t}" width="${w - 2 * t}" height="${h - 2 * t}" fill="url(#glass)" stroke="#8a949d" stroke-width="1.5"/>`;
  let body = "";
  const X = 230,
    Y = 120,
    Wd = 740,
    Hd = 620;
  body += `<rect x="${X}" y="${Y}" width="${Wd}" height="${Hd}" rx="4" fill="url(#al)" stroke="#6f7983" stroke-width="2.5"/>`;
  body += `<rect x="${X + 22}" y="${Y + 22}" width="${Wd - 44}" height="${Hd - 44}" fill="#eef2f5" stroke="#8a949d" stroke-width="1.5"/>`;
  if (tipo === "corrediza" || tipo === "corrediza-mosquitero") {
    body += frame(X + 30, Y + 30, Wd / 2 + 10, Hd - 60, 26);
    body += frame(X + Wd / 2 - 40, Y + 38, Wd / 2 + 10, Hd - 76, 26);
    body += `<rect x="${X + Wd / 2 + 6}" y="${Y + Hd / 2 - 40}" width="10" height="80" rx="4" fill="#5c656e"/>`;
    if (tipo === "corrediza-mosquitero")
      body += `<rect x="${X + 40}" y="${Y + 44}" width="${Wd / 2 - 30}" height="${Hd - 88}" fill="url(#malla)" stroke="#5f6870" stroke-width="10" opacity="0.9"/>`;
  } else if (tipo === "batiente") {
    body += frame(X + 30, Y + 30, Wd - 60, Hd - 60, 34);
    body += `<rect x="${X + Wd - 90}" y="${Y + Hd / 2 - 50}" width="12" height="100" rx="5" fill="#5c656e"/>`;
  } else {
    body += frame(X + 30, Y + 30, Wd / 2 - 35, Hd - 60, 22);
    body += frame(X + Wd / 2 + 5, Y + 30, Wd / 2 - 35, Hd - 60, 22);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="al" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1f4"/><stop offset="0.5" stop-color="#c9d0d7"/><stop offset="1" stop-color="#a9b2bb"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e4f3f6"/><stop offset="0.45" stop-color="#cfe6eb"/><stop offset="0.5" stop-color="#f2fafb"/><stop offset="1" stop-color="#b9d8de"/></linearGradient>
<pattern id="malla" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#9aa4ad" opacity="0.25"/><path d="M0 0 L6 0 M0 0 L0 6" stroke="#48515a" stroke-width="0.8" opacity="0.6"/></pattern>
<filter id="soft"><feGaussianBlur stdDeviation="18"/></filter></defs>
<rect width="${W}" height="${H}" fill="#ffffff"/>
<ellipse cx="600" cy="770" rx="420" ry="26" fill="#2c3640" opacity="0.12" filter="url(#soft)"/>
${body}
</svg>`;
}
const SISTEMAS_TIPO = {
  "Ventana corrediza 1380": "corrediza",
  "Ventana corrediza 1500": "corrediza",
  "Puerta y ventana corrediza 2000": "corrediza",
  "Puerta y ventana corrediza 3000": "corrediza",
  "Corrediza C-80": "corrediza",
  "C-100 MID": "corrediza-mosquitero",
  "Puerta y ventana fija 2000": "fija",
  "Puerta y ventana fija 3000": "fija",
};

// ---------- Genéricas (solo para productos fuera del catálogo maestro) ----------
const GENERICA =
  "Imagen genérica según el tipo de producto; no corresponde a un modelo específico.";
const GENERICAS = {
  angulo: { piezas: [angle(25.4, 25.4, 1.6)] },
  "tubo-cuadrado": { piezas: [box(0, 0, 30, 30, 1.4)] },
  "tubo-rectangular": { piezas: [box(0, 0, 60, 30, 1.5)] },
  "tubo-redondo": { piezas: [ring(38, 1.4)] },
  "perfil-corrediza": {
    piezas: [
      solid(rect(0, 0, 76, 1.8)),
      ...[
        [0, 22],
        [21.2, 14],
        [37.2, 18],
        [53.2, 14],
        [74.2, 22],
      ].map(([x, hgt]) => solid(rect(x, 1, x + 1.8, hgt))),
    ],
  },
  vidrio: {
    piezas: [solid(rect(0, 0, 120, 6))],
    opciones: {
      largo: 1.1,
      color: [168, 206, 214],
      corte:
        '<stop offset="0" stop-color="#e3f5f6"/><stop offset="1" stop-color="#86bcc4"/>',
    },
  },
  rueda: { piezas: [ring(35, 11)], opciones: { largo: 0.32 } },
  chapa: {
    piezas: [
      solid(rect(0, 0, 32, 70), [
        circle(4.5, 48, 16, 44),
        rect(14.2, 28, 17.8, 40),
      ]),
    ],
    opciones: { largo: 0.45 },
  },
};

// ---------- Generación ----------
const webp = (svg, file) =>
  sharp(Buffer.from(svg))
    .webp({ quality: 86, effort: 6, smartSubsample: true })
    .toFile(file);
async function limpiar(carpeta) {
  await mkdir(carpeta, { recursive: true });
  for (const a of await readdir(carpeta))
    if (a.endsWith(".webp")) await rm(path.join(carpeta, a));
}
for (const g of ["perfiles", "accesorios", "herrajes", "genericas", "sistemas"])
  await limpiar(path.join(assets, g));
await writeFile(path.join(assets, "herrajes/.gitkeep"), "");

// Ninguna geometría se repite salvo cuando el plano dibuja la misma sección.
const firmas = new Map();
for (const [codigo, s] of Object.entries(SECCIONES)) {
  const key = JSON.stringify(s.piezas);
  const otro = firmas.get(key);
  if (
    otro &&
    !MISMA_SECCION_EN_PLANO.some(
      (par) => par.includes(otro) && par.includes(codigo),
    )
  )
    throw new Error(`Geometría repetida: ${otro} y ${codigo}`);
  firmas.set(key, codigo);
}
const sobrantes = Object.keys(SECCIONES).filter(
  (c) => !data.productos.some((p) => p.codigo === c),
);
if (sobrantes.length)
  throw new Error("Secciones sin producto: " + sobrantes.join(", "));

let bytes = 0;
const lineas = [],
  manifiesto = [];
for (const p of data.productos) {
  const s = p.codigo ? SECCIONES[p.codigo] : null;
  const fuente = p.fuentes
    .map((f) => `${f.archivo} pág. ${f.paginas_pdf.join(", ")}`)
    .join("; ");
  if (s) {
    bytes += (
      await webp(render(s.piezas, s.opciones), path.join(assets, p.imagen))
    ).size;
    lineas.push(
      `  ${JSON.stringify(p.codigo)}: { source: require("../assets/catalogo/${p.imagen}"), illustrative: true, note: ${JSON.stringify(s.nota)} },`,
    );
  }
  manifiesto.push({
    codigo: p.codigo,
    nombre: p.nombre,
    ruta: s ? `packages/mobile/assets/catalogo/${p.imagen}` : null,
    ruta_prevista: `packages/mobile/assets/catalogo/${p.imagen}`,
    tipo: s ? "render_3d_generado_por_codigo" : "pendiente",
    fuente_tecnica: fuente,
    estado: s ? "ilustrativa" : "pendiente",
    nota: s
      ? s.nota
      : p.grupo === "Herrajes" || p.grupo === "Accesorios"
        ? "Pieza no extruida: requiere render o fotografía de la pieza real."
        : "Sección pendiente de modelar a partir del plano.",
  });
}
const sistemas = [];
for (const [nombre, tipo] of Object.entries(SISTEMAS_TIPO)) {
  const archivo = `sistemas/${nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")}.webp`;
  bytes += (await webp(systemSvg(tipo), path.join(assets, archivo))).size;
  sistemas.push(
    `  ${JSON.stringify(nombre)}: { source: require("../assets/catalogo/${archivo}"), illustrative: true, note: "Ilustración del conjunto armado; no reproduce las cotas ni los componentes del sistema." },`,
  );
  manifiesto.push({
    codigo: null,
    nombre: `Sistema ${nombre}`,
    ruta: `packages/mobile/assets/catalogo/${archivo}`,
    tipo: "ilustracion_de_sistema",
    fuente_tecnica: null,
    estado: "ilustrativa",
    nota: "Portada del sistema; no sustituye las imágenes de los componentes.",
  });
}
const genericas = [];
for (const [tipo, g] of Object.entries(GENERICAS)) {
  bytes += (
    await webp(
      render(g.piezas, g.opciones),
      path.join(assets, "genericas", tipo + ".webp"),
    )
  ).size;
  genericas.push(
    `  ${JSON.stringify(tipo)}: { source: require("../assets/catalogo/genericas/${tipo}.webp"), illustrative: true, generic: true, note: ${JSON.stringify(GENERICA)} },`,
  );
}
await writeFile(
  path.join(root, "packages/mobile/src/catalogImages.js"),
  "// Generado por scripts/catalogo/generar-imagenes.js. No editar a mano.\n" +
    "// Renders ilustrativos (1200 × 900) asociados por código. Una URL HTTPS\n" +
    "// registrada en el producto tiene prioridad sobre estas imágenes.\n" +
    "export const catalogImages = {\n" +
    lineas.join("\n") +
    "\n};\n" +
    "// Portadas de los sistemas de cancelería.\n" +
    "export const systemImages = {\n" +
    sistemas.join("\n") +
    "\n};\n" +
    "// Solo para productos que no pertenecen al catálogo maestro.\n" +
    "export const genericImages = {\n" +
    genericas.join("\n") +
    "\n};\n",
);
const resumen = manifiesto.reduce(
  (m, x) => ({ ...m, [x.estado]: (m[x.estado] ?? 0) + 1 }),
  {},
);
await writeFile(
  path.join(root, "database/catalogo/image-manifest.json"),
  JSON.stringify(
    {
      generado_por: "scripts/catalogo/generar-imagenes.js",
      aviso:
        "Renders e ilustraciones generados por código; no son fotografías ni reproducciones del arte del proveedor. Estado 'validada' solo tras revisión del cliente.",
      resumen,
      imagenes: manifiesto,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Renders de producto: ${lineas.length} · pendientes: ${data.productos.length - lineas.length} · sistemas: ${sistemas.length} · ${Math.round(bytes / 1024)} KB`,
);
