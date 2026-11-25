/* Verificación de la web de Las Riberas (Playwright, UN navegador, ventanas pequeñas, escala 1). Base: la de Amaicha.
   Uso: node verificar.mjs            (puerto 8971; todo)
        node verificar.mjs 3 4        (solo esos bloques, para depurar)
   Sin capturas: lo que hay que mirar a ojo va en el README y en PENDIENTES. El 3D NO se pinta: el navegador arranca con
   --disable-3d-apis, la página se abre con ?sin-webgl y, salvo en el bloque 12, js/lugar.js y vendor/ se bloquean (del
   3D solo se comprueba el contenedor y el respaldo). El motor real (Redforts), Google Maps y las letras se sirven
   falsos: no se hace ninguna petición de verdad a terceros. Todo va con movimiento reducido salvo el bloque 13, una vez
   y al final. Mide comportamiento, no aspecto. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8971;
const SOLO = process.argv.slice(2).map(Number).filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
const PAG = BASE + 'index.html?sin-webgl';
const MOTOR = 'https://booking.redforts.com/es/iframe/i8ZN/';

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle).slice(0, 700) : '')); } };
const nota = (m) => console.log('  ·      ' + m);
const LLAVE = 'lasriberas-cookies';
const sinCookies = `try { localStorage.setItem('${LLAVE}', 'si'); } catch (e) {}`;
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const D = JSON.parse(leer('data/riberas.json'));
const RUTAS = existe('ref/raw/rutas.json') ? JSON.parse(leer('ref/raw/rutas.json')) : null;
const kmTxt = (v) => String(Math.round(v * 10) / 10).replace('.', ',') + ' km';

/* ================= 1. archivos (sin navegador) ================= */
if (toca(1)) {
console.log('\n1. Archivos, textos y contrato');
const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'));
for (const f of htmls) {
  const s = leer(f);
  comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, nofollow">/.test(s), `${f}: charset lo primero y noindex, nofollow justo detrás`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0, `${f}: ningún id repetido`, [...new Set(rep)]);
  comprobar(!/<!--parte:/.test(s) && !/<!-- sin partes\//.test(s) && !/\{\{[A-Z_]+\}\}/.test(s) && !/<!--(apartamentos|vistazo|comunes|piscina|estancias|alrededor|alrededor-txt|resenas|condiciones|llegar|faro-portada|precarga-portada|jsonld|simbolo:[a-z_-]+)-->/.test(s), `${f}: todas las partes y datos incluidos`);
  comprobar(!/[ÃÂ][\u0080-\u00BF]|\uFFFD/.test(s), `${f}: sin caracteres rotos`);
}
comprobar(['.nojekyll', '404.html', 'manifest.json', 'img/og.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png', 'marca/logo.svg', 'marca/logo-claro.svg', 'marca/palabra.svg', 'marca/simbolo.svg', 'marca/simbolo-claro.svg', 'marca/faro.svg', 'marca/faro-claro.svg', 'marca/marca.json'].every(existe), 'están .nojekyll, 404, manifest, og, favicons y el logo redibujado (logo, símbolo, palabra, faro)');
const M = JSON.parse(leer('marca/marca.json'));
comprobar(M.colores.marino === '#2D475E' && M.colores.luz === '#FDCF60' && M.colores.ola === '#84CDE4', 'colores del logo medidos en sus píxeles: marino #2D475E, luz #FDCF60, ola #84CDE4', M.colores);
comprobar(M.iou.faro_favicon > 0.95 && M.iou.linterna > 0.9 && M.iou.simbolo_marino > 0.9 && M.iou.olas > 0.88 && M.iou.las_riberas > 0.8, `logo redibujado y validado por IoU: faro ${M.iou.faro_favicon}, linterna ${M.iou.linterna}, loma+faro ${M.iou.simbolo_marino}, olas ${M.iou.olas}, LAS RIBERAS ${M.iou.las_riberas}`, M.iou);
{
  const faro = leer('marca/faro.svg');
  const d = (faro.match(/ d="([^"]+)"/g) || []).join('');
  comprobar(!/[CcQqSsTt]/.test(d.replace(/A[^A-Z]+/g, '')), 'el faro solo lleva rectas y arcos (redibujado, nada calcado)');
  const pal = leer('marca/palabra.svg');
  const primer = / d="([^"]+)"/.exec(pal)[1];
  comprobar(!/[Cc]/.test(primer) && (pal.match(/<path/g) || []).length === 6, 'LAS RIBERAS: L, A, I, E y las astas de R y B como polígonos; las dos S, las dos R y la B por potrace (6 trazados)');
}
const html = leer('index.html');
const fotosJson = JSON.parse(leer('img/fotos/fotos.json'));
const lista = JSON.parse(leer('scripts/fotos-lista.json'));
{
  const rutas = new Set();
  for (const m of html.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|#|data:)/.test(r)) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !existe(r));
  comprobar(faltan.length === 0, `index.html: existen los ${rutas.size} archivos que enlaza`, faltan);

  /* fotos */
  const pedidas = [...new Set([...html.matchAll(/<picture data-foto="([^"]+)"/g)].map((m) => m[1]))];
  comprobar(pedidas.length >= 40 && pedidas.every((n) => fotosJson.some((f) => f.nombre === n)), `las ${pedidas.length} fotos de la página existen en img/fotos/fotos.json`, pedidas.filter((n) => !fotosJson.some((f) => f.nombre === n)));
  const faltanFotos = [];
  for (const f of fotosJson) for (const w of f.anchos) for (const e of (f.alfa ? ['avif', 'webp'] : ['avif', 'webp', 'jpg'])) if (!existe(`img/fotos/${f.nombre}-${w}.${e}`)) faltanFotos.push(`${f.nombre}-${w}.${e}`);
  comprobar(faltanFotos.length === 0, 'cada foto existe en todos sus anchos, en AVIF, WebP y JPG (la recortada, AVIF y WebP con transparencia)', faltanFotos.slice(0, 5));
  const nit = existe('ref/raw/nitidez.json') ? JSON.parse(leer('ref/raw/nitidez.json')) : {};
  const amplia = fotosJson.filter((f) => { const o = nit[f.origen]; return !o || Math.max(...f.anchos) > o.ancho || f.ancho > o.ancho; });
  comprobar(amplia.length === 0, 'ninguna foto se amplía: ningún ancho pasa del de su original (ref/raw/nitidez.json)', amplia.map((f) => f.nombre));
  const de800 = fotosJson.filter((f) => nit[f.origen] && nit[f.origen].ancho === 800);
  comprobar(de800.length >= 35 && de800.every((f) => Math.max(...f.anchos) === 800), `las ${de800.length} fotos de interior y piscina (800 px) se sirven a 800 como mucho`);
  const fj = fotosJson.find((f) => f.nombre === 'fachada-recorte'), fn = nit[fj.origen];
  comprobar(fj.alfa && fn && fn.cociente >= 0.6 && fj.ancho === fn.ancho, `la portada (la fachada sin su cielo) tiene resolución real: nitidez ${fn && fn.cociente} (≥ 0,6), ${fj.ancho}×${fj.alto} sin ampliar, con transparencia`);
  comprobar(/fetchpriority="high"/.test(html.match(/<section id="portada"[\s\S]*?<\/section>/)[0]) && /<link rel="preload" as="image"[^>]*fachada-recorte/.test(html), 'la fachada de la portada lleva fetchpriority="high" y se precarga (es el LCP)');
  comprobar(!/fotos-originales\/(couple|dog-friendly|escapada_riberas)/.test(JSON.stringify(lista)), 'ninguna foto de banco (couple, dog-friendly, escapada_riberas)');

  /* textos: nada inventado, solo castellano, sin rayas */
  const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const alts = [...html.matchAll(/(?:alt|aria-label|title)="([^"]*)"/g)].map((m) => m[1]).join(' ');
  comprobar(!/[—–]/.test(texto + alts), 'ni una raya (— ni –) en el texto visible, los alt ni las etiquetas');
  comprobar(/686 498 264/.test(texto) && /626 467 401/.test(texto) && /tel:\+34686498264/.test(html) && /wa\.me\/34686498264/.test(html) && /info@apartamentoslasriberas\.com/.test(texto) && /Vivigo s\/n, Oviñana/.test(texto), 'contacto: los dos teléfonos, WhatsApp, correo y dirección de DATOS');
  comprobar(!/\b33(156|846)\b/.test(texto), 'el código postal no se escribe (su web da dos: por confirmar)');
  comprobar(!/eco ?friendly|pet friendly|mejor precio|villas|casino|apuesta|bet/i.test(texto + alts), 'nada que no esté en DATOS ni nada del spam de su WordPress (ni «eco friendly», ni «villas», ni casinos)');
  comprobar(/Desde las 15:30/.test(texto) && /Antes de las 11:00/.test(texto) && /Gratis hasta 7 días antes/.test(texto) && /30 %/.test(texto) && /tarjeta queda como garantía/.test(texto) && /5 € por noche/.test(texto), 'condiciones del motor: 15:30, 11:00, cancelación 7 días, 30 %, tarjeta de garantía, mascotas 5 €/noche');
  comprobar(/>4,9</.test(html) && /más de 250 reseñas/.test(texto) && !/\b269\b/.test(texto), 'reseñas: 4,9 en Google con «más de 250 reseñas» (leído de segunda mano: sin la cifra exacta)');
  comprobar(!/\b(1|una)( sola| única)? reseña\b/i.test(texto) && !/la (primera|segunda) reseña/i.test(texto) && !/clientes satisfechos|cientos de/i.test(texto), 'sin recuento de pocas reseñas ni prueba social inventada');
  comprobar(/Es su motor de reservas real\./.test(texto) && /reservas que hagas dentro son de verdad/.test(texto) && /Abrir el motor en otra pestaña/.test(texto), 'junto al motor, el aviso de que es REAL y «Abrir el motor en otra pestaña» (siempre visible)');
  comprobar(!/<iframe/.test(html) && !/redforts\.com[^"]*\?arrival/.test(html), 'el iframe del motor no está en el HTML (se crea al pedirlo)');
  comprobar((html.match(/<article class="apto"/g) || []).length === 3 && /<dd class="cifra">4<\/dd>/.test(html) && /<dd class="cifra">6<\/dd>/.test(html) && /<dd class="cifra">2\+2<\/dd>/.test(html) && /Bañera de hidromasaje/.test(texto) && /sidra/.test(texto) && /bombones/.test(texto) && /Dos baños/.test(texto) && /Vistas al faro/.test(texto), 'los tres apartamentos con sus cifras (4, 6, 2+2) y lo propio de cada uno (faro, dos baños, hidromasaje con sidra y bombones)');
  comprobar((html.match(/data-reservar="(mirador|familiar|deluxe)"/g) || []).length === 3 && /Ver fechas de este/.test(texto), 'cada ficha lleva «Ver fechas de este» que lleva a Reservar');
  comprobar(!/<li>\s*•/.test(html) && (html.match(/<svg class="ico" aria-hidden="true"><use href="#i-/g) || []).length >= 25, 'fichas diseñadas: servicios con icono propio (sprite #i-…), sin viñetas de texto');
  const iconosUsados = new Set([...html.matchAll(/use href="#(i-[a-z-]+)"/g)].map((m) => m[1]));
  comprobar([...iconosUsados].every((i) => new RegExp(`<symbol id="${i}"`).test(html)), `los ${iconosUsados.size} iconos que se usan existen en el sprite`, [...iconosUsados].filter((i) => !new RegExp(`<symbol id="${i}"`).test(html)));
  if (RUTAS) {
    const ok = RUTAS.llegar.every((id) => { const d = RUTAS.destinos[id].desde_casa; return new RegExp(`data-ruta="${id}"[\\s\\S]*?${kmTxt(d.km)}`).test(html); });
    comprobar(ok && (html.match(/<li data-ruta=/g) || []).length === RUTAS.llegar.length, `Alrededor: las ${RUTAS.llegar.length} distancias son las de ref/raw/rutas.json (OSRM), ninguna a ojo`);
    comprobar(RUTAS.casa.lat === 43.5773554 && RUTAS.casa.lon === -6.2490802 && /data-q="43\.577355,-6\.249080"/.test(html) && !/43\.577007|6\.2514292/.test(html), 'la casa en su sitio del Catastro (43.5773554, -6.2490802) para OSRM, el mapa y el JSON-LD; el pin malo de Google no sale');
    comprobar(new RegExp(kmTxt(RUTAS.destinos.vidio.recta_km).replace(' km', ' kilómetros')).test(texto), `el faro a ${kmTxt(RUTAS.destinos.vidio.recta_km)} en línea recta, sacado de rutas.json`);
  } else nota('sin ref/raw/rutas.json');
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
  comprobar(ld['@type'] === 'LodgingBusiness' && ld.geo.latitude === 43.5773554 && !ld.aggregateRating && !ld.address.postalCode, 'JSON-LD: LodgingBusiness con el punto del Catastro, sin nota de reseñas de segunda mano ni código postal dudoso');

  /* contrato web ↔ módulos */
  const sitios = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/data-modulo="([^"]+)"/g)].map((m) => m[1]);
  comprobar(JSON.stringify(sitios) === JSON.stringify(['portada', 'lugar']), 'los huecos de los módulos: portada y lugar', sitios);
  comprobar(/<section id="lugar"[^>]*aria-labelledby="t-lugar">[\s\S]*?<div data-modulo="lugar">\s*<figure class="lugar__respaldo">[\s\S]*?faro-vidio[\s\S]*?<\/figure>\s*<\/div>/.test(html), '#lugar: <div data-modulo="lugar"> con el respaldo (Cabo Vidio con su faro y texto)');
  const cabeza = html.split('</head>')[0];
  comprobar(/<link rel="stylesheet" href="css\/lugar\.css/.test(cabeza) && /<script src="js\/lugar\.js[^"]*" defer><\/script>/.test(html) && html.indexOf('js/lugar.js') < html.indexOf('js/main.js') && html.indexOf('js/portada.js') < html.indexOf('js/main.js'), 'carga css/lugar.css (en el <head>) y js/lugar.js (defer, antes de main.js)');
  comprobar(['js/portada.js', 'js/reserva.js', 'js/main.js', 'js/lugar.js'].every((s) => new RegExp(`<script src="${s}\\?v=[0-9a-f]+" defer>`).test(html)) && /css\/estilos\.css\?v=[0-9a-f]+/.test(html), 'los CSS y JS propios con defer y ?v=<huella>');
  comprobar(!/data-(partir|split|letras|chars?)\b/.test(html) && !/class="[^"]*\bcortina\b|id="cortina"/.test(html), 'ni letra a letra ni cortina');
  const faro = existe('data/faro.json') ? JSON.parse(leer('data/faro.json')) : null;
  comprobar(faro && faro.grupo === 1 && faro.periodo_s === 5 && /openstreetmap\.org\/node\/100170985/.test(faro.fuente) && /NO confirmado/.test(faro.nota), 'data/faro.json: destello único cada 5 s, con su fuente (OSM, D 1641) y la nota de que falta la oficial', faro);
}

/* CSS y JS: lo que no se negocia */
const base = leer('css/base.css'), css = leer('css/estilos.css');
const raizCss = base.split('}')[0];
comprobar(['--fondo', '--superficie', '--texto', '--texto-suave', '--marca', '--acento', '--ola', '--linea', '--letra-titular', '--letra-texto', '--letra-cifras'].every((v) => new RegExp(`\\s${v}:`).test(raizCss)), 'las variables comunes del contrato, en :root de css/base.css');
comprobar((raizCss.match(/--[a-z]+: #[0-9A-F]{6};/g) || []).length === 6 && /--marino: #2D475E/.test(raizCss) && /--luz: #FDCF60/.test(raizCss) && /--ola: #84CDE4/.test(raizCss), 'seis colores y ninguno más; marino, luz y ola son los del logo');
{
  const bloque = (css.match(/#lugar \{\s*--lugar-arriba[\s\S]*?\}/) || [''])[0];
  comprobar(['--fondo', '--texto', '--texto-suave', '--linea', '--superficie', '--marca'].every((v) => bloque.includes(v + ':')), '#lugar es campo oscuro: redefine --fondo, --texto, --texto-suave, --linea, --superficie y --marca');
}
comprobar(/\.cookies:not\(\[hidden\]\)\s*\{\s*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:/.test(css), 'cookies: display solo en :not([hidden])');
comprobar(/\.mando:not\(\[hidden\]\)/.test(css) && !/\.mando\s*\{[^}]*display:/.test(css), 'mando: display solo en :not([hidden])');
comprobar(/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(base), '[hidden] siempre oculta');
comprobar(/\.menu-movil\s*\{[^}]*height:\s*100dvh/.test(css) && !/\.menu-movil\s*\{[^}]*inset:\s*0/.test(css), 'menú móvil: altura 100dvh, nunca inset:0 (la cabecera lleva backdrop-filter)');
comprobar(!/\ddvh/.test(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\.menu-movil\s*\{[^}]*\}/, '')), 'fuera del menú fijo, ningún dvh (la barra del móvil no mueve nada)');
comprobar(/picture\[data-real\] img \{ max-width: 800px; \}/.test(css) && /\.apto__f \{[^}]*max-width: 800px/.test(css) && /\.piscina__g \{[^}]*max-width: 800px/.test(css), 'CSS: las fotos de 800 px nunca más anchas que 800 (tope en la foto, la ficha y la piscina)');
const js = ['js/main.js', 'js/reserva.js', 'js/portada.js'].map(leer).join('\n');
comprobar(!/cursor:\s*none/.test(base + css + js) && !/marquee/i.test(css + html) && !/li\s*\{[^}]*position:\s*sticky/.test(css), 'sin cursor propio, sin marquesina y sin pila sticky de tarjetas');
comprobar(/:focus-visible\s*\{\s*outline:\s*2px solid/.test(base) && /\.foco-haz__marco\s*\{[^}]*stroke-width:\s*2/.test(base), 'foco: contorno de 2 px y el haz corto (#foco-haz)');
const mainJs = leer('js/main.js');
comprobar(/raiz\.classList\.add\('con-movimiento'\)/.test(mainJs) && /const motion = !quieto;/.test(mainJs), '«con-movimiento» solo sin movimiento reducido');
comprobar(/if \(esBarra\(\)\) return;/.test(mainJs) && /if \(innerWidth === anchoVista\) return;/.test(leer('js/reserva.js')), 'el resize de la barra del móvil no rehace nada (main y el calendario)');
comprobar(/history\.scrollRestoration = 'manual'/.test(leer('partes/cabeza.html')) && /scrollTo\(0, 0\)/.test(mainJs), 'recargar a media página: scrollRestoration manual y vuelta arriba');
comprobar(!/(cdnjs|jsdelivr|unpkg|gsap|lenis)/i.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'ninguna librería de CDN en la página (sin GSAP ni Lenis): solo las letras de Google');
const fuentes = html.match(/fonts\.googleapis\.com\/css2\?[^"]+/)[0];
const familias = [...fuentes.matchAll(/family=([A-Za-z+]+)/g)].map((m) => m[1]);
comprobar(JSON.stringify(familias) === '["Parkinsans","Radio+Canada+Big","Inconsolata"]' && /display=swap/.test(fuentes), 'Google Fonts: Parkinsans, Radio Canada Big e Inconsolata, display=swap, ninguna más');
{
  const otras = [];
  for (const d of fs.readdirSync(path.join(RAIZ, '..'))) {
    if (!/-(web|bocetos|tienda)$/.test(d) || d === path.basename(RAIZ)) continue;
    const dir = path.join(RAIZ, '..', d);
    let ficheros = [];
    try { ficheros = [...fs.readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => path.join(dir, f)), ...(fs.existsSync(path.join(dir, 'css')) ? fs.readdirSync(path.join(dir, 'css')).filter((f) => f.endsWith('.css')).map((f) => path.join(dir, 'css', f)) : [])]; } catch (e) {}
    for (const f of ficheros) { const s = fs.readFileSync(f, 'utf8'); for (const fam of familias) if (s.includes('family=' + fam + ':') || s.includes('family=' + fam + '&') || new RegExp(`['"]${fam.replace(/\+/g, ' ')}['"]`).test(s)) otras.push(fam + ' en ' + d); }
  }
  comprobar(otras.length === 0, 'ninguna de las tres letras está ya en otra web de la cartera (grep en ../*-web, -bocetos y -tienda)', [...new Set(otras)]);
}
// receta de borrado del mando (README), comprobada sobre copias en memoria
{
  const quitar = (s, re) => (re.test(s) ? s.replace(re, '') : null);
  const cab = quitar(leer('partes/cabeza.html').split('\r\n').join('\n'), /\s*\/\/ MANDO DE MAQUETA[^\n]*\n\s*if \(q\.has\('revision'\)\) \{[\s\S]*?\n    \}\n/);
  const pie = quitar(leer('partes/pie.html').split('\r\n').join('\n'), /<!-- MANDO DE MAQUETA[\s\S]*?<!-- fin del MANDO DE MAQUETA -->\n?/);
  const mj = quitar(mainJs.split('\r\n').join('\n'), /\s*\/\* =+ \d+\. MANDO DE MAQUETA[\s\S]*?\/\* fin del MANDO DE MAQUETA \*\//);
  let ok = !!(cab && pie && mj) && !/revision|densidad-sobria/.test(cab) && !/id="mando"|data-densidad/.test(pie) && !/data-densidad|pintarMando/.test(mj);
  try { new vm.Script(mj); new vm.Script(cab.match(/<script>([\s\S]*?)<\/script>/)[1]); } catch (e) { ok = false; }
  comprobar(ok, 'la receta de borrado del mando (README) quita los tres bloques y el JS sigue siendo válido');
}
}

/* ================= navegador: uno solo, sin WebGL ================= */
const browser = await chromium.launch({ headless: true, args: ['--disable-3d-apis'] });
try {
  async function nueva(op = {}, { script, abortar, con3d } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce', ...op });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route(/google\.com\/maps/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>mapa</p>' }));
    await ctx.route(/redforts\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>motor de prueba</p>' }));
    await ctx.route(/googletagmanager|google-analytics|facebook\.com|instagram\.com|wa\.me/, (r) => r.abort());
    if (!con3d) {
      await ctx.route(/\/js\/lugar\.js|\/vendor\//, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '/* sin 3D en las pruebas */' }));
      await ctx.route(/\/css\/lugar\.css/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    }
    if (abortar) await ctx.route(abortar, (r) => r.abort());
    if (script) await ctx.addInitScript(script);
    const page = await ctx.newPage();
    page._errores = [];
    page._noGet = [];
    page.on('pageerror', (e) => page._errores.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|WebGL|webgl/.test(m.text())) page._errores.push('consola: ' + m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) page._errores.push(r.status() + ' ' + r.url()); });
    page.on('request', (r) => { if (r.method() !== 'GET') page._noGet.push(r.method() + ' ' + r.url()); });
    return { ctx, page };
  }
  const contrastes = (page, sel) => page.evaluate((sel) => {
    const lz = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (c) => { lz.clearRect(0, 0, 1, 1); lz.fillStyle = '#000'; lz.fillStyle = c; lz.fillRect(0, 0, 1, 1); return [...lz.getImageData(0, 0, 1, 1).data]; };
    const L = (m) => { m = m.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
    const fondo = (el) => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b) && !/[, /] ?0\)$/.test(b)) return rgba(b).slice(0, 3); el = el.parentElement; } return rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3); };
    return sel.map((s) => {
      const el = document.querySelector(s); if (!el) return [s, 'falta'];
      const f = fondo(el), c = rgba(getComputedStyle(el).color), a = c[3] / 255;
      const t = [0, 1, 2].map((i) => c[i] * a + f[i] * (1 - a));
      const x = L(t), y = L(f); return [s, Math.round(((Math.max(x, y) + .05) / (Math.min(x, y) + .05)) * 100) / 100];
    });
  }, sel);

  /* ---------- 2. portada (respaldo) a cinco tamaños ---------- */
  if (toca(2)) {
  console.log('\n2. Portada (respaldo, movimiento reducido) a 360×640, 375×667, 390×844, 768×1024, 1280×800 y 1440×900');
  for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024], [1280, 800], [1440, 900]]) {
    const movil = w < 1000;
    const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: movil, hasTouch: movil }, { script: sinCookies });
    await page.goto(PAG);
    await page.waitForFunction(() => { const i = document.querySelector('#portada .portada__foto img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
    const r = await page.evaluate(() => {
      const q = (s) => document.querySelector(s).getBoundingClientRect();
      const cab = q('#cab'), h1 = q('#portada h1'), sub = q('.portada__sub'), faro = q('.portada__faro'), foto = q('.portada__foto'), esc = q('.portada__escena');
      const img = document.querySelector('#portada .portada__foto img');
      const b = [...document.querySelectorAll('#portada .portada__acc .btn')].filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect());
      const pisa = (a, c) => a.left < c.right - 1 && a.right > c.left + 1 && a.top < c.bottom - 1 && a.bottom > c.top + 1;
      const tejado = foto.top + foto.height * 0.385;   // lo más alto del tejado (ref/raw/recorte.json: fila 383 de 989)
      return {
        foto: img.complete && img.naturalWidth > 0,
        amplia: +(img.getBoundingClientRect().width / +img.getAttribute('width')).toFixed(3),   // frente al ORIGINAL (1920), no al candidato del srcset
        h1BajoCab: h1.top >= cab.bottom - 1,
        subYbotonesLibres: [sub, ...b].every((x) => !pisa(x, faro)) && [sub, ...b].every((x) => x.bottom <= tejado + 2),
        faroTrasTejado: faro.bottom > foto.top + foto.height * 0.42,
        faroDentro: faro.top >= esc.top - 2,
        botones: b.length >= 1 && b.every((x) => x.right <= innerWidth + 1 && x.height >= 44),
        sinScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ctaVisible: b.every((x) => x.bottom <= innerHeight),
        respaldo: !document.querySelector('.portada__luz'),
      };
    });
    const { amplia, ...resto } = r;
    comprobar(Object.values(resto).every(Boolean) && amplia <= 1.001, `${w}×${h}: fachada cargada y sin ampliar (×${String(amplia).replace('.', ',')} en px CSS), titular bajo la cabecera, texto y botones libres del faro y sobre el tejado, faro plantado detrás del tejado, sin scroll lateral`, r);
    comprobar(page._errores.length === 0, `${w}×${h}: sin errores`, page._errores.slice(0, 3));
    await ctx.close();
  }
  }

  /* ---------- 3. contraste y foco (escritorio) ---------- */
  if (toca(3)) {
  console.log('\n3. Contraste y foco (escritorio, movimiento reducido)');
  const sel = ['.portada__pre', '#portada h1', '.portada__sub', '#portada .btn--luz', '.portada__acc .btn--linea-clara',
    '#t-apartamentos', '#apartamentos .sec-txt', '.aptos__sel [aria-selected="true"] b', '.aptos__sel [aria-selected="false"] b', '.aptos__sel [aria-selected="false"] small',
    '#apto-mirador .apto__tit', '#apto-mirador .apto__pre', '#apto-mirador .apto__propio', '#apto-mirador .apto__txt', '#apto-mirador .apto__cifras dd', '#apto-mirador .apto__cifras dt', '#apto-mirador .apto__rasgos b', '#apto-mirador .apto__rasgos span', '#apto-mirador .btn--oscuro', '#apto-mirador .apto__motor', '#apto-mirador figcaption .enlace',
    '.comunes__lista b', '.comunes__lista span', '.comunes__nota', '#t-piscina', '.piscina .sec-txt', '.piscina__datos dt', '.piscina__datos dd',
    '.estancias__indice a', '.estancias__n', '.estancia__tit', '.foto figcaption',
    '#t-lugar', '#lugar .sec-txt', '.lugar__respaldo figcaption', '.al-grupo__tit', '.al-nombre', '.al-dato .cifra', '.al-km', '.al-recta', '.alrededor__fino',
    '#t-resenas', '.resenas__dato', '.real', '.busca__eti', '.busca__resumen', '.busca__pista', '.cal__tit', '.cal__dias button:not(:disabled)', '.cal__dias button:disabled', '.motor__vacio p', '.motor__fuera a', '.motor__nota', '#busca-ir', '#motor-sin-fechas',
    '.condiciones__tit', '.condiciones__lista dt', '.condiciones__lista dd', '.condiciones__lineas a',
    '.contacto__dir', '.contacto__lineas a', '.contacto__ruta', '.map-consent b', '.map-consent span:last-child', '.pie__h', '.pie__cols p', '.pie__cols a', '.pie__legal p', '.pie__legal a', '.pie__sub'];
  const grandes = new Set(['#portada h1', '#t-apartamentos', '#apto-mirador .apto__tit', '#apto-mirador .apto__cifras dd', '#t-piscina', '.estancia__tit', '#t-lugar', '.al-grupo__tit', '#t-resenas', '.condiciones__tit', '.cal__tit']);
  for (const hora of ['dia', 'noche']) {
    const { ctx, page } = await nueva({}, { script: sinCookies });
    await page.goto(PAG + '&hora=' + hora);
    await page.waitForTimeout(300);
    const n = await page.evaluate(() => getComputedStyle(document.getElementById('portada')).getPropertyValue('--n').trim());
    const cs = await contrastes(page, hora === 'dia' ? sel : sel.slice(0, 5));
    const malos = cs.filter(([s, c]) => c === 'falta' || c < (grandes.has(s) ? 3 : 4.5));
    comprobar((hora === 'dia' ? n === '0' : n === '1') && malos.length === 0, `${hora === 'dia' ? 'de día' : 'de noche (portada)'} (--n = ${n}): contraste WCAG ≥ 4,5:1 (3:1 en rótulos grandes) en ${cs.length} parejas de texto`, malos);
    nota('peores: ' + cs.filter(([, c]) => c !== 'falta').sort((a, b) => a[1] - b[1]).slice(0, 4).map(([s, c]) => `${s} ${c}`).join(' · '));
    if (hora === 'noche') { await ctx.close(); continue; }
    // cabecera: clara sobre la portada; al bajar, fondo bruma
    const c0 = await page.evaluate(() => getComputedStyle(document.querySelector('.cab__tel')).color);
    await page.evaluate(() => scrollTo(0, 1400));
    await page.waitForFunction(() => document.getElementById('cab').classList.contains('sc'));
    const cb = await contrastes(page, ['.cab__tel', '.cab__reservar']);
    comprobar(c0 === 'rgb(238, 243, 246)' && cb.every(([, c]) => c >= 4.5), 'cabecera: clara sobre la portada; al bajar, fondo bruma con texto noche (≥ 4,5:1)', { c0, cb });
    // foco del teclado: contorno de 2 px + el haz corto a su izquierda, en claro y en oscuro
    const focos = [];
    for (const s of ['#portada .btn--luz', '.aptos__sel [role="tab"]', '.estancias__indice a', '.al-btn', '#mapa-btn', '.pie__cols a', '#busca-ir']) {
      await page.locator(s).first().scrollIntoViewIfNeeded();
      await page.locator(s).first().focus();
      await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
      await page.waitForTimeout(80);
      focos.push(await page.evaluate((s) => {
        const el = document.activeElement, c = getComputedStyle(el), m = document.getElementById('foco-haz');
        const r = el.getBoundingClientRect(), rm = m.getBoundingClientRect();
        return { s, el: el.matches(s), ancho: c.outlineWidth, estilo: c.outlineStyle, marco: m.classList.contains('es-visible') && rm.left < r.left - 15 && rm.right > r.right && rm.top < r.top && rm.bottom > r.bottom && /^M0 /.test(m.querySelector('.foco-haz__cono').getAttribute('d')) };
      }, s));
    }
    comprobar(focos.every((f) => f.el && f.ancho === '2px' && f.estilo === 'solid' && f.marco), 'foco del teclado: contorno de 2 px y el haz corto que nace a su izquierda (claro y oscuro)', focos);
    const cf = await page.evaluate(() => {
      const lz = document.createElement('canvas').getContext('2d');
      const rgb = (c) => { lz.fillStyle = c; lz.fillRect(0, 0, 1, 1); return [...lz.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const L = (m) => { m = m.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
      const k = (a, b) => { const x = L(rgb(a)), y = L(rgb(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      return { marinoBruma: k('#2D475E', '#EEF3F6'), marinoNiebla: k('#2D475E', '#DCE6EC'), luzNoche: k('#FDCF60', '#0E1C2A'), brumaLuz: k('#EEF3F6', '#FDCF60') };
    });
    comprobar(cf.marinoBruma >= 3 && cf.marinoNiebla >= 3 && cf.luzNoche >= 3, 'el color del foco llega a 3:1 contra sus fondos (marino sobre bruma y niebla, luz sobre noche)', cf);
    comprobar(await page.evaluate(() => document.querySelector('.pie__faro').classList.contains('es-encendido')), 'pie: con movimiento reducido el faro ya está encendido (estado final)');
    comprobar(page._errores.length === 0, 'sin errores de consola', page._errores.slice(0, 3));
    await ctx.close();
  }
  }

  /* ---------- 4. tokens, letras, apartamentos, estancias y fotos de 800 px ---------- */
  if (toca(4)) {
  console.log('\n4. Tokens, letras, el selector de apartamentos, las estancias y las fotos de 800 px');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  const tk = await page.evaluate(() => { const c = getComputedStyle(document.documentElement); return Object.fromEntries(['--bruma', '--niebla', '--marino', '--noche', '--luz', '--ola'].map((n) => [n, c.getPropertyValue(n).trim()])); });
  comprobar(tk['--bruma'] === '#EEF3F6' && tk['--niebla'] === '#DCE6EC' && tk['--marino'] === '#2D475E' && tk['--noche'] === '#0E1C2A' && tk['--luz'] === '#FDCF60' && tk['--ola'] === '#84CDE4', 'los seis colores en :root', tk);
  const lg = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('lugar')); return { fondo: c.getPropertyValue('--fondo').trim(), texto: getComputedStyle(document.querySelector('#lugar [data-modulo]')).getPropertyValue('--texto').trim(), bg: c.backgroundColor }; });
  comprobar(/var\(--noche\)|#0E1C2A/i.test(lg.fondo) && /bruma|#EEF3F6/i.test(lg.texto) && lg.bg === 'rgb(14, 28, 42)', '#lugar oscuro y el módulo hereda --fondo noche y --texto bruma', lg);
  const fam = await page.evaluate(() => ({ h1: getComputedStyle(document.querySelector('#portada h1')).fontFamily, cifra: getComputedStyle(document.querySelector('.apto__cifras dd')).fontFamily, p: getComputedStyle(document.querySelector('.apto__txt')).fontFamily }));
  comprobar(/Parkinsans/.test(fam.h1) && /Inconsolata/.test(fam.cifra) && /Radio Canada Big/.test(fam.p), 'titulares en Parkinsans, cifras en Inconsolata y texto en Radio Canada Big', fam);
  // selector
  const t0 = await page.evaluate(() => [...document.querySelectorAll('.apto')].map((f) => !f.hidden));
  await page.click('#tab-familiar');
  const t1 = await page.evaluate(() => ({ vis: [...document.querySelectorAll('.apto')].map((f) => !f.hidden), sel: document.getElementById('tab-familiar').getAttribute('aria-selected'), haz: getComputedStyle(document.getElementById('tab-familiar'), '::before').clipPath }));
  await page.focus('#tab-familiar'); await page.keyboard.press('ArrowDown');
  const t2 = await page.evaluate(() => ({ foco: document.activeElement.id, vis: [...document.querySelectorAll('.apto')].map((f) => !f.hidden) }));
  comprobar(JSON.stringify(t0) === '[true,false,false]' && JSON.stringify(t1.vis) === '[false,true,false]' && t1.sel === 'true' && /polygon/.test(t1.haz) && t2.foco === 'tab-deluxe' && JSON.stringify(t2.vis) === '[false,false,true]', 'los tres apartamentos: selector que cambia la ficha (clic y flechas), el elegido marcado con un haz corto', { t0, t1, t2 });
  // «Ver fechas de este»: baja a Reservar con la pista de ese apartamento
  await page.click('#apto-deluxe [data-reservar="deluxe"]');
  await page.waitForTimeout(300);
  const rv = await page.evaluate(() => ({ top: document.getElementById('reservar').getBoundingClientRect().top, pista: document.querySelector('[data-pista]').textContent }));
  comprobar(rv.top > -10 && rv.top < 140 && /Apartamento Deluxe con Jacuzzi/.test(rv.pista), '«Ver fechas de este» del Deluxe baja a Reservar y dice cómo se llama en su motor', rv);
  // estancias: el índice marca la que se ve
  const ids = D.estancias.map((e) => e.id);
  const marcadas = [];
  for (const id of ids) {
    await page.evaluate((id) => { const s = document.getElementById('est-' + id); scrollTo(0, s.getBoundingClientRect().top + scrollY - innerHeight * 0.3); }, id);
    await page.waitForTimeout(150);
    marcadas.push(await page.evaluate(() => (document.querySelector('.estancias__indice a[aria-current="true"]') || {}).dataset?.est));
  }
  comprobar(JSON.stringify(marcadas) === JSON.stringify(ids), `por dentro: el índice fijo marca la estancia que se ve (${ids.length} estancias, también con movimiento reducido)`, marcadas);
  const filas = await page.evaluate(() => {
    const malas = [];
    document.querySelectorAll('.fila').forEach((f) => { const hs = [...f.querySelectorAll('.foto-btn')].map((b) => b.getBoundingClientRect().height); if (Math.max(...hs) - Math.min(...hs) > 2) malas.push(hs); });
    return { malas, n: document.querySelectorAll('.fila').length, sticky: getComputedStyle(document.querySelector('.estancias__indice')).position, marcos: [...document.querySelectorAll('.foto .foto-btn')].some((b) => parseFloat(getComputedStyle(b).borderTopWidth) > 0 || getComputedStyle(b).boxShadow !== 'none') };
  });
  comprobar(filas.malas.length === 0 && filas.n >= 10 && filas.sticky === 'sticky' && !filas.marcos, `fotos sin marco con la misma altura en cada una de las ${filas.n} filas e índice fijo (sticky)`, filas);
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  // las fotos de 800 px, nunca más anchas que eso (a 1280 y a 1920 de ancho)
  for (const [w, h] of [[1280, 800], [1920, 1080]]) {
    const c = await nueva({ viewport: { width: w, height: h } }, { script: sinCookies });
    await c.page.goto(PAG + '&revision&densidad=sobria');   // en la sobria se ven las tres fichas a la vez
    const anchas = await c.page.evaluate(() => [...document.querySelectorAll('picture[data-real] img')].filter((i) => i.offsetParent).map((i) => [i.closest('picture').dataset.foto, Math.round(i.getBoundingClientRect().width)]).filter(([, a]) => a > 801));
    const n = await c.page.evaluate(() => [...document.querySelectorAll('picture[data-real] img')].filter((i) => i.offsetParent).length);
    comprobar(anchas.length === 0 && n >= 35, `${w}×${h}: las ${n} fotos de 800 px que se ven miden 800 px o menos en pantalla`, anchas);
    await c.ctx.close();
  }
  }

  /* ---------- 5. visor por NOMBRE ---------- */
  if (toca(5)) {
  console.log('\n5. El visor (abre por nombre de archivo)');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  const nombres = await page.evaluate(() => [...document.querySelectorAll('[data-visor]')].filter((b) => b.offsetParent && b.classList.contains('foto-btn')).map((b) => b.dataset.visor));
  const fj = JSON.parse(leer('img/fotos/fotos.json')).map((f) => f.nombre);
  comprobar(nombres.length >= 40 && nombres.every((n) => fj.includes(n)), `${nombres.length} fotos con visor y todas existen`, nombres);
  const mal = [];
  for (const n of nombres) {
    const b = page.locator(`.foto-btn[data-visor="${n}"]:visible`).first();
    await b.scrollIntoViewIfNeeded();
    await b.click();
    const v = await page.evaluate(() => ({ open: document.getElementById('visor').open, n: document.getElementById('visor-img').dataset.nombre, src: document.getElementById('visor-img').getAttribute('src') }));
    if (!v.open || v.n !== n || !v.src.includes('/' + n + '-')) mal.push([n, v]);
    await page.keyboard.press('Escape');
  }
  comprobar(mal.length === 0, 'cada miniatura abre SU foto (nombre de archivo comprobado) y Escape cierra', mal.slice(0, 3));
  await page.locator('#apto-mirador figcaption .enlace').scrollIntoViewIfNeeded();
  await page.click('#apto-mirador figcaption .enlace');
  const ls = await page.evaluate(() => ({ n: document.getElementById('visor-img').dataset.nombre, cuenta: document.getElementById('visor-n').textContent }));
  comprobar(ls.n === 'mirador-salon' && ls.cuenta === `1 / ${D.apartamentos[0].fotos.length}`, `«Ver sus ${D.apartamentos[0].fotos.length} fotos» abre la serie del Mirador por nombre`, ls);
  await page.keyboard.press('ArrowRight');
  comprobar(await page.evaluate((n) => document.getElementById('visor-img').dataset.nombre === n, D.apartamentos[0].fotos[1]), 'la flecha del teclado pasa a la siguiente de la serie');
  await page.keyboard.press('Escape');
  const api = await page.evaluate(() => { window.LasRiberas.visor.abrir(['pabellon', 'fachada', 'piscina'], 'fachada'); return { n: document.getElementById('visor-img').dataset.nombre, cuenta: document.getElementById('visor-n').textContent }; });
  comprobar(api.n === 'fachada' && api.cuenta === '2 / 3', 'LasRiberas.visor.abrir(lista, nombre) abre por nombre', api);
  await page.waitForTimeout(400);
  const tam = await page.evaluate(() => { window.LasRiberas.visor.abrir(['piscina'], 'piscina'); return new Promise((r) => setTimeout(() => { const i = document.getElementById('visor-img'); r({ w: Math.round(i.getBoundingClientRect().width), nat: i.naturalWidth }); }, 400)); });
  comprobar(tam.w <= 800, `en el visor, una foto de 800 px se ve a ${tam.w} px (nunca más ancha que la real)`, tam);
  await page.keyboard.press('Escape');
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 6. alrededor ---------- */
  if (toca(6)) {
  console.log('\n6. Alrededor: la lista elige el sitio y el dibujo saca el haz desde la casa');
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const movil = w < 600;
    const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: movil, hasTouch: movil }, { script: sinCookies });
    await page.goto(PAG);
    const ini = await page.evaluate(() => ({ botones: document.querySelectorAll('.al-btn').length, sitios: document.querySelectorAll('.al-sitio').length, pulsado: document.querySelector('.al-btn[aria-pressed="true"]')?.closest('li').dataset.ruta, haz: document.querySelector('.al-haz path').getAttribute('d') }));
    comprobar(ini.botones === 7 && ini.sitios === 7 && ini.pulsado === 'vidio' && /^M0 0L/.test(ini.haz), `${w}: 7 sitios en el dibujo y en la lista; arranca en el faro con su haz`, ini);
    const malos = [];
    for (const id of ['luarca', 'ovd', 'vallina', 'cudillero']) {
      const b = page.locator(`li[data-ruta="${id}"] .al-btn`);
      await b.scrollIntoViewIfNeeded();
      if (movil) await b.tap(); else await b.click();
      const r = await page.evaluate((id) => {
        const g = document.querySelector(`.al-sitio[data-ruta="${id}"]`), p = document.querySelector('.al-haz path').getAttribute('d');
        const et = g.querySelector('.al-et');
        return { pulsado: document.querySelector('.al-btn[aria-pressed="true"]').closest('li').dataset.ruta, elegido: g.classList.contains('es-elegido'), unico: document.querySelectorAll('.al-sitio.es-elegido').length, haz: p, etiqueta: getComputedStyle(et).display !== 'none' };
      }, id);
      if (r.pulsado !== id || !r.elegido || r.unico !== 1 || !/^M0 0L/.test(r.haz) || !r.etiqueta) malos.push([id, r]);
    }
    comprobar(malos.length === 0, `${w}: cada sitio se marca en el dibujo (con su nombre visible) y el haz apunta a él`, malos.slice(0, 2));
    const sc = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    comprobar(sc && page._errores.length === 0, `${w}: sin scroll lateral ni errores`, page._errores.slice(0, 3));
    await ctx.close();
  }
  }

  /* ---------- 7. reservar: el buscador y el iframe REAL que se crea solo al pedirlo ---------- */
  if (toca(7)) {
  console.log('\n7. Reservar: buscador propio + su motor real (Redforts) en iframe');
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const movil = w < 600;
    const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: movil, hasTouch: movil }, { script: sinCookies });
    await page.goto(PAG);
    await page.locator('#busca').scrollIntoViewIfNeeded();
    const f0 = await page.evaluate(() => ({ iframe: !!document.querySelector('iframe'), fuera: document.getElementById('motor-fuera').href, visible: !!document.getElementById('motor-fuera').offsetParent }));
    comprobar(!f0.iframe && f0.fuera === MOTOR && f0.visible, `${w}: el iframe no existe hasta pedirlo; «Abrir el motor en otra pestaña» ya se ve, al motor sin fechas`, f0);
    await page.click('#busca-ir');
    comprobar(await page.evaluate(() => !document.querySelector('iframe') && /Falta el día de llegada/.test(document.querySelector('[data-resumen]').textContent)), `${w}: sin fechas, «Buscar» no abre nada y dice lo que falta`);
    await page.click('.cal__flecha[data-nav="1"]');
    const par = await page.evaluate(() => { const b = [...document.querySelectorAll('.cal__dias button:not(:disabled)')]; return [b[10].dataset.k, b[13].dataset.k]; });
    await page.click(`.cal__dias button[data-k="${par[0]}"]`);
    await page.click(`.cal__dias button[data-k="${par[1]}"]`);
    const conFechas = `${MOTOR}?arrival=${par[0]}&departure=${par[1]}`;
    comprobar(await page.evaluate((u) => document.getElementById('motor-fuera').href === u && /3 noches/.test(document.querySelector('[data-noches]').textContent), conFechas), `${w}: al elegir fechas, el enlace de fuera ya lleva arrival y departure (3 noches)`);
    await page.click('#busca-ir');
    const ifr = await page.waitForFunction(() => { const f = document.getElementById('motor-iframe'); return f && f.src; }, null, { timeout: 5000 }).then((x) => x.jsonValue(), () => null);
    comprobar(ifr === conFechas, `${w}: al buscar se CREA el iframe de su Redforts con las fechas por URL (?arrival=…&departure=…)`, ifr);
    await page.waitForFunction(() => /con tus fechas/.test(document.getElementById('motor-estado').textContent), null, { timeout: 5000 }).catch(() => {});
    const m = await page.evaluate(() => { const f = document.getElementById('motor-iframe').getBoundingClientRect(); return { alto: Math.round(f.height), dentro: f.left >= 0 && f.right <= innerWidth + 1, fuera: document.getElementById('motor-fuera').href, estado: document.getElementById('motor-estado').textContent, real: /su motor de reservas real/i.test(document.querySelector('.real').textContent) }; });
    comprobar(m.alto >= 640 && m.alto <= 1040 && m.dentro && m.fuera === ifr && /con tus fechas/.test(m.estado) && m.real, `${w}: el iframe mide ${m.alto} px de alto, cabe de ancho y lleva al lado «Abrir el motor en otra pestaña» (la misma dirección) y el aviso de motor real`, m);
    await page.click('#motor-sin-fechas');
    comprobar(await page.evaluate((u) => document.getElementById('motor-iframe').src === u && document.querySelectorAll('iframe').length === 1 && document.getElementById('motor-fuera').href === u, MOTOR), `${w}: «Abrir su calendario sin fechas» lleva el mismo iframe (y el enlace) al motor sin parámetros`);
    const cond = await page.evaluate(() => { const c = document.querySelector('.condiciones').getBoundingClientRect(); return { visible: c.height > 100, cabe: c.right <= innerWidth + 1 }; });
    comprobar(cond.visible && cond.cabe, `${w}: las condiciones al lado (o debajo, en móvil), dentro de la pantalla`, cond);
    comprobar(page._noGet.length === 0, `${w}: el buscador no envía nada (ninguna petición que no sea GET)`, page._noGet);
    comprobar(page._errores.length === 0, `${w}: sin errores`, page._errores.slice(0, 3));
    await ctx.close();
  }
  }

  /* ---------- 8. cookies y mapa ---------- */
  if (toca(8)) {
  console.log('\n8. Cookies y mapa de Google');
  const { ctx, page } = await nueva();
  await page.goto(PAG);
  const vis = () => page.evaluate(() => { const c = document.getElementById('cookies'); return !c.hidden && getComputedStyle(c).display === 'flex' && c.getBoundingClientRect().height > 40; });
  await page.waitForTimeout(200);
  comprobar(await vis(), 'cookies: el aviso aparece en la primera visita');
  comprobar(await page.evaluate(() => /Google Fonts/.test(document.getElementById('cookies').textContent) && /mapa de Google/.test(document.getElementById('cookies').textContent) && /Redforts/.test(document.getElementById('cookies').textContent)), 'el aviso cita Google Fonts, el mapa de Google y el motor (Redforts)');
  await page.click('#ck-si');
  comprobar(!(await vis()) && await page.evaluate((k) => localStorage.getItem(k) === 'si', LLAVE), 'cookies: «Entendido» lo cierra y lo recuerda');
  await page.reload(); await page.waitForTimeout(300);
  comprobar(!(await vis()), 'cookies: no vuelve a salir tras aceptar');
  await page.locator('#abrir-cookies').scrollIntoViewIfNeeded();
  await page.click('#abrir-cookies');
  comprobar(await vis(), 'cookies: «Preferencias de cookies» lo vuelve a abrir');
  await page.click('#ck-no');
  comprobar(!(await vis()) && await page.evaluate((k) => localStorage.getItem(k) === 'no', LLAVE), 'cookies: «Solo lo necesario» lo cierra y lo recuerda');
  await page.evaluate((k) => localStorage.removeItem(k), LLAVE); await page.reload(); await page.waitForTimeout(300);
  comprobar(await vis(), 'cookies: si se borra la clave, vuelve a salir');
  const ckp = leer('cookies.html'), pr = leer('privacidad.html');
  comprobar(/Google Fonts/.test(ckp) && /Google Maps/.test(ckp) && /Redforts/.test(ckp) && /sidi8ZN/.test(ckp) && /lasriberas-cookies/.test(pr) && /Redforts/.test(pr), 'cookies y privacidad citan Google Fonts, Google Maps, Redforts (con su cookie de sesión) y lo que se guarda');
  await page.locator('#mapa').scrollIntoViewIfNeeded();
  comprobar(await page.evaluate(() => !document.querySelector('#mapa iframe')), 'el mapa de Google no se carga hasta pedirlo');
  await page.click('#mapa-btn');
  const m = await page.evaluate(() => { const f = document.querySelector('#mapa iframe'); return f && f.src; });
  comprobar(m && /output=embed/.test(m) && /maps\?q=43\.577355%2C-6\.249080/.test(m), 'al pulsar, el mapa se carga (maps?q=<el punto del Catastro>&output=embed, sin clave)', m);
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 9. mando de densidades (solo con ?revision) ---------- */
  if (toca(9)) {
  console.log('\n9. Mando «Faro / Sobria»');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  const sin = await page.evaluate(() => ({ mando: !document.getElementById('mando').hidden, disp: getComputedStyle(document.getElementById('mando')).display, vistazo: getComputedStyle(document.getElementById('vistazo')).display }));
  comprobar(!sin.mando && sin.disp === 'none' && sin.vistazo === 'none', 'sin ?revision: ni mando ni tabla «De un vistazo»', sin);
  await page.goto(PAG + '&revision');
  await page.waitForTimeout(200);
  const con = await page.evaluate(() => ({ botones: [...document.querySelectorAll('#mando button')].map((b) => b.textContent.trim() + ':' + b.getAttribute('aria-pressed')), vis: !document.getElementById('mando').hidden, izq: document.getElementById('mando').getBoundingClientRect().left < 40 }));
  comprobar(con.vis && con.izq && con.botones.join() === 'Faro:true,Sobria:false', 'con ?revision: el mando «Faro / Sobria» abajo a la izquierda, con Faro marcada', con);
  await page.click('#mando button[data-densidad="sobria"]');
  await page.waitForTimeout(200);
  const so = await page.evaluate(() => ({ clase: document.documentElement.classList.contains('densidad-sobria'), vistazo: getComputedStyle(document.getElementById('vistazo')).display, url: location.search, filas: document.querySelectorAll('.vistazo__tabla tbody tr').length, fichas: [...document.querySelectorAll('.apto')].filter((f) => getComputedStyle(f).display !== 'none').length, sel: getComputedStyle(document.querySelector('.aptos__sel')).display, sc: document.documentElement.scrollWidth <= document.documentElement.clientWidth }));
  comprobar(so.clase && so.vistazo === 'block' && /densidad=sobria/.test(so.url) && so.filas === 7 && so.fichas === 3 && so.sel === 'none' && so.sc, 'en «Sobria»: sin selector (las tres fichas seguidas) y AÑADE la tabla «De un vistazo» (7 filas), sin scroll lateral', so);
  await page.click('#mando button[data-densidad="faro"]');
  comprobar(await page.evaluate(() => !document.documentElement.classList.contains('densidad-sobria') && getComputedStyle(document.getElementById('vistazo')).display === 'none'), 'volver a «Faro» la oculta');
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  const c2 = await nueva({});
  await c2.page.goto(PAG + '&revision');
  comprobar(await c2.page.evaluate(() => !(!document.getElementById('cookies').hidden && !document.getElementById('mando').hidden)), 'el mando se aparta mientras está el aviso de cookies');
  await c2.ctx.close();
  }

  /* ---------- 10. móvil: menú, visor con el dedo, barra del navegador, índice y buscador ---------- */
  if (toca(10)) {
  console.log('\n10. Móvil (390×844): menú, visor con el dedo, barra del navegador');
  const { ctx, page } = await nueva({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { script: sinCookies });
  await page.goto(PAG);
  await page.evaluate(() => scrollTo(0, 1600));
  await page.waitForFunction(() => document.getElementById('cab').classList.contains('sc'));
  await page.click('#menu-btn');
  const mm = await page.evaluate(() => { const r = document.getElementById('menu-movil').getBoundingClientRect(); return { top: r.top, alto: r.height, vista: innerHeight, vis: getComputedStyle(document.getElementById('menu-movil')).visibility, exp: document.getElementById('menu-btn').getAttribute('aria-expanded') }; });
  comprobar(mm.top === 0 && Math.abs(mm.alto - mm.vista) < 2 && mm.vis === 'visible' && mm.exp === 'true', 'menú móvil a pantalla completa con la cabecera ya fija (blur) y aria-expanded', mm);
  await page.click('#menu-btn');
  comprobar(await page.evaluate(() => !document.body.classList.contains('menu')), 'el botón del menú también lo cierra');
  await page.click('#menu-btn');
  await page.click('#menu-movil a[href="#reservar"]');
  comprobar(await page.waitForFunction(() => !document.body.classList.contains('menu'), null, { timeout: 3000 }).then(() => true, () => false), 'el menú se cierra al elegir');
  const nombres = await page.evaluate(() => [...document.querySelectorAll('#est-fuera [data-visor]')].map((b) => b.dataset.visor));
  const mal = [];
  for (const n of nombres) {
    const b = page.locator(`#est-fuera [data-visor="${n}"]`);
    await b.scrollIntoViewIfNeeded(); await b.tap();
    const v = await page.evaluate(() => ({ open: document.getElementById('visor').open, n: document.getElementById('visor-img').dataset.nombre }));
    if (!v.open || v.n !== n) mal.push([n, v]);
    await page.click('#visor-cerrar');
  }
  comprobar(mal.length === 0 && nombres.length === 5, 'con el dedo, cada foto de «Fuera» abre la suya', mal);
  await page.locator(`#est-fuera [data-visor="${nombres[0]}"]`).tap();
  const ok = await page.evaluate(() => ['.visor__btn--sig', '.visor__btn--ant'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); const x = r.left + r.width / 2; return [0.25, 0.5, 0.75, 0.9].map((f) => { const e = document.elementFromPoint(x, r.top + r.height * f); return !!e && !!e.closest(s); }).every(Boolean); }));
  comprobar(ok.every(Boolean), 'visor móvil: los botones ‹ › reciben el toque en toda su altura', ok);
  await page.click('#visor-cerrar');
  await page.locator('#est-cocina').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const ind = await page.evaluate(() => { const o = document.querySelector('.estancias__indice'); const a = document.querySelector('.estancias__indice a[aria-current="true"]'); const r = a && a.getBoundingClientRect(); return { corto: [...document.querySelectorAll('.estancias__corto')].every((s) => getComputedStyle(s).display !== 'none'), marcada: a && a.dataset.est, aLaVista: !!r && r.left >= -1 && r.right <= innerWidth + 1, sinScrollPagina: document.documentElement.scrollWidth <= document.documentElement.clientWidth }; });
  comprobar(ind.corto && ind.marcada === 'cocina' && ind.aLaVista && ind.sinScrollPagina, 'índice de estancias en móvil: tira de nombres cortos con la marcada a la vista y sin scroll lateral de la página', ind);
  // la barra del navegador: 6 cambios de alto → ningún «riberas:resize» y nada se mueve
  await page.evaluate(() => document.querySelectorAll('main > section, footer').forEach((s) => { s.style.height = s.offsetHeight + 'px'; }));
  const n0 = await page.evaluate(() => { window.__res = 0; document.addEventListener('riberas:resize', () => window.__res++); scrollTo(0, 5200); return document.getElementById('contacto').getBoundingClientRect().top + scrollY; });
  await page.waitForTimeout(150);
  for (const alto of [788, 844, 788, 844, 800, 844]) { await page.setViewportSize({ width: 390, height: alto }); await page.waitForTimeout(260); }
  const d = await page.evaluate(() => ({ res: window.__res, top: document.getElementById('contacto').getBoundingClientRect().top + scrollY }));
  comprobar(d.res === 0 && Math.abs(d.top - n0) < 1, 'barra del móvil: nada se rehace y la página no se mueve', { ...d, antes: n0 });
  await page.evaluate(() => document.querySelectorAll('main > section, footer').forEach((s) => { s.style.height = ''; }));
  const mo = await page.evaluate(() => { const b = document.getElementById('busca').getBoundingClientRect(); const dia = document.querySelector('.cal__dias button').getBoundingClientRect(); return { cabe: b.right <= innerWidth + 1 && b.left >= 0, meses: document.querySelectorAll('.cal__mes').length, dia: Math.round(dia.width) }; });
  comprobar(mo.cabe && mo.meses === 1 && mo.dia >= 38, 'el buscador cabe en 390 px, enseña un mes y los días miden ≥ 38 px', mo);
  comprobar(page._errores.length === 0, 'móvil: sin errores', page._errores.slice(0, 3));
  await ctx.close();
  // sin scroll lateral en ningún tamaño de móvil, de arriba abajo
  for (const [w, h] of [[360, 640], [375, 667], [768, 1024]]) {
    const c = await nueva({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700 }, { script: sinCookies });
    await c.page.goto(PAG);
    const anchos = await c.page.evaluate(() => { const malos = []; document.querySelectorAll('main *, footer *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1 && !e.closest('.portada__escena, .vistazo__caja, .estancias__indice, svg')) malos.push(e.className || e.tagName); }); return { sc: document.documentElement.scrollWidth <= document.documentElement.clientWidth, malos: [...new Set(malos)].slice(0, 5) }; });
    comprobar(anchos.sc && anchos.malos.length === 0, `${w}×${h}: nada se sale por la derecha en toda la página`, anchos);
    comprobar(c.page._errores.length === 0, `${w}×${h}: sin errores`, c.page._errores.slice(0, 3));
    await c.ctx.close();
  }
  }

  /* ---------- 11. legales y enlaces ---------- */
  if (toca(11)) {
  console.log('\n11. Legales, 404 y enlaces');
  const { ctx, page } = await nueva();
  for (const f of ['aviso-legal', 'privacidad', 'cookies', 'accesibilidad', '404']) {
    page._errores.length = 0;
    await page.goto(BASE + f + '.html');
    comprobar((await page.locator('h1').count()) === 1 && page._errores.length === 0, `${f}.html se abre sin errores`, page._errores);
  }
  const av = leer('aviso-legal.html');
  comprobar(/Complejo Turístico Playa La Vallina S\.L\./.test(av) && /B74444522/.test(av) && /Vivigo s\/n, Oviñana, Cudillero/.test(av) && /Registro de turismo<\/dt><dd><span class="aviso-corto">por confirmar/.test(av) && /Código postal<\/dt><dd><span class="aviso-corto">por confirmar/.test(av) && /OSRM/.test(av) && /ODbL/.test(av) && /Instituto Geográfico Nacional/.test(av) && /Catastro/.test(av) && /reservas que se hacen en él son reales/.test(av), 'aviso legal: el titular de DATOS (sociedad, NIF y domicilio), registro y CP «por confirmar», OSM/OSRM, IGN y Catastro del 3D, y el motor real');
  const todos = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html')).map((f) => leer(f)).join('\n');
  const internos = [...new Set([...todos.matchAll(/href="([a-z0-9-]+\.html)(#[^"]*)?"/g)].map((m) => m[1]))];
  comprobar(internos.every(existe), `los enlaces internos entre páginas existen (${internos.join(', ')})`, internos.filter((f) => !existe(f)));
  const anclas = [...new Set([...leer('index.html').matchAll(/href="#([^"]+)"/g)].map((m) => m[1]))];
  const sinDestino = anclas.filter((a) => !new RegExp(`id="${a}"`).test(leer('index.html')));
  comprobar(sinDestino.length === 0, `las ${anclas.length} anclas de la portada tienen destino`, sinDestino);
  const externos = [...todos.matchAll(/<a [^>]*href="https?:[^"]+"[^>]*>/g)].map((m) => m[0]);
  comprobar(externos.every((a) => /target="_blank"/.test(a) ? /rel="noopener"/.test(a) : true), `los ${externos.length} enlaces de fuera que abren otra pestaña llevan rel="noopener"`);
  await ctx.close();
  }

  /* ---------- 12. el 3D: solo el contenedor y su respaldo (no se pinta WebGL) ---------- */
  if (toca(12)) {
  console.log('\n12. El lugar en 3D: el contenedor y el respaldo (sin pintar WebGL)');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  await page.locator('#lugar').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => { const i = document.querySelector('[data-modulo="lugar"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 6000 }).catch(() => {});
  const r = await page.evaluate(() => { const el = document.querySelector('[data-modulo="lugar"]'); const img = el.querySelector('img'); const r = img && img.getBoundingClientRect(); return { el: !!el, foto: !!img && img.complete && img.naturalWidth > 0 && r.width > 200, texto: /Cabo Vidio/.test(el.textContent), canvas: !!el.querySelector('canvas') }; });
  comprobar(r.el && r.foto && r.texto && !r.canvas, 'el hueco #lugar [data-modulo="lugar"] existe y se ve el respaldo (Cabo Vidio y texto), sin canvas', r);
  comprobar(page._errores.length === 0, 'sin js/lugar.js la página no falla', page._errores.slice(0, 3));
  await ctx.close();
  if (existe('js/lugar.js')) {
    const c3 = await nueva({}, { script: sinCookies, con3d: true });
    await c3.page.goto(PAG);
    const anc = await c3.page.evaluate(() => { const r = []; for (let e = document.querySelector('[data-modulo="lugar"]').parentElement; e && e !== document.documentElement; e = e.parentElement) { const c = getComputedStyle(e); if (/(hidden|auto|scroll|clip)/.test(c.overflowX + ' ' + c.overflowY) || c.transform !== 'none' || c.filter !== 'none') r.push(e.tagName + '.' + e.className); } return { r, arriba: getComputedStyle(document.getElementById('lugar')).getPropertyValue('--lugar-arriba').trim() }; });
    comprobar(anc.r.length === 0 && anc.arriba !== '', 'el escenario sticky del 3D puede pegarse: ningún antepasado con overflow, transform ni filter, y --lugar-arriba puesto', anc);
    await c3.page.locator('#lugar').scrollIntoViewIfNeeded();
    const ok = await c3.page.waitForFunction(() => { const el = document.querySelector('[data-modulo="lugar"]'); return el.dataset.montado === '1' && el.dataset.modo === 'plano'; }, null, { timeout: 8000 }).then(() => true, () => false);
    await c3.page.waitForFunction(() => [...document.querySelectorAll('[data-modulo="lugar"] img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
    const p3 = await c3.page.evaluate(() => { const el = document.querySelector('[data-modulo="lugar"]'); const imgs = [...el.querySelectorAll('img')]; return { montado: el.dataset.montado, modo: el.dataset.modo, imgs: imgs.length, cargadas: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, marcas: [...el.querySelectorAll('.lugar__marca')].filter((m) => !m.hidden && getComputedStyle(m).display !== 'none').length, canvas3d: !!el.querySelector('canvas'), sc: document.documentElement.scrollWidth <= document.documentElement.clientWidth }; });
    comprobar(ok && p3.imgs >= 1 && p3.cargadas === p3.imgs && p3.marcas > 0 && p3.sc, 'con js/lugar.js y sin WebGL: data-montado="1", data-modo="plano", cargan sus imágenes y hay marcas visibles (sin scroll lateral)', p3);
    comprobar(c3.page._errores.length === 0, 'el módulo del 3D (plan B) no da errores', c3.page._errores.slice(0, 3));
    await c3.ctx.close();
  } else nota('aún no está js/lugar.js');
  }

  /* ---------- 13. con movimiento, una vez y al final ---------- */
  if (toca(13)) {
  console.log('\n13. Con movimiento (una vez): el haz que gira y enciende, el gesto, la recarga a media página, titulares y el pie');
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { script: sinCookies });
    await page.goto(PAG + '&hora=noche');
    await page.waitForFunction(() => document.getElementById('portada').classList.contains('es-luz'), null, { timeout: 5000 }).catch(() => {});
    const est = () => page.evaluate(() => { const e = window.LasRiberas.web.montados.get(document.querySelector('[data-modulo="portada"]')); return e && e.inst && JSON.parse(JSON.stringify(e.inst.estado)); });
    const e0 = await est();
    await page.waitForTimeout(700);
    const e1 = await est();
    const giro = (a, b) => ((a - b + 540) % 360) - 180;
    comprobar(e0 && e0.encendidas && e0.activo && e0.n === 1 && e0.periodo === 5 && Math.abs(giro(e1.giro, e0.giro)) > 20, `portada con movimiento y de noche: el haz gira (${Math.abs(giro(e1.giro, e0.giro)).toFixed(0)}° en 0,7 s, una vuelta cada ${e0 && e0.periodo} s de data/faro.json) y hay copias encendidas`, { e0, e1 });
    const al = await page.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((v) => Math.round(v)); };
      const h = document.querySelector('.portada__texto:not([aria-hidden]) .portada__tit'), hc = document.querySelector('.portada__luz--tit .portada__tit');
      const f = document.querySelector('.portada__foto:not([aria-hidden]) img'), fc = document.querySelector('.portada__luz--foto img');
      return { h: r(h), hc: r(hc), f: r(f), fc: r(fc), copiaId: !!document.querySelector('.portada__luz [id]'), copiaOculta: document.querySelector('.portada__luz--tit .portada__texto').getAttribute('aria-hidden') };
    });
    const igual = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 1);
    comprobar(igual(al.h, al.hc) && igual(al.f, al.fc) && !al.copiaId && al.copiaOculta === 'true', 'el titular y la fachada encendidos caen EXACTAMENTE sobre los de verdad (±1 px) aunque giren con el haz; las copias, sin ids y ocultas al lector', al);
    // recarga a media página → arriba
    await page.mouse.move(640, 400);
    for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(40); }
    const sep = await page.evaluate(() => ({ y: scrollY, t: document.querySelector('.portada__texto').style.transform }));
    comprobar(sep.y > 1000 && /translate3d\(0px, -\d/.test(sep.t), 'al bajar, las capas se separan (el titular sube más deprisa)', sep);
    await page.reload();
    await page.waitForTimeout(600);
    comprobar(await page.evaluate(() => scrollY) === 0, 'recargar a media página: vuelve arriba (scrollY === 0)', await page.evaluate(() => scrollY));
    comprobar(page._errores.length === 0, 'con movimiento no hay errores (escritorio)', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { script: sinCookies });
    await page.goto(PAG + '&hora=dia');
    await page.waitForFunction(() => document.getElementById('portada').classList.contains('es-luz'), null, { timeout: 5000 }).catch(() => {});
    const cdp = await ctx.newCDPSession(page);
    const est = () => page.evaluate(() => { const e = window.LasRiberas.web.montados.get(document.querySelector('[data-modulo="portada"]')); return e && e.inst ? { giro: e.inst.estado.giro, vel: e.inst.estado.vel, n: e.inst.estado.n } : null; });
    const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const a0 = await est();
    await t('touchStart', 80, 600);
    for (let i = 1; i <= 8; i++) { await t('touchMove', 80 + i * 25, 602); await page.waitForTimeout(25); }
    const durante = await est();
    await t('touchEnd');
    await page.waitForTimeout(1500);
    const despues = await est();
    // de día y sin gesto gira hacia la izquierda (giro baja); arrastrar a la derecha lo empuja al otro lado (sube)
    const d = ((durante.giro - a0.giro + 540) % 360) - 180;
    comprobar(a0.n === 0 && d > 30 && Math.abs(despues.vel) < 40, `gesto táctil del hero: arrastrar con el dedo gira el faro a mano (${d.toFixed(0)}°), y al soltar la inercia se apaga y vuelve a su ritmo`, { a0, durante, despues });
    const y0 = await page.evaluate(() => scrollY);
    await t('touchStart', 200, 700);
    for (let i = 1; i <= 10; i++) { await t('touchMove', 200, 700 - i * 40); await page.waitForTimeout(16); }
    await t('touchEnd');
    await page.waitForTimeout(500);
    const y1 = await page.evaluate(() => scrollY);
    comprobar(y1 > y0 + 200, 'y el scroll vertical con el dedo sigue siendo de la página (touch-action: pan-y)', { y0, y1 });
    const total = await page.evaluate(() => document.querySelectorAll('[data-aparece]').length);
    for (let pasada = 0; pasada < 2; pasada++) {
      const alto = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < alto; y += 500) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(60); }
    }
    await page.waitForTimeout(1300);
    const vistos = await page.evaluate(() => [...document.querySelectorAll('[data-aparece]')].map((h) => [h.id, h.classList.contains('es-visto'), getComputedStyle(h).opacity]));
    comprobar(vistos.length === total && vistos.every(([, v, o]) => v && o === '1'), `móvil con movimiento: los ${total} titulares aparecen al pasar`, vistos.filter(([, v]) => !v));
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(2200);
    const pie = await page.evaluate(() => ({ encendido: document.querySelector('.pie__faro').classList.contains('es-encendido'), luz: getComputedStyle(document.querySelector('.pie__simbolo .s-luz')).fill, haz: getComputedStyle(document.querySelector('.pie__haz')).opacity }));
    comprobar(pie.encendido && pie.luz === 'rgb(253, 207, 96)' && +pie.haz > 0.4, 'el objeto se completa en el pie: el faro se enciende al llegar y su haz da una pasada', pie);
    comprobar(page._errores.length === 0, 'con movimiento no hay errores (móvil)', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, javaScriptEnabled: false });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const page = await ctx.newPage();
    await page.goto(PAG);
    const r = await page.evaluate(() => ({ h1: !!document.querySelector('#portada h1').offsetParent, faro: !!document.querySelector('.portada__faro'), haz: getComputedStyle(document.querySelector('.portada__haz')).transform !== 'none', tit: getComputedStyle(document.querySelector('#t-apartamentos')).opacity, fichas: [...document.querySelectorAll('.apto')].filter((f) => getComputedStyle(f).display !== 'none').length, motor: !!document.querySelector('#cal noscript'), lugar: !!document.querySelector('[data-modulo="lugar"] img') }));
    comprobar(r.h1 && r.faro && r.haz && r.tit === '1' && r.fichas === 3 && r.motor && r.lugar, 'sin JavaScript: la portada en su respaldo (con el haz quieto), las tres fichas, el respaldo del 3D y el motor remite a su enlace y al teléfono', r);
    await ctx.close();
  }
  }
} finally {
  await browser.close();
  servidor.close();
}

console.log(`\n${nOk} comprobaciones bien, ${fallos.length} mal`);
if (fallos.length) { console.log('FALLOS:\n - ' + fallos.join('\n - ')); process.exitCode = 1; }
