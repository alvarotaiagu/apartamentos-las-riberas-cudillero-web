/* ------------------------------------------------------------------
   Apartamentos Las Riberas · lugar.js · «Del faro a la casa»
   window.LasRiberas.lugar.montar(el, { movimiento, densidad, webgl }) → { destruir() }

   Un recorrido en 3D que se mueve con el scroll: la cámara sale del
   Cantábrico frente a Cabo Vidio, se acerca al faro y lo rodea, cruza la
   rasa y baja a la finca, hasta quedar en el prado delante del bloque de
   apartamentos y del pabellón de la piscina, con el cabo al fondo.
   - Relieve MDT05/MDT25 y ortofoto PNOA del IGN (CC BY 4.0), edificios
     sobre su planta del Catastro, lugares de OpenStreetMap comprobados
     (scripts/lugar-datos.py).
   - El faro de Cabo Vidio modelado (casa del torrero sobre su planta
     catastral y torre redonda con su linterna). De noche su haz gira con
     el ritmo de data/faro.json (lo escribe Web); si no está, giro lento
     neutro.
   - El sol, la luna y la luz de este momento en Cudillero (cálculo local,
     fórmulas de SunCalc). De noche, luces en las ventanas y en la piscina.
   - Three.js 0.160.0, copia propia en vendor/, pedido con import() solo
     cuando hace falta.
   - Plan B en el mismo hueco (sin WebGL, movimiento reducido, «sobria»,
     ahorro de datos, móvil antes de pulsar el botón, Playwright): la vista
     desde el mar dibujada con los mismos datos, la finca y el faro desde
     el aire.
   El HTML que trae `el` es el respaldo: se guarda y se repone al destruir.
   Parámetros: ?fps (fotogramas), ?sin-webgl (plan B), ?lugar=3d (fuerza
   el 3D aunque el navegador sea automatizado), ?hora=AAAA-MM-DDTHH:MM
   (simula otra hora para mirar la noche o el atardecer).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var A = (window.LasRiberas = window.LasRiberas || {});
  if (A.lugar && A.lugar.montar) return;

  var SCRIPT = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var RAIZ = SCRIPT ? new URL('../', SCRIPT).href : (typeof location !== 'undefined' ? new URL('./', location.href).href : './');
  var BASE = RAIZ + 'img/lugar/';
  var THREE_URL = RAIZ + 'vendor/three-0.160.0.module.min.js';
  var FARO_URL = RAIZ + 'data/faro.json';
  var LAT = 43.5773, LON = -6.2491, TZ = 'Europe/Madrid', RAD = Math.PI / 180;
  var FARO_NEUTRO = { grupo: 1, periodo_s: 12, neutro: true };   // si no hay data/faro.json: giro lento, sin ritmo inventado

  /* ============ utilidades ============ */
  var lim = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var suave = function (a, b, x) { var t = lim((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var hexA = function (c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); };
  var mezcla = function (a, b, t) { var x = hexA(a), y = hexA(b); return '#' + x.map(function (v, i) { return pad(Math.round(lim(lerp(v, y[i], t), 0, 255)).toString(16)); }).join(''); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var RUMBOS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  var rumbo = function (az) { return RUMBOS[Math.round((((az % 360) + 360) % 360) / 45) % 8]; };

  /* ============ el sol y la luna (fórmulas de SunCalc, V. Agafonkin) ============ */
  var J1970 = 2440588, J2000 = 2451545, OBL = RAD * 23.4397;
  var dias = function (f) { return f.valueOf() / 864e5 - 0.5 + J1970 - J2000; };
  var ascRec = function (l, b) { return Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l)); };
  var declin = function (l, b) { return Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l)); };
  var sideral = function (d) { return RAD * (280.16 + 360.9856235 * d) - RAD * -LON; };
  function altAz(H, dec) {
    var phi = RAD * LAT;
    return {
      alt: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD,
      az: (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180 + 360) % 360, // desde el norte, hacia el este
    };
  }
  function solCoords(d) {
    var M = RAD * (357.5291 + 0.98560028 * d);
    var L = M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
    return { dec: declin(L, 0), ra: ascRec(L, 0) };
  }
  function lunaCoords(d) {
    var L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
    var l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F);
    return { ra: ascRec(l, b), dec: declin(l, b), dist: 385001 - 20905 * Math.cos(M) };
  }
  function sol(f) { var d = dias(f), c = solCoords(d); return altAz(sideral(d) - c.ra, c.dec); }
  function luna(f) {
    var d = dias(f), m = lunaCoords(d), s = solCoords(d), p = altAz(sideral(d) - m.ra, m.dec);
    var phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    var inc = Math.atan2(149598000 * Math.sin(phi), m.dist - 149598000 * Math.cos(phi));
    var ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { alt: p.alt, az: p.az, luz: (1 + Math.cos(inc)) / 2, fase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / Math.PI };
  }
  function nombreFase(f) {
    if (f < 0.03 || f >= 0.97) return 'nueva';
    if (f < 0.22) return 'creciente';
    if (f < 0.28) return 'en cuarto creciente';
    if (f < 0.47) return 'gibosa creciente';
    if (f < 0.53) return 'llena';
    if (f < 0.72) return 'gibosa menguante';
    if (f < 0.78) return 'en cuarto menguante';
    return 'menguante';
  }
  // el faro se enciende al ponerse el sol y se apaga al salir (0 de día, 1 de noche)
  function faroEncendido(altSol) { return lim((0.5 - altSol) / 3, 0, 1); }
  var fmtHora = null;
  function horaLocal(f) {
    try {
      fmtHora = fmtHora || new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      return fmtHora.format(f);
    } catch (e) { return pad(f.getHours()) + ':' + pad(f.getMinutes()); }
  }
  // la frase del cielo de ahora (se dice igual en el 3D y en el plano)
  function fraseCielo(f) {
    var s = sol(f), l = luna(f), h = horaLocal(f);
    if (s.alt > 0) return 'Ahora en Cudillero son las ' + h + ' y el sol está a ' + Math.round(s.alt) + '° sobre el horizonte, al ' + rumbo(s.az) + '. El faro descansa.';
    if (s.alt > -6) return 'Ahora en Cudillero son las ' + h + ': ' + (s.az < 180 ? 'está amaneciendo' : 'está anocheciendo') + ' y el faro de Cabo Vidio ya gira.';
    var txt = 'Ahora en Cudillero son las ' + h + ' y es de noche: el faro de Cabo Vidio barre el mar';
    if (l.alt > 0 && l.luz > 0.03) txt += '; la luna, ' + nombreFase(l.fase) + ', está a ' + Math.round(l.alt) + '° al ' + rumbo(l.az);
    return txt + '.';
  }
  // el ritmo del faro: n destellos seguidos cada `periodo_s` segundos (giro de la óptica)
  function ritmoFaro(j) {
    var g = j && Math.round(+j.grupo), p = j && +j.periodo_s;
    if (!(g >= 1 && g <= 9 && p >= 1 && p <= 60)) return FARO_NEUTRO;
    return { grupo: g, periodo_s: p, fuente: j.fuente || null, neutro: false };
  }
  // separación angular entre los haces de un grupo (≈ 1,6 s entre destellos, sin pasar de la mitad del giro)
  function separacionHaces(r) { return r.grupo > 1 ? 2 * Math.PI * Math.min(1.6, r.periodo_s / (2 * r.grupo)) / r.periodo_s : 0; }

  /* ============ el color del cielo según la altura del sol ============ */
  var CIELO = [
    [-18, '#04070f', '#0c1222'],
    [-10, '#081028', '#1e2644'],
    [-4, '#1a2752', '#7a5562'],
    [0, '#34508c', '#e08a64'],
    [6, '#5279b8', '#efbf96'],
    [18, '#6893cc', '#d9e2e9'],
    [45, '#4c82c4', '#cddcea'],
  ];
  function cieloPara(alt) {
    if (alt <= CIELO[0][0]) return { cz: CIELO[0][1], ch: CIELO[0][2] };
    for (var i = 1; i < CIELO.length; i++) {
      if (alt <= CIELO[i][0]) {
        var a = CIELO[i - 1], b = CIELO[i], t = (alt - a[0]) / (b[0] - a[0]);
        return { cz: mezcla(a[1], b[1], t), ch: mezcla(a[2], b[2], t) };
      }
    }
    var u = CIELO[CIELO.length - 1];
    return { cz: u[1], ch: u[2] };
  }

  /* ============ el recorrido: interpolación monótona por componente ============ */
  // Hermite con tangentes de Fritsch-Butland: no se pasa de largo aunque los tramos
  // sean de kilómetros al principio y de metros al final. Empieza y acaba en reposo.
  function monotona(ps, vs) {
    var n = ps.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d[i] = (vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]);
    m[0] = 0; m[n - 1] = 0;
    for (i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
      var h0 = ps[i] - ps[i - 1], h1 = ps[i + 1] - ps[i];
      m[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
    }
    return function (p) {
      if (p <= ps[0]) return vs[0];
      if (p >= ps[n - 1]) return vs[n - 1];
      var k = 0; while (k < n - 2 && p > ps[k + 1]) k++;
      var h = ps[k + 1] - ps[k], t = (p - ps[k]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * vs[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * vs[k + 1] + (t3 - t2) * h * m[k + 1];
    };
  }
  function camino(rec) {
    var ps = rec.map(function (r) { return r.p; });
    var f = [0, 1, 2].map(function (k) { return monotona(ps, rec.map(function (r) { return r.pos[k]; })); });
    var g = [0, 1, 2].map(function (k) { return monotona(ps, rec.map(function (r) { return r.mira[k]; })); });
    return function (p) { return { pos: [f[0](p), f[1](p), f[2](p)], mira: [g[0](p), g[1](p), g[2](p)] }; };
  }

  /* ============ alturas: PNG RGB → metros ============ */
  function cargarAlturas(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('alturas ' + r.status); return r.blob(); })
      .then(function (b) {
        var op = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
        return (window.createImageBitmap ? createImageBitmap(b, op).catch(function () { return createImageBitmap(b); }) : Promise.reject(new Error('sin createImageBitmap')));
      })
      .then(function (bmp) {
        var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
        var d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, out = new Float32Array(n);
        for (var i = 0; i < n; i++) out[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 10 - 100;
        if (bmp.close) bmp.close();
        return { w: c.width, h: c.height, data: out };
      });
  }
  function muestreador(r) {
    var sx = (r.w - 1) / (r.x1 - r.x0), sz = (r.h - 1) / (r.z1 - r.z0), w = r.w, h = r.h, a = r.data;
    return function (x, z) {
      var fx = lim((x - r.x0) * sx, 0, w - 1.0001), fz = lim((z - r.z0) * sz, 0, h - 1.0001);
      var i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * w + i;
      return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + w] * (1 - u) + a[k + w + 1] * u) * v;
    };
  }
  function pesoCaja(r, x, z, b) {
    var d = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z);
    return lim(d / b, 0, 1);
  }
  // rectángulo mínimo (por giro de 1°) de una nube de puntos [x, z]
  function rectOrientado(pts) {
    var mejor = null;
    for (var gd = 0; gd < 90; gd += 1) {
      var g = gd * RAD, c = Math.cos(g), s = Math.sin(g), u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      pts.forEach(function (p) { var u = p[0] * c + p[1] * s, v = -p[0] * s + p[1] * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); });
      var a = (u1 - u0) * (v1 - v0);
      if (!mejor || a < mejor.a) mejor = { a: a, g: g, uc: (u0 + u1) / 2, vc: (v0 + v1) / 2, lu: u1 - u0, lv: v1 - v0 };
    }
    var c2 = Math.cos(mejor.g), s2 = Math.sin(mejor.g), r = { cx: mejor.uc * c2 - mejor.vc * s2, cz: mejor.uc * s2 + mejor.vc * c2, largo: mejor.lu, fondo: mejor.lv, ang: mejor.g };
    if (r.fondo > r.largo) { var t = r.largo; r.largo = r.fondo; r.fondo = t; r.ang += Math.PI / 2; }
    return r;
  }

  /* ============ texturas dibujadas (ligeras) ============ */
  function azar(semilla) { var s = semilla >>> 0 || 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function lienzo(lado, pintar) { var c = document.createElement('canvas'); c.width = c.height = lado; pintar(c.getContext('2d'), lado); return c; }
  function texRevoco(base, semilla) {
    return lienzo(256, function (g, L) {
      var r = azar(semilla); g.fillStyle = base; g.fillRect(0, 0, L, L);
      var im = g.getImageData(0, 0, L, L), d = im.data;
      for (var i = 0; i < d.length; i += 4) { var n = (r() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      g.putImageData(im, 0, 0);
      for (var k = 0; k < 30; k++) { g.fillStyle = 'rgba(0,0,0,' + (r() * 0.035).toFixed(3) + ')'; g.fillRect(r() * L, r() * L, 10 + r() * 40, 2 + r() * 30); }
    });
  }
  function texTeja(base, semilla) {          // teja curva: hileras de canales con sombra
    return lienzo(256, function (g, L) {
      var r = azar(semilla), filas = 8, cols = 10, fh = L / filas, cw = L / cols;
      g.fillStyle = mezcla(base, '#000000', 0.35); g.fillRect(0, 0, L, L);
      for (var j = 0; j < filas; j++) {
        for (var i = 0; i < cols; i++) {
          var x = i * cw, y = j * fh, c = mezcla(mezcla(base, r() < 0.5 ? '#5e2a1e' : '#b8624a', r() * 0.4), '#3a3a30', r() * 0.12);
          var gr = g.createLinearGradient(x, 0, x + cw, 0);
          gr.addColorStop(0, mezcla(c, '#000000', 0.42)); gr.addColorStop(0.45, mezcla(c, '#ffffff', 0.1)); gr.addColorStop(1, mezcla(c, '#000000', 0.48));
          g.fillStyle = gr; g.fillRect(x + 1, y, cw - 2, fh + 3);
          g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(x + 1, y + fh - 3, cw - 2, 3);
        }
      }
    });
  }
  function texTablas(base, semilla, horizontal) {   // tablas de madera barnizada (hastial del pabellón)
    return lienzo(256, function (g, L) {
      var r = azar(semilla), p = 0;
      while (p < L) {
        var w = 14 + r() * 8, c = mezcla(base, r() < 0.5 ? '#5a3418' : '#c27c42', r() * 0.35);
        g.fillStyle = c; if (horizontal) g.fillRect(0, p, L, w); else g.fillRect(p, 0, w, L);
        g.fillStyle = 'rgba(0,0,0,.35)'; if (horizontal) g.fillRect(0, p + w - 1.5, L, 1.5); else g.fillRect(p + w - 1.5, 0, 1.5, L);
        p += w;
      }
    });
  }

  /* ============ módulo ============ */
  function montar(el, opciones) {
    opciones = opciones || {};
    var q = new URLSearchParams(location.search);
    var reduce = opciones.movimiento === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sobria = opciones.densidad === 'sobria';
    var movil = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;
    var ahorro = !!(navigator.connection && navigator.connection.saveData);
    var forzar3d = q.get('lugar') === '3d';
    var automatizado = !!navigator.webdriver && !forzar3d;                           // Playwright: nunca pinta el 3D
    var sinWebgl = opciones.webgl === false || q.has('sin-webgl') || automatizado;
    if (!sinWebgl && !sobria && !reduce && !forzar3d) {
      try { var cv0 = document.createElement('canvas'); sinWebgl = !(cv0.getContext('webgl2') || cv0.getContext('webgl')); } catch (e) { sinWebgl = true; }
    }
    var puede3d = !sinWebgl && !sobria && !reduce;
    var auto3d = puede3d && !movil && !ahorro;
    // ?hora=2026-11-25T20:30 para mirar otra hora (se mantiene el reloj corriendo desde ahí)
    var desfase = 0;
    if (q.get('hora')) { var hq = new Date(q.get('hora')); if (!isNaN(hq)) desfase = hq - new Date(); }
    var ahora = function () { return new Date(Date.now() + desfase); };
    var respaldo = el.innerHTML;
    var estado = { modo: 'plano', destruido: false, error3d: null, cargado: false, p: 0, pVis: 0, calidad: 0 };
    var escuchas = [];
    var escucha = function (o, ev, fn, op) { o.addEventListener(ev, fn, op); escuchas.push(function () { o.removeEventListener(ev, fn, op); }); };
    var t3 = null, meta = null, cargando = null, intervalo = 0, ritmo = FARO_NEUTRO;

    /* ---------- DOM ---------- */
    el.classList.add('lugar');
    el.innerHTML =
      '<div class="lugar__pista">' +
        '<div class="lugar__escenario" role="img" aria-label="Recorrido en 3D desde el mar Cantábrico hasta Apartamentos Las Riberas, pasando por el faro de Cabo Vidio, con el relieve real y la luz de este momento">' +
          '<img class="lugar__poster" alt="" decoding="async" src="' + BASE + 'vista-mar-1600.webp" srcset="' + BASE + 'vista-mar-960.webp 960w, ' + BASE + 'vista-mar-1600.webp 1600w" sizes="100vw">' +
          '<div class="lugar__rotulos" aria-hidden="true"></div>' +
          '<ol class="lugar__paradas"></ol>' +
          '<div class="lugar__pie3d"><p class="lugar__ahora" data-l="ahora3d"></p>' +
          '<button type="button" class="lugar__btn lugar__btn--suave" data-l="aplano">Ver en plano</button></div>' +
          '<p class="lugar__aviso" data-l="aviso" role="status" hidden></p>' +
        '</div>' +
      '</div>' +
      '<div class="lugar__planob">' +
        '<figure class="lugar__vista">' +
          '<div class="lugar__marco"><img alt="El relieve real visto desde el mar: Cabo Vidio con su faro, la rasa costera y la sierra detrás" decoding="async" loading="lazy" src="' + BASE + 'vista-mar-960.webp" srcset="' + BASE + 'vista-mar-960.webp 960w, ' + BASE + 'vista-mar-1600.webp 1600w" sizes="(max-width: 820px) 100vw, 66vw">' +
          '<i class="lugar__noche" aria-hidden="true"></i><ul class="lugar__marcas" aria-hidden="true"></ul></div>' +
          '<figcaption>Desde el mar: Cabo Vidio y su faro, la rasa y, detrás, la sierra. Dibujado con el relieve y la ortofoto del IGN.</figcaption>' +
        '</figure>' +
        '<figure class="lugar__faro">' +
          '<div class="lugar__marco lugar__marco--cuadro"><img alt="El faro de Cabo Vidio desde el aire: la casa del torrero y la torre redonda, al borde del acantilado" decoding="async" loading="lazy" src="' + BASE + 'plano-faro-600.webp" width="600" height="600">' +
          '<i class="lugar__noche" aria-hidden="true"></i><ul class="lugar__marcas lugar__marcas--cuadro" data-l="marcasFaro" aria-hidden="true"></ul></div>' +
          '<figcaption>El faro, desde el aire (ortofoto PNOA).</figcaption>' +
        '</figure>' +
        '<figure class="lugar__finca">' +
          '<div class="lugar__marco lugar__marco--cuadro"><img alt="La finca desde el aire: el bloque de apartamentos en L con su porche, rodeado de prado" decoding="async" loading="lazy" src="' + BASE + 'plano-finca-900.webp" width="900" height="900">' +
          '<i class="lugar__noche" aria-hidden="true"></i><ul class="lugar__marcas lugar__marcas--cuadro" data-l="marcasFinca" aria-hidden="true"></ul></div>' +
          '<figcaption>La finca, desde el aire (ortofoto PNOA; la piscina cubierta es posterior a la foto).</figcaption>' +
        '</figure>' +
        '<ol class="lugar__pasos"></ol>' +
        '<p class="lugar__ahora" data-l="ahora2d"></p>' +
        '<p class="lugar__acciones"><button type="button" class="lugar__btn" data-l="a3d" hidden>Ver el recorrido en 3D</button></p>' +
      '</div>' +
      '<p class="lugar__fuente" data-l="fuente">Relieve MDT05 y MDT25 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0) · Planta de los edificios © Dirección General del Catastro · Lugares © colaboradores de OpenStreetMap. El relieve lejano está exagerado ×1,3 para que se lea la sierra. El sol y la luna se calculan en tu navegador para Cudillero.</p>';
    var $ = function (k) { return el.querySelector('[data-l="' + k + '"]'); };
    var pista = el.querySelector('.lugar__pista'), escenario = el.querySelector('.lugar__escenario');
    var capaRot = el.querySelector('.lugar__rotulos');
    var aviso = $('aviso');
    var avisar = function (t) { aviso.textContent = t || ''; aviso.hidden = !t; };

    /* ---------- paradas (las mismas en el 3D y en el plano) ---------- */
    var PARADAS = [
      { desde: 0, t: 'Desde el mar', d: 'El Cantábrico delante; Cabo Vidio entra en el mar y, detrás, la sierra.' },
      { desde: 0.24, t: 'El faro de Cabo Vidio', d: 'La torre redonda junto a la casa del torrero, al borde del acantilado. De noche, su haz barre el mar.' },
      { desde: 0.56, t: 'La rasa', d: 'Prados llanos entre el acantilado y la sierra: Oviñana a un lado, la playa de La Vallina al otro.' },
      { desde: 0.8, t: 'La finca', d: 'El bloque de apartamentos en L con su porche de madera y el pabellón de la piscina, mirando al prado.' },
    ];
    var htmlParadas = PARADAS.map(function (p, i) { return '<li data-i="' + i + '"><b>' + esc(p.t) + '</b><span>' + esc(p.d) + '</span></li>'; }).join('');
    el.querySelector('.lugar__paradas').innerHTML = htmlParadas;
    el.querySelector('.lugar__pasos').innerHTML = htmlParadas;
    var lisParadas = el.querySelectorAll('.lugar__paradas li');
    var paradaActual = -1;
    function marcarParada(p) {
      var i = 0; for (var k = 0; k < PARADAS.length; k++) if (p >= PARADAS[k].desde - 0.001) i = k;
      if (i === paradaActual) return;
      paradaActual = i;
      lisParadas.forEach(function (li, k) { li.classList.toggle('es-actual', k === i); li.classList.toggle('es-pasada', k < i); });
    }

    /* ---------- el cielo de ahora, en texto (y la noche y el faro en el plano) ---------- */
    function cieloTexto() {
      var f = ahora(), txt = fraseCielo(f), s = sol(f);
      $('ahora2d').textContent = txt; $('ahora3d').textContent = txt;
      el.style.setProperty('--lugar-noche', String(lim((-s.alt - 1) / 10, 0, 1).toFixed(2)));
      el.style.setProperty('--lugar-faro', String(faroEncendido(s.alt).toFixed(2)));
      if (t3) t3.luces(f);
    }
    function aplicarRitmo() {
      el.style.setProperty('--lugar-faro-periodo', ritmo.periodo_s + 's');
      el.dataset.faroRitmo = ritmo.neutro ? 'neutro' : 'real';
      el.querySelectorAll('.lugar__destello').forEach(function (d) {
        var html = '';
        for (var i = 0; i < ritmo.grupo; i++) html += '<i style="animation-delay:' + (i * separacionHaces(ritmo) / (2 * Math.PI) * ritmo.periodo_s).toFixed(2) + 's"></i>';
        d.innerHTML = html;
      });
    }

    /* ---------- plan B: marcas sobre las imágenes ---------- */
    function montarPlano(m) {
      var nombres = {}; m.lugares.forEach(function (l) { nombres[l.clave] = l; });
      var ulV = el.querySelector('.lugar__vista .lugar__marcas');
      ulV.innerHTML = m.planB.vista.marcas.map(function (k) {
        var l = nombres[k.clave]; if (!l) return '';
        return '<li class="lugar__marca' + (k.clave === 'casa' ? ' lugar__marca--casa' : '') + (k.clave === 'faro' ? ' lugar__marca--faro' : '') + '" data-x="' + k.x + '" data-y="' + k.y + '">' +
          (k.clave === 'faro' ? '<b class="lugar__destello"></b>' : '') + '<span>' + esc(l.nombre) + '</span></li>';
      }).join('');
      var cuadro = function (ul, pl, claves) {
        var x0 = pl.cx - pl.lado / 2, z0 = pl.cz - pl.lado / 2;
        ul.innerHTML = claves.map(function (c) {
          var l = nombres[c]; if (!l) return '';
          return '<li class="lugar__marca lugar__marca--cuadro' + (c === 'faro' ? ' lugar__marca--faro' : '') + '" style="left:' + ((l.x - x0) / pl.lado * 100).toFixed(2) + '%;top:' + ((l.z - z0) / pl.lado * 100).toFixed(2) + '%">' +
            (c === 'faro' ? '<b class="lugar__destello"></b>' : '') + '<span>' + esc(c === 'faro' ? 'El faro' : l.nombre) + '</span></li>';
        }).join('');
      };
      cuadro($('marcasFinca'), m.planB.plano, ['apartamentos', 'piscina']);
      cuadro($('marcasFaro'), m.planB.faro, ['faro']);
      aplicarRitmo();
      colocarMarcas();
    }
    // la vista del mar se recorta con object-fit: cover; las marcas siguen al recorte y se ocultan si quedan fuera
    function colocarMarcas() {
      var marco = el.querySelector('.lugar__vista .lugar__marco'); if (!marco || !meta) return;
      var W = marco.clientWidth, H = marco.clientHeight; if (!W || !H) return;
      var iw = meta.planB.vista.ancho, ih = meta.planB.vista.alto, k = Math.max(W / iw, H / ih);
      var ox = (W - iw * k) / 2, oy = (H - ih * k) * 0.55;
      el.querySelectorAll('.lugar__vista .lugar__marca').forEach(function (li) {
        var x = ox + (+li.dataset.x) / 100 * iw * k, y = oy + (+li.dataset.y) / 100 * ih * k;
        li.hidden = x < 12 || x > W - 12 || y < 8 || y > H - 8;
        li.style.left = x.toFixed(1) + 'px'; li.style.top = y.toFixed(1) + 'px';
        li.classList.toggle('a-la-izq', x > W * 0.7);
      });
      var vis = [].filter.call(el.querySelectorAll('.lugar__vista .lugar__marca'), function (li) { return !li.hidden; })
        .sort(function (a, b) { return parseFloat(a.style.left) - parseFloat(b.style.left); });
      for (var i = 0; i < vis.length; i++) for (var j = i + 1; j < vis.length; j++) {
        var a = vis[i].querySelector('span').getBoundingClientRect(), b = vis[j].querySelector('span').getBoundingClientRect();
        if (a.right > b.left - 6 && a.left < b.right + 6 && a.bottom > b.top - 2 && a.top < b.bottom + 2) vis[i].classList.add('a-la-izq');
      }
    }

    function ponModo(m) {
      estado.modo = m;
      el.dataset.modo = m;
      $('a3d').hidden = !(puede3d && m === 'plano' && !estado.error3d);
      if (t3) t3.activo(m === '3d');
    }

    /* ---------- datos ---------- */
    var pMeta = fetch(BASE + 'lugar.json').then(function (r) { if (!r.ok) throw new Error('lugar.json ' + r.status); return r.json(); })
      .then(function (m) { meta = m; if (!estado.destruido) montarPlano(m); return m; });
    pMeta.catch(function (e) { console.warn('Lugar: sin datos', e); });
    // el ritmo del faro lo escribe Web en data/faro.json; si falta o no cuadra, giro lento neutro
    fetch(FARO_URL).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (j) { ritmo = ritmoFaro(j); if (!estado.destruido) { aplicarRitmo(); if (t3) t3.ritmo(ritmo); } });

    /* ---------- el 3D ---------- */
    function cargar3d() {
      if (t3) return Promise.resolve(t3);
      if (cargando) return cargando;
      avisar('Cargando el relieve…');
      var hiDef = !movil && !ahorro;
      cargando = pMeta.then(function (m) {
        var claves = ['cerca', 'medio', 'finca', 'cabo', 'lejos'];
        return Promise.all([import(THREE_URL)].concat(claves.map(function (k) { return cargarAlturas(BASE + m.rasters[k].archivo); })))
          .then(function (r) {
            if (estado.destruido) return null;
            var R = {};
            claves.forEach(function (k, i) { var b = r[i + 1], o = m.rasters[k]; R[k] = Object.assign({}, o, { w: b.w, h: b.h, data: b.data }); });
            return crear3d(r[0], m, R, hiDef);
          });
      }).then(function (t) { avisar(''); return t; }, function (e) {
        estado.error3d = String((e && e.message) || e);
        console.warn('Lugar: el 3D no está disponible:', e);
        avisar(''); cargando = null; ponModo('plano');
        return null;
      });
      return cargando;
    }

    function crear3d(THREE, m, R, hiDef) {
      var cv = document.createElement('canvas');
      cv.className = 'lugar__lienzo'; cv.setAttribute('aria-hidden', 'true');
      escenario.insertBefore(cv, capaRot);
      var ren = new THREE.WebGLRenderer({ canvas: cv, antialias: hiDef, powerPreference: 'high-performance', alpha: false, stencil: false });
      var topeDPR = function () { return estado.calidad >= 1 ? 1 : (movil ? 1.25 : 1.5); };
      ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
      ren.outputColorSpace = THREE.SRGBColorSpace;
      ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap; ren.shadowMap.autoUpdate = false;
      var anis = Math.min(8, ren.capabilities.getMaxAnisotropy());
      var esc3 = new THREE.Scene();
      var cam = new THREE.PerspectiveCamera(40, 1.6, 1, 160000);
      var disponer = [];
      var guarda = function (o) { disponer.push(o); return o; };
      var i, j;

      /* --- alturas combinadas: finca y cabo 4 m, medio 10 m, cerca 20 m, lejos ~330 m --- */
      var hC = muestreador(R.cerca), hM = muestreador(R.medio), hF = muestreador(R.finca), hB = muestreador(R.cabo), hL = muestreador(R.lejos);
      var EX = m.exag;
      var exag = function (x, z) { return 1 + (EX.lejos - 1) * suave(EX.desde, EX.hasta, Math.sqrt(x * x + z * z)); };
      function altura(x, z) {                  // metros (sin exagerar); el mar, negativo
        var wc = pesoCaja(R.cerca, x, z, 1);
        if (wc <= 0) return hL(x, z);
        var h = hC(x, z);
        var wm = pesoCaja(R.medio, x, z, 80); if (wm > 0) h = lerp(h, hM(x, z), wm);
        var wf = pesoCaja(R.finca, x, z, 40); if (wf > 0) h = lerp(h, hF(x, z), wf);
        var wb = pesoCaja(R.cabo, x, z, 40); if (wb > 0) h = lerp(h, hB(x, z), wb);
        return h;
      }
      var yDe = function (x, z) { var h = altura(x, z); return h > 0 ? h * exag(x, z) : h; };

      /* --- materiales del suelo: ortofoto cercana + tres capas de detalle (medio, cabo, finca) --- */
      var ldr = new THREE.TextureLoader();
      var cargaTex = function (url, alListo) {
        return ldr.load(url, function (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anis; t.needsUpdate = true; if (alListo) alListo(t); pedir(true); },
          undefined, function () { console.warn('Lugar: no carga', url); });
      };
      var O = m.orto, calidadTex = hiDef ? 'alta' : 'baja';
      var caja4 = function (o) { return new THREE.Vector4(o.x0, o.z0, o.x1, o.z1); };
      var uDet = {
        mapMedio: { value: null }, cajaMedio: { value: caja4(O.medio) }, listoMedio: { value: 0 },
        mapCabo: { value: null }, cajaCabo: { value: caja4(O.cabo) }, listoCabo: { value: 0 },
        mapFinca: { value: null }, cajaFinca: { value: caja4(O.finca) }, listoFinca: { value: 0 },
      };
      var matCerca = guarda(new THREE.MeshLambertMaterial({ color: '#6b7660' }));
      matCerca.onBeforeCompile = function (sh) {
        Object.assign(sh.uniforms, uDet);
        sh.vertexShader = 'varying vec2 vXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vXZ = position.xz;');
        sh.fragmentShader = [
          'varying vec2 vXZ;',
          'uniform sampler2D mapMedio; uniform vec4 cajaMedio; uniform float listoMedio;',
          'uniform sampler2D mapCabo; uniform vec4 cajaCabo; uniform float listoCabo;',
          'uniform sampler2D mapFinca; uniform vec4 cajaFinca; uniform float listoFinca;',
          'vec4 capaDetalle(vec4 t, sampler2D m, vec4 c, float listo, float borde) {',
          '  vec2 fu = (vXZ - c.xy) / (c.zw - c.xy);',
          '  if (listo < 0.5 || fu.x <= 0.0 || fu.x >= 1.0 || fu.y <= 0.0 || fu.y >= 1.0) return t;',
          '  float b = smoothstep(0.0, borde, min(min(fu.x, 1.0 - fu.x), min(fu.y, 1.0 - fu.y)));',
          '  return mix(t, texture2D(m, vec2(fu.x, 1.0 - fu.y)), b);',
          '}',
          sh.fragmentShader.replace('#include <map_fragment>', [
            '#ifdef USE_MAP',
            '  vec4 texel = texture2D(map, vMapUv);',
            '  texel = capaDetalle(texel, mapMedio, cajaMedio, listoMedio, 0.05);',
            '  texel = capaDetalle(texel, mapCabo, cajaCabo, listoCabo, 0.12);',
            '  texel = capaDetalle(texel, mapFinca, cajaFinca, listoFinca, 0.12);',
            '  diffuseColor *= texel;',
            '#endif'].join('\n'))].join('\n');
      };
      cargaTex(BASE + O.cerca.archivos[calidadTex], function (t) { matCerca.map = t; matCerca.color.set('#ffffff'); matCerca.needsUpdate = true; });
      cargaTex(BASE + O.medio.archivos[calidadTex], function (t) { uDet.mapMedio.value = t; uDet.listoMedio.value = 1; });
      cargaTex(BASE + O.cabo.archivos[calidadTex], function (t) { uDet.mapCabo.value = t; uDet.listoCabo.value = 1; });
      cargaTex(BASE + O.finca.archivos[calidadTex], function (t) { uDet.mapFinca.value = t; uDet.listoFinca.value = 1; });
      var matLejos = guarda(new THREE.MeshLambertMaterial({ color: '#5c6658', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 }));
      cargaTex(BASE + O.lejos.archivos.alta, function (t) { matLejos.map = t; matLejos.color.set('#ffffff'); matLejos.needsUpdate = true; });

      /* --- relieve cercano: rejilla densa en la finca y en el faro, más abierta lejos --- */
      var Fz = m.faro, CEN = m.tejadoL[0];
      var CX = [CEN.cx, Fz.x], CZ = [CEN.cz, Fz.z];
      var pasos = hiDef ? [4, 10, 24, 60] : [6, 14, 32, 80];
      var pasoEn = function (d) { return d < 160 ? pasos[0] : d < 700 ? pasos[1] : d < 2100 ? pasos[2] : pasos[3]; };
      function ejes(a0, a1, cs) {
        var dist = function (v) { return Math.min.apply(null, cs.map(function (c) { return Math.abs(v - c); })); };
        var out = [a0], v = a0;
        while (v < a1 - 0.01) {
          var s = pasoEn(dist(v));
          s = pasoEn(Math.min(dist(v), dist(v + s)));
          v = Math.min(a1, v + s); out.push(v);
        }
        return out;
      }
      var C = R.cerca;
      var xs = ejes(C.x0, C.x1, CX), zs = ejes(C.z0, C.z1, CZ);
      function rejilla(xs, zs, yFn, uvCaja, hueco, faldon) {
        var nx = xs.length, nz = zs.length, n = nx * nz;
        var nF = faldon ? 2 * (nx + nz) : 0;
        var pos = new Float32Array((n + nF) * 3), uv = new Float32Array((n + nF) * 2);
        var k = 0, i, j;
        for (j = 0; j < nz; j++) for (i = 0; i < nx; i++, k++) {
          var x = xs[i], z = zs[j];
          pos[k * 3] = x; pos[k * 3 + 1] = yFn(x, z, i, j); pos[k * 3 + 2] = z;
          uv[k * 2] = (x - uvCaja.x0) / (uvCaja.x1 - uvCaja.x0); uv[k * 2 + 1] = 1 - (z - uvCaja.z0) / (uvCaja.z1 - uvCaja.z0);
        }
        var idx = [];
        for (j = 0; j < nz - 1; j++) for (i = 0; i < nx - 1; i++) {
          if (hueco && i >= hueco[0] && i < hueco[2] && j >= hueco[1] && j < hueco[3]) continue;
          var a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
        if (faldon) {                                     // el borde baja como una pared: tapa las rendijas entre mallas
          var borde = [], f0 = n;
          for (i = 0; i < nx; i++) borde.push(i);
          for (j = 1; j < nz; j++) borde.push(j * nx + nx - 1);
          for (i = nx - 2; i >= 0; i--) borde.push((nz - 1) * nx + i);
          for (j = nz - 2; j > 0; j--) borde.push(j * nx);
          borde.forEach(function (v, q) {
            var w = f0 + q;
            pos[w * 3] = pos[v * 3]; pos[w * 3 + 1] = Math.min(pos[v * 3 + 1], 0) - faldon; pos[w * 3 + 2] = pos[v * 3 + 2];
            uv[w * 2] = uv[v * 2]; uv[w * 2 + 1] = uv[v * 2 + 1];
          });
          for (var qq = 0; qq < borde.length; qq++) {
            var v0 = borde[qq], v1 = borde[(qq + 1) % borde.length], w0 = f0 + qq, w1 = f0 + (qq + 1) % borde.length;
            idx.push(v0, w0, v1, v1, w0, w1, v0, v1, w0, v1, w1, w0);
          }
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(n + nF > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
        g.computeVertexNormals();
        return guarda(g);
      }
      var cerca = new THREE.Mesh(rejilla(xs, zs, function (x, z) { return yDe(x, z); }, O.cerca, null, 160), matCerca);
      cerca.receiveShadow = true;
      esc3.add(cerca);

      var L = R.lejos, xsL = [], zsL = [];
      for (i = 0; i < L.w; i++) xsL.push(L.x0 + i * (L.x1 - L.x0) / (L.w - 1));
      for (j = 0; j < L.h; j++) zsL.push(L.z0 + j * (L.z1 - L.z0) / (L.h - 1));
      var lejos = new THREE.Mesh(rejilla(xsL, zsL, function (x, z, i, j) { var h = L.data[j * L.w + i]; return h > 0 ? h * exag(x, z) : h; }, O.lejos, L.hueco, 500), matLejos);
      esc3.add(lejos);

      /* --- el mar: sombreado propio (olas por ruido, Fresnel, brillo del sol y la luna, espuma en la orilla) --- */
      var costaTex = cargaTex(BASE + O.costa.archivo, function (t) { t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; });
      costaTex.colorSpace = THREE.NoColorSpace;
      var uAgua = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        tiempo: { value: 0 }, costa: { value: null }, costaCaja: { value: new THREE.Vector4(C.x0, C.z0, C.x1, C.z1) },
        dirSol: { value: new THREE.Vector3(0, 1, 0) }, colSol: { value: new THREE.Color('#ffffff') }, brilloSol: { value: 1 },
        dirLuna: { value: new THREE.Vector3(0, 1, 0) }, brilloLuna: { value: 0 },
        cZ: { value: new THREE.Color('#5a82bf') }, cH: { value: new THREE.Color('#d9e2e9') },
        profundo: { value: new THREE.Color('#103a4e') }, somero: { value: new THREE.Color('#2b7a84') }, luzAgua: { value: 1 },
        olas: { value: reduce ? 0 : 1 }, cajaLejos: { value: new THREE.Vector4(R.lejos.x0, R.lejos.z0, R.lejos.x1, R.lejos.z1) },
        faroPos: { value: new THREE.Vector3(Fz.x, 100, Fz.z) }, faroDir: { value: new THREE.Vector3(1, 0, 0) }, faroLuz: { value: 0 },
      }]);
      uAgua.costa.value = costaTex;
      var matAgua = guarda(new THREE.ShaderMaterial({
        uniforms: uAgua, fog: true, toneMapped: false,
        vertexShader: [
          'varying vec3 vW;', '#include <fog_pars_vertex>',
          'void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;', '#include <fog_vertex>', '}'].join('\n'),
        fragmentShader: [
          'uniform float tiempo; uniform sampler2D costa; uniform vec4 costaCaja; uniform vec3 dirSol; uniform vec3 colSol; uniform float brilloSol;',
          'uniform vec3 dirLuna; uniform float brilloLuna; uniform vec3 cZ; uniform vec3 cH; uniform vec3 profundo; uniform vec3 somero; uniform float luzAgua; uniform float olas; uniform vec4 cajaLejos;',
          'uniform vec3 faroPos; uniform vec3 faroDir; uniform float faroLuz;',
          'varying vec3 vW;', '#include <fog_pars_fragment>',
          'float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
          '  float a = fract(sin(dot(i, vec2(127.1,311.7)))*43758.5), b = fract(sin(dot(i+vec2(1,0), vec2(127.1,311.7)))*43758.5);',
          '  float c = fract(sin(dot(i+vec2(0,1), vec2(127.1,311.7)))*43758.5), d = fract(sin(dot(i+vec2(1,1), vec2(127.1,311.7)))*43758.5);',
          '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }',
          'void main(){',
          '  if ((vW.x < cajaLejos.x || vW.x > cajaLejos.z || vW.z > cajaLejos.w) && vW.z > -3000.0) discard;',
          '  vec2 p = vW.xz; float t = tiempo * olas;',
          '  vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);',
          '  float fade = 1.0 - smoothstep(600.0, 9000.0, dist);',
          '  vec2 g = vec2(0.0);',
          '  g += vec2(0.30, 0.95) * cos(dot(p, vec2(0.30, 0.95)) * 0.05 - t * 0.85) * 0.6;',
          '  g += vec2(-0.55, 0.83) * cos(dot(p, vec2(-0.55, 0.83)) * 0.11 - t * 1.3) * 0.35;',
          '  g += vec2(0.9, 0.42) * cos(dot(p, vec2(0.9, 0.42)) * 0.23 - t * 1.9) * 0.22;',
          '  float e = 0.6; vec2 q = p * 0.09 + vec2(t * 0.15, t * 0.08);',
          '  g += vec2(ruido(q + vec2(e, 0.0)) - ruido(q - vec2(e, 0.0)), ruido(q + vec2(0.0, e)) - ruido(q - vec2(0.0, e))) * 0.9;',
          '  vec3 N = normalize(vec3(-g.x * 0.11 * fade, 1.0, -g.y * 0.11 * fade));',
          '  vec2 cu = (p - costaCaja.xy) / (costaCaja.zw - costaCaja.xy);',
          '  float dc = 800.0;',
          '  if (cu.x > 0.0 && cu.x < 1.0 && cu.y > 0.0 && cu.y < 1.0) { vec4 c = texture2D(costa, vec2(cu.x, 1.0 - cu.y)); dc = c.r * 765.0; }',
          '  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);',
          '  vec3 Rf = reflect(-V, N); Rf.y = abs(Rf.y);',
          '  vec3 cielo = mix(cH, cZ, smoothstep(0.0, 0.45, Rf.y));',
          '  vec3 cuerpo = mix(somero, profundo, smoothstep(10.0, 260.0, dc)) * luzAgua;',
          '  vec3 col = mix(cuerpo, cielo, fres * 0.85);',
          '  col += colSol * brilloSol * (pow(max(dot(Rf, dirSol), 0.0), 380.0) * 6.0 + pow(max(dot(Rf, dirSol), 0.0), 30.0) * 0.18);',
          '  col += vec3(0.75, 0.82, 1.0) * brilloLuna * pow(max(dot(Rf, dirLuna), 0.0), 120.0) * 2.5;',
          // el haz del faro rozando el agua: una franja tenue bajo el haz, que se apaga con la distancia
          '  vec2 fd = p - faroPos.xz; float fl = length(fd);',
          '  float enHaz = pow(max(dot(fd / max(fl, 1.0), faroDir.xz), 0.0), 900.0) * (1.0 - smoothstep(300.0, 5200.0, fl)) * smoothstep(60.0, 260.0, fl);',
          '  col += vec3(1.0, 0.93, 0.78) * faroLuz * enHaz * (0.10 + 0.25 * fres);',
          '  float banda = 0.5 + 0.5 * sin(dc * 0.35 - t * 1.6 + ruido(p * 0.05) * 6.0);',
          '  float esp = (1.0 - smoothstep(4.0, 34.0, dc)) * (0.55 + 0.45 * banda) + (1.0 - smoothstep(0.0, 8.0, dc)) * 0.6;',
          '  esp *= 0.55 + 0.45 * ruido(p * 0.35 + t * 0.3);',
          '  col = mix(col, vec3(0.92, 0.94, 0.93) * max(luzAgua, 0.08), clamp(esp, 0.0, 1.0));',
          '  gl_FragColor = vec4(col, 1.0);',
          '  #include <fog_fragment>',
          '  #include <colorspace_fragment>',
          '}'].join('\n'),
      }));
      var agua = new THREE.Mesh(guarda(new THREE.PlaneGeometry(300000, 300000).rotateX(-Math.PI / 2)), matAgua);
      esc3.add(agua);

      /* --- cielo: cúpula con degradado y brillo hacia el sol --- */
      var uCielo = { cZ: { value: new THREE.Color() }, cH: { value: new THREE.Color() }, dirSol: { value: new THREE.Vector3(0, 1, 0) }, brillo: { value: 0 }, cLuz: { value: new THREE.Color('#ffb070') } };
      var cielo = new THREE.Mesh(guarda(new THREE.SphereGeometry(120000, 40, 20)), guarda(new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false, uniforms: uCielo,
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: ['uniform vec3 cZ; uniform vec3 cH; uniform vec3 dirSol; uniform float brillo; uniform vec3 cLuz; varying vec3 vP;',
          'void main(){ float h = vP.y; vec3 c = mix(cH, cZ, smoothstep(0.0, 0.55, h)); if (h < 0.0) c = cH;',
          ' float s = max(dot(normalize(vP), dirSol), 0.0); float vel = 1.0 - smoothstep(0.0, 0.45, abs(h));',
          ' c += cLuz * brillo * (pow(s, 6.0) * 0.5 + pow(s, 60.0) * 0.45) * vel;',
          ' gl_FragColor = vec4(c, 1.0);', ' #include <colorspace_fragment>', '}'].join('\n'),
      })));
      cielo.renderOrder = -10; cielo.frustumCulled = false;
      esc3.add(cielo);
      esc3.fog = new THREE.FogExp2('#d9e2e9', 1 / 46000);

      // estrellas
      var rnd = azar(23), nE = hiDef ? 900 : 500, ePos = new Float32Array(nE * 3);
      for (i = 0; i < nE; i++) {
        var a = rnd() * Math.PI * 2, hh = Math.asin(0.03 + rnd() * 0.96);
        ePos[i * 3] = Math.cos(hh) * Math.sin(a) * 100000; ePos[i * 3 + 1] = Math.sin(hh) * 100000; ePos[i * 3 + 2] = -Math.cos(hh) * Math.cos(a) * 100000;
      }
      var eGeo = guarda(new THREE.BufferGeometry()); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
      var estrellas = new THREE.Points(eGeo, guarda(new THREE.PointsMaterial({ color: '#f3eee4', size: movil ? 1.4 : 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })));
      estrellas.frustumCulled = false; esc3.add(estrellas);
      var texDe = function (lado, f) { var c = lienzo(lado, f), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return guarda(t); };
      var solS = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texDe(128, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,246,222,1)'); r.addColorStop(0.14, 'rgba(255,232,180,1)'); r.addColorStop(0.32, 'rgba(255,205,140,.35)'); r.addColorStop(1, 'rgba(255,205,140,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); }), fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      solS.scale.set(9000, 9000, 1); esc3.add(solS);
      var lunaCv = document.createElement('canvas'); lunaCv.width = lunaCv.height = 128;
      var lunaTex = guarda(new THREE.CanvasTexture(lunaCv)); lunaTex.colorSpace = THREE.SRGBColorSpace;
      var lunaS = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: lunaTex, fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      lunaS.scale.set(3600, 3600, 1); esc3.add(lunaS);
      function pintarLuna(fase) {
        var g = lunaCv.getContext('2d'), Ld = 128, r = Ld * 0.36, c = Ld / 2;
        g.clearRect(0, 0, Ld, Ld); g.save(); g.translate(c, c);
        g.fillStyle = 'rgba(40,50,70,.5)'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        var crec = fase < 0.5, p = crec ? fase : 1 - fase; if (!crec) g.scale(-1, 1);
        var k = Math.cos(2 * Math.PI * p);
        g.shadowColor = 'rgba(242,236,227,.55)'; g.shadowBlur = Ld * 0.1; g.fillStyle = '#f1ebdc';
        g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
        g.ellipse(0, 0, Math.max(0.01, Math.abs(k)) * r, r, 0, Math.PI / 2, k >= 0 ? -Math.PI / 2 : 3 * Math.PI / 2, k >= 0);
        g.fill(); g.restore(); lunaTex.needsUpdate = true;
      }

      /* --- luces --- */
      var FINCA = new THREE.Vector3(CEN.cx, yDe(CEN.cx, CEN.cz), CEN.cz);
      var luzSol = new THREE.DirectionalLight('#ffffff', 2.6);
      luzSol.castShadow = true;
      var SM = hiDef ? 2048 : 1024;
      luzSol.shadow.mapSize.set(SM, SM);
      Object.assign(luzSol.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 1600 });
      luzSol.shadow.camera.updateProjectionMatrix();
      luzSol.shadow.bias = -0.0004; luzSol.shadow.normalBias = 0.05;
      luzSol.target.position.copy(FINCA);
      var luzLuna = new THREE.DirectionalLight('#a8bce0', 0);
      luzLuna.target.position.copy(FINCA);
      var hemi = new THREE.HemisphereLight('#dfe8f0', '#5d5444', 1.5);
      var luzCasa = new THREE.PointLight('#ffc27a', 0, 70, 2);      // siempre está: si no, cambiaría el programa al anochecer
      esc3.add(luzSol, luzSol.target, luzLuna, luzLuna.target, hemi, luzCasa);

      /* --- materiales de los edificios --- */
      var texRep = function (c) { var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anis; return guarda(t); };
      var MAT = {
        crema: guarda(new THREE.MeshLambertMaterial({ map: texRep(texRevoco('#ede3cf', 12)) })),      // el revoco de los apartamentos (foto de la fachada)
        blanca: guarda(new THREE.MeshLambertMaterial({ map: texRep(texRevoco('#eeebe4', 14)) })),
        vecina: guarda(new THREE.MeshLambertMaterial({ map: texRep(texRevoco('#e6dfd2', 15)) })),
        madera: guarda(new THREE.MeshLambertMaterial({ color: '#8a4b22' })),                          // postes y carpintería barnizados
        tablas: guarda(new THREE.MeshLambertMaterial({ map: texRep(texTablas('#9a5527', 41, true)) })),
        alero: guarda(new THREE.MeshLambertMaterial({ color: '#6b3a1f' })),
        zocalo: guarda(new THREE.MeshLambertMaterial({ color: '#d9d2c4' })),
      };
      var matTeja = guarda(new THREE.MeshLambertMaterial({ map: texRep(texTeja('#8e3d2c', 5)) }));       // teja rojo oscuro de la foto
      var matTejaFaro = guarda(new THREE.MeshLambertMaterial({ map: texRep(texTeja('#c4643d', 6)) }));   // la del faro, más anaranjada (ortofoto)
      var matTejaV = guarda(new THREE.MeshLambertMaterial({ map: texRep(texTeja('#a85a3e', 7)), color: '#e2d8cf' }));
      var ESTILO = {      // muro, altura de planta, alero, pendiente (°), luces de noche
        apartamentos: { muro: 'crema', planta: 2.7, alero: 0.6, pend: 23, luz: 0.7, teja: matTeja },
        faro: { muro: 'blanca', planta: 3.0, alero: 0.5, pend: 25, luz: 0.2, teja: matTejaFaro },
        vecina: { muro: 'vecina', planta: 2.8, alero: 0.45, pend: 27, luz: 0.3, teja: matTejaV },
      };
      var finca = new THREE.Group(); esc3.add(finca);
      var geoMuros = {}, ventanas = [];
      function añadeMuro(clave, a, b, y0, y1a, y1b, u0) {
        var g = geoMuros[clave] || (geoMuros[clave] = { p: [], uv: [] });
        var dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), u1 = u0 + l / 2.4;
        g.p.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1b, b[1], a[0], y0, a[1], b[0], y1b, b[1], a[0], y1a, a[1]);
        g.uv.push(u0, y0 / 2.4, u1, y0 / 2.4, u1, y1b / 2.4, u0, y0 / 2.4, u1, y1b / 2.4, u0, y1a / 2.4);
      }
      function dentro(pt, anillo) {
        var c = false;
        for (var i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
          var a = anillo[i], b = anillo[j];
          if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
        }
        return c;
      }
      // altura del faldón de un tejado a cuatro aguas (rectángulo + alero) en (x, z); negativa fuera
      function faldon(rc, alero, x, z) {
        var c = Math.cos(rc.ang), s = Math.sin(rc.ang), dx = x - rc.cx, dz = z - rc.cz;
        var u = dx * c + dz * s, v = -dx * s + dz * c;
        return Math.min(rc.largo / 2 + alero - Math.abs(u), rc.fondo / 2 + alero - Math.abs(v));
      }
      function tejado(rc, y0, tipo, alero, pendG, mat, matGab) {
        var c = Math.cos(rc.ang), s = Math.sin(rc.ang);
        var Lh = rc.largo / 2 + alero, Fh = rc.fondo / 2 + alero, pend = Math.tan(pendG * RAD), sube = Fh * pend;
        var P = function (u, v, y) { return [rc.cx + u * c - v * s, y, rc.cz + u * s + v * c]; };
        var tris = [], uvs = [];
        var cara = function (pts, uvsC) {                 // se invierte cada triángulo: la cara buena mira al cielo
          for (var t = 0; t < pts.length; t += 3) {
            [pts[t], pts[t + 2], pts[t + 1]].forEach(function (v) { tris.push(v[0], v[1], v[2]); });
            [uvsC[t], uvsC[t + 2], uvsC[t + 1]].forEach(function (v) { uvs.push(v[0], v[1]); });
          }
        };
        var Y0 = y0, Y1 = y0 + sube, lg = Math.hypot(Fh, sube);
        if (tipo === '4') {
          var cr = Math.max(0, Lh - Fh);
          cara([P(-Lh, -Fh, Y0), P(Lh, -Fh, Y0), P(cr, 0, Y1), P(-Lh, -Fh, Y0), P(cr, 0, Y1), P(-cr, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [(Lh + cr) / 1.6, lg / 1.6], [0, 0], [(Lh + cr) / 1.6, lg / 1.6], [(Lh - cr) / 1.6, lg / 1.6]]);
          cara([P(Lh, Fh, Y0), P(-Lh, Fh, Y0), P(-cr, 0, Y1), P(Lh, Fh, Y0), P(-cr, 0, Y1), P(cr, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [(Lh + cr) / 1.6, lg / 1.6], [0, 0], [(Lh + cr) / 1.6, lg / 1.6], [(Lh - cr) / 1.6, lg / 1.6]]);
          var lgL = Math.hypot(Lh - cr, sube);
          cara([P(Lh, -Fh, Y0), P(Lh, Fh, Y0), P(cr, 0, Y1)], [[0, 0], [2 * Fh / 1.6, 0], [Fh / 1.6, lgL / 1.6]]);
          cara([P(-Lh, Fh, Y0), P(-Lh, -Fh, Y0), P(-cr, 0, Y1)], [[0, 0], [2 * Fh / 1.6, 0], [Fh / 1.6, lgL / 1.6]]);
        } else {
          cara([P(-Lh, -Fh, Y0), P(Lh, -Fh, Y0), P(Lh, 0, Y1), P(-Lh, -Fh, Y0), P(Lh, 0, Y1), P(-Lh, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [2 * Lh / 1.6, lg / 1.6], [0, 0], [2 * Lh / 1.6, lg / 1.6], [0, lg / 1.6]]);
          cara([P(Lh, Fh, Y0), P(-Lh, Fh, Y0), P(-Lh, 0, Y1), P(Lh, Fh, Y0), P(-Lh, 0, Y1), P(Lh, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [2 * Lh / 1.6, lg / 1.6], [0, 0], [2 * Lh / 1.6, lg / 1.6], [0, lg / 1.6]]);
          if (matGab) {                                     // hastiales (piñones)
            var Lw = rc.largo / 2, Fw = rc.fondo / 2, Yw = y0 + alero * pend;
            var gb = [P(Lw, -Fw, Yw), P(Lw, Fw, Yw), P(Lw, 0, Y1 - 0.05), P(-Lw, Fw, Yw), P(-Lw, -Fw, Yw), P(-Lw, 0, Y1 - 0.05)];
            var gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute([].concat.apply([], gb), 3));
            gg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, Fw / 0.6, 0, Fw / 1.2, (Y1 - Yw) / 1.2, 0, 0, Fw / 0.6, 0, Fw / 1.2, (Y1 - Yw) / 1.2], 2));
            gg.computeVertexNormals();
            var mgm = matGab.clone(); mgm.side = THREE.DoubleSide; guarda(mgm);
            var mg = new THREE.Mesh(guarda(gg), mgm); mg.castShadow = true; mg.receiveShadow = true; finca.add(mg);
          }
        }
        var tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); tg.computeVertexNormals();
        var mt = new THREE.Mesh(guarda(tg), mat); mt.castShadow = true; mt.receiveShadow = true; finca.add(mt);
        // el canto del alero (tablas de madera, como en la foto)
        var canto = new THREE.Mesh(guarda(new THREE.BoxGeometry(2 * Lh, 0.18, 2 * Fh)), MAT.alero);
        canto.position.set(rc.cx, y0 - 0.1, rc.cz); canto.rotation.y = -rc.ang; canto.castShadow = true; finca.add(canto);
        return Y1;
      }

      /* --- la finca: el bloque en L sobre su planta catastral, con su tejado de dos alas y el porche --- */
      var EST_A = ESTILO.apartamentos;
      var apart = m.edificios.find(function (e) { return e.tipo === 'apartamentos'; });
      var yA = apart.suelo + 0.2;                          // la losa
      var aleroA = yA + 2.45;                              // la línea del alero (los postes del porche)
      var pendA = Math.tan(EST_A.pend * RAD);
      var techoL = function (x, z) {                       // el tejado en L = el más alto de las dos alas en cada punto
        var f = Math.max(faldon(m.tejadoL[0], EST_A.alero, x, z), faldon(m.tejadoL[1], EST_A.alero, x, z));
        return aleroA + Math.max(0, f) * pendA;
      };
      function muros(e, est, techo, yBase, yTope) {
        var an = e.anillo, u = 0, suelo = Math.min(e.suelo, yDe(e.rect.cx, e.rect.cz)) - 0.6;
        for (var k = 0; k < an.length; k++) {
          var A0 = an[k], B0 = an[(k + 1) % an.length], l = Math.hypot(B0[0] - A0[0], B0[1] - A0[1]);
          if (l < 0.05) continue;
          var ya = techo ? techo(A0[0], A0[1]) - 0.06 : yTope, yb = techo ? techo(B0[0], B0[1]) - 0.06 : yTope;
          añadeMuro(est.muro, A0, B0, suelo, ya, yb, u);
          u += l / 2.4;
          if (l < 2.4) continue;
          var nxv = (B0[1] - A0[1]) / l, nzv = -(B0[0] - A0[0]) / l, mid = [(A0[0] + B0[0]) / 2 + nxv * 0.3, (A0[1] + B0[1]) / 2 + nzv * 0.3];
          if (dentro(mid, an)) { nxv = -nxv; nzv = -nzv; }
          // al porche dan las puertas de cada apartamento; al prado, las ventanas
          var alPorche = e.tipo === 'apartamentos' && dentro([mid[0] + nxv * 1.2, mid[1] + nzv * 1.2], m.porche.anillo);
          var nV = Math.max(1, Math.floor((l - 0.8) / 2.9));
          for (var pi = 0; pi < e.pisos; pi++) for (var w = 0; w < nV; w++) {
            var t = (w + 0.5) / nV, wx = A0[0] + (B0[0] - A0[0]) * t, wz = A0[1] + (B0[1] - A0[1]) * t;
            var hseed = Math.abs(Math.sin(wx * 12.9898 + wz * 78.233 + pi * 3.1) * 43758.5453) % 1;
            var puerta = alPorche && (w % 2 === 0);
            ventanas.push({ x: wx + nxv * 0.03, z: wz + nzv * 0.03, y: yBase + pi * est.planta + (puerta ? 1.05 : 1.45), ang: Math.atan2(nxv, nzv), luz: hseed < est.luz, tipo: e.tipo, puerta: puerta });
          }
        }
      }
      muros(apart, EST_A, techoL, yA);
      m.tejadoL.forEach(function (rc) { tejado(rc, aleroA, '4', EST_A.alero, EST_A.pend, matTeja, null); });
      // losa del porche y postes de madera sobre su pie blanco (los de la foto)
      (function () {
        var an = m.porche.anillo, sh = new THREE.Shape();
        an.forEach(function (p, k) { if (k) sh.lineTo(p[0], -p[1]); else sh.moveTo(p[0], -p[1]); });
        var g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
        var losa = new THREE.Mesh(guarda(g), guarda(new THREE.MeshLambertMaterial({ color: '#b9ab98' }))); losa.position.y = yA; losa.receiveShadow = true; finca.add(losa);
        var n = m.porche.postes.length;
        var postes = new THREE.InstancedMesh(guarda(new THREE.BoxGeometry(0.2, 1, 0.2)), MAT.madera, n);
        var pies = new THREE.InstancedMesh(guarda(new THREE.BoxGeometry(0.34, 0.32, 0.34)), MAT.zocalo, n);
        var mt = new THREE.Matrix4(), q0 = new THREE.Quaternion(), p0 = new THREE.Vector3(), s0 = new THREE.Vector3();
        m.porche.postes.forEach(function (p, k) {
          var top = techoL(p[0], p[1]) - 0.12, h = top - (yA + 0.3);
          p0.set(p[0], yA + 0.3 + h / 2, p[1]); s0.set(1, h, 1); mt.compose(p0, q0, s0); postes.setMatrixAt(k, mt);
          p0.set(p[0], yA + 0.16, p[1]); s0.set(1, 1, 1); mt.compose(p0, q0, s0); pies.setMatrixAt(k, mt);
        });
        postes.castShadow = true; pies.castShadow = true; finca.add(postes, pies);
      })();

      /* --- el pabellón de la piscina (no está en Catastro ni en la ortofoto: situado por las fotos) --- */
      var PB = m.pabellon, pabVidrio = null, pabAgua = null, pabHalo = null;
      (function () {
        var g = new THREE.Group(), y0 = Math.max(PB.suelo, yA - 0.1) + 0.1;
        g.position.set(PB.cx, 0, PB.cz); g.rotation.y = -PB.ang;
        // en el marco del grupo: x = hacia el patio (largo), z = a lo ancho (fondo)
        var Lx = PB.largo / 2, Fz2 = PB.fondo / 2, sx = PB.hacia[0] * Math.cos(PB.ang) + PB.hacia[1] * Math.sin(PB.ang) >= 0 ? 1 : -1;
        var add = function (geo, mat, x, y, z) { var me = new THREE.Mesh(guarda(geo), mat); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; g.add(me); return me; };
        var hCuerpo = 2.55;
        add(new THREE.BoxGeometry(PB.largo, 0.4, PB.fondo), MAT.madera, 0, y0 + 0.2, 0);                       // zócalo de madera
        pabVidrio = guarda(new THREE.MeshLambertMaterial({ color: '#a8c2c6', transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide, emissive: '#ffd9a0', emissiveIntensity: 0 }));
        var vidrio = function (w, x, z, ry) { var me = new THREE.Mesh(guarda(new THREE.PlaneGeometry(w, hCuerpo - 0.5)), pabVidrio); me.position.set(x, y0 + 0.4 + (hCuerpo - 0.5) / 2, z); me.rotation.y = ry; me.renderOrder = 2; g.add(me); };
        vidrio(PB.fondo, sx * Lx, 0, Math.PI / 2);                                                           // el frente al prado
        vidrio(PB.largo - 2.4, sx * 1.2, Fz2, 0); vidrio(PB.largo - 2.4, sx * 1.2, -Fz2, 0);                    // los lados
        // montantes de madera cada ~2,3 m y el cerco de arriba
        var montante = function (x, z) { add(new THREE.BoxGeometry(0.14, hCuerpo, 0.14), MAT.madera, x, y0 + hCuerpo / 2, z); };
        var nF = Math.max(2, Math.round(PB.fondo / 2.3));
        for (var k = 0; k <= nF; k++) montante(sx * Lx, -Fz2 + k * PB.fondo / nF);
        var nL = Math.max(2, Math.round((PB.largo - 2.4) / 2.3));
        for (k = 0; k <= nL; k++) { var xx = sx * (Lx - k * (PB.largo - 2.4) / nL); montante(xx, Fz2); montante(xx, -Fz2); }
        add(new THREE.BoxGeometry(PB.largo, 0.2, PB.fondo + 0.1), MAT.madera, 0, y0 + hCuerpo - 0.05, 0);
        // la piscina dentro (agua turquesa, con luz propia de noche)
        pabAgua = guarda(new THREE.MeshLambertMaterial({ color: '#4fb7c6', emissive: '#2ab3c8', emissiveIntensity: 0 }));
        var aguaP = new THREE.Mesh(guarda(new THREE.PlaneGeometry(PB.largo - 4.4, PB.fondo - 3.4).rotateX(-Math.PI / 2)), pabAgua);
        aguaP.position.set(sx * 0.8, y0 + 0.42, 0); g.add(aguaP);
        add(new THREE.BoxGeometry(PB.largo - 0.4, 0.04, PB.fondo - 0.4), MAT.zocalo, 0, y0 + 0.4, 0).receiveShadow = true;
        // la terraza delante, con cuatro tumbonas (Piscina7)
        add(new THREE.BoxGeometry(3.6, 0.12, PB.fondo + 1.0), guarda(new THREE.MeshLambertMaterial({ color: '#8d8378' })), sx * (Lx + 1.8), y0 + 0.06, 0);
        var mTumb = guarda(new THREE.MeshLambertMaterial({ color: '#5b5148' }));
        for (k = 0; k < 4; k++) add(new THREE.BoxGeometry(1.9, 0.35, 0.6), mTumb, sx * (Lx + 1.9), y0 + 0.3, -PB.fondo * 0.36 + k * PB.fondo * 0.24);
        g.updateMatrixWorld(true);
        finca.add(g);
        // el tejado a dos aguas con su hastial de tablas, que sale del faldón del ala larga
        tejado({ cx: PB.cx, cz: PB.cz, largo: PB.largo, fondo: PB.fondo, ang: PB.ang }, y0 + hCuerpo, '2', 0.7, 26, matTeja, MAT.tablas);
        // de noche, la luz del agua a través del cristal (halo dibujado, sin bloom)
        pabHalo = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texDe(64, function (gg, l) { var r = gg.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(150,230,240,.7)'); r.addColorStop(0.35, 'rgba(120,210,230,.2)'); r.addColorStop(1, 'rgba(120,210,230,0)'); gg.fillStyle = r; gg.fillRect(0, 0, l, l); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 })));
        pabHalo.position.set(PB.cx, y0 + 1.4, PB.cz); pabHalo.scale.set(16, 9, 1); pabHalo.visible = false; finca.add(pabHalo);
      })();

      /* --- el faro de Cabo Vidio: casa del torrero (Catastro) y torre redonda con linterna --- */
      var faroG = new THREE.Group(); esc3.add(faroG);
      var casaFaro = m.edificios.filter(function (e) { return e.tipo === 'faro'; });
      var yT = Math.max(Fz.suelo, yDe(Fz.x, Fz.z));
      var yFoco = lim(Fz.foco, yT + 8.5, yT + 12);          // plano focal: 101 m sobre el mar, ~10 m sobre el suelo
      if (casaFaro.length) {
        var ptsF = [], sF = Math.min.apply(null, casaFaro.map(function (e) { return e.suelo; })), yTF = sF + 0.2 + ESTILO.faro.planta;
        casaFaro.forEach(function (e) {
          e.anillo.forEach(function (p) { if (Math.hypot(p[0] - Fz.x, p[1] - Fz.z) > Fz.r + 0.4) ptsF.push(p); });
          muros(e, ESTILO.faro, null, sF + 0.2, yTF);
        });
        tejado(rectOrientado(ptsF), yTF, '4', ESTILO.faro.alero, ESTILO.faro.pend, matTejaFaro, null);
      }
      var hTorre = yFoco - 1.3 - yT;
      var mTorre = MAT.blanca, mOscuro = guarda(new THREE.MeshLambertMaterial({ color: '#3b4146' }));
      var addF = function (geo, mat, y) { var me = new THREE.Mesh(guarda(geo), mat); me.position.set(Fz.x, y, Fz.z); me.castShadow = true; me.receiveShadow = true; faroG.add(me); return me; };
      addF(new THREE.CylinderGeometry(Fz.r * 0.96 + 0.14, Fz.r + 0.14, hTorre + 1, 28), mTorre, yT - 1 + (hTorre + 1) / 2);   // la torre
      addF(new THREE.CylinderGeometry(Fz.r + 0.55, Fz.r + 0.45, 0.22, 28), mTorre, yT + hTorre + 0.11);         // el balcón
      addF(new THREE.CylinderGeometry(Fz.r + 0.5, Fz.r + 0.5, 0.9, 28, 1, true), guarda(new THREE.MeshLambertMaterial({ color: '#2f3539', side: THREE.DoubleSide, transparent: true, opacity: 0.55 })), yT + hTorre + 0.67);  // barandilla
      addF(new THREE.CylinderGeometry(1.0, 1.0, 0.45, 20), mOscuro, yT + hTorre + 0.45);                         // basamento de la linterna
      var vidLinterna = guarda(new THREE.MeshLambertMaterial({ color: '#c9d6da', emissive: '#fff1c8', emissiveIntensity: 0, transparent: true, opacity: 0.8 }));
      addF(new THREE.CylinderGeometry(0.95, 0.95, 1.5, 16), vidLinterna, yFoco);                                  // la linterna
      addF(new THREE.ConeGeometry(1.1, 0.75, 16), mOscuro, yFoco + 0.75 + 0.37);                                  // la cúpula
      addF(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), mOscuro, yFoco + 1.5);                                // la veleta
      var FOCO = new THREE.Vector3(Fz.x, yFoco, Fz.z);

      /* --- el haz: conos aditivos que giran con el ritmo de data/faro.json --- */
      var LARGO_HAZ = 5200, ANCHO_HAZ = 2.2 * RAD;
      var hazGeo = new THREE.ConeGeometry(Math.tan(ANCHO_HAZ) * LARGO_HAZ, LARGO_HAZ, 28, 1, true);
      hazGeo.translate(0, -LARGO_HAZ / 2, 0); hazGeo.rotateZ(Math.PI / 2);                                        // vértice en el foco, abre hacia +x
      guarda(hazGeo);
      var uHaz = { intensidad: { value: 0 }, largo: { value: LARGO_HAZ }, color: { value: new THREE.Color('#fff2d2') } };
      var matHaz = guarda(new THREE.ShaderMaterial({
        uniforms: uHaz, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false,
        vertexShader: [
          'varying float vT; varying vec3 vN; varying vec3 vV; varying float vD;',
          'void main(){ vT = position.x; vec4 w = modelMatrix * vec4(position, 1.0);',
          ' vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vD = length(cameraPosition - w.xyz);',
          ' gl_Position = projectionMatrix * viewMatrix * w; }'].join('\n'),
        fragmentShader: [
          'uniform float intensidad; uniform float largo; uniform vec3 color;',
          'varying float vT; varying vec3 vN; varying vec3 vV; varying float vD;',
          'void main(){ float t = clamp(vT / largo, 0.0, 1.0);',
          ' float borde = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);',          // más denso en el eje: parece un volumen
          ' float a = intensidad * pow(1.0 - t, 1.8) * smoothstep(0.0, 0.004, t) * borde * exp(-vD / 26000.0);',
          ' gl_FragColor = vec4(color * a * 0.55, 1.0);',
          ' #include <colorspace_fragment>', '}'].join('\n'),
      }));
      var giro = new THREE.Group(); giro.position.copy(FOCO); esc3.add(giro);
      var haces = [];
      function montarHaces(r) {
        haces.forEach(function (h) { giro.remove(h); }); haces = [];
        var sep = separacionHaces(r);
        for (var k = 0; k < r.grupo; k++) {
          var h = new THREE.Mesh(hazGeo, matHaz); h.rotation.y = -k * sep; h.frustumCulled = false; h.renderOrder = 5;
          giro.add(h); haces.push(h);
        }
      }
      montarHaces(ritmo);
      // el destello: un halo en la linterna que crece cuando el haz apunta a la cámara
      var destello = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texDe(128, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,250,235,1)'); r.addColorStop(0.12, 'rgba(255,238,200,.75)'); r.addColorStop(0.4, 'rgba(255,220,160,.16)'); r.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); }), transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, opacity: 0 })));
      destello.position.copy(FOCO); destello.visible = false; esc3.add(destello);
      var faroLuz = 0, tFaro = 0;

      /* --- ventanas y puertas: oscuras de día; de noche, unas cuantas encendidas --- */
      var nVen = ventanas.length;
      var vidrio = new THREE.InstancedMesh(guarda(new THREE.PlaneGeometry(1, 1)), guarda(new THREE.MeshLambertMaterial({ color: '#2a2622', side: THREE.DoubleSide })), Math.max(1, nVen));
      var marco = new THREE.InstancedMesh(guarda(new THREE.BoxGeometry(1, 1, 0.08)), MAT.madera, Math.max(1, nVen));
      var encendidas = ventanas.filter(function (v) { return v.luz; });
      var luzV = new THREE.InstancedMesh(guarda(new THREE.PlaneGeometry(1, 1)), guarda(new THREE.MeshBasicMaterial({ color: '#ffc77a', toneMapped: false, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })), Math.max(1, encendidas.length));
      var mtx = new THREE.Matrix4(), qt = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1), ps = new THREE.Vector3();
      var tam = function (v) { return v.puerta ? [0.95, 2.05] : [1.0, 1.15]; };
      ventanas.forEach(function (v, k) {
        var t = tam(v);
        qt.setFromAxisAngle(eje, v.ang);
        ps.set(v.x, v.y, v.z); sc.set(t[0] * 0.85, t[1] * 0.9, 1); mtx.compose(ps, qt, sc); vidrio.setMatrixAt(k, mtx);
        ps.set(v.x - Math.sin(v.ang) * 0.02, v.y, v.z - Math.cos(v.ang) * 0.02); sc.set(t[0] * 1.05, t[1] * 1.08, 1); mtx.compose(ps, qt, sc); marco.setMatrixAt(k, mtx);
      });
      encendidas.forEach(function (v, k) { var t = tam(v); qt.setFromAxisAngle(eje, v.ang); ps.set(v.x + Math.sin(v.ang) * 0.015, v.y, v.z + Math.cos(v.ang) * 0.015); sc.set(t[0] * 0.8, t[1] * 0.86, 1); mtx.compose(ps, qt, sc); luzV.setMatrixAt(k, mtx); });
      sc.set(1, 1, 1);
      vidrio.count = nVen; marco.count = nVen;
      luzV.count = encendidas.length; luzV.visible = false;
      finca.add(marco, vidrio, luzV);
      var haloTex = texDe(64, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,196,120,.85)'); r.addColorStop(0.3, 'rgba(255,190,110,.25)'); r.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); });
      var halos = [];
      encendidas.filter(function (v) { return v.tipo === 'apartamentos'; }).forEach(function (v) {
        var h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
        guarda(h.material); h.position.set(v.x + Math.sin(v.ang) * 0.4, v.y, v.z + Math.cos(v.ang) * 0.4); h.scale.set(3.2, 3.2, 1); h.visible = false; finca.add(h); halos.push(h);
      });
      luzCasa.position.set(PB.cx + PB.hacia[0] * 9, yA + 2.6, PB.cz + PB.hacia[1] * 9);

      /* --- vecinas (Catastro): revoco claro y teja más apagada --- */
      m.edificios.filter(function (e) { return e.tipo === 'vecina'; }).forEach(function (e) {
        var est = ESTILO.vecina, arriba = e.suelo + 0.25 + e.pisos * est.planta;
        muros(e, est, null, e.suelo + 0.25, arriba);
        if (e.rect.fondo >= 1.6) tejado(e.rect, arriba, e.rect.largo > 1.6 * e.rect.fondo ? '2' : '4', est.alero, est.pend, matTejaV, e.rect.largo > 1.6 * e.rect.fondo ? MAT.vecina : null);
      });
      Object.keys(geoMuros).forEach(function (k) {
        var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(geoMuros[k].p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(geoMuros[k].uv, 2)); g.computeVertexNormals();
        var mm = MAT[k].clone(); guarda(mm); mm.side = THREE.DoubleSide;
        var me = new THREE.Mesh(guarda(g), mm); me.castShadow = true; me.receiveShadow = true; finca.add(me);
      });

      /* --- árboles alrededor de la finca (copas detectadas en la ortofoto) --- */
      var fin = m.recorrido[m.recorrido.length - 1];
      var arb = m.arboles.filter(function (a, k) {
        if (!hiDef && k % 2) return false;
        // nada entre la cámara final y la casa
        var ax = fin.pos[0], az = fin.pos[2], bx = CEN.cx, bz = CEN.cz, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
        var t = lim(((a[0] - ax) * dx + (a[2] - az) * dz) / l2, 0, 1), d = Math.hypot(a[0] - ax - t * dx, a[2] - az - t * dz);
        return d > a[3] + 9;
      });
      var copaGeo = new THREE.IcosahedronGeometry(1, 1), cp = copaGeo.attributes.position, rr = azar(77);
      for (i = 0; i < cp.count; i++) {
        var vx = cp.getX(i), vy = cp.getY(i), vz = cp.getZ(i), hsh = Math.abs(Math.sin(vx * 12.99 + vy * 78.23 + vz * 37.72) * 43758.55) % 1, f = 0.8 + hsh * 0.34;
        cp.setXYZ(i, vx * f, vy * f, vz * f);
      }
      copaGeo.computeVertexNormals(); guarda(copaGeo);
      var nArb = Math.max(1, arb.length);
      var copas = new THREE.InstancedMesh(copaGeo, guarda(new THREE.MeshLambertMaterial({ color: '#ffffff' })), nArb);
      var troncos = new THREE.InstancedMesh(guarda(new THREE.CylinderGeometry(0.18, 0.28, 1, 5)), guarda(new THREE.MeshLambertMaterial({ color: '#4a3d30' })), nArb);
      var col = new THREE.Color(), base = new THREE.Color('#465f36');
      arb.forEach(function (a, k) {
        var x = a[0], z = a[2], r = a[3], alto = a[4], y0 = yDe(x, z);
        qt.setFromAxisAngle(eje, rr() * 6.28);
        ps.set(x, y0 + alto - r * 0.95, z); sc.set(r, r * (0.85 + rr() * 0.3), r); mtx.compose(ps, qt, sc); copas.setMatrixAt(k, mtx);
        col.set(a[5]); col.lerp(base, 0.45); col.multiplyScalar(1.15 + rr() * 0.2); copas.setColorAt(k, col);
        ps.set(x, y0 + (alto - r) / 2, z); sc.set(1, Math.max(0.5, alto - r), 1); mtx.compose(ps, qt, sc); troncos.setMatrixAt(k, mtx);
      });
      sc.set(1, 1, 1);
      copas.count = troncos.count = arb.length;
      copas.castShadow = troncos.castShadow = true; copas.receiveShadow = true;
      esc3.add(copas, troncos);

      /* --- rótulos (HTML encima del lienzo) --- */
      var LEJANOS = ['mar', 'sierra', 'cudillero'];
      var rotulos = m.lugares.map(function (l) {
        var li = document.createElement('span');
        li.className = 'lugar__rotulo' + (l.clave === 'casa' ? ' lugar__rotulo--casa' : '') + (l.clave === 'faro' ? ' lugar__rotulo--faro' : '');
        li.innerHTML = '<span><b>' + esc(l.nombre) + '</b>' + (l.sub ? '<small>' + esc(l.sub) + '</small>' : '') + '</span>';
        capaRot.appendChild(li);
        var y = l.clave === 'mar' ? l.dy : l.clave === 'faro' ? yFoco + 14 : Math.max(0, altura(l.x, l.z)) * exag(l.x, l.z) + l.dy;
        return { el: li, l: l, v: new THREE.Vector3(l.x, y, l.z), visto: false };
      });
      function tapado(a, b) {                     // ¿el relieve tapa la línea de la cámara al rótulo?
        for (var k = 1; k < 24; k++) {
          var t = k / 24, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
          if (yDe(x, z) > y + 2) return true;
        }
        return false;
      }

      /* --- el cielo de ahora: luces, colores, astros, el faro --- */
      var dirSol = new THREE.Vector3(), dirLuna = new THREE.Vector3(), noche = 0;
      var dirDe = function (az, alt, v) { return v.set(Math.sin(az * RAD) * Math.cos(alt * RAD), Math.sin(alt * RAD), -Math.cos(az * RAD) * Math.cos(alt * RAD)); };
      var faseLuna = -1;
      function luces(f) {
        f = f || ahora();
        var s = sol(f), l = luna(f), c = cieloPara(s.alt);
        noche = lim((-s.alt - 2) / 10, 0, 1);
        var dia = lim((s.alt + 4) / 14, 0, 1);
        uCielo.cZ.value.set(c.cz); uCielo.cH.value.set(c.ch);
        dirDe(s.az, s.alt, dirSol); dirDe(l.az, l.alt, dirLuna);
        uCielo.dirSol.value.copy(dirSol);
        uCielo.brillo.value = lim(1 - Math.abs(s.alt - 1) / 14, 0, 1);
        esc3.fog.color.set(mezcla(c.ch, c.cz, 0.12));
        luzSol.position.copy(FINCA).addScaledVector(dirSol, 700);
        luzSol.intensity = 2.7 * suave(-1, 10, s.alt);
        luzSol.color.set(mezcla('#fff6ea', '#ff9d5c', lim(1 - s.alt / 22, 0, 1)));
        solS.visible = s.alt > -3; solS.material.opacity = lim((s.alt + 3) / 4, 0, 1);
        luzLuna.position.copy(FINCA).addScaledVector(dirLuna, 700);
        luzLuna.intensity = l.alt > 0 ? (0.25 + 0.9 * l.luz) * noche : 0;
        lunaS.visible = l.alt > -1.5 && l.luz > 0.03;
        if (lunaS.visible) { var fk = Math.round(l.fase * 100); if (fk !== faseLuna) { faseLuna = fk; pintarLuna(l.fase); } lunaS.material.opacity = lim((l.alt + 1.5) / 3, 0, 1); }
        hemi.intensity = lerp(0.45, 1.55, dia);
        hemi.color.set(mezcla('#3c4f86', '#dfe8f0', dia)); hemi.groundColor.set(mezcla('#15131c', '#5d5444', dia));
        estrellas.material.opacity = noche * noche;
        uAgua.cZ.value.set(c.cz); uAgua.cH.value.set(c.ch); uAgua.dirSol.value.copy(dirSol); uAgua.dirLuna.value.copy(dirLuna);
        uAgua.colSol.value.copy(luzSol.color); uAgua.brilloSol.value = suave(-2, 6, s.alt);
        uAgua.brilloLuna.value = l.alt > 0 ? l.luz * noche : 0;
        uAgua.luzAgua.value = lerp(0.1, 1, dia);
        // la casa de noche
        var enc = noche > 0.05;
        luzV.visible = enc; luzV.material.opacity = lim(noche * 1.4, 0, 1);
        halos.forEach(function (h) { h.visible = enc; h.material.opacity = noche * 0.9; });
        luzCasa.intensity = noche * 70;
        pabVidrio.emissiveIntensity = noche * 0.35; pabAgua.emissiveIntensity = noche * 0.9;
        pabHalo.visible = enc; pabHalo.material.opacity = noche * 0.7;
        // el faro: se enciende al ponerse el sol; de día, la linterna apagada
        faroLuz = faroEncendido(s.alt);
        vidLinterna.emissiveIntensity = faroLuz * 1.6;
        haces.forEach(function (h) { h.visible = faroLuz > 0.01; });
        destello.visible = faroLuz > 0.01;
        uHaz.intensidad.value = faroLuz * lerp(0.55, 1, noche);
        uAgua.faroLuz.value = faroLuz * noche;
        ren.shadowMap.needsUpdate = true;
        pedir(true);
      }
      // giro del faro: ángulo según la hora (así el ritmo es el real, aunque los fotogramas vayan a saltos)
      var vTmp = new THREE.Vector3();
      function girarFaro() {
        if (faroLuz <= 0.01) return;
        var P = ritmo.periodo_s, t = (ahora().valueOf() / 1000) % P;
        var ang = -2 * Math.PI * t / P;                    // en el sentido de las agujas del reloj visto desde arriba
        giro.rotation.y = ang;
        var dx = Math.cos(ang), dz = -Math.sin(ang);
        uAgua.faroDir.value.set(dx, 0, dz);
        // destello: cuánto apunta algún haz a la cámara
        vTmp.copy(cam.position).sub(FOCO); var dc = vTmp.length(); vTmp.y = 0; vTmp.normalize();
        var best = 0, sep = separacionHaces(ritmo);
        for (var k = 0; k < ritmo.grupo; k++) {
          var a2 = ang - k * sep, cx2 = Math.cos(a2), cz2 = -Math.sin(a2);
          best = Math.max(best, Math.exp(-Math.pow(Math.acos(lim(cx2 * vTmp.x + cz2 * vTmp.z, -1, 1)) / (ANCHO_HAZ * 1.6), 2)));
        }
        var tamD = lim(dc * 0.02, 6, 140);
        destello.scale.set(tamD * (0.5 + 2.5 * best), tamD * (0.5 + 2.5 * best), 1);
        destello.material.opacity = faroLuz * (0.35 + 0.65 * best);
      }

      /* --- cámara: el recorrido con el scroll --- */
      var ruta = camino(m.recorrido);
      var vista = { w: 0, h: 0 };
      var hProm = 0;
      function ajustar() {
        var w = escenario.clientWidth, h = escenario.clientHeight;
        if (!w || !h) return;
        if (vista.w === w && Math.abs(vista.h - h) < 160 && vista.h) { if (vista.h !== h) { vista.h = h; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); pedir(true); } return; }
        vista.w = w; vista.h = h;
        ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
        ren.setSize(w, h, false);
        cam.aspect = w / h;
        cam.fov = w / h < 1 ? 56 : w / h < 1.3 ? 46 : 40;          // en vertical se abre para que quepa el cabo
        cam.updateProjectionMatrix();
        pedir(true);
      }
      var pAnt = -1, tAgua = 0;
      function situar(p) {
        var r = ruta(p);
        cam.position.set(r.pos[0], r.pos[1], r.pos[2]);
        cam.lookAt(r.mira[0], r.mira[1], r.mira[2]);
        var sobre = Math.max(2, r.pos[1] - Math.max(0, yDe(r.pos[0], r.pos[2])));
        var cerca2 = lim(sobre * 0.12, 0.4, 25);
        if (Math.abs(cerca2 - cam.near) / cam.near > 0.1) { cam.near = cerca2; cam.updateProjectionMatrix(); }
        hProm = sobre;
      }
      var v3 = new THREE.Vector3();
      function colocarRotulos(p) {
        var w = vista.w, h = vista.h;
        rotulos.forEach(function (r) {
          var ok = p >= r.l.fase[0] && p <= r.l.fase[1];
          if (ok) {
            v3.copy(r.v).project(cam);
            ok = v3.z < 1 && Math.abs(v3.x) < 0.94 && v3.y > -0.9 && v3.y < 0.92;
            if (ok && LEJANOS.indexOf(r.l.clave) < 0) ok = !tapado(cam.position, r.v);
          }
          if (ok) r.el.style.transform = 'translate3d(' + ((v3.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - v3.y) / 2 * h).toFixed(1) + 'px,0)';
          if (ok !== r.visto) { r.visto = ok; r.el.classList.toggle('es-visible', ok); }
        });
      }

      /* --- bucle: pinta solo si hace falta; se para fuera de pantalla --- */
      var raf = 0, tPrev = 0, activo = false, visible = true, sucio = true, primero = true;
      var fpsEl = null, fN = 0, fT0 = 0, tAc = 0, nAc = 0;
      if (q.has('fps')) { fpsEl = document.createElement('p'); fpsEl.className = 'lugar__fps'; escenario.appendChild(fpsEl); }
      function leerScroll() {
        var r = pista.getBoundingClientRect(), recorrido = pista.offsetHeight - escenario.offsetHeight;
        estado.p = recorrido > 0 ? lim(-r.top / recorrido, 0, 1) : 0;
      }
      function paso(t) {
        raf = 0;
        if (estado.destruido || !activo || !visible) return;
        var dt = tPrev ? Math.min(0.1, (t - tPrev) / 1000) : 0.016; tPrev = t;
        leerScroll();
        var k = reduce ? 1 : 1 - Math.exp(-dt * 5.5);                  // inercia suave, independiente de los fps
        var pV = estado.pVis + (estado.p - estado.pVis) * k;
        if (Math.abs(estado.p - pV) < 0.00005) pV = estado.p;
        var mueve = Math.abs(pV - pAnt) > 0.00001;
        estado.pVis = pV;
        var aguaViva = !reduce && pV < 0.7;
        var faroVivo = !reduce && faroLuz > 0.01;               // de noche el haz gira siempre (aunque no se mueva el scroll)
        if (mueve || sucio || aguaViva || faroVivo) {
          tAgua += dt; uAgua.tiempo.value = tAgua;
          situar(pV);
          girarFaro();
          cielo.position.copy(cam.position); estrellas.position.copy(cam.position);
          solS.position.copy(cam.position).addScaledVector(dirSol, 100000);
          lunaS.position.copy(cam.position).addScaledVector(dirLuna, 100000);
          ren.render(esc3, cam);
          colocarRotulos(pV); marcarParada(pV);
          pAnt = pV; sucio = false;
          if (primero) { primero = false; escenario.classList.add('lugar--listo'); estado.cargado = true; }
          if (fpsEl) { fN++; if (!fT0) fT0 = t; if (t - fT0 > 500) { fpsEl.textContent = (fN * 1000 / (t - fT0)).toFixed(0) + ' fps · calidad ' + estado.calidad + ' · DPR ' + ren.getPixelRatio().toFixed(2) + ' · ' + Math.round(hProm) + ' m · faro ' + (ritmo.neutro ? 'neutro' : ritmo.grupo + '/' + ritmo.periodo_s + ' s'); fN = 0; fT0 = t; } }
          tAc += dt; nAc++;
          if (nAc >= 50) { var media = tAc / nAc; tAc = 0; nAc = 0; if (media > 0.03 && estado.calidad < 2 && !document.hidden) bajarCalidad(); }
        }
        raf = requestAnimationFrame(paso);
      }
      function pedir(ensuciar) { if (ensuciar) sucio = true; if (!raf && activo && visible && !estado.destruido) { tPrev = 0; raf = requestAnimationFrame(paso); } }
      function bajarCalidad() {
        estado.calidad++;
        if (estado.calidad === 1) { ren.setPixelRatio(1); ren.setSize(vista.w, vista.h, false); }
        if (estado.calidad === 2) { ren.shadowMap.enabled = false; luzSol.castShadow = false; ren.setPixelRatio(0.8); ren.setSize(vista.w, vista.h, false); esc3.traverse(function (o) { if (o.material) o.material.needsUpdate = true; }); }
        pedir(true);
      }
      var alRedim = new ResizeObserver(function () { ajustar(); });
      alRedim.observe(escenario);
      var io = new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) pedir(true); else { cancelAnimationFrame(raf); raf = 0; }
      }, { rootMargin: '120px' });
      io.observe(pista);
      escucha(window, 'scroll', function () { pedir(false); }, { passive: true });
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); estado.error3d = 'contexto perdido'; ponModo('plano'); });

      ajustar();
      luces();
      try { ren.compile(esc3, cam); } catch (e) { /* sin compilación previa */ }

      t3 = {
        luces: luces,
        ritmo: function (r) { montarHaces(r); luces(); },
        activo: function (si) { activo = si; cv.hidden = !si; if (si) { vista.w = 0; ajustar(); pedir(true); } else { cancelAnimationFrame(raf); raf = 0; } },
        estado: function () { return { p: estado.p, pVis: estado.pVis, calidad: estado.calidad, near: cam.near, fov: cam.fov, triangulos: ren.info.render.triangles, llamadas: ren.info.render.calls, ventanas: nVen, arboles: arb.length, haces: haces.length, faroLuz: faroLuz, giroFaro: giro.rotation.y }; },
        destruir: function () {
          cancelAnimationFrame(raf); raf = 0; alRedim.disconnect(); io.disconnect();
          disponer.forEach(function (o) { try { o.dispose(); } catch (e) { /* ya */ } });
          esc3.traverse(function (o) { if (o.material && o.material.dispose) o.material.dispose(); });
          try { ren.dispose(); ren.forceContextLoss(); } catch (e) { /* ya */ }
          cv.remove();
        },
      };
      return t3;
    }

    /* ---------- mandos ---------- */
    function activar3d(desdeBoton) {
      ponModo('3d');
      if (desdeBoton) el.scrollIntoView({ block: 'start', behavior: 'auto' });
      cargar3d().then(function (t) { if (t && !estado.destruido && estado.modo === '3d') t.activo(true); });
    }
    $('a3d').addEventListener('click', function () { activar3d(true); });
    $('aplano').addEventListener('click', function () { ponModo('plano'); el.scrollIntoView({ block: 'start', behavior: 'auto' }); });
    var alRedimPlano = new ResizeObserver(function () { colocarMarcas(); });
    alRedimPlano.observe(el);
    escuchas.push(function () { alRedimPlano.disconnect(); });

    cieloTexto();
    aplicarRitmo();
    intervalo = setInterval(function () { if (!document.hidden) cieloTexto(); }, 60000);
    marcarParada(0);
    if (auto3d) activar3d(false); else ponModo('plano');
    el.dataset.montado = '1';

    return {
      destruir: function () {
        estado.destruido = true;
        clearInterval(intervalo);
        escuchas.forEach(function (f) { f(); });
        if (t3) t3.destruir();
        t3 = null;
        el.classList.remove('lugar'); delete el.dataset.modo; delete el.dataset.montado; delete el.dataset.faroRitmo;
        ['--lugar-noche', '--lugar-faro', '--lugar-faro-periodo'].forEach(function (v) { el.style.removeProperty(v); });
        el.innerHTML = respaldo;
      },
      estado: function () { return { modo: estado.modo, puede3d: puede3d, auto3d: auto3d, error3d: estado.error3d, cargado: estado.cargado, ritmo: ritmo, t3: t3 ? t3.estado() : null }; },
      ver3d: function () { activar3d(false); },
      verPlano: function () { ponModo('plano'); },
    };
  }

  A.lugar = { montar: montar, sol: sol, luna: luna, fraseCielo: fraseCielo, cieloPara: cieloPara, camino: camino, monotona: monotona, ritmoFaro: ritmoFaro, separacionHaces: separacionHaces, faroEncendido: faroEncendido };
})();
