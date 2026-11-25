/* =====================================================================
   Apartamentos Las Riberas · reserva.js: el buscador propio y su MOTOR REAL (Redforts) en un iframe.
   - Calendario propio (dos meses en escritorio, uno en móvil) de llegada y salida. Redforts no recibe personas por URL
     (`adults=` no hace nada, comprobado al leer su motor): se eligen dentro.
   - Fechas por URL (comprobado): https://booking.redforts.com/es/iframe/i8ZN/?arrival=AAAA-MM-DD&departure=AAAA-MM-DD.
     Sin fechas, el motor sin parámetros.
   - El iframe NO existe hasta que alguien pulsa «Buscar en su motor» o «Abrir su calendario sin fechas». Lo que se
     reserve dentro es REAL. Al lado, siempre, «Abrir el motor en otra pestaña» con la misma dirección (Safari puede
     bloquear su cookie de sesión dentro del iframe).
   - LasRiberas.reserva: { estado, urlMotor(), abrir(conFechas), tipo(id), fechas(a, b) }. «Ver fechas de este» de
     cada ficha llama a tipo(id): cambia la pista (cómo se llama ese apartamento en su motor).
   ===================================================================== */
(function () {
  'use strict';
  const A = (window.LasRiberas = window.LasRiberas || {});
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const MOTOR = 'https://booking.redforts.com/es/iframe/i8ZN/';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const SEM = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const DIAS_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const PISTA = {
    '': 'En su motor eliges el apartamento y cuántos sois.',
    mirador: 'En su motor sale como «Apartamento Mirador» (hasta 4 personas).',
    familiar: 'En su motor sale como «Apartamento Familiar» (hasta 6 personas).',
    deluxe: 'En su motor sale como «Apartamento Deluxe con Jacuzzi» (2 adultos y 2 niños).',
  };

  const form = $('#busca');
  const calEl = $('#cal');
  const motor = $('#motor');
  if (!form || !calEl || !motor) return;

  const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const mas = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const igual = (a, b) => !!a && !!b && a.getTime() === b.getTime();
  const noches = (a, b) => Math.round((b - a) / 864e5);
  const dd = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
  const corto = (d) => `${DIAS_C[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
  const largo = (d) => `${DIAS_L[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;

  const estado = { entrada: null, salida: null, espera: 'entrada', sobre: null, tipo: '' };
  const h0 = hoy();
  let ver = new Date(h0.getFullYear(), h0.getMonth(), 1);
  let foco = null;
  const nMeses = () => (matchMedia('(min-width: 700px)').matches ? 2 : 1);

  /* ---------------- calendario ---------------- */
  function pintar(enfocar) {
    const h = hoy(), n = nMeses();
    const min = new Date(h.getFullYear(), h.getMonth(), 1);
    const max = new Date(h.getFullYear() + 1, h.getMonth(), 1);   // un año por delante, como su motor
    let html = `<div class="cal__nav"><button type="button" class="cal__flecha" data-nav="-1" aria-label="Mes anterior"${ver <= min ? ' disabled' : ''}><svg class="ico" aria-hidden="true"><use href="#i-flecha-izq"/></svg></button>`
      + `<button type="button" class="cal__flecha" data-nav="1" aria-label="Mes siguiente"${new Date(ver.getFullYear(), ver.getMonth() + n, 1) > max ? ' disabled' : ''}><svg class="ico" aria-hidden="true"><use href="#i-flecha-der"/></svg></button></div>`;
    html += `<div class="cal__meses" style="--meses:${n}">`;
    const f0 = foco || estado.entrada || h;
    for (let m = 0; m < n; m++) {
      const ini = new Date(ver.getFullYear(), ver.getMonth() + m, 1);
      const dias = new Date(ini.getFullYear(), ini.getMonth() + 1, 0).getDate();
      const hueco = (ini.getDay() + 6) % 7;
      html += `<div class="cal__mes"><p class="cal__tit">${MESES[ini.getMonth()]} ${ini.getFullYear()}</p><div class="cal__sem" aria-hidden="true">${SEM.map((x) => `<span>${x}</span>`).join('')}</div><div class="cal__dias">`;
      for (let i = 0; i < hueco; i++) html += '<span></span>';
      for (let i = 1; i <= dias; i++) {
        const d = new Date(ini.getFullYear(), ini.getMonth(), i);
        const pasado = d < h;
        html += `<button type="button" data-d="${d.getTime()}" data-k="${iso(d)}" tabindex="${igual(d, f0) ? 0 : -1}"${pasado ? ' disabled' : ''}${igual(d, h) ? ' class="es-hoy"' : ''} aria-label="${largo(d)}${igual(d, h) ? ', hoy' : ''}">${i}</button>`;
      }
      html += '</div></div>';
    }
    html += '</div>';
    calEl.innerHTML = html;
    if (!calEl.querySelector('button[data-d][tabindex="0"]')) { const p = calEl.querySelector('button[data-d]:not([disabled])'); if (p) p.tabIndex = 0; }
    marcar();
    if (enfocar && foco) { const b = calEl.querySelector(`button[data-d="${foco.getTime()}"]`); if (b) { $$('button[data-d]', calEl).forEach((x) => (x.tabIndex = -1)); b.tabIndex = 0; b.focus(); } }
  }
  function marcar() {
    const { entrada, salida, sobre } = estado;
    const fin = salida || (sobre && entrada && sobre > entrada ? sobre : null);
    $$('button[data-d]', calEl).forEach((b) => {
      const d = new Date(+b.dataset.d);
      const ini = igual(d, entrada), ult = igual(d, salida);
      b.classList.toggle('es-ini', ini);
      b.classList.toggle('es-fin', ult || (!salida && igual(d, fin)));
      b.classList.toggle('es-entre', !!(entrada && fin && d > entrada && d < fin));
      b.setAttribute('aria-pressed', String(ini || ult));
    });
  }
  function mover(n, enfocar) {
    const h = hoy();
    const v = new Date(ver.getFullYear(), ver.getMonth() + n, 1);
    if (v < new Date(h.getFullYear(), h.getMonth(), 1) || v > new Date(h.getFullYear() + 1, h.getMonth(), 1)) return;
    ver = v; pintar(enfocar);
  }
  calEl.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav && !nav.disabled) { mover(+nav.dataset.nav); return; }
    const b = e.target.closest('button[data-d]');
    if (b && !b.disabled) elegir(new Date(+b.dataset.d));
  });
  calEl.addEventListener('pointerover', (e) => {
    const b = e.target.closest('button[data-d]');
    if (!b || estado.espera !== 'salida' || !estado.entrada) return;
    estado.sobre = new Date(+b.dataset.d); marcar();
  });
  calEl.addEventListener('pointerleave', () => { estado.sobre = null; marcar(); });
  calEl.addEventListener('keydown', (e) => {
    const b = e.target.closest('button[data-d]');
    if (!b) return;
    const salto = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!salto) return;
    e.preventDefault();
    let d = mas(new Date(+b.dataset.d), salto);
    if (d < hoy()) d = hoy();
    foco = d;
    const ultimoVisible = new Date(ver.getFullYear(), ver.getMonth() + nMeses(), 0);
    if (d > ultimoVisible) mover(1, true); else if (d < ver) mover(-1, true); else pintar(true);
  });
  function elegir(d) {
    if (estado.espera === 'entrada' || !estado.entrada || d <= estado.entrada) { estado.entrada = d; estado.salida = null; estado.espera = 'salida'; }
    else { estado.salida = d; estado.espera = 'entrada'; }
    estado.sobre = null; foco = d;
    actualizar();
  }

  /* ---------------- textos ---------------- */
  function actualizar() {
    const { entrada, salida } = estado;
    $$('[data-fecha="entrada"]', form).forEach((e) => (e.textContent = entrada ? corto(entrada) : 'Elige día'));
    $$('[data-fecha="salida"]', form).forEach((e) => (e.textContent = salida ? corto(salida) : 'Elige día'));
    const n = entrada && salida ? noches(entrada, salida) : 0;
    $('[data-noches]', form).textContent = n ? `${n} ${n === 1 ? 'noche' : 'noches'}` : '';
    let r;
    if (!entrada) r = 'Elige el día de llegada.';
    else if (!salida) r = `Llegada el ${largo(entrada)}. Ahora, el día de salida.`;
    else r = `Del ${largo(entrada)} al ${largo(salida)}.`;
    $('[data-resumen]', form).textContent = r;
    if (!iframe) $('#motor-fuera').href = urlMotor(true);
    $('[data-pista]', form).textContent = PISTA[estado.tipo] || PISTA[''];
    marcar();
  }

  /* ---------------- el motor ---------------- */
  let iframe = null;
  function urlMotor(conFechas) {
    if (conFechas === false || !(estado.entrada && estado.salida)) return MOTOR;
    const p = new URLSearchParams({ arrival: iso(estado.entrada), departure: iso(estado.salida) });
    return MOTOR + '?' + p.toString();
  }
  function abrir(conFechas) {
    const url = urlMotor(conFechas);
    const vacio = $('#motor-vacio');
    if (vacio) vacio.remove();
    motor.classList.add('esta-cargando');
    $('#motor-estado').textContent = 'Abriendo su motor de reservas…';
    $('#motor-fuera').href = url;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.className = 'motor__iframe';
      iframe.id = 'motor-iframe';
      iframe.title = 'Motor de reservas de Apartamentos Las Riberas (Redforts, reservas reales)';
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      iframe.setAttribute('allow', 'payment');
      iframe.addEventListener('load', () => {
        motor.classList.remove('esta-cargando');
        const { entrada, salida } = estado;
        $('#motor-estado').textContent = iframe.dataset.fechas === '1' ? `Su motor, con tus fechas: del ${corto(entrada)} al ${corto(salida)}. Elige allí el apartamento y cuántos sois.` : 'Su motor, en su calendario: elige allí las fechas.';
      });
      motor.insertBefore(iframe, $('#motor-fuera-p'));
    }
    iframe.dataset.fechas = url === MOTOR ? '0' : '1';
    iframe.src = url;
    motor.dataset.url = url;
    return url;
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!(estado.entrada && estado.salida)) {
      $('[data-resumen]', form).textContent = estado.entrada ? 'Falta el día de salida.' : 'Falta el día de llegada.';
      const b = calEl.querySelector('button[data-d][tabindex="0"]'); if (b) b.focus();
      return;
    }
    abrir(true);
    motor.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  $('#motor-sin-fechas').addEventListener('click', () => abrir(false));

  let anchoVista = innerWidth;
  addEventListener('resize', () => { if (innerWidth === anchoVista) return; anchoVista = innerWidth; pintar(); });   // la barra del móvil no rehace nada
  pintar();
  actualizar();

  A.reserva = {
    estado, urlMotor, abrir,
    tipo(id) { if (id in PISTA) { estado.tipo = id; actualizar(); } },
    fechas(a, b) { estado.entrada = a ? new Date(a + 'T00:00') : null; estado.salida = b ? new Date(b + 'T00:00') : null; estado.espera = 'entrada'; if (estado.entrada) ver = new Date(estado.entrada.getFullYear(), estado.entrada.getMonth(), 1); pintar(); actualizar(); },
  };
})();
