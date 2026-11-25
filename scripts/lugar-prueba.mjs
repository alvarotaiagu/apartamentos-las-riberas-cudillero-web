/* Comprobación del módulo lugar (agente Lugar 3D). NO pinta el 3D.
   1. Funciones puras de js/lugar.js en Node (vm): sol, luna, el ritmo del faro, el recorrido.
   2. Datos de img/lugar/: ficheros, tamaños, alturas (PNG decodificado en Node), edificios, lugares, recorrido.
   3. (con navegador) Plan B en Chromium SIN WebGL (--disable-3d-apis + navigator.webdriver) y la escena 3D
      montada con Three.js real y un WebGLRenderer FALSO que no pinta (no gasta CPU en swiftshader).
   Uso: node scripts/lugar-prueba.mjs --sin-navegador   (solo 1 y 2: lo que se puede comprobar sin pintar)
        node scripts/lugar-prueba.mjs                   (1, 2 y 3; puerto 8962; un navegador, escala 1)
   Antes de la 3: mirar que no haya otra prueba en marcha (chrome-headless-shell), ver WEBS NEGOCIOS/CLAUDE.md. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 8962;
let fallos = 0, bien = 0;
const ok = (c, txt) => { if (c) { bien++; console.log('  ok  ', txt); } else { fallos++; console.log('  MAL ', txt); } };

/* ---------- 1. funciones puras ---------- */
console.log('1. funciones puras');
const ctx = { window: {}, document: { currentScript: null }, location: { href: 'http://localhost/', search: '' }, URL, URLSearchParams, Intl, Math, Date, console };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/lugar.js'), 'utf8'), ctx, { filename: 'lugar.js' });
const L = ctx.LasRiberas.lugar;
ok(typeof L.montar === 'function', 'expone window.LasRiberas.lugar.montar');
// mediodía solar en Cudillero (6,25° O): ~12:27 UTC. Altura = 90 − 43,58 ± 23,44
const s = L.sol(new Date('2026-06-21T12:27:00Z'));
ok(s.alt > 69 && s.alt < 70.6 && s.az > 175 && s.az < 185, `sol 21-jun 12:27 UTC: ${s.alt.toFixed(2)}° alt (teórica 69,9°), ${s.az.toFixed(1)}° az`);
const s2 = L.sol(new Date('2026-12-21T12:27:00Z'));
ok(s2.alt > 22.3 && s2.alt < 23.6, `sol 21-dic 12:27 UTC: ${s2.alt.toFixed(2)}° (teórica 23,0°)`);
// puesta de sol de hoy (25-nov-2026): se busca el paso por −0,833°
let puesta = null;
for (let m = 15 * 60; m < 19 * 60; m++) {
  const a = L.sol(new Date(Date.UTC(2026, 10, 25, 0, m))).alt, b = L.sol(new Date(Date.UTC(2026, 10, 25, 0, m + 1))).alt;
  if (a > -0.833 && b <= -0.833) { puesta = m; break; }
}
ok(puesta && puesta >= 16 * 60 + 50 && puesta <= 17 * 60 + 5, `puesta de sol 25-nov en Cudillero: ${puesta ? Math.floor(puesta / 60 + 1) + ':' + String(puesta % 60).padStart(2, '0') : '?'} hora peninsular (≈ 17:53: Oviedo 17:51 + 2 min por estar más al oeste)`);
const lu = L.luna(new Date('2026-11-24T15:00:00Z'));
ok(lu.luz > 0.97, `luna llena del 24-nov-2026: ${(lu.luz * 100).toFixed(1)} % iluminada, fase ${lu.fase.toFixed(3)}`);
const lu2 = L.luna(new Date('2026-12-09T00:00:00Z'));
ok(lu2.luz < 0.05, `luna nueva del 9-dic-2026: ${(lu2.luz * 100).toFixed(1)} % iluminada`);
ok(/Cudillero/.test(L.fraseCielo(new Date())), 'frase del cielo: ' + L.fraseCielo(new Date()));
ok(/faro/.test(L.fraseCielo(new Date('2026-11-25T22:00:00Z'))), 'de noche habla del faro: ' + L.fraseCielo(new Date('2026-11-25T22:00:00Z')));
ok(L.faroEncendido(20) === 0 && L.faroEncendido(-6) === 1, 'faro apagado de día y encendido de noche');
// ritmo del faro: lo lee de data/faro.json; si falta o no cuadra, giro neutro
const neu = L.ritmoFaro(null), r1 = L.ritmoFaro({ grupo: 1, periodo_s: 5, fuente: 'x' }), r3 = L.ritmoFaro({ grupo: 3, periodo_s: 15 });
ok(neu.neutro && neu.grupo === 1, `sin data/faro.json: giro neutro (1 haz cada ${neu.periodo_s} s)`);
ok(!r1.neutro && r1.periodo_s === 5 && L.separacionHaces(r1) === 0, 'Fl 5 s: un haz, una vuelta cada 5 s');
const sep3 = L.separacionHaces(r3);
ok(Math.abs(sep3 / (2 * Math.PI) * 15 - 1.6) < 0.01, `Gp Fl(3) 15 s: tres haces a ${(sep3 / Math.PI * 180).toFixed(1)}° (1,6 s entre destellos)`);
ok(L.ritmoFaro({ grupo: 0, periodo_s: 5 }).neutro && L.ritmoFaro({ grupo: 2, periodo_s: 'x' }).neutro, 'datos raros → neutro');
const faroJ = path.join(RAIZ, 'data/faro.json');
if (fs.existsSync(faroJ)) {
  const fj = JSON.parse(fs.readFileSync(faroJ, 'utf8')), rr = L.ritmoFaro(fj);
  console.log(`       data/faro.json: ${JSON.stringify(fj)} → ${rr.neutro ? 'NEUTRO (no cuadra)' : rr.grupo + ' destello(s) cada ' + rr.periodo_s + ' s'}`);
} else console.log('       data/faro.json todavía no existe (lo escribe Web): el 3D usará el giro neutro');

/* ---------- 2. datos ---------- */
console.log('2. datos de img/lugar/');
const dir = path.join(RAIZ, 'img/lugar');
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'lugar.json'), 'utf8'));
const usados = new Set(['lugar.json', meta.orto.costa.archivo, ...meta.planB.vista.archivos, meta.planB.plano.archivo, meta.planB.faro.archivo]);
Object.values(meta.rasters).forEach((r) => usados.add(r.archivo));
['cerca', 'medio', 'finca', 'cabo', 'lejos'].forEach((k) => Object.values(meta.orto[k].archivos).forEach((a) => usados.add(a)));
usados.forEach((f) => ok(fs.existsSync(path.join(dir, f)), 'existe ' + f));
const sobran = fs.readdirSync(dir).filter((f) => !usados.has(f));
ok(sobran.length === 0, 'ningún fichero sin usar en img/lugar/' + (sobran.length ? ': ' + sobran.join(', ') : ''));
const tam = (f) => fs.statSync(path.join(dir, f)).size;
const peso = fs.readdirSync(dir).reduce((a, f) => a + tam(f), 0);
fs.readdirSync(dir).sort().forEach((f) => console.log(`       ${f.padEnd(26)} ${(tam(f) / 1024).toFixed(0).padStart(6)} KB`));
ok(peso < 5.0e6, `peso de img/lugar/: ${(peso / 1048576).toFixed(2)} MB`);
const three = fs.statSync(path.join(RAIZ, 'vendor/three-0.160.0.module.min.js')).size;
const comun = ['lugar.json', ...Object.values(meta.rasters).map((r) => r.archivo), meta.orto.costa.archivo, meta.orto.lejos.archivos.alta];
const pesoEsc = [...comun, ...['cerca', 'medio', 'finca', 'cabo'].map((k) => meta.orto[k].archivos.alta), 'vista-mar-1600.webp'].reduce((a, f) => a + tam(f), 0) + three;
const pesoMov = [...comun, ...['cerca', 'medio', 'finca', 'cabo'].map((k) => meta.orto[k].archivos.baja), 'vista-mar-960.webp'].reduce((a, f) => a + tam(f), 0) + three;
const pesoB = ['lugar.json', 'vista-mar-960.webp', meta.planB.plano.archivo, meta.planB.faro.archivo].reduce((a, f) => a + tam(f), 0);
console.log(`       lo que baja el 3D: escritorio ${(pesoEsc / 1048576).toFixed(2)} MB · móvil ${(pesoMov / 1048576).toFixed(2)} MB (Three.js ${(three / 1024).toFixed(0)} KB incluido, sin gzip) · plan B ${(pesoB / 1024).toFixed(0)} KB`);
ok(pesoEsc < 4.4e6 && pesoMov < 3.0e6, 'el 3D no se pasa de 4,2 MB en escritorio ni de 2,9 MB en móvil');

// alturas: decodificador PNG mínimo (RGB 8 bits, sin entrelazado) para leerlas aquí sin navegador
function leePNG(f) {
  const b = fs.readFileSync(f); let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), tipo = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (tipo === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12] !== 0) throw new Error('PNG no soportado'); }
    if (tipo === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const bpp = ct === 2 ? 3 : ct === 6 ? 4 : 0; if (!bpp) throw new Error('PNG de color ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = w * bpp, out = Buffer.alloc(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const f0 = raw[y * (st + 1)], fila = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
    for (let x = 0; x < st; x++) {
      const a = x >= bpp ? out[y * st + x - bpp] : 0, up = y ? out[(y - 1) * st + x] : 0, c = x >= bpp && y ? out[(y - 1) * st + x - bpp] : 0;
      let v = fila[x];
      if (f0 === 1) v += a; else if (f0 === 2) v += up; else if (f0 === 3) v += (a + up) >> 1;
      else if (f0 === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      out[y * st + x] = v & 255;
    }
  }
  const alt = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alt[i] = (out[i * bpp] * 256 + out[i * bpp + 1]) / 10 - 100;
  return { w, h, data: alt };
}
const R = {};
for (const [k, r] of Object.entries(meta.rasters)) {
  const d = leePNG(path.join(dir, r.archivo));
  ok(d.w === r.w && d.h === r.h, `alturas-${k}.png: ${d.w}×${d.h} como dice lugar.json`);
  R[k] = { ...r, ...d };
}
const muestra = (r, x, z) => { const fx = Math.min(Math.max((x - r.x0) / (r.x1 - r.x0) * (r.w - 1), 0), r.w - 1.0001), fz = Math.min(Math.max((z - r.z0) / (r.z1 - r.z0) * (r.h - 1), 0), r.h - 1.0001);
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * r.w + i, a = r.data; return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + r.w] * (1 - u) + a[k + r.w + 1] * u) * v; };
const dentro = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
const alt = (x, z) => ['finca', 'cabo', 'medio', 'cerca'].map((k) => R[k]).find((r) => dentro(r, x, z)) ? muestra(['finca', 'cabo', 'medio', 'cerca'].map((k) => R[k]).find((r) => dentro(r, x, z)), x, z) : muestra(R.lejos, x, z);
const ap = meta.edificios.find((e) => e.tipo === 'apartamentos');
ok(ap && ap.area > 500 && ap.area < 700, `bloque de apartamentos (Catastro ${meta.origen.catastro}): ${ap && ap.area} m² sin el porche`);
ok(meta.tejadoL.length === 2 && meta.porche.postes.length >= 8, `tejado en L de dos alas y ${meta.porche.postes.length} postes de porche`);
ok(Math.hypot(...meta.origen.pin_web_m) > 150, `el pin de su web queda a ${Math.hypot(...meta.origen.pin_web_m).toFixed(0)} m del edificio (se usa el Catastro)`);
const hCasa = alt(meta.tejadoL[0].cx, meta.tejadoL[0].cz);
ok(hCasa > 40 && hCasa < 140 && Math.abs(hCasa - ap.suelo) < 3, `altura en la finca: ${hCasa.toFixed(1)} m (suelo del Catastro ${ap.suelo} m)`);
const F = meta.faro, hF = alt(F.x, F.z);
ok(Math.hypot(F.x - F.nodo[0], F.z - F.nodo[1]) < 15, `torre del faro (arco del Catastro) a ${Math.hypot(F.x - F.nodo[0], F.z - F.nodo[1]).toFixed(1)} m del nodo OSM; radio ${F.r} m`);
ok(Math.hypot(F.x, F.z) > 1600 && Math.hypot(F.x, F.z) < 2100 && F.z < -1500, `faro al norte, a ${(Math.hypot(F.x, F.z) / 1000).toFixed(2)} km de la casa`);
ok(hF > 70 && hF < 100, `suelo en el faro: ${hF.toFixed(1)} m (plano focal oficial 101 m)`);
ok(alt(F.x, F.z - 700) < 0, 'mar a 700 m al norte del faro');
ok(meta.edificios.some((e) => e.tipo === 'faro'), `casa del torrero: ${meta.edificios.filter((e) => e.tipo === 'faro').length} partes del Catastro`);
const PB = meta.pabellon;
ok(PB && Math.hypot(PB.cx - meta.tejadoL[0].cx, PB.cz - meta.tejadoL[0].cz) < 40, `pabellón de la piscina junto al bloque (${PB.largo}×${PB.fondo} m, estimado)`);
for (const l of meta.lugares) {
  if (l.clave === 'mar') { ok(alt(l.x, l.z) < 0, 'rótulo del mar sobre el mar'); continue; }
  const r = dentro(R.cerca, l.x, l.z) ? 'cerca' : 'lejos';
  ok(alt(l.x, l.z) > (l.clave === 'vallina' ? -8 : -1), `${l.nombre} en tierra o en la orilla (${l.x.toFixed(0)}, ${l.z.toFixed(0)}) [${l.osm || l.nota}] (${r})`);
}
const cud = meta.lugares.find((x) => x.clave === 'cudillero'), ovi = meta.lugares.find((x) => x.clave === 'ovinana'), val = meta.lugares.find((x) => x.clave === 'vallina');
ok(cud.x > 6000 && ovi.x > 500 && val.x < 0, 'Cudillero y Oviñana al este, La Vallina al oeste (OSM)');
ok(Array.isArray(meta.arboles) && meta.arboles.length > 50, `árboles: ${meta.arboles.length}`);
// el recorrido: sin pasarse de largo, sin saltos y siempre por encima del suelo
const ruta = L.camino(meta.recorrido);
let pasaDeLargo = 0, salto = 0, prev = null, holgura = [1e9, 0];
for (let i = 0; i <= 4000; i++) {
  const p = i / 4000, r = ruta(p);
  for (let k = 0; k < 3; k++) {
    const vs = meta.recorrido.map((x) => x.pos[k]);
    if (r.pos[k] < Math.min(...vs) - 0.01 || r.pos[k] > Math.max(...vs) + 0.01) pasaDeLargo++;
  }
  if (prev) salto = Math.max(salto, Math.hypot(r.pos[0] - prev[0], r.pos[1] - prev[1], r.pos[2] - prev[2]));
  prev = r.pos;
  const sobre = r.pos[1] - Math.max(0, alt(r.pos[0], r.pos[2]));
  if (sobre < holgura[0]) holgura = [sobre, p];
}
ok(pasaDeLargo === 0, 'el recorrido no se sale del rango de sus puntos');
ok(salto < 12, `paso máximo entre 1/4000 de scroll: ${salto.toFixed(2)} m`);
ok(holgura[0] > 8, `la cámara pasa como poco a ${holgura[0].toFixed(1)} m del suelo (p=${holgura[1].toFixed(3)})`);
// la mirada final: la casa delante y el faro dentro del cuadro (con el fov de 40° en 16:9)
const fin = meta.recorrido.at(-1), dirM = [fin.mira[0] - fin.pos[0], fin.mira[2] - fin.pos[2]];
const angDe = (x, z) => { const a = Math.atan2(x - fin.pos[0], -(z - fin.pos[2])) - Math.atan2(dirM[0], -dirM[1]); return Math.atan2(Math.sin(a), Math.cos(a)) / Math.PI * 180; };
const aCasa = angDe(meta.tejadoL[0].cx, meta.tejadoL[0].cz), aFaro = angDe(F.x, F.z);
ok(Math.abs(aCasa) < 30 && Math.abs(aFaro) < 30, `final: casa a ${aCasa.toFixed(0)}° y faro a ${aFaro.toFixed(0)}° del centro (cabe ±33° en 16:9)`);
// sintaxis del CSS (llaves equilibradas) y de los scripts
const css = fs.readFileSync(path.join(RAIZ, 'css/lugar.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
ok((css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length, 'css/lugar.css: llaves equilibradas');

/* ---------- 3. plan B y escena con renderizador falso (navegador, sin WebGL) ---------- */
if (process.argv.includes('--sin-navegador')) { console.log(`\n${bien} bien, ${fallos} mal (sin navegador)`); process.exit(fallos ? 1 : 0); }
console.log('3. plan B en Chromium sin WebGL');
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(PUERTO, r));
const browser = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl', '--disable-gpu'] });
const ignora = (t) => /data\/faro\.json/.test(t) || /404 \(Not Found\)/.test(t);     // data/faro.json puede no existir todavía
try {
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const ctxB = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctxB.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !ignora(m.text())) errores.push(m.text()); });
    page.on('requestfailed', (r) => { if (!ignora(r.url())) errores.push('falla ' + r.url()); });
    await page.goto(`http://localhost:${PUERTO}/scripts/lugar-prueba.html`);
    await page.waitForFunction(() => document.querySelector('[data-modulo="lugar"]').dataset.montado === '1');
    await page.locator('#lugar').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelectorAll('.lugar__vista .lugar__marca').length > 0, null, { timeout: 8000 });
    await page.waitForFunction(() => [...document.querySelectorAll('.lugar__planob img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
    const r = await page.evaluate(() => {
      const el = document.querySelector('[data-modulo="lugar"]');
      const vis = (s) => { const n = el.querySelector(s); return !!n && n.getBoundingClientRect().height > 0 && getComputedStyle(n).display !== 'none'; };
      return {
        modo: el.dataset.modo, pistaVisible: getComputedStyle(el.querySelector('.lugar__pista')).display !== 'none',
        planob: vis('.lugar__planob'), vista: vis('.lugar__vista img'), finca: vis('.lugar__finca img'), faro: vis('.lugar__faro img'),
        marcasVista: [...el.querySelectorAll('.lugar__vista .lugar__marca')].filter((m) => !m.hidden).map((m) => m.textContent),
        marcasFinca: [...el.querySelectorAll('.lugar__finca .lugar__marca')].map((m) => m.textContent),
        destellos: el.querySelectorAll('.lugar__destello i').length,
        pasos: el.querySelectorAll('.lugar__pasos li').length, ahora: el.querySelector('[data-l="ahora2d"]').textContent,
        boton: !el.querySelector('[data-l="a3d"]').hidden, lienzo: !!el.querySelector('canvas'),
        anchoDoc: document.documentElement.scrollWidth, anchoVista: innerWidth,
      };
    });
    console.log(`   ${w}×${h}`);
    ok(r.modo === 'plano' && !r.pistaVisible && !r.lienzo, 'plan B, sin pista y sin lienzo (no se pinta WebGL)');
    ok(r.planob && r.vista && r.finca && r.faro, 'se ven la vista desde el mar, el faro y la finca');
    ok(r.marcasVista.length >= 3, 'marcas en la vista: ' + r.marcasVista.join(' · '));
    ok(r.marcasFinca.length === 2 && r.destellos >= 2, 'marcas en la finca: ' + r.marcasFinca.join(' · ') + ` · destellos del faro: ${r.destellos}`);
    ok(r.pasos === 4 && /Cudillero/.test(r.ahora), 'cuatro paradas y el cielo de ahora');
    ok(!r.boton, 'sin botón 3D cuando no hay WebGL');
    ok(r.anchoDoc <= r.anchoVista, `sin scroll horizontal (${r.anchoDoc} ≤ ${r.anchoVista})`);
    if (w === 1280) {
      const rep = await page.evaluate(() => { window.__lugar.destruir(); const el = document.querySelector('[data-modulo="lugar"]'); return { resp: !!el.querySelector('figure.respaldo'), clase: el.classList.contains('lugar') }; });
      ok(rep.resp && !rep.clase, 'destruir() repone el HTML de respaldo');
    }
    ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
    await ctxB.close();
  }

  console.log('4. escena 3D con renderizador falso (no pinta; los shaders NO se compilan aquí)');
  const ENVOLTORIO = `import * as T from '/vendor/three-0.160.0.module.min.js?real';
export * from '/vendor/three-0.160.0.module.min.js?real';
export class WebGLRenderer {
  constructor(o) { this.domElement = o.canvas; this.shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
    this.capabilities = { getMaxAnisotropy: () => 8 }; this.info = { render: { triangles: 0, calls: 0 } }; this._pr = 1; window.__pintadas = 0; }
  setPixelRatio(v) { this._pr = v; } getPixelRatio() { return this._pr; } setSize() {} compile() {}
  render(esc, cam) {
    window.__pintadas++; let tri = 0, calls = 0;
    esc.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite) && o.visible && o.geometry) { calls++; const g = o.geometry; const n = g.index ? g.index.count : g.attributes.position.count; tri += n / 3 * (o.isInstancedMesh ? o.count : 1);
      const pa = g.attributes.position && g.attributes.position.array; if (pa && !window.__nan) { for (let i = 0; i < pa.length; i += 97) if (!Number.isFinite(pa[i])) { window.__nan = (o.name || o.type) + ' ' + i; break; } } } });
    this.info.render.triangles = tri; this.info.render.calls = calls;
    if (![cam.position.x, cam.position.y, cam.position.z].every(Number.isFinite)) throw new Error('cámara con NaN');
    window.__cam = [cam.position.x, cam.position.y, cam.position.z, cam.near, cam.fov];
  }
  dispose() {} forceContextLoss() {}
}`;
  for (const hora of ['', '&hora=2026-11-25T23:00']) {
    const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const page = await ctx3.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if ((m.type() === 'error' && !ignora(m.text())) || (m.type() === 'warning' && /Lugar/.test(m.text()))) errores.push(m.text()); });
    await page.route((u) => u.pathname.endsWith('/vendor/three-0.160.0.module.min.js') && !u.search.includes('real'),
      (rt) => rt.fulfill({ status: 200, contentType: 'text/javascript', body: ENVOLTORIO }));
    await page.goto(`http://localhost:${PUERTO}/scripts/lugar-prueba.html?lugar=3d${hora}`);
    await page.waitForFunction(() => window.__lugar && window.__lugar.estado().t3 && window.__pintadas > 0, null, { timeout: 30000 });
    const e0 = await page.evaluate(() => ({ est: window.__lugar.estado(), modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, nan: window.__nan || null, listo: document.querySelector('.lugar__escenario').classList.contains('lugar--listo') }));
    console.log(`   ${hora ? 'de noche (' + hora.slice(6) + ')' : 'ahora'}`);
    ok(e0.modo === '3d' && e0.listo, 'modo 3D montado y primer fotograma «pintado»');
    ok(!e0.nan, 'ninguna geometría con NaN' + (e0.nan ? ': ' + e0.nan : ''));
    console.log('       triángulos', Math.round(e0.est.t3.triangulos), '· objetos', e0.est.t3.llamadas, '· ventanas', e0.est.t3.ventanas, '· árboles', e0.est.t3.arboles, '· haces', e0.est.t3.haces, '· faro', e0.est.t3.faroLuz.toFixed(2));
    ok(e0.est.t3.triangulos > 100000 && e0.est.t3.triangulos < 2500000, 'triángulos en un rango razonable');
    if (hora) {
      const g0 = e0.est.t3.giroFaro; await page.waitForTimeout(700);
      const g1 = await page.evaluate(() => window.__lugar.estado().t3.giroFaro);
      ok(e0.est.t3.faroLuz > 0.99 && g0 !== g1, `de noche el faro está encendido y gira (${g0.toFixed(2)} → ${g1.toFixed(2)} rad)`);
    } else if (e0.est.t3.faroLuz === 0) ok(true, 'de día el faro está apagado');
    const tramos = [[0, ['Mar Cantábrico', 'Cabo Vidio'], 'Desde el mar'], [0.4, ['Cabo Vidio'], 'El faro de Cabo Vidio'], [0.66, [], 'La rasa'], [0.995, ['Los apartamentos', 'La piscina'], 'La finca']];
    for (const [p, esperados, parada] of tramos) {
      await page.evaluate((p) => { const pista = document.querySelector('.lugar__pista'); const esc = document.querySelector('.lugar__escenario');
        const y0 = pista.getBoundingClientRect().top + scrollY; scrollTo(0, y0 + p * (pista.offsetHeight - esc.offsetHeight)); }, p);
      await page.waitForFunction((p) => { const t = window.__lugar.estado().t3; return t && Math.abs(t.pVis - p) < 0.004; }, p, { timeout: 15000 });
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => ({ rot: [...document.querySelectorAll('.lugar__rotulo.es-visible b')].map((b) => b.textContent), par: (document.querySelector('.lugar__paradas li.es-actual b') || {}).textContent, cam: window.__cam }));
      const faltan = esperados.filter((x) => !r.rot.includes(x));
      ok(faltan.length === 0 && r.par === parada, `p=${p}: parada «${r.par}», rótulos: ${r.rot.join(' · ') || '(ninguno)'} · cámara a ${r.cam[1].toFixed(0)} m, near ${r.cam[3].toFixed(2)}`);
    }
    if (!hora) {
      await page.waitForTimeout(1500);
      const fin2 = await page.evaluate(() => { const a = window.__pintadas; return new Promise((res) => setTimeout(() => res(window.__pintadas - a), 600)); });
      ok(fin2 < 8 || e0.est.t3.faroLuz > 0, `al final, quieto y de día, casi no repinta (${fin2} en 0,6 s)`);
      await page.evaluate(() => document.querySelector('[data-l="aplano"]').click());
      const pl = await page.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, boton: !document.querySelector('[data-l="a3d"]').hidden }));
      ok(pl.modo === 'plano' && pl.boton, '«Ver en plano» vuelve al plan B y ofrece volver al 3D');
    }
    const rep = await page.evaluate(() => { window.__lugar.destruir(); return !!document.querySelector('[data-modulo="lugar"] figure.respaldo'); });
    ok(rep, 'destruir() con el 3D montado repone el respaldo');
    ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
    await ctx3.close();
  }
} finally {
  await browser.close();
  srv.close();
}
console.log(`\n${bien} bien, ${fallos} mal`);
process.exit(fallos ? 1 : 0);
