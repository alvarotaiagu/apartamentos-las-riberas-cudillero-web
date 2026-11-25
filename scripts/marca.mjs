/* Favicons, iconos e imagen para compartir de Las Riberas, a partir del faro redibujado (scripts/marca-logo.py).
   Uso: node scripts/marca.mjs   (necesita antes marca/marca.json, marca/logo-claro.svg e img/fotos/ de scripts/fotos.mjs)
   Escribe marca/favicon.svg, favicon-32.png, apple-touch-icon.png, icono-512.png e img/og.jpg (1200×630).
   El icono es el de su favicon: el faro dentro de un círculo marino sobre blanco, con la luz amarilla y el celeste del
   suelo (aquí, una banda recta: el detalle de las dos lomas no se lee a 32 px). */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const M = JSON.parse(fs.readFileSync(path.join(RAIZ, 'marca/marca.json'), 'utf8'));
const { marino: MARINO, luz: LUZ, ola: OLA } = M.colores;
const NOCHE = '#0E1C2A', BRUMA = '#EEF3F6';
const F = M.faro_svg;
const [, , FW, FH] = F.viewBox;

// el icono: círculo blanco con aro marino; el faro centrado, su base cortada por el círculo; una banda de suelo celeste
function icono(t, margen = 0) {
  const r = t / 2 - margen, c = t / 2, aro = Math.max(1.5, r * 0.07);
  const fh = r * 2 * 0.86, esc = fh / FH, fw = FW * esc;
  const x = c - fw / 2, y = c - r + r * 0.12;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 ${t} ${t}">
  <defs><clipPath id="c"><circle cx="${c}" cy="${c}" r="${r - aro / 2}"/></clipPath></defs>
  <circle cx="${c}" cy="${c}" r="${r}" fill="#ffffff"/>
  <g clip-path="url(#c)">
    <rect x="0" y="${c + r * 0.3}" width="${t}" height="${t}" fill="${OLA}"/>
    <g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${esc.toFixed(5)})"><path fill="${MARINO}" d="${F.cuerpo}"/><path fill="${LUZ}" d="${F.luz}"/></g>
  </g>
  <circle cx="${c}" cy="${c}" r="${r - aro / 2}" fill="none" stroke="${MARINO}" stroke-width="${aro}"/>
</svg>`);
}
const png = async (t, m) => sharp(icono(t * 4, m * 4), { density: 72 }).resize(t, t, { kernel: 'lanczos3' }).png().toBuffer();
fs.writeFileSync(path.join(RAIZ, 'marca/favicon-32.png'), await png(32, 0.5));
fs.writeFileSync(path.join(RAIZ, 'marca/apple-touch-icon.png'), await sharp(await png(180, 14)).flatten({ background: BRUMA }).png().toBuffer());
fs.writeFileSync(path.join(RAIZ, 'marca/icono-512.png'), await png(512, 24));
fs.writeFileSync(path.join(RAIZ, 'marca/favicon.svg'), icono(64, 1).toString());

// og:image 1200×630: el cielo de la portada al anochecer, la fachada sin su cielo, el faro detrás y el logo en claro
const W = 1200, H = 630;
const logo = fs.readFileSync(path.join(RAIZ, 'marca/logo-claro.svg'), 'utf8');
const lv = /viewBox="([^"]+)"/.exec(logo)[1].split(/\s+/).map(Number);
const anchoLogo = 230, altoLogo = Math.round(anchoLogo * lv[3] / lv[2]);
const logoPng = await sharp(Buffer.from(logo.replace(/<svg([^>]*)>/, `<svg$1 width="${anchoLogo * 2}" height="${altoLogo * 2}">`))).resize(anchoLogo).png().toBuffer();
const fotoW = 1050, fotoH = Math.round(fotoW * 989 / 1920);
const fotoX = W - fotoW + 40, fotoY = Math.round(H - fotoH * 0.62);
// lo que cabe en el lienzo (sharp no compone nada que se salga)
const recX = Math.max(0, -fotoX), recW = Math.min(fotoW, W - fotoX) - recX, recH = Math.min(fotoH, H - fotoY);
const foto = await sharp(await sharp(path.join(RAIZ, 'img/fotos/fachada-recorte-1600.webp')).resize(fotoW).modulate({ brightness: 0.82, saturation: 0.85 }).png().toBuffer())
  .extract({ left: recX, top: 0, width: recW, height: recH }).png().toBuffer();
const faroH = 300, faroEsc = faroH / FH, faroX = 930, faroBase = fotoY + fotoH * 0.47;
const lx = faroX + F.linterna[0] * faroEsc, ly = faroBase - faroH + F.linterna[1] * faroEsc;
const fondo = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NOCHE}"/><stop offset=".62" stop-color="#1B3550"/><stop offset="1" stop-color="#3C6585"/></linearGradient>
    <linearGradient id="haz" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${LUZ}" stop-opacity=".8"/><stop offset="1" stop-color="${LUZ}" stop-opacity="0"/></linearGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="${LUZ}" stop-opacity=".9"/><stop offset=".3" stop-color="${LUZ}" stop-opacity=".25"/><stop offset="1" stop-color="${LUZ}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#cielo)"/>
  <g transform="translate(${faroX} ${faroBase - faroH}) scale(${faroEsc.toFixed(5)})"><path fill="${MARINO}" d="${F.cuerpo}"/><path fill="${LUZ}" d="${F.luz}"/></g>
  <path d="M${lx} ${ly - 2}L${lx - 900} ${ly - 120}L${lx - 900} ${ly + 70}L${lx} ${ly + 2}Z" fill="url(#haz)" opacity=".4"/>
  <circle cx="${lx}" cy="${ly}" r="90" fill="url(#halo)"/>
  <text x="64" y="${84 + altoLogo + 70}" font-family="Arial, sans-serif" font-weight="700" font-size="40" fill="${BRUMA}">Junto al faro de Cabo Vidio</text>
  <text x="64" y="${84 + altoLogo + 116}" font-family="Arial, sans-serif" font-size="26" fill="${BRUMA}">Apartamentos rurales · Oviñana, Cudillero</text>
</svg>`;
await sharp(Buffer.from(fondo)).composite([
  { input: foto, left: Math.max(0, fotoX), top: fotoY },
  { input: logoPng, left: 64, top: 84 },
]).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(RAIZ, 'img/og.jpg'));
console.log('marca/ (favicon, iconos) e img/og.jpg listos');

// el faro en claro (cuerpo bruma, linterna amarilla) para el 404
fs.writeFileSync(path.join(RAIZ, 'marca/faro-claro.svg'), fs.readFileSync(path.join(RAIZ, 'marca/faro.svg'), 'utf8').replace(/currentColor/g, BRUMA));
console.log('marca/faro-claro.svg');
