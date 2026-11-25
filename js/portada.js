/* =====================================================================
   Apartamentos Las Riberas · portada.js · «La luz de Vidio»
   window.LasRiberas.portada.montar(el, { movimiento, densidad, webgl }) → { destruir(), estado }
   - La noche (--n, de 0 a 1) sale del sol de AHORA en Cudillero (fórmulas de SunCalc): de día el cielo es azul y el
     haz tenue; de noche, azul de noche, la fachada a oscuras y el haz manda. Es contenido: se calcula también con
     movimiento reducido y en la sobria. ?hora=noche, ?hora=dia o ?hora=AAAA-MM-DDTHH:MM para mirarlo a otra hora.
   - Con movimiento: el haz gira (un giro cada `periodo` segundos: data/faro.json si existe; si no, giro lento neutro)
     y ENCIENDE el titular y la fachada por donde pasa: dos copias de la escena recortadas por la cuña del haz, que
     gira con él mientras la copia gira al revés (queda quieta en su sitio). Máscara, no un foco pegado encima.
   - Gesto (§5 bis): arrastrar en horizontal sobre la portada gira el faro a mano; al soltar sigue con inercia y vuelve
     a su ritmo. touch-action: pan-y (el scroll vertical sigue siendo de la página).
   - Al bajar, las capas se separan: el titular sube más deprisa que la página y la fachada se queda atrás.
   - El HTML de `el` es el respaldo (la escena quieta): al destruir se quita todo lo creado.
   ===================================================================== */
(function () {
  'use strict';
  const A = (window.LasRiberas = window.LasRiberas || {});
  const LAT = 43.5773554, LON = -6.2490802, RAD = Math.PI / 180;
  const PERIODO_NEUTRO = 12;   // el mismo giro neutro que usa el 3D (js/lugar.js) mientras no haya ritmo oficial
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- el sol (altura en grados sobre el horizonte), fórmulas de SunCalc (V. Agafonkin, BSD) ---------- */
  function altSol(fecha) {
    const d = fecha.valueOf() / 864e5 - 0.5 + 2440588 - 2451545;
    const M = RAD * (357.5291 + 0.98560028 * d);
    const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + RAD * 102.9372 + Math.PI;
    const e = RAD * 23.4397;
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
    const H = RAD * (280.16 + 360.9856235 * d) - RAD * -LON - ra;
    const phi = RAD * LAT;
    return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD;
  }
  // de +4° (aún de día) a −8° (noche cerrada): la noche sube poco a poco con el crepúsculo
  const nocheDe = (alt) => lim((4 - alt) / 12, 0, 1);
  function nocheAhora() {
    let pedida = null;
    try { pedida = new URLSearchParams(location.search).get('hora'); } catch (e) {}
    if (pedida === 'noche') return { n: 1, alt: -30, pedida };
    if (pedida === 'dia') return { n: 0, alt: 30, pedida };
    let f = new Date();
    if (pedida && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(pedida)) { const g = new Date(pedida); if (!isNaN(g)) f = g; }
    const alt = altSol(f);
    return { n: +nocheDe(alt).toFixed(3), alt: +alt.toFixed(2), pedida };
  }

  let periodo = PERIODO_NEUTRO, fuenteRitmo = 'neutro';
  const ritmo = fetch('data/faro.json').then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (j && j.periodo_s > 0) { periodo = j.periodo_s; fuenteRitmo = j.fuente || 'data/faro.json'; }
  }).catch(() => {});

  function montar(el, op) {
    op = op || {};
    const portada = el.closest('.portada') || el;
    const estado = { n: 0, alt: 0, giro: 196, vel: 0, periodo, ritmo: fuenteRitmo, activo: false, encendidas: false };
    const pintarNoche = () => { const r = nocheAhora(); estado.n = r.n; estado.alt = r.alt; portada.style.setProperty('--n', r.n); portada.dataset.noche = r.n >= 0.5 ? 'si' : 'no'; };
    pintarNoche();
    const reloj = setInterval(pintarNoche, 60000);

    const quieto = !op.movimiento || op.densidad === 'sobria';
    if (quieto) {
      el.dataset.montado = '1';
      return { estado, destruir() { clearInterval(reloj); delete el.dataset.montado; portada.style.removeProperty('--n'); } };
    }

    /* ---------- las copias encendidas ---------- */
    const faro = el.querySelector('.portada__faro');
    const texto = el.querySelector('.portada__texto');
    const foto = el.querySelector('.portada__foto');
    const haz = el.querySelector('.portada__haz');
    const div = (c) => { const d = document.createElement('div'); d.className = c; return d; };
    function capa(clase, nodo, despues) {
      const luz = div('portada__luz ' + clase), cuna = div('portada__cuna'), contra = div('portada__contra');
      const copia = nodo.cloneNode(true);
      copia.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      copia.querySelectorAll('img').forEach((i) => { i.alt = ''; i.removeAttribute('fetchpriority'); i.loading = 'eager'; });
      copia.setAttribute('aria-hidden', 'true');
      copia.inert = true;
      contra.appendChild(copia); cuna.appendChild(contra); luz.appendChild(cuna);
      despues.after(luz);
      return { luz, cuna, contra, copia };
    }
    const cTit = capa('portada__luz--tit', texto, texto);
    const cFoto = capa('portada__luz--foto', foto, foto);
    estado.encendidas = true;

    let fx = 0, fy = 0;
    function medir() {
      const e = el.getBoundingClientRect(), r = faro.getBoundingClientRect();
      fx = r.left - e.left + r.width * (+faro.dataset.lx || 0.5);
      fy = r.top - e.top + r.height * (+faro.dataset.ly || 0.25);
      el.style.setProperty('--fx', fx.toFixed(1) + 'px');
      el.style.setProperty('--fy', fy.toFixed(1) + 'px');
      el.style.setProperty('--esc-w', e.width.toFixed(1) + 'px');
      el.style.setProperty('--esc-h', e.height.toFixed(1) + 'px');
      for (const c of [cTit, cFoto]) {
        const h = c.cuna.offsetHeight;
        c.contra.style.left = (-fx).toFixed(1) + 'px';
        c.contra.style.top = (h / 2 - fy).toFixed(1) + 'px';
        c.contra.style.transformOrigin = `${fx.toFixed(1)}px ${fy.toFixed(1)}px`;
      }
    }
    medir();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir).catch(() => {});

    /* ---------- el gesto: girar el faro con el dedo o el ratón ---------- */
    let arrastre = null;
    const abajo = (e) => {
      if (e.button > 0 || e.target.closest('a, button')) return;
      arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), girando: false };
    };
    const mueve = (e) => {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
      if (!arrastre.girando) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) { if (Math.abs(dy) > 10) arrastre = null; return; }
        arrastre.girando = true;
        try { el.setPointerCapture(e.pointerId); } catch (er) {}
        portada.classList.add('es-girando');
      }
      const ahora = performance.now(), dt = Math.max(1, ahora - arrastre.t);
      const d = dx * 0.45;
      estado.giro += d;
      estado.vel = lim(d / dt * 1000, -900, 900);   // grados por segundo al soltar
      arrastre.x = e.clientX; arrastre.y = e.clientY; arrastre.t = ahora;
      pintar();
    };
    const arriba = (e) => {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      arrastre = null; portada.classList.remove('es-girando');
    };
    el.addEventListener('pointerdown', abajo);
    el.addEventListener('pointermove', mueve);
    el.addEventListener('pointerup', arriba);
    el.addEventListener('pointercancel', arriba);

    /* ---------- el bucle (solo con la portada en pantalla y la pestaña visible) ---------- */
    let raf = 0, t0 = 0, visible = true, ultimoY = -1;
    const alto = () => el.offsetHeight || innerHeight;
    function pintar() {
      const g = estado.giro.toFixed(2);
      haz.style.transform = `rotate(${g}deg)`;
      cTit.luz.style.transform = cFoto.luz.style.transform = `rotate(${g}deg)`;
      cTit.contra.style.transform = cFoto.contra.style.transform = `rotate(${(-estado.giro).toFixed(2)}deg)`;
    }
    function separar() {
      const y = Math.min(scrollY, alto());
      if (y === ultimoY) return;
      ultimoY = y;
      const t = `translate3d(0, ${(-y * 0.22).toFixed(1)}px, 0)`, f = `translate3d(0, ${(y * 0.1).toFixed(1)}px, 0)`;
      texto.style.transform = cTit.copia.style.transform = t;
      foto.style.transform = cFoto.copia.style.transform = f;
    }
    function paso(t) {
      raf = requestAnimationFrame(paso);
      const dt = t0 ? Math.min(0.05, (t - t0) / 1000) : 0;
      t0 = t;
      if (!arrastre || !arrastre.girando) {
        const base = -360 / periodo;   // gira hacia la izquierda: de la casa al titular
        estado.vel += (0 - estado.vel) * Math.min(1, dt * 1.6);   // la inercia se apaga y vuelve a su ritmo
        estado.giro += (base + estado.vel) * dt;
      }
      estado.giro = ((estado.giro % 360) + 360) % 360;
      pintar();
      separar();
    }
    const arrancar = () => { if (!raf && visible && !document.hidden) { t0 = 0; estado.activo = true; raf = requestAnimationFrame(paso); } };
    const parar = () => { if (raf) cancelAnimationFrame(raf); raf = 0; estado.activo = false; };
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) arrancar(); else parar(); }) : null;
    if (io) io.observe(el);
    const alVer = () => { if (document.hidden) parar(); else arrancar(); };
    document.addEventListener('visibilitychange', alVer);
    const alResize = () => { medir(); ultimoY = -1; };
    document.addEventListener('riberas:resize', alResize);
    ritmo.then(() => { estado.periodo = periodo; estado.ritmo = fuenteRitmo; });
    portada.classList.add('es-luz');
    el.dataset.montado = '1';
    pintar();
    arrancar();

    return {
      estado,
      destruir() {
        parar();
        clearInterval(reloj);
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', alVer);
        document.removeEventListener('riberas:resize', alResize);
        el.removeEventListener('pointerdown', abajo);
        el.removeEventListener('pointermove', mueve);
        el.removeEventListener('pointerup', arriba);
        el.removeEventListener('pointercancel', arriba);
        cTit.luz.remove(); cFoto.luz.remove();
        haz.style.transform = ''; texto.style.transform = ''; foto.style.transform = '';
        ['--fx', '--fy', '--esc-w', '--esc-h'].forEach((v) => el.style.removeProperty(v));
        portada.classList.remove('es-luz', 'es-girando');
        portada.style.removeProperty('--n');
        delete el.dataset.montado;
      },
    };
  }

  A.portada = { montar, altSol, nocheDe };
})();
