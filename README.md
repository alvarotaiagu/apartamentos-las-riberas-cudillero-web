# Apartamentos Las Riberas · «La luz de Vidio»

Propuesta de web para **Apartamentos Las Riberas**, apartamentos rurales en Vivigo (Oviñana, Cudillero, Asturias),
junto a los acantilados de Cabo Vidio. Tienen web (WordPress, apartamentoslasriberas.com, con spam de casinos
inyectado) y no han encargado esta. Una sola página (`index.html`) más legales y 404. **En local, sin publicar y sin
commits.** `noindex, nofollow` en todas las páginas. Solo castellano.

Datos: `ref/DATOS-LAS-RIBERAS.md` (lo que no está ahí va a `PENDIENTES.md` o se marca «por confirmar»). Encargo:
`ENCARGO.md`. El 3D («Del faro a la casa») es del agente Lugar 3D: sus notas, en [`LUGAR.md`](LUGAR.md).

## El concepto: «La luz de Vidio»

El faro de su logo es el de Cabo Vidio, a 1,8 km en línea recta de la casa. La portada es ese faro, redibujado en
grande, plantado detrás del tejado de la casa; su luz gira y **el haz barre la fachada y enciende el titular a su
paso**: dos copias de la escena (el titular y la fachada, más claras y cálidas) recortadas por la cuña del haz. La cuña
gira con el haz y la copia gira al revés, así que queda quieta en su sitio: lo que se ve es una máscara que pasa, no un
foco pegado encima. La escena tiene **la hora real de Cudillero** (el sol, con las fórmulas de SunCalc): de día el
cielo es azul, la fachada luce y el haz es tenue; con el crepúsculo todo baja a azul de noche, la fachada se apaga y el
haz manda. Profundidad, no tarjeta sobre foto: la fachada es la foto **sin su cielo** (recortada por
`scripts/portada-recorte.py`), el titular va detrás del faro y, al bajar, las capas se separan (el titular sube más
deprisa que la página, la fachada se queda atrás).

El ritmo del haz es el de `data/faro.json`: **un destello cada 5 s** (OpenStreetMap, referencia D 1641 del Libro de
Faros; falta la fuente oficial, ver `PENDIENTES.md`). Una vuelta del haz = un destello.

El resto de la web hereda el haz **con mesura**: un **haz corto** (una cuña de luz que se abre hacia la palabra) marca
lo activo (el enlace de la cabecera, el apartamento elegido, la estancia que se ve, el sitio elegido en «Alrededor»), el
foco del teclado lleva su haz corto a la izquierda y el faro del pie **se enciende** al llegar. Las tres olas del logo
solo salen dentro del logo.

Lectura de diseño (skill `design-taste-frontend`): web de alojamiento rural premium para quien decide y reserva, con
lenguaje de marca (el faro y su luz); dials 7 / 6 / 3. Tres campos oscuros (la portada, el lugar y el pie) sobre una
página clara y fría. Un solo radio (14 px, el de la cornisa y el balcón del faro) y botones en píldora (el remate).
Arquitectura de Amaicha en HTML/CSS/JS sin librerías (la skill sugiere React/Tailwind; manda el PLIEGO y el utillaje de
la carpeta).

### Las letras (Google Fonts, `display=swap`, tres y ninguna más)

Ninguna está en la cartera (`verificar.mjs` lo comprueba con un grep en `../*-web`, `-bocetos` y `-tienda`):

- **Parkinsans** (titulares): geométrica de formas llenas, de la familia de las letras de su logo sin imitarlas.
- **Radio Canada Big** (texto): grotesca abierta y muy legible.
- **Inconsolata** (cifras: personas, minutos, km, la nota, el calendario), estrechada al 92 %.

### Los colores (seis, ninguno más; el resto son mezclas `color-mix`)

| Token | Color | Uso |
|---|---|---|
| `--marino` | `#2D475E` | el del faro y las letras del logo (mediana de sus píxeles): titulares de marca, iconos, filetes |
| `--luz` | `#FDCF60` | la linterna del faro: el acento (botón de reservar, el haz, lo activo en oscuro) |
| `--ola` | `#84CDE4` | las olas del logo: solo dibujo, nunca texto |
| `--bruma` | `#EEF3F6` | fondo, frío (no crema) |
| `--niebla` | `#DCE6EC` | superficie: piscina, reseñas, condiciones, el mapa |
| `--noche` | `#0E1C2A` | texto y campos oscuros (la portada de noche, el lugar, el pie) |

Contrato con Lugar 3D: `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--marca` (= marino), `--acento`
(= luz), `--ola`, `--linea`, `--letra-titular`, `--letra-texto`, `--letra-cifras`, en `:root` de `css/base.css`.
**`#lugar` es campo oscuro**: dentro se redefinen `--fondo`, `--texto`, `--texto-suave`, `--linea`, `--superficie`,
`--marca` y `--foco` para fondo noche (en Amaicha el texto del 3D salió ilegible por no hacerlo).

## Las secciones

1. **Portada «La luz de Vidio»** (`js/portada.js`, `LasRiberas.portada`). Respaldo (sin JS, movimiento reducido y
   versión sobria): la misma escena con el haz quieto. La noche se calcula también con movimiento reducido (es
   contenido). Gesto (§5 bis): **arrastrar en horizontal gira el faro a mano**; al soltar sigue con inercia y vuelve a
   su ritmo (`touch-action: pan-y`). `?hora=noche`, `?hora=dia` o `?hora=AAAA-MM-DDTHH:MM` para mirarla a otra hora
   (el 3D acepta el mismo parámetro).
2. **Tres tipos de apartamento**: un selector a la izquierda (cifra grande de personas; el elegido, con el haz corto) y
   la ficha: foto (como mucho 800 px), cifras grandes (personas, dormitorios, baños), lo propio de cada uno con icono
   propio (vistas al faro; dos baños; hidromasaje con sidra y bombones), «Ver fechas de este» (baja a Reservar y dice
   cómo se llama en su motor) y «Ver sus N fotos». Debajo, **«En los tres»** una sola vez, con iconos.
3. **La piscina climatizada**: el texto y tres fotos de 800 px a su tamaño (la grande, 800 px como mucho).
4. **Por dentro**: índice fijo (salón, cocina, dormitorios, baños, el hidromasaje, la piscina, fuera) que marca la
   estancia que se ve; fotos sin marco en filas de la misma altura (cada fila suma ≥ 2,4 de proporción, así ninguna de
   800 px pasa de 800 en pantalla) con el apartamento de cada una debajo; visor por NOMBRE.
5. **Del faro a la casa** (`#lugar`): el 3D de Lugar 3D. Respaldo de la Web: Cabo Vidio con el faro arriba.
6. **Alrededor**: un dibujo con cada sitio en su longitud y latitud reales (norte arriba, escala de 5 km) y la lista en
   tres grupos (la costa, los pueblos, para llegar). Al elegir un sitio, un haz corto sale de la casa hacia él. Todas
   las cifras de OSRM (`ref/raw/rutas.json`), coche y, en lo cercano, a pie; también la distancia en línea recta.
7. **Reseñas**: 4,9 sobre 5 en Google «con más de 250 reseñas» y el enlace. Leído de segunda mano (ver PENDIENTES).
8. **Reservar**: aviso de motor real, buscador propio (llegada y salida) que **crea** el iframe de su Redforts con
   `?arrival=…&departure=…`; sin fechas, el motor sin parámetros. «Abrir el motor en otra pestaña» siempre a la vista
   (Safari puede bloquear su cookie dentro del iframe). Al lado, las condiciones del motor y teléfonos, WhatsApp y
   correo.
9. **Cómo llegar**: dirección, teléfonos, WhatsApp, correo, la ruta desde Cudillero y el aeropuerto (OSRM) y el mapa de
   Google tras pulsar (con el punto del Catastro, no el pin de su Google Maps, que está mal).

Legales (aviso legal, privacidad, cookies, accesibilidad) con el titular de DATOS (Complejo Turístico Playa La Vallina
S.L., B74444522); registro turístico y código postal «por confirmar». Aviso de cookies. 404 con el faro y su haz.
JSON-LD `LodgingBusiness` (sin nota de reseñas ni código postal).

## El motor de reservas (REAL)

`https://booking.redforts.com/es/iframe/i8ZN/?arrival=AAAA-MM-DD&departure=AAAA-MM-DD` (comprobado al leer su motor;
`adults=` no hace nada). Sin `X-Frame-Options` ni CSP. El iframe **no existe** hasta que se pide. Alto
`clamp(700px, 92svh, 1040px)` en escritorio y `clamp(640px, 88svh, 900px)` en móvil. **Las reservas que se hagan
dentro son reales.** El tipo de apartamento no va por URL: «Ver fechas de este» cambia la pista («En su motor sale como
“Apartamento Mirador”»).

## Fotos

De su WordPress (`ref/fotos-originales/`). Nitidez medida en todas (`scripts/fotos-nitidez.py` → `ref/raw/nitidez.json`):
ninguna ampliada (todas ≥ 0,61 salvo las que no se usan).

- **Portada: la fachada** (`apartamentos_lasriberas_inicio.jpg`, 1920×989, nitidez 0,94) **sin su cielo**
  (`scripts/portada-recorte.py`: tejado columna a columna, horizonte del mar respetado). AVIF y WebP con
  transparencia. **Cuánto se amplía** (px CSS frente a los 1920 del original): 1440×900 → ×0,75; 1280×800 → ×0,67;
  768×1024 → ×0,61; 390×844 → ×0,53 (se ve un 38 % de la casa, centrado en el pabellón). Nunca pasa de ×1. En
  pantallas de alta densidad, en píxeles de pantalla: escritorio a DPR 2 → ×1,5; móvil a DPR 3 → ×1,6 (no hay original
  mayor: pedirlo, ver PENDIENTES).
- **Interiores y piscina: 800 px.** Se sirven a 480 y 800 y **nunca se ven más anchas de 800 px** (tope en CSS en la
  foto, la ficha y la piscina; filas de proporción ≥ 2,4; el visor las enseña a su tamaño). `verificar.mjs` lo mide a
  1280 y a 1920 de ancho.
- A 1920: los salones del Familiar y del Deluxe (fotos de las fichas) y Cabo Vidio (respaldo del 3D).
- No se usan: `couple`, `dog-friendly` y `escapada_riberas` (de banco), ni las de entorno cuyo origen no consta
  (`acantilado`, `bruma`, `rocks`, `sablon`, `vallina`, `ruta`, `mountains`). `farocabovidio.jpg` sí (es el cabo de
  verdad, con el faro), pendiente de confirmar que es suya.
- AVIF, WebP y JPG; gradación suave común (sus fotos vienen con HDR fuerte).

## La marca

`scripts/marca-logo.py`: el logo **redibujado** (memoria «Logo de JPG: redibujar las rectas»).

- **El faro** con primitivas medidas fila a fila en el favicon de 513 px: remate, cúpula (media elipse), cornisa y
  balcón (rectángulos de cantos redondos), linterna y torre (trapecio que se abre 0,1245 por unidad). IoU 0,98 contra
  el favicon; linterna 0,96. Solo rectas y arcos.
- **La loma y las tres olas**: curvas libres, potrace (alphamax 1,15) sobre el alfa ×8 suavizado del logo de 181 px,
  con la torre borrada del alfa y puesta encima con sus rectas. IoU 0,95 (marino) y 0,92 (olas).
- **LAS RIBERAS**: L, A, I y E redibujadas como polígonos (misma altura de mayúscula y mismo asta); las dos S, las dos R
  y la B por potrace con el asta de R y B quitada del alfa y puesta como rectángulo exacto. IoU 0,84 medido a ×8.
  «Apartamentos rurales» va como texto (a 8 px en el PNG no se puede redibujar con fiabilidad).
- Salen `marca/faro.svg` (currentColor), `faro-claro.svg`, `simbolo.svg`, `simbolo-claro.svg`, `palabra.svg`,
  `logo.svg`, `logo-claro.svg` y `marca.json` (geometría e IoU). `scripts/marca.mjs`: favicons (el de su favicon: el
  faro en un círculo marino) e `img/og.jpg` (1200×630).
- El faro de la portada es blanco con la torre en sombra a la derecha y un filete marino (el faro de verdad es blanco y
  así no se confunde con el titular que pasa detrás); de noche, silueta marino.

## Cómo se trabaja

```
python -I -X utf8 scripts/fotos-nitidez.py      # nitidez real de las originales → ref/raw/nitidez.json
python -I -X utf8 scripts/portada-recorte.py    # la fachada sin su cielo → ref/recortes/fachada-recorte.png
node scripts/fotos.mjs                          # img/fotos/<nombre>-<ancho>.{avif,webp,jpg} + fotos.json (nunca amplía)
python -I -X utf8 scripts/marca-logo.py         # el logo redibujado → marca/*.svg + marca/marca.json
node scripts/marca.mjs                          # favicons, faro-claro.svg e img/og.jpg
node scripts/alrededor-rutas.mjs                # distancias OSRM → ref/raw/rutas.json (origen: el Catastro)
node scripts/legales.mjs                        # *.src.html de las legales y el 404
node construir.mjs                              # partes, datos, fotos → *.html; versionar.mjs pone ?v=<huella>
node verificar.mjs                              # Playwright, puerto 8971 (sin capturas, sin pintar WebGL)
node scripts/rendimiento.mjs                    # LCP e INP en móvil de gama media, puerto 8972
```

Se edita SIEMPRE el `*.src.html` o la parte (`partes/`); el `.html` se regenera. **Una sola fuente de datos:**
`data/riberas.json` (apartamentos, comunes, piscina, estancias, condiciones, reseñas, contacto, titular, motor). Las
distancias, solo de `ref/raw/rutas.json`. El ritmo del faro, de `data/faro.json` (lo leen la portada y el 3D).
`construir.mjs` quita los `<link>`/`<script>` de ficheros que no existen, **salvo `css/lugar.css` y `js/lugar.js`**.

### Módulos

| Módulo | Agente | Hueco | Ficheros |
|---|---|---|---|
| `portada` | Web | `#portada [data-modulo="portada"]` (respaldo: la escena con el haz quieto; la fachada es el LCP) | `js/portada.js` (CSS en `css/estilos.css`) |
| `lugar` | Lugar 3D | `#lugar [data-modulo="lugar"]` (respaldo: Cabo Vidio y un texto) | `js/lugar.js`, `css/lugar.css`, `img/lugar/`, `vendor/`, `scripts/lugar-*` → [`LUGAR.md`](LUGAR.md) |

Contrato: `LasRiberas.<mod>.montar(el, { movimiento, densidad, webgl })` → `{ destruir() }`. `main.js` monta la
portada al cargar y el lugar al acercarse (900 px). Eventos: `riberas:resize` (solo los resize de verdad, no la barra
del móvil), `riberas:densidad`. `LasRiberas.reservar(tipo)`, `LasRiberas.reserva` y `LasRiberas.visor.abrir(lista,
nombre)` los pone la web. Los selectores de Lugar van bajo `[data-modulo].lugar` (la sección también lleva la clase
`lugar`; los de la Web para la sección van por `#lugar`). Lugar admite `?fps` y `?hora=AAAA-MM-DDTHH:MM`.

## Mando de densidades (solo con `?revision`)

`index.html?revision` enseña el mando «Versión: **Faro** / **Sobria**» (abajo a la izquierda; se aparta mientras está
el aviso de cookies). Sin `?revision` no existe.

- **Faro** (cargada): el haz que gira y enciende, el selector de apartamentos con su haz corto, los haces cortos de lo
  activo, el faro del pie que se enciende al llegar.
- **Sobria**: el haz quieto y más tenue, sin selector (las tres fichas seguidas), lo activo en negrita y subrayado en
  vez del haz corto, el faro del pie ya encendido, y **añade** la tabla «De un vistazo» (personas, dormitorios, baños,
  sofá cama, lo propio, vistas y mascotas de los tres).

No lleva mando de paleta: es una web de un negocio real con su marca (como Amaicha y Casa Benito).

### Receta de borrado (antes de enseñársela al cliente como web suya)

1. `partes/cabeza.html`: borrar desde `// MANDO DE MAQUETA` hasta el cierre de su `if (q.has('revision')) { … }`.
2. `partes/pie.html`: borrar desde `<!-- MANDO DE MAQUETA` hasta `<!-- fin del MANDO DE MAQUETA -->`.
3. `js/main.js`: borrar el bloque `/* ===… 16. MANDO DE MAQUETA` … `/* fin del MANDO DE MAQUETA */`.
4. Si ya no hace falta la tabla de la sobria: quitar `.replace('<!--vistazo-->', vistazo)` y el `<!--vistazo-->`.
5. `node construir.mjs && node verificar.mjs` (el bloque 1 comprueba esta receta sobre copias en memoria).

## Lo que no se negocia (y su prueba en `verificar.mjs`)

Checklist de webs desde cero, para las piezas que lleva: menú móvil a 100dvh dentro de la cabecera con blur (bloque 10),
cookies con `:not([hidden])` (1 y 8), resize de la barra del móvil que no rehace nada (10), visor por NOMBRE con ratón y
con el dedo (5 y 10; botones del visor tocables en toda su altura), recargar a media página vuelve arriba (13),
titulares que aparecen observando el contenedor (13), hero en flujo sin pisarse a 360×640, 375×667, 390×844,
768×1024, 1280×800 y 1440×900 (2: texto y botones libres del faro y por encima del tejado), `con-movimiento` solo sin
movimiento reducido (1), contraste WCAG medido de día y de noche (3). Sin cursor propio, sin pila sticky, sin
marquesina, sin cortina, sin letra a letra (1).

§5 bis: **fórmula rota** (fuera cortina, pila, marquesina, cursor, letra a letra y botones magnéticos; **pieza
propia**: el haz que enciende el titular y la fachada con la hora real); **gesto del hero** (girar el faro arrastrando,
probado con eventos táctiles reales en el bloque 13); **el objeto se completa en el pie** (el faro se enciende; con
movimiento reducido, ya encendido: 3 y 13); **foco con forma propia** (contorno de 2 px + el haz corto, `#foco-haz`: 3);
**rendimiento medido** (abajo). Menú §5 bis elegido: **dato real en vivo** (el sol de ahora en Cudillero decide el día
o la noche de la portada; si algo falla, de día).

## Rendimiento

**Medido el 2026-11-25** con `scripts/rendimiento.mjs` (Pixel 7 emulado: 412×915, DPR 2,625, 4G lento 1,6 Mb/s y
150 ms, CPU ×4; sin el 3D, que tiene su propio presupuesto en `LUGAR.md`): **LCP 1,72–1,84 s** (la fachada,
`fachada-recorte-1920.avif`, en las cuatro pasadas, también con movimiento reducido), 15 peticiones y ~480 KB hasta
`load`, una tarea larga de 53–64 ms, **INP aproximado 64–104 ms** (un toque en la portada y otro en el selector).
Presupuesto: LCP ≤ 2,5 s, INP ≤ 200 ms.

La portada no usa canvas: el haz y las copias encendidas se mueven solo con `transform` (rotaciones), el bucle corre
solo con la portada en pantalla y la pestaña visible (IntersectionObserver + `visibilitychange`), y la noche se
recalcula una vez por minuto. Sin librerías (ni GSAP ni Lenis).

## Verificación y «no repetir»

`node verificar.mjs` (2026-11-25, con el módulo de Lugar 3D ya dentro): **195 comprobaciones bien, 0 mal**, en 13 bloques: archivos y contrato, portada a seis tamaños, contraste (día y noche) y foco, tokens /
selector / estancias / fotos de 800 px, visor por nombre, Alrededor, el buscador y el iframe real (escritorio y móvil,
con Redforts servido falso), cookies y mapa, mando, móvil, legales y enlaces, el 3D (solo contenedor, respaldo y plan B
sin WebGL) y, una vez, con movimiento.

`node ../plantillas-negocios-web/scripts/repeticion.mjs ../apartamentos-las-riberas-cudillero-web` (2026-11-25): en las
últimas diez webs no domina ninguna pieza; **Las Riberas usa ninguna del kit** («crema + acento: fondo #EEF3F6» sale
como nota: es la bruma fría, no crema) → **repite 0 de las dominantes (tope 2)**.

## Qué mirar en Chrome

Abrir con un servidor local (p. ej. `npx serve` en esta carpeta) `index.html` y `index.html?revision`. Nadie ha visto
todavía el aspecto: las pruebas miden comportamiento. Lista completa en `PENDIENTES.md`.
