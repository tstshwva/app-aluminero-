// Genera el set de iconos de la app (packages/mobile/assets/icon-*.png).
// Una sola familia: retícula de 24, trazo de 1.8, extremos redondeados.
// Las versiones «-active» son rellenas para la pestaña seleccionada.
// Los PNG son negros sobre transparente: la app los colorea con tintColor,
// por eso los recortes de los iconos rellenos usan fill-rule evenodd.
// Ejecutar desde la raíz: node scripts/generar-iconos.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "packages/mobile/assets");
const SIZE = 96;
const linea = (d) =>
  `<g fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</g>`;
const relleno = (d) => `<g fill="#000" fill-rule="evenodd">${d}</g>`;

const iconos = {
  home: linea(
    `<path d="M3.8 10.4 12 3.6l8.2 6.8"/><path d="M5.8 8.9v10.3c0 .7.5 1.2 1.2 1.2h3.3v-5.6h3.4v5.6H17c.7 0 1.2-.5 1.2-1.2V8.9"/>`,
  ),
  "home-active": relleno(
    `<path d="M12 2.6 3 10.1a.9.9 0 0 0 1.15 1.4l.75-.62v8.32c0 1.2.9 2.1 2.1 2.1h3.3v-5.6h3.4v5.6H17c1.2 0 2.1-.9 2.1-2.1v-8.32l.75.62A.9.9 0 0 0 21 10.1Z"/>`,
  ),
  catalog: linea(
    `<rect x="3.6" y="3.6" width="7" height="7" rx="1.6"/><rect x="13.4" y="3.6" width="7" height="7" rx="1.6"/><rect x="3.6" y="13.4" width="7" height="7" rx="1.6"/><rect x="13.4" y="13.4" width="7" height="7" rx="1.6"/>`,
  ),
  "catalog-active": relleno(
    `<rect x="2.7" y="2.7" width="8.8" height="8.8" rx="2"/><rect x="12.5" y="2.7" width="8.8" height="8.8" rx="2"/><rect x="2.7" y="12.5" width="8.8" height="8.8" rx="2"/><rect x="12.5" y="12.5" width="8.8" height="8.8" rx="2"/>`,
  ),
  inventory: linea(
    `<path d="M12 3.3 20 7.4v9.2L12 20.7 4 16.6V7.4Z"/><path d="M4.3 7.6 12 11.6l7.7-4"/><path d="M12 11.6v8.9"/><path d="m8 5.4 7.9 4.1"/>`,
  ),
  "inventory-active": relleno(
    `<path d="M11.2 12.4 3.4 8.4v8.2c0 .3.2.6.5.8l7.3 3.7Z"/><path d="M12.8 12.4v8.7l7.3-3.7c.3-.2.5-.5.5-.8V8.4Z"/><path d="M12.4 2.5a.9.9 0 0 0-.8 0L9.3 3.7l7.8 4.1 2.6-1.3Zm-4.7 2-3.3 1.8 7.6 4 3.4-1.8Z"/>`,
  ),
  orders: linea(
    `<rect x="4.8" y="4.6" width="14.4" height="16.4" rx="2.2"/><path d="M9 4.6V3.8c0-.5.4-.9.9-.9h4.2c.5 0 .9.4.9.9v.8"/><path d="M8.4 10.6h7.2M8.4 14.2h7.2M8.4 17.8h4.4"/>`,
  ),
  "orders-active": relleno(
    `<path d="M9.9 2h4.2c1 0 1.8.8 1.8 1.8v.1h1.1c1.7 0 3.1 1.4 3.1 3.1v12c0 1.7-1.4 3.1-3.1 3.1H7c-1.7 0-3.1-1.4-3.1-3.1V7c0-1.7 1.4-3.1 3.1-3.1h1.1v-.1C8.1 2.8 8.9 2 9.9 2Zm-1.5 7.7a.9.9 0 0 0 0 1.8h7.2a.9.9 0 0 0 0-1.8Zm0 3.6a.9.9 0 0 0 0 1.8h7.2a.9.9 0 0 0 0-1.8Zm0 3.6a.9.9 0 0 0 0 1.8h4.4a.9.9 0 0 0 0-1.8Z"/>`,
  ),
  cart: linea(
    `<path d="M3 3.8h2.2l2.3 11.1c.1.6.6 1 1.2 1h8.9c.6 0 1.1-.4 1.2-1l1.4-7H6.2"/><circle cx="9.2" cy="19.6" r="1.3"/><circle cx="17" cy="19.6" r="1.3"/>`,
  ),
  "cart-active": relleno(
    `<path d="M3 2.9a.9.9 0 0 0 0 1.8h1.5l2.2 10.4c.2 1 1.1 1.7 2.1 1.7h8.9c1 0 1.9-.7 2.1-1.7l1.6-7.9H6Z"/><circle cx="9.2" cy="19.6" r="1.9"/><circle cx="17" cy="19.6" r="1.9"/>`,
  ),
  profile: linea(
    `<circle cx="12" cy="8.2" r="3.9"/><path d="M4.6 20.4c.8-3.9 3.8-6.1 7.4-6.1s6.6 2.2 7.4 6.1"/>`,
  ),
  "profile-active": relleno(
    `<circle cx="12" cy="8.2" r="4.8"/><path d="M12 13.4c-4.2 0-7.6 2.6-8.3 7a1 1 0 0 0 1 1.2h14.6a1 1 0 0 0 1-1.2c-.7-4.4-4.1-7-8.3-7Z"/>`,
  ),
  more: linea(
    `<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>`,
  ),
  "more-active": relleno(
    `<circle cx="5.5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="18.5" cy="12" r="2.2"/>`,
  ),
  search: linea(
    `<circle cx="10.8" cy="10.8" r="6.4"/><path d="m15.6 15.6 4.8 4.8"/>`,
  ),
  menu: linea(`<path d="M4 7h16M4 12h16M4 17h11"/>`),
  back: linea(`<path d="M14.8 5.2 8 12l6.8 6.8"/>`),
  arrow: linea(`<path d="M4.5 12h14.5"/><path d="m13.4 6.4 5.6 5.6-5.6 5.6"/>`),
  bell: linea(
    `<path d="M6.2 16.8V11a5.8 5.8 0 0 1 11.6 0v5.8l1.5 1.6H4.7Z"/><path d="M10.1 20.6a2 2 0 0 0 3.8 0"/>`,
  ),
  // Cámara (lector de códigos).
  camera: linea(
    `<path d="M4.6 7.6h3l1.5-2.2c.2-.3.6-.5 1-.5h3.8c.4 0 .8.2 1 .5l1.5 2.2h3c1 0 1.8.8 1.8 1.8v8.7c0 1-.8 1.8-1.8 1.8H4.6c-1 0-1.8-.8-1.8-1.8V9.4c0-1 .8-1.8 1.8-1.8Z"/><circle cx="12" cy="13.3" r="3.4"/>`,
  ),
};

for (const [nombre, contenido] of Object.entries(iconos)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24">${contenido}</svg>`;
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(assets, `icon-${nombre}.png`));
}
console.log(`Iconos generados: ${Object.keys(iconos).length}`);
