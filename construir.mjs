/* Genera las páginas a partir de sus fuentes *.src.html (la arquitectura de Amaicha y Casa Benito):
   1. <!--parte:partes/archivo.html--> → el contenido de ese archivo (si falta, un comentario y la web sigue).
   2. Una sola fuente de datos, data/riberas.json (de ref/DATOS-LAS-RIBERAS.md):
        · <!--apartamentos--> el selector y las tres fichas; <!--vistazo--> la tabla de la sobria; <!--comunes--> lo de los tres;
        · <!--piscina-->, <!--estancias-->, <!--resenas--> y <!--condiciones-->.
   3. <!--alrededor-->, <!--alrededor-txt-->, <!--llegar--> y {{VIDIO_RECTA}}: de ref/raw/rutas.json (OSRM). Sin el fichero,
      ninguna cifra.
   4. La marca (marca/marca.json y marca/simbolo.svg, de scripts/marca-logo.py): <!--faro-portada--> (el faro grande de la
      portada) y <!--simbolo:clase--> (el símbolo en línea, con la linterna aparte para encenderla).
   5. <img data-foto="nombre" ...> → <picture> con AVIF, WebP y JPG (sin JPG si la foto lleva transparencia).
      <!--precarga-portada--> → <link rel="preload"> de la fachada recortada (el LCP).
   6. Los <link>/<script> propios que no existen se quitan con un aviso, SALVO los del 3D (css/lugar.css y js/lugar.js).
   7. Ejecuta versionar.mjs (?v=<huella> en CSS y JS).
   Se edita SIEMPRE el *.src.html (o la parte); el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const leerJson = (f) => JSON.parse(leer(f));
const FOTOS = new Map(leerJson('img/fotos/fotos.json').map((f) => [f.nombre, f]));
const D = leerJson('data/riberas.json');
const M = leerJson('marca/marca.json');
const num = (n) => String(n).replace('.', ',');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* ---------- fotos ---------- */
const sets = (nombre) => {
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const set = (ext) => f.anchos.map((w) => `img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  return { f, set };
};
function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const { f, set } = sets(nombre);
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  const base = f.anchos.includes(800) ? 800 : f.anchos[f.anchos.length - 1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '');
  if (!/\bloading=/.test(resto) && !/fetchpriority="high"/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  const real = f.ancho <= 800 ? ` data-real="${f.ancho}"` : '';
  // con transparencia no hay JPG: la de reserva es la WebP (la entienden todos los navegadores actuales)
  const ultimo = f.alfa ? 'webp' : 'jpg';
  return `<picture data-foto="${nombre}"${real}>`
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + (f.alfa ? '' : `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`)
    + `<img src="img/fotos/${nombre}-${base}.${ultimo}" srcset="${set(ultimo)}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}"${resto}>`
    + `</picture>`;
}
function precarga(html) {
  const m = /<img\b[^>]*data-foto="fachada-recorte"[^>]*>/.exec(html);
  if (!m) return html.replace('<!--precarga-portada-->', '');
  const sizes = /\bsizes="([^"]+)"/.exec(m[0])[1];
  const { set } = sets('fachada-recorte');
  return html.replace('<!--precarga-portada-->', `<link rel="preload" as="image" type="image/avif" imagesrcset="${set('avif')}" imagesizes="${sizes}" fetchpriority="high">`);
}
const razon = (n) => { const f = FOTOS.get(n); return f.ancho / f.alto; };
const ico = (n) => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;

/* ---------- la marca ---------- */
function simbolo(clase) {
  const s = leer('marca/simbolo.svg');
  const vb = /viewBox="([^"]+)"/.exec(s)[1];
  const ds = [...s.matchAll(/<path fill="([^"]+)"(?: fill-rule="evenodd")? d="([^"]+)"\/>/g)].map((m) => m[2]);
  if (ds.length !== 4) throw new Error('marca/simbolo.svg: se esperaban 4 trazados (olas, faro, loma, linterna)');
  const [olas, cuerpo, loma, luz] = ds;
  return `      <svg class="simbolo ${clase}" viewBox="${vb}" aria-hidden="true" focusable="false">`
    + `<path class="s-ola" fill-rule="evenodd" d="${olas}"/><path class="s-mar" d="${cuerpo}"/><path class="s-mar" fill-rule="evenodd" d="${loma}"/><path class="s-luz" d="${luz}"/></svg>`;
}
function faroPortada() {
  const F = M.faro_svg;
  const [x, y, w, h] = F.viewBox;
  return `    <svg class="portada__faro" viewBox="${x} ${y} ${+w.toFixed(2)} ${+h.toFixed(2)}" data-lx="${(F.linterna[0] / w).toFixed(4)}" data-ly="${(F.linterna[1] / h).toFixed(4)}" aria-hidden="true" focusable="false">`
    + `<defs><linearGradient id="faro-sombra" x1="0" y1="0" x2="1" y2="0"><stop class="faro__s1" offset="0"/><stop class="faro__s1" offset=".46"/><stop class="faro__s2" offset="1"/></linearGradient></defs>`
    + `<path class="faro__cuerpo" fill="url(#faro-sombra)" d="${F.cuerpo}"/><path class="faro__luz" d="${F.luz}"/></svg>`;
}

/* ---------- apartamentos ---------- */
function apartamentos() {
  const sel = `    <div class="aptos__sel" role="tablist" aria-label="Tipos de apartamento">\n` + D.apartamentos.map((a, i) => `      <button type="button" role="tab" id="tab-${a.id}" aria-controls="apto-${a.id}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ''}><span class="aptos__n cifra">${esc(a.cifras[0].v)}</span><span class="aptos__nom"><b>${esc(a.nombre)}</b><small>${esc(a.propio)}</small></span></button>`).join('\n') + '\n    </div>';
  const fichas = D.apartamentos.map((a) => `    <article class="apto" id="apto-${a.id}" role="tabpanel" aria-labelledby="t-apto-${a.id}" data-apto="${a.id}">
      <figure class="apto__f">
        <button type="button" class="foto-btn" data-visor="${a.foto}" data-lista="${a.fotos.join(',')}" aria-label="Ver las fotos del ${esc(a.motor)}"><img data-foto="${a.foto}" alt="${esc(a.fotoAlt)}" sizes="(max-width: 899px) min(92vw, 800px), min(50vw, 800px)"></button>
        <figcaption><button type="button" class="enlace" data-visor="${a.foto}" data-lista="${a.fotos.join(',')}">Ver sus ${a.fotos.length} fotos</button></figcaption>
      </figure>
      <div class="apto__cuerpo">
        <h3 class="apto__tit" id="t-apto-${a.id}"><span class="apto__pre">Apartamento</span> ${esc(a.nombre)}</h3>
        <p class="apto__propio"><span class="haz-corto" aria-hidden="true"></span>${esc(a.propio)}</p>
        <p class="apto__txt">${esc(a.texto)}</p>
        <dl class="apto__cifras">
${a.cifras.map((c) => `          <div><dt>${esc(c.t)}</dt><dd class="cifra">${esc(c.v)}</dd></div>`).join('\n')}
        </dl>
        <ul class="apto__rasgos">
${a.rasgos.map((r) => `          <li>${ico(r.icono)}<b>${esc(r.nombre)}</b>${r.detalle ? `<span>${esc(r.detalle)}</span>` : ''}</li>`).join('\n')}
        </ul>
        <p class="apto__acc"><a class="btn btn--oscuro" href="#reservar" data-reservar="${a.id}">Ver fechas de este<span class="vh">: ${esc(a.motor)}</span></a><span class="apto__motor">En su motor: «${esc(a.motor)}»</span></p>
      </div>
    </article>`).join('\n');
  return `    <div class="aptos">\n${sel}\n    <div class="aptos__fichas">\n${fichas}\n    </div>\n    </div>`;
}
function vistazo() {
  const A = D.apartamentos;
  const filas = [
    ['Personas', 'Hasta 4', 'Hasta 6', '2 adultos y 2 niños'],
    ['Dormitorios', '1, con cama king-size o dos individuales', '2 amplios, cama king o camas separadas', '1, con cama king-size'],
    ['Baños', '1 completo', '2, uno en suite', '1'],
    ['Sofá cama', 'Sí', 'Sí', 'Sí'],
    ['Lo propio', A[0].propio, A[1].propio, `${A[2].propio}; sidra y bombones de bienvenida`],
    ['Vistas', 'Al faro de Cabo Vidio', 'Al mar y al faro', 'Al mar y al atardecer'],
    ['Mascotas', '5 € por noche', '5 € por noche', '5 € por noche'],
  ];
  return `    <div class="vistazo" id="vistazo">
      <h3 class="vistazo__tit">De un vistazo</h3>
      <div class="vistazo__caja" role="group" aria-label="Tabla comparativa de los tres apartamentos">
        <table class="vistazo__tabla">
          <caption class="vh">Mirador, Familiar y Deluxe con jacuzzi comparados</caption>
          <thead><tr><th scope="col"><span class="vh">Dato</span></th>${A.map((a) => `<th scope="col">${esc(a.nombre)}</th>`).join('')}</tr></thead>
          <tbody>
${filas.map(([h, ...c]) => `            <tr><th scope="row">${h}</th>${c.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </div>`;
}
const comunes = () => `    <div class="comunes">
      <h3 class="comunes__tit">En los tres</h3>
      <ul class="comunes__lista">
${D.comunes.map((r) => `        <li>${ico(r.icono)}<b>${esc(r.nombre)}</b>${r.detalle ? `<span>${esc(r.detalle)}</span>` : ''}</li>`).join('\n')}
      </ul>
      <p class="comunes__nota">Mascotas: ${esc(D.mascotas.charAt(0).toLowerCase() + D.mascotas.slice(1))}</p>
    </div>`;

/* ---------- piscina ---------- */
function piscina() {
  const P = D.piscina;
  const [g, ...p] = P.fotos;
  const fig = (f, cl, sizes) => `        <figure class="${cl}"><button type="button" class="foto-btn" data-visor="${f.n}" data-grupo="piscina" aria-label="Ver más grande: ${esc(f.alt)}"><img data-foto="${f.n}" alt="${esc(f.alt)}" sizes="${sizes}"></button></figure>`;
  return `    <div class="piscina__in">
      <div class="piscina__txt">
        <h2 id="t-piscina" class="sec-tit" data-aparece>${esc(P.titulo)}</h2>
        <p class="sec-txt">${esc(P.texto)}</p>
        <dl class="piscina__datos">
          <div><dt>Agua</dt><dd>Climatizada</dd></div>
          <div><dt>Pabellón</dt><dd>Cubierto, de madera y cristal</dd></div>
          <div><dt>Fuera</dt><dd>Terraza con tumbonas</dd></div>
        </dl>
      </div>
      <div class="piscina__fotos">
${fig(g, 'piscina__g', '(max-width: 899px) min(92vw, 800px), min(56vw, 800px)')}
${p.map((f) => fig(f, 'piscina__p', '(max-width: 899px) 46vw, min(27vw, 400px)')).join('\n')}
      </div>
    </div>`;
}

/* ---------- estancias (filas de la misma altura: cada fila suma ≥ 2,4 de proporción, así ninguna foto de 800 px pasa de 800) ---------- */
function filas(fotos) {
  const out = []; let fila = [], suma = 0;
  for (const f of fotos) {
    fila.push(f); suma += razon(f.n);
    if (suma >= 2.6) { out.push(fila); fila = []; suma = 0; }
  }
  if (fila.length) {
    if (out.length && suma < 2.4) out[out.length - 1].push(...fila); else out.push(fila);
  }
  return out;
}
function estancias() {
  const ind = `    <nav class="estancias__indice" aria-label="Estancias">
      <ol>
${D.estancias.map((e, i) => `        <li><a href="#est-${e.id}" data-est="${e.id}"${i === 0 ? ' aria-current="true"' : ''}><span class="haz-corto" aria-hidden="true"></span><span class="estancias__largo">${esc(e.nombre)}</span><span class="estancias__corto" aria-hidden="true">${esc(e.corto)}</span><span class="estancias__n cifra" aria-hidden="true">${e.fotos.length}</span></a></li>`).join('\n')}
      </ol>
    </nav>`;
  const grupos = D.estancias.map((e) => `      <section class="estancia" id="est-${e.id}" aria-labelledby="t-est-${e.id}">
        <h3 class="estancia__tit" id="t-est-${e.id}">${esc(e.nombre)}</h3>
${filas(e.fotos).map((fila) => `        <div class="fila" style="--suma:${fila.reduce((s, f) => s + razon(f.n), 0).toFixed(3)}">
${fila.map((f) => `          <figure class="foto" style="--r:${razon(f.n).toFixed(3)}"><button type="button" class="foto-btn" data-visor="${f.n}" data-grupo="casa" aria-label="Ver más grande: ${esc(f.alt)}"><img data-foto="${f.n}" alt="${esc(f.alt)}" sizes="(max-width: 899px) min(92vw, 800px), min(34vw, 560px)"></button><figcaption>${esc(f.a)}</figcaption></figure>`).join('\n')}
        </div>`).join('\n')}
      </section>`).join('\n');
  return `    <div class="estancias">\n${ind}\n      <div class="estancias__grupos">\n${grupos}\n      </div>\n    </div>`;
}

/* ---------- reseñas y condiciones ---------- */
function resenas() {
  const R = D.resenas;
  if (!R) return '';
  return `<!-- ============ 7. Reseñas: la nota de Google (leída en ${esc(R.leida)}) y el enlace. Sin cifra exacta de reseñas: «${esc(R.recuentoTexto)}» ============ -->
<section id="resenas" class="sec resenas" aria-labelledby="t-resenas">
  <div class="env resenas__in">
    <p class="resenas__nota" aria-hidden="true"><span class="cifra">${esc(R.nota)}</span><span class="resenas__estrellas">${ico('estrella').repeat(5)}</span></p>
    <div class="resenas__txt">
      <h2 id="t-resenas" class="sec-tit" data-aparece>${esc(R.nota)} sobre ${esc(R.sobre)} en Google</h2>
      <p class="resenas__dato">Con ${esc(R.recuentoTexto)} de huéspedes en su ficha de Google.</p>
      <p><a class="btn btn--oscuro" href="${esc(R.enlace)}" target="_blank" rel="noopener">Leer las reseñas en Google<span class="vh"> (se abre en otra pestaña)</span></a></p>
    </div>
  </div>
</section>`;
}
const condiciones = () => `    <dl class="condiciones__lista">
${D.condiciones.map((c) => `      <div><dt>${esc(c.t)}</dt><dd>${esc(c.v)}</dd></div>`).join('\n')}
    </dl>`;

/* ---------- alrededor (ref/raw/rutas.json) ---------- */
function leerRutas() {
  const f = path.join(RAIZ, 'ref/raw/rutas.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}
const R = leerRutas();
const tiempo = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min');
const km = (v) => num(Math.round(v * 10) / 10) + ' km';
const GRUPOS = [['costa', 'La costa'], ['pueblos', 'Los pueblos'], ['llegar', 'Para llegar']];
function alrededorTxt() {
  if (!R) return '      <p class="sec-txt">La costa de Cabo Vidio, Oviñana, Cudillero y Luarca.</p>';
  const d = R.destinos;
  return `      <p class="sec-txt">El faro y Oviñana, andando. Cudillero queda a ${tiempo(d.cudillero.desde_casa.minutos)} en coche, Luarca a ${tiempo(d.luarca.desde_casa.minutos)} y el aeropuerto de Asturias a ${tiempo(d.ovd.desde_casa.minutos)}.</p>`;
}
function alrededor() {
  if (!R) { console.warn('  (sin ref/raw/rutas.json: «Alrededor» va sin distancias)'); return '    <p class="alrededor__fino" data-sin-rutas>Las distancias por carretera están por calcular.</p>'; }
  const fecha = new Date(R.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  // el dibujo: cada sitio en su sitio (equirrectangular centrada en la casa, km reales, norte arriba)
  const C = R.casa, kx = Math.cos(C.lat * Math.PI / 180) * 111.32, ky = 110.57;
  const P = (p) => ({ x: (p.lon - C.lon) * kx, y: (C.lat - p.lat) * ky });
  const pts = R.llegar.map((id) => ({ id, ...P(R.destinos[id]) }));
  const minX = Math.min(0, ...pts.map((p) => p.x)), maxX = Math.max(0, ...pts.map((p) => p.x));
  const minY = Math.min(0, ...pts.map((p) => p.y)), maxY = Math.max(0, ...pts.map((p) => p.y));
  const W = 1000, mx = 70, my = 70, s = (W - 2 * mx) / (maxX - minX);
  const H = Math.round((maxY - minY) * s + 2 * my + 30);
  const X = (x) => +(mx + (x - minX) * s).toFixed(1), Y = (y) => +(my + 20 + (y - minY) * s).toFixed(1);
  const casa = { x: X(0), y: Y(0) };
  const lado = (p) => (p.x > 0 ? 'der' : 'izq');
  const marcas = pts.map((p) => `<g class="al-sitio" data-ruta="${p.id}" transform="translate(${X(p.x)} ${Y(p.y)})"><circle r="6"/><text class="al-et al-et--${lado(p)}" x="${p.x > 0 ? 12 : -12}" y="${p.y < 0.5 ? -12 : 24}">${esc(R.destinos[p.id].nombre.replace('Faro y acantilados de ', ''))}</text></g>`).join('');
  const kmBarra = 5 * s;
  const dibujo = `      <figure class="al-mapa" aria-hidden="true">
        <svg class="al-svg" viewBox="0 0 ${W} ${H}" data-casa="${casa.x},${casa.y}" focusable="false">
          <text class="al-mar" x="${W / 2}" y="26">Mar Cantábrico</text>
          <g class="al-haz" transform="translate(${casa.x} ${casa.y})"><path d=""/></g>
          ${marcas}
          <g class="al-casa" transform="translate(${casa.x} ${casa.y})"><circle r="11"/><circle r="4.5"/><text x="0" y="34">Las Riberas</text></g>
          <g class="al-escala" transform="translate(${mx} ${H - 18})"><path d="M0 0H${kmBarra.toFixed(1)}M0 -5V5M${kmBarra.toFixed(1)} -5V5"/><text x="${(kmBarra / 2).toFixed(1)}" y="-9">5 km</text></g>
        </svg>
      </figure>`;
  const cols = GRUPOS.map(([g, tit]) => {
    const ids = R.llegar.filter((id) => R.destinos[id].grupo === g);
    return `        <section class="al-grupo" aria-labelledby="t-al-${g}">
          <h3 class="al-grupo__tit" id="t-al-${g}">${tit}</h3>
          <ol class="al-lista">
${ids.map((id) => { const d = R.destinos[id]; const c = d.desde_casa; const p = d.a_pie; return `            <li data-ruta="${id}"><button type="button" class="al-btn" aria-pressed="false"><span class="haz-corto" aria-hidden="true"></span><b class="al-nombre">${esc(d.nombre)}</b><span class="al-dato">${ico('coche')}<span class="vh">En coche: </span><span class="cifra">${tiempo(c.minutos)}</span><span class="cifra al-km">${km(c.km)}</span></span>${p ? `<span class="al-dato">${ico('pie')}<span class="vh">A pie: </span><span class="cifra">${tiempo(p.minutos)}</span><span class="cifra al-km">${km(p.km)}</span></span>` : ''}<span class="al-recta">${km(d.recta_km)} en línea recta</span></button></li>`; }).join('\n')}
          </ol>
        </section>`;
  }).join('\n');
  return `    <div class="alrededor__in" id="alrededor-in">
${dibujo}
      <div class="al-grupos">
${cols}
      </div>
    </div>
    <p class="alrededor__fino">En coche, por carretera; a pie, por caminos. Calculado con OSRM sobre datos de © colaboradores de OpenStreetMap el ${fecha}: tiempos sin tráfico ni paradas, orientativos. La playa de La Vallina queda muy cerca en línea recta, pero se baja a ella dando la vuelta.</p>`;
}
function llegar() {
  if (!R) return '';
  const d = R.destinos;
  return `      <p class="contacto__ruta">Desde Cudillero, <span class="cifra">${km(d.cudillero.desde_casa.km)}</span> y <span class="cifra">${tiempo(d.cudillero.desde_casa.minutos)}</span> en coche por la ${d.cudillero.desde_casa.carreteras.includes('A-8') ? 'A-8' : 'carretera'}; desde el aeropuerto de Asturias, <span class="cifra">${km(d.ovd.desde_casa.km)}</span> y <span class="cifra">${tiempo(d.ovd.desde_casa.minutos)}</span>. Oviñana, a <span class="cifra">${km(d.ovinana.desde_casa.km)}</span>.</p>`;
}
const vidioRecta = () => (R ? km(R.destinos.vidio.recta_km).replace(' km', ' kilómetros') : 'menos de dos kilómetros');

/* ---------- JSON-LD (sin nota de reseñas: la de Google se ha leído de segunda mano) ---------- */
function jsonld() {
  const C = D.contacto;
  const o = {
    '@context': 'https://schema.org', '@type': 'LodgingBusiness', name: 'Apartamentos Las Riberas',
    description: 'Apartamentos rurales con piscina climatizada junto al faro de Cabo Vidio.',
    address: { '@type': 'PostalAddress', streetAddress: 'Vivigo s/n', addressLocality: 'Oviñana, Cudillero', addressRegion: 'Asturias', addressCountry: 'ES' },
    geo: { '@type': 'GeoCoordinates', latitude: C.lat, longitude: C.lon },
    telephone: C.telefonos.map((t) => t.tel), email: C.correo, image: 'img/og.jpg',
    sameAs: [C.instagram, C.facebook], petsAllowed: true, checkinTime: '15:30', checkoutTime: '11:00',
    amenityFeature: ['Piscina climatizada cubierta', 'Calefacción por suelo radiante', 'Wifi', 'Aparcamiento'].map((n) => ({ '@type': 'LocationFeatureSpecification', name: n, value: true })),
  };
  return `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\u003c')}</script>`;
}

/* ---------- partes y ausentes ---------- */
const partes = (html, prof = 0) => html.replace(/<!--parte:([^\s>]+)\s*-->/g, (m, ruta) => {
  const f = path.join(RAIZ, ruta);
  if (!fs.existsSync(f)) { console.warn('  (falta ' + ruta + ')'); return `<!-- sin ${ruta} -->`; }
  if (prof > 3) throw new Error('Partes anidadas de más: ' + ruta);
  return partes(fs.readFileSync(f, 'utf8').trim(), prof + 1);
});
const DEL_3D = new Set(['css/lugar.css', 'js/lugar.js']);
const quitarAusentes = (html) => html
  .replace(/[ \t]*<link rel="stylesheet" href="(css\/[^"?]+)"[^>]*>\r?\n?/g, (m, r) => (DEL_3D.has(r) || fs.existsSync(path.join(RAIZ, r)) ? m : (console.warn('  (sin ' + r + ': se quita su <link>)'), '')))
  .replace(/[ \t]*<script (?:type="module" )?src="(js\/[^"?]+)"[^>]*><\/script>\r?\n?/g, (m, r) => (DEL_3D.has(r) || fs.existsSync(path.join(RAIZ, r)) ? m : (console.warn('  (sin ' + r + ': se quita su <script>)'), '')));

for (const r of DEL_3D) if (!fs.existsSync(path.join(RAIZ, r))) console.warn(`  (aún no está ${r}, del agente Lugar 3D: la etiqueta se queda y la página usa el respaldo)`);

const fuentes = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.src.html'));
for (const src of fuentes) {
  let html = quitarAusentes(partes(fs.readFileSync(path.join(RAIZ, src), 'utf8')));
  html = html
    .replace(/<!--simbolo:([a-z_-]+)-->/g, (m, c) => simbolo(c))
    .replace('<!--faro-portada-->', faroPortada)
    .replace('<!--apartamentos-->', apartamentos)
    .replace('<!--vistazo-->', vistazo)
    .replace('<!--comunes-->', comunes)
    .replace('<!--piscina-->', piscina)
    .replace('<!--estancias-->', estancias)
    .replace('<!--resenas-->', resenas)
    .replace('<!--condiciones-->', condiciones)
    .replace('<!--alrededor-txt-->', alrededorTxt)
    .replace('<!--alrededor-->', alrededor)
    .replace('<!--llegar-->', llegar)
    .replace('{{VIDIO_RECTA}}', vidioRecta)
    .replace('<!--jsonld-->', jsonld);
  if (html.includes('<div class="mapa" id="mapa">')) html = html.replace('<div class="mapa" id="mapa">', `<div class="mapa" id="mapa" data-q="${D.contacto.lat.toFixed(6)},${D.contacto.lon.toFixed(6)}">`);
  html = precarga(html);
  html = html.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));
  const destino = src.replace('.src.html', '.html');
  fs.writeFileSync(path.join(RAIZ, destino), html);
  console.log(`${src} → ${destino} (${(html.length / 1024).toFixed(0)} KB)`);
}
execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });
