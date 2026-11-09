// Herrajes y accesorios no extruidos, representados como piezas ensambladas
// (cuerpos, ruedas, palancas y placas) según los dibujos del manual C-100 MID,
// págs. 6–7. Son representaciones ilustrativas: no reproducen el mecanismo
// interno ni medidas exactas, porque el manual no las acota.
// Cada cuerpo: sección en XY (mm), extruida de z0 a z1; material opcional.
export function herrajes({ rect }) {
  const circ = (cx, cy, r, n = 48) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
  // Rectángulo con esquinas redondeadas.
  const rr = (x0, y0, x1, y1, r, n = 6) => {
    const pts = [];
    for (const [cx, cy, a0] of [
      [x1 - r, y0 + r, -90],
      [x1 - r, y1 - r, 0],
      [x0 + r, y1 - r, 90],
      [x0 + r, y0 + r, 180],
    ])
      for (let i = 0; i <= n; i++) {
        const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    return pts;
  };
  const c = (outer, z0, z1, mat = "metal", holes = []) => ({
    outer,
    holes,
    z0,
    z1,
    mat,
  });
  const rueda = (x, y, r, z0, z1) => [
    c(circ(x, y, r), z0, z1, "nylon"),
    c(circ(x, y, r * 0.38), z0 - 0.6, z1 + 0.6, "cromo"),
  ];
  return {
    "GN-623": [
      c(rr(-3, -4, 17, 48, 2), 6, 8),
      c(rect(0, 0, 14, 44), 0, 6, "metal", [rect(4, 22, 10, 31)]),
      c(rect(14, 29, 19, 34), 1, 5),
      c(circ(7, 13, 3.2), -3, 0, "cromo"),
    ],
    "GT45/40.03A": [
      c(rr(0, 4, 64, 20, 2), 0, 20),
      c(rect(4, 20, 60, 23), 2, 18),
      ...rueda(15, 4, 7.5, 6, 14),
      ...rueda(49, 4, 7.5, 6, 14),
      c(rect(-7, 10, 0, 14), 8, 12, "cromo"),
    ],
    "T26/9X": [
      c(rect(0, 6, 30, 10), 0, 14),
      c(rect(0, 6, 3, 19), 0, 14),
      c(rect(27, 6, 30, 19), 0, 14),
      ...rueda(15, 5, 6, 4, 10),
    ],
    "45/30.03-A": [
      c(rr(0, 5, 96, 19, 2), 0, 16),
      ...rueda(14, 5, 6, 5, 11),
      ...rueda(32, 5, 6, 5, 11),
      ...rueda(64, 5, 6, 5, 11),
      ...rueda(82, 5, 6, 5, 11),
      c(rect(-4, 8, 0, 16), 5, 11, "nylon"),
      c(rect(96, 8, 100, 16), 5, 11, "nylon"),
      c(rect(44, 19, 52, 23), 6, 10, "cromo"),
    ],
    F306: [
      c(rr(0, 0, 18, 84, 9), 4, 7),
      c(rr(4, 26, 14, 72, 5), -3, 4, "cromo"),
      c(circ(9, 34, 2.4), -4, -3, "metal"),
    ],
    "F-306E": [
      c(rr(0, 0, 16, 90, 8), 0, 3, "metal", [rr(4, 24, 12, 66, 4)]),
      c(rr(3, 23, 13, 67, 5), 3, 12, "metal"),
      c(rr(5.2, 38, 10.8, 56, 2.8), 1, 5, "nylon"),
    ],
    "GYC-100MID": [
      c(rect(0, 0, 10, 72), 0, 4),
      ...[0, 1, 2, 3, 4, 5].map((i) =>
        c(rect(10, 10 + i * 9, 14, 14 + i * 9), 0, 4),
      ),
      c(rect(28, 14, 34, 58), 0, 4, "cromo"),
      c(rect(28, 14, 42, 18), 0, 4, "cromo"),
    ],
    "GN-622CV": [
      c(rect(0, 0, 70, 3), 0, 30),
      c(rect(0, 3, 2, 7), 0, 30),
      c(rect(68, 3, 70, 7), 0, 30),
      c(circ(19, 8, 5), 3, 27, "nylon"),
      c(circ(51, 8, 5), 3, 27, "nylon"),
    ],
    "GN-481": [
      c(
        [
          [0, 0],
          [30, 0],
          [30, 8],
          [8, 8],
          [8, 30],
          [0, 30],
        ],
        0,
        12,
      ),
      c(rect(8, 8, 26, 10), 2, 10),
      c(circ(4, 22, 3.4), -3, 0, "cromo"),
    ],
    "M.P. / F-608": [
      c(rr(0, 0, 14, 62, 5), 4, 8),
      c(circ(7, 44, 3), 0, 4, "cromo"),
      c(rr(3, 8, 11, 48, 4), -6, 0, "cromo"),
    ],
    "GN-622TT": [
      c(rr(0, 0, 24, 40, 3), 0, 3, "nylon", [circ(12, 30, 2.2, 32)]),
      c(rect(0, 0, 24, 3), 0, 16, "nylon"),
    ],
    TE: [c(circ(0, 0, 22, 72), 0, 120, "malla", [circ(0, 0, 5, 32)])],
    F305: [
      c(rr(0, 0, 24, 74, 12), 0, 2.5, "metal", [rr(6, 12, 18, 62, 6)]),
      c(rr(5, 11, 19, 63, 7), 2.5, 9),
    ],
    "UN-305T": [
      c(rr(0, 0, 14, 96, 7), 0, 2.5, "metal", [rr(4, 20, 10, 76, 3)]),
      c(rr(3, 19, 11, 77, 4), 2.5, 7),
    ],
  };
}
