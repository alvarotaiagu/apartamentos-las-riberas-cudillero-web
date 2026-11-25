/* ------------------------------------------------------------------
   Apartamentos Las Riberas · Oviñana, Cudillero · «La luz de Vidio» · lo común de la página
   - Monta los módulos con su respaldo: la portada (LasRiberas.portada) al cargar y el 3D (LasRiberas.lugar, del
     agente Lugar 3D) al acercarse (IntersectionObserver, 900 px). Contrato: LasRiberas.<mod>.montar(el, { movimiento,
     densidad, webgl }) → { destruir() }. Si un módulo falla, vuelve su respaldo. Si js/lugar.js no está, se queda el
     respaldo. Eventos: «riberas:resize» (solo los resize de verdad, no la barra del móvil) y «riberas:densidad».
   - Cabecera, menú móvil, el selector de apartamentos, el índice de estancias, «Alrededor», el visor por NOMBRE,
     cookies, el mapa a petición, el foco del teclado con su haz corto, el faro del pie que se enciende y el mando.
   - El buscador y el motor real van en js/reserva.js.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !quieto;
  const sobria = () => raiz.classList.contains('densidad-sobria');
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const A = (window.LasRiberas = window.LasRiberas || {});
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA (checklist punto 10)
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;

  /* ============ 1. titulares que aparecen (solo con movimiento; se observa el CONTENEDOR, checklist 13) ============ */
  const titulares = $$('[data-aparece]');
  if (motion && 'IntersectionObserver' in window) {
    const deCaja = new Map();
    titulares.forEach((h) => { const c = h.parentElement || h; if (!deCaja.has(c)) deCaja.set(c, []); deCaja.get(c).push(h); });
    const vistos = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { (deCaja.get(e.target) || []).forEach((h) => h.classList.add('es-visto')); vistos.unobserve(e.target); }
    }), { rootMargin: '0px 0px -6% 0px' });
    deCaja.forEach((_, c) => vistos.observe(c));
    raiz.classList.add('con-movimiento');
  } else titulares.forEach((h) => h.classList.add('es-visto'));

  /* ============ 2. ir a un sitio ============ */
  const cabAlto = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--cabecera')) || 72;
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - cabAlto() - 8;
    scrollTo({ top: Math.max(0, y), behavior: quieto || sobria() ? 'auto' : 'smooth' });
  };

  /* ============ 3. cabecera: fondo al bajar y el enlace de la sección que se ve (haz corto) ============ */
  const cab = $('#cab');
  const portadaSec = $('#portada');
  const enlaces = $$('.cab__nav a');
  const secciones = enlaces.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  let actual = null;
  function pintarCabecera() {
    const umbral = portadaSec ? portadaSec.offsetHeight - cabAlto() - 2 : 24;
    cab.classList.toggle('sc', scrollY > umbral);
    const y = cabAlto() + altoVista * 0.25;
    let sec = null;
    for (const s of secciones) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) sec = s; }
    if (sec !== actual) {
      actual = sec;
      enlaces.forEach((a) => { if (sec && a.getAttribute('href') === '#' + sec.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    }
  }

  /* ============ 4. módulos: portada (al cargar) y lugar (al acercarse) ============ */
  const montados = new Map();
  const esperando = new Set();
  const modulo = (el) => { const m = A[el.dataset.modulo]; return m && typeof m.montar === 'function' ? m : null; };
  const opciones = () => ({ movimiento: motion && !sobria(), densidad: sobria() ? 'sobria' : 'faro', webgl: !raiz.classList.contains('sin-webgl') });
  function montarModulo(el) {
    if (montados.has(el)) return;
    const mod = modulo(el);
    if (!mod) { esperando.add(el); return; }
    esperando.delete(el);
    const respaldo = el.innerHTML;
    try {
      const inst = mod.montar(el, opciones());
      montados.set(el, { inst, respaldo });
      if (inst && inst.listo && typeof inst.listo.catch === 'function') inst.listo.catch((er) => { console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er); el.innerHTML = respaldo; delete el.dataset.montado; });
    } catch (er) {
      console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er);
      el.innerHTML = respaldo;
      montados.set(el, { inst: null, respaldo });
    }
  }
  const reintentar = () => { if (esperando.size) [...esperando].forEach(montarModulo); };
  addEventListener('load', reintentar);
  function remontarTodos() {
    [...montados].forEach(([el, { inst, respaldo }]) => {
      try { inst && inst.destruir && inst.destruir(); } catch (er) { console.warn(er); }
      el.innerHTML = respaldo;
      delete el.dataset.montado;
      montados.delete(el);
      montarModulo(el);
    });
  }
  const portadaMod = $('#portada [data-modulo="portada"]');
  if (portadaMod) montarModulo(portadaMod);
  const resto = $$('[data-modulo]').filter((el) => el !== portadaMod);
  if ('IntersectionObserver' in window) {
    const ioMod = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioMod.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '900px 0px' });
    resto.forEach((el) => ioMod.observe(el));
  } else resto.forEach(montarModulo);
  // los clics dentro del 3D montado son del módulo
  const deModulo = (t) => !!t.closest('[data-modulo="lugar"][data-montado]');

  /* ============ 5. menú ============ */
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 6. enlaces internos y «Ver fechas de este» (cambia la pista del buscador) ============ */
  A.reservar = function (tipo) {
    if (A.reserva) A.reserva.tipo(tipo || '');
    cerrarMenu();
    irA('#reservar');
  };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || deModulo(e.target)) return;
    const r = e.target.closest('[data-reservar]');
    if (r) { e.preventDefault(); A.reservar(r.getAttribute('data-reservar')); return; }
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const destino = a.getAttribute('href');
    if (destino.length < 2 || !$(destino)) return;
    e.preventDefault();
    cerrarMenu();
    irA(destino);
    setTimeout(() => {
      const t = $(destino);
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }, 900);
  });

  /* ============ 7. los tres apartamentos: selector (sin JS, o en la sobria, se ven las tres fichas) ============ */
  const tabs = $$('.aptos__sel [role="tab"]');
  const fichas = $$('.apto');
  function elegirApto(id, enfocar) {
    tabs.forEach((t) => {
      const si = t.getAttribute('aria-controls') === 'apto-' + id;
      t.setAttribute('aria-selected', String(si));
      t.tabIndex = si ? 0 : -1;
      if (si && enfocar) t.focus();
    });
    fichas.forEach((p) => { p.hidden = p.dataset.apto !== id; });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => elegirApto(t.getAttribute('aria-controls').replace('apto-', '')));
    t.addEventListener('keydown', (e) => {
      const n = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (e.key === 'Home' || e.key === 'End' || n) {
        e.preventDefault();
        const j = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + n + tabs.length) % tabs.length;
        elegirApto(tabs[j].getAttribute('aria-controls').replace('apto-', ''), true);
      }
    });
  });
  if (tabs.length) elegirApto('mirador');

  /* ============ 8. por estancias: el índice marca la que se ve (contenido: también con movimiento reducido) ============ */
  const indice = $$('.estancias__indice a');
  if (indice.length && 'IntersectionObserver' in window) {
    const caja = $('.estancias__indice');
    const marcar = (id) => indice.forEach((a) => {
      if (a.dataset.est === id) {
        a.setAttribute('aria-current', 'true');
        // en móvil el índice es una tira con scroll lateral: que la marcada quede a la vista
        if (caja.scrollWidth > caja.clientWidth + 2) caja.scrollTo({ left: a.offsetLeft - 16, behavior: 'auto' });
      } else a.removeAttribute('aria-current');
    });
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) marcar(e.target.id.replace('est-', '')); }), { rootMargin: '-35% 0px -60% 0px' });
    $$('.estancia').forEach((s) => io.observe(s));
  }

  /* ============ 9. alrededor: elegir un sitio lo marca en el dibujo y saca un haz corto desde la casa ============ */
  const alSvg = $('.al-svg');
  const alBtns = $$('.al-btn');
  function elegirSitio(id) {
    alBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.closest('li').dataset.ruta === id)));
    if (!alSvg) return;
    let dest = null;
    $$('.al-sitio', alSvg).forEach((g) => { const si = g.dataset.ruta === id; g.classList.toggle('es-elegido', si); if (si) dest = g; });
    const [cx, cy] = alSvg.dataset.casa.split(',').map(Number);
    const p = $('.al-haz path', alSvg);
    if (!dest || !p) return;
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(dest.getAttribute('transform'));
    const dx = +m[1] - cx, dy = +m[2] - cy, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L, w = Math.min(16, L * 0.22);
    p.setAttribute('d', `M0 0L${(dx + nx * w).toFixed(1)} ${(dy + ny * w).toFixed(1)}L${(dx - nx * w).toFixed(1)} ${(dy - ny * w).toFixed(1)}Z`);
  }
  alBtns.forEach((b) => b.addEventListener('click', () => elegirSitio(b.closest('li').dataset.ruta)));
  if (alBtns.length) elegirSitio('vidio');

  /* ============ 10. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'lasriberas-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });
  if (!leer()) ck.hidden = false;
  verMando();

  /* ============ 11. mapa de Google solo al pedirlo (sin clave de API) ============ */
  $('#mapa-btn').addEventListener('click', () => {
    const marco = document.createElement('iframe');
    const q = $('#mapa').dataset.q || 'Apartamentos Las Riberas, Vivigo, Oviñana, Cudillero, Asturias';
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&z=14&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con Apartamentos Las Riberas en Vivigo, Oviñana';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-btn').remove();
  });

  /* ============ 12. visor de fotos: se abre por el NOMBRE de la foto (checklist 11) ============ */
  const visor = $('#visor');
  const vImg = $('#visor-img'), vPie = $('#visor-pie'), vN = $('#visor-n');
  const FOTOS = new Map();
  fetch('img/fotos/fotos.json').then((r) => r.json()).then((l) => l.forEach((f) => FOTOS.set(f.nombre, f))).catch(() => {});
  function infoFoto(n) {
    const img = $('picture[data-foto="' + n + '"] img');
    const f = FOTOS.get(n);
    let anchos = f ? f.anchos.slice() : null, ancho = f ? f.ancho : 0, alto = f ? f.alto : 0, alt = '', alfa = f ? f.alfa : false;
    if (img) {
      const a = (img.getAttribute('srcset') || '').split(',').map((x) => parseInt(x.trim().split(/\s+/)[1], 10)).filter(Boolean).sort((p, q) => p - q);
      if (a.length) anchos = a;
      ancho = +img.getAttribute('width') || ancho; alto = +img.getAttribute('height') || alto;
      alt = img.alt;
    }
    return { n, alt, pie: alt, anchos: anchos && anchos.length ? anchos : [800], ancho: ancho || 800, alto: alto || 533, ext: alfa ? 'webp' : 'jpg' };
  }
  let lista = [], actualV = 0, origen = null;
  function poner(i) {
    actualV = (i + lista.length) % lista.length;
    const f = lista[actualV];
    const peq = f.anchos.includes(800) ? 800 : f.anchos[0];
    const gran = f.anchos.filter((w) => w <= 1920).pop() || f.anchos[f.anchos.length - 1];
    // primero la de 800 (ya en caché o ligera) y la grande al cargar
    vImg.src = `img/fotos/${f.n}-${peq}.${f.ext}`;
    vImg.dataset.nombre = f.n;
    vImg.alt = f.alt;
    vImg.width = f.ancho; vImg.height = f.alto;
    if (gran !== peq) {
      const grande = new Image();
      grande.onload = () => { if (vImg.dataset.nombre === f.n) vImg.src = grande.src; };
      grande.src = `img/fotos/${f.n}-${gran}.${f.ext}`;
    }
    vPie.textContent = f.pie;
    vN.textContent = (actualV + 1) + ' / ' + lista.length;
  }
  function abrirVisor(nombres, nombre, desde) {
    if (!visor || typeof visor.showModal !== 'function') return;
    const vistos = new Set();
    lista = [];
    (nombres || []).forEach((x) => {
      const n = typeof x === 'string' ? x : x.nombre || x.n;
      if (!n || vistos.has(n)) return;
      vistos.add(n);
      lista.push(infoFoto(n));
    });
    if (!lista.length) return;
    let i = lista.findIndex((f) => f.n === nombre);
    if (i < 0) i = 0;
    origen = desde || document.activeElement;
    poner(i);
    if (!visor.open) visor.showModal();
  }
  A.visor = { abrir: (l, n) => abrirVisor(l, n) };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || deModulo(e.target)) return;
    const b = e.target.closest('[data-visor]');
    if (!b) return;
    let nombres;
    if (b.dataset.lista) nombres = b.dataset.lista.split(',');
    else {
      const g = b.getAttribute('data-grupo');
      nombres = (g ? $$('[data-visor][data-grupo="' + g + '"]') : [b]).map((x) => x.dataset.visor);
    }
    abrirVisor(nombres, b.dataset.visor, b);
  });
  if (visor) {
    $('#visor-ant').addEventListener('click', () => poner(actualV - 1));
    $('#visor-sig').addEventListener('click', () => poner(actualV + 1));
    $('#visor-cerrar').addEventListener('click', () => visor.close());
    visor.addEventListener('click', (e) => { if (e.target === visor || e.target.classList.contains('visor__fig')) visor.close(); });
    visor.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') poner(actualV - 1); else if (e.key === 'ArrowRight') poner(actualV + 1); });
    visor.addEventListener('close', () => { if (origen && document.contains(origen)) origen.focus({ preventScroll: true }); });
  }

  /* ============ 13. el foco del teclado: contorno de 2 px y un haz corto que nace a su izquierda ============ */
  const marco = $('#foco-haz');
  const pCono = marco && marco.querySelector('.foco-haz__cono');
  const pMarco = marco && marco.querySelector('.foco-haz__marco');
  let enfocado = null;
  function ponerMarco() {
    if (!marco) return;
    const el = enfocado;
    if (!el || !document.contains(el) || el.closest('dialog')) { marco.classList.remove('es-visible'); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { marco.classList.remove('es-visible'); return; }
    const fijo = !!el.closest('.cab, .cookies, .mando, .menu-movil, .saltar');
    const m = 6, L = 22;   // el contorno va a 4 + 2 px; el haz, 22 px a la izquierda
    const w = Math.round(r.width + 2 * m), h = Math.round(r.height + 2 * m), W = w + L;
    marco.classList.toggle('es-fijo', fijo);
    marco.style.left = (r.left - m - L + (fijo ? 0 : scrollX)) + 'px';
    marco.style.top = (r.top - m + (fijo ? 0 : scrollY)) + 'px';
    marco.style.width = W + 'px'; marco.style.height = h + 'px';
    marco.setAttribute('viewBox', `0 0 ${W} ${h}`);
    const a = Math.min(h / 2 - 2, 10);
    pCono.setAttribute('d', `M0 ${h / 2 - 1}L${L - 3} ${h / 2 - a}V${h / 2 + a}L0 ${h / 2 + 1}Z`);
    const rr = Math.min(10, h / 2 - 1);
    pMarco.setAttribute('d', `M${L + 1 + rr} 1H${W - 1 - rr}A${rr} ${rr} 0 0 1 ${W - 1} ${1 + rr}V${h - 1 - rr}A${rr} ${rr} 0 0 1 ${W - 1 - rr} ${h - 1}H${L + 1 + rr}A${rr} ${rr} 0 0 1 ${L + 1} ${h - 1 - rr}V${1 + rr}A${rr} ${rr} 0 0 1 ${L + 1 + rr} 1Z`);
    marco.style.color = getComputedStyle(el).getPropertyValue('--foco').trim() || '#2D475E';
    marco.classList.add('es-visible');
  }
  let tFoco = 0;
  const mirarFoco = () => {
    clearTimeout(tFoco);
    tFoco = setTimeout(() => {
      const el = document.activeElement;
      let visible = false;
      try { visible = !!el && el !== document.body && el.matches(':focus-visible'); } catch (er) {}
      enfocado = visible ? el : null;
      ponerMarco();
    }, 0);
  };
  document.addEventListener('focusin', mirarFoco);
  document.addEventListener('focusout', mirarFoco);

  /* ============ 14. el pie: el faro se enciende al llegar (con movimiento reducido o en la sobria, ya encendido) ============ */
  const pieFaro = $('.pie__faro');
  if (pieFaro) {
    if (motion && !sobria() && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { pieFaro.classList.add('es-encendido'); io.disconnect(); } }, { rootMargin: '0px 0px -12% 0px' });
      io.observe(pieFaro);
    } else pieFaro.classList.add('es-encendido');
  }

  /* ============ 15. con el scroll (un rAF por fotograma, pasivo): cabecera, módulos que esperan y el foco fijo ============ */
  let pend = 0;
  function alScroll() {
    pend = 0;
    pintarCabecera();
    reintentar();
    if (enfocado && marco.classList.contains('es-fijo')) ponerMarco();
  }
  addEventListener('scroll', () => { if (!pend) pend = requestAnimationFrame(alScroll); }, { passive: true });
  alScroll();

  /* ============ 16. MANDO DE MAQUETA (no viaja al cliente) ============ */
  if (mando && raiz.classList.contains('revision')) {
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === sobria())));
    botones.forEach((b) => b.addEventListener('click', () => {
      const antes = sobria();
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (antes === sobria()) return;
      if (sobria() && pieFaro) pieFaro.classList.add('es-encendido');
      remontarTodos();
      document.dispatchEvent(new CustomEvent('riberas:densidad', { detail: sobria() ? 'sobria' : 'faro' }));
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  /* ============ 17. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      document.dispatchEvent(new CustomEvent('riberas:resize'));
      alScroll();
      ponerMarco();
    }, 200);
  });

  // recargar a media página: se entra arriba (checklist 12)
  addEventListener('pageshow', () => { if (!location.hash && scrollY > 0) scrollTo(0, 0); });

  // lo que pueden usar los módulos y las pruebas
  A.web = { motion, quieto, sobria, irA, montados, get altoVista() { return altoVista; } };
  document.dispatchEvent(new CustomEvent('riberas:web'));
})();
