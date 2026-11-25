# Lugar 3D · «Del faro a la casa»

Módulo `lugar` de la sección `#lugar` (agente Lugar 3D, 2026-11-25). Ficheros: `js/lugar.js`, `css/lugar.css`,
`img/lugar/`, `vendor/three-0.160.0.module.min.js`, `scripts/lugar-*`, `ref/raw/lugar-cache/` (caché de descargas,
54 MB, no viaja a la web).

**Nadie lo ha visto pintado todavía.** El 3D no se prueba con Playwright; lo tiene que mirar Álvaro en su Chrome
(ver «Qué mirar»).

## Qué hace

Un recorrido en 3D que avanza con el scroll (sección fijada con `position: sticky`, sin GSAP):

| Scroll | Cámara | Rótulos |
|---|---|---|
| 0 – 17 % | sobre el Cantábrico, a ~3,3 km del cabo y a 330 m, mirando al sur: Cabo Vidio, la rasa y la sierra detrás | Mar Cantábrico, Cabo Vidio (el faro), Oviñana, Playa de La Vallina, Penadrada, Las Riberas, Cudillero (si entra) |
| 17 – 50 % | se acerca al faro, lo rodea por el lado del mar y por el oeste y queda al sur mirándolo con el mar detrás | Cabo Vidio |
| 50 – 74 % | se da la vuelta y cruza la rasa hacia la finca | Las Riberas |
| 74 – 100 % | baja por el oeste del bloque y acaba en el prado, al sur del patio: la casa delante y, al fondo, el cabo con el faro (el encuadre de la foto de la fachada) | Los apartamentos, La piscina |

Abajo, las cuatro paradas («Desde el mar», «El faro de Cabo Vidio», «La rasa», «La finca»); la actual se marca con
un punto de luz (`--acento`). Rótulos sin distancias (las pone Web en «Alrededor»).

- **Relieve**: MDT05 del IGN de la playa de Gavieiro a Cudillero y del mar (2 km más allá del faro) a la sierra
  (14,1 × 7,4 km). Rejilla que se aprieta en la finca y en el faro (4 m) y se abre lejos (10, 24 y 60 m), con cuatro
  rásteres de alturas (finca y cabo a 4 m, de la finca al faro a 10 m, caja cercana a 20 m). Anillo lejano con MDT25
  (72 × 55 km, ~350 m) hasta la cordillera. El relieve **lejano** está exagerado ×1,3 (de 4 a 14 km de la casa, en
  suave; la finca, el cabo y la costa, a escala real). Se dice en el pie.
- **Ortofoto PNOA** encima, en cuatro niveles que se funden: 4,6 m/px la caja cercana, 1,7 m/px de la finca al faro,
  ~0,3 m/px en la finca (640 m) y ~0,5 m/px en el cabo (560 m); ~32 m/px el anillo lejano (sin nubes: se rellenan
  con el color de alrededor). Bajo los edificios 3D se borra el tejado de la foto para que no salga dos veces.
- **Mar**: plano con sombreado propio (olas por ruido, reflejo del cielo con Fresnel, brillo del sol o de la luna,
  color según la distancia a la costa real, espuma en la orilla sacada del MDT) y, de noche, la franja del haz del
  faro rozando el agua.
- **El faro de Cabo Vidio**: la casa del torrero sobre su **planta del Catastro** (`E00115400QJ23A`, dos partes,
  revoco blanco, tejado a cuatro aguas anaranjado como en la ortofoto) y la **torre redonda** en su esquina noreste,
  situada y medida por el arco de esa planta (radio 2,1 m, a 1,4 m del nodo OSM 100170985): balcón, barandilla,
  linterna acristalada y cúpula oscura. Plano focal a ~100 m sobre el mar (oficial: 101 m). Colores de la torre y la
  cúpula **supuestos** (blanco y gris oscuro): la ortofoto solo deja ver un círculo claro.
- **El haz**: de noche (se enciende con el sol a +0,5° y queda del todo a −2,5°) gira en el sentido de las agujas
  del reloj visto desde arriba. **Ritmo de `data/faro.json`** (`{ "grupo": n, "periodo_s": n, "fuente": "url" }`,
  lo escribe Web): una vuelta cada `periodo_s` y `grupo` haces separados ~1,6 s, así que cada vuelta da los
  destellos del grupo. El ángulo sale del reloj (no de los fotogramas), así que el ritmo es el real aunque vaya a
  tirones. Si el fichero no está o no cuadra: **un haz, una vuelta cada 12 s** (giro neutro, sin ritmo inventado).
  Cuando el haz apunta a la cámara, la linterna destella (halo dibujado, sin bloom).
- **La finca**: el **bloque de apartamentos** (`E00306700QJ22G`) sobre su planta del Catastro: es **una L**
  (48,5 × 27,2 m, alas de 11,8 m de fondo) con el patio al sureste, no un bloque recto. Muros de revoco crema, una
  planta, el **tejado en L** de teja rojo oscuro con su limahoya (dos alas a cuatro aguas que se cortan solas) y el
  **porche** (parte 2 del Catastro) con 14 postes de madera sobre pie blanco. Al porche dan puertas y ventanas
  alternas; al prado, ventanas. Vecinas en un radio de 300 m (36 partes del Catastro) en blanco con teja más apagada.
- **El pabellón de la piscina NO está en el Catastro ni en la ortofoto PNOA** (en su sitio la ortofoto enseña una
  terraza). Se pone **por las fotos** (`apartamentos_lasriberas_inicio.jpg`, `Piscina7`, `Piscina8`): sale del
  extremo este del ala larga hacia el patio, 8,4 m de ancho y 7,6 m fuera del alero (**medidas estimadas**), con
  zócalo y montantes de madera, cristal, tejado a dos aguas con hastial de tablas, el agua turquesa dentro, la
  terraza delante y cuatro tumbonas. De noche el agua se enciende.
- **Árboles**: 430 copas detectadas en la ortofoto de detalle (sobre todo el bosque que baja a la playa de Vivigo);
  ninguno entre la cámara final y la casa.
- **El cielo de ahora** en Cudillero: sol y luna en su posición real (SunCalc, en el navegador), color del cielo y de
  la luz según la altura del sol, sombras suaves en la finca (recalculadas solo cuando cambia el sol). De noche:
  estrellas, la luna con su fase, ventanas encendidas con halo dibujado, la piscina iluminada y el faro girando.
  Texto «Ahora en Cudillero son las…» (cada minuto).

### Plan B (en el mismo hueco)

Sin WebGL, con movimiento reducido, en densidad «sobria», con ahorro de datos, en el móvil antes de pulsar el botón y
en navegadores automatizados (Playwright): **la vista desde el mar dibujada** con los mismos datos (relieve +
ortofoto, render por columnas en Python, mismo encuadre que el arranque del 3D) con sus marcas, **el faro desde el
aire** y **la finca desde el aire** (ortofotos PNOA, con marcas), las cuatro paradas y el cielo de ahora. De noche las
imágenes se oscurecen y en la marca del faro **late su destello al ritmo de `data/faro.json`** (un pulso por destello
del grupo; con movimiento reducido, luz fija).

### Cuándo sale cada cosa

| Caso | Qué se ve |
|---|---|
| Escritorio con WebGL | el 3D se carga al montar (Web monta a ~900 px); mientras, el póster (la vista dibujada) en el mismo hueco |
| Móvil (≤ 820 px o puntero grueso) o ahorro de datos | plan B + botón **«Ver el recorrido en 3D»** |
| `prefers-reduced-motion`, `movimiento: false`, `densidad: 'sobria'`, sin WebGL, `?sin-webgl` | plan B, sin botón |
| `navigator.webdriver` (Playwright) | plan B siempre; `?lugar=3d` lo fuerza (no usarlo en pruebas con WebGL de verdad) |
| En 3D | botón «Ver en plano» abajo a la derecha |
| Si falla la carga o se pierde el contexto WebGL | vuelve solo al plan B |

## Para Web

1. **HTML** (ya está en `index.src.html`): `<div data-modulo="lugar">RESPALDO</div>` dentro de `#lugar`. El contenido
   del div se guarda y se repone al destruir.
2. **CSS y JS** en el `<head>` (con tu `?v=` de `versionar.mjs`): `css/lugar.css` y `js/lugar.js` con `defer`.
   **Three.js no lo cargas tú**: `lugar.js` lo pide con `import()` a `vendor/three-0.160.0.module.min.js` (copia
   propia, MIT) solo cuando hace falta. Sin import map, sin CDN.
3. **Montar** desde `main.js`: `LasRiberas.lugar.montar(el, { movimiento, densidad, webgl })`. `webgl: false` fuerza
   el plan B; si no lo pasas, lo detecta él.
4. **Sticky**: ningún antepasado de `[data-modulo="lugar"]` puede llevar `overflow: hidden|auto|clip` ni
   `transform`/`filter`. Ya pones `--lugar-arriba: var(--cabecera)` en `#lugar`: bien. El div, a **todo el ancho**;
   el plan B ya lleva su respiro con tu `padding-inline` en `[data-modo="plano"]`.
5. **Variables que lee**: `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--marca`, `--acento` (la luz del
   faro: punto de la parada actual, marca del faro, botón), `--linea`, `--letra-titular`, `--letra-texto`,
   `--letra-cifras`. No define colores de página. Todos sus selectores van bajo `[data-modulo].lugar`, porque tu
   sección también lleva la clase `lugar` y sus figuras no deben heredar nada.
6. **`data/faro.json`**: `{ "grupo": 1, "periodo_s": 5, "fuente": "…" }`. Grupo de 1 a 9 y periodo de 1 a 60 s; si
   no, giro neutro. Para tu fuente oficial: OSM tiene en el nodo del faro `seamark:light:character=Fl`,
   `period=5`, `sequence=0.3+(4.7)`, `height=101`, `range=25`, `reference=D 1641` (número del Libro de Faros del
   Almirantazgo), y la Wikipedia dice «destellos blancos cada 5 segundos». Eso es apoyo, no la fuente oficial que
   pide el ENCARGO.
7. **`verificar.mjs`**: el módulo no pinta WebGL bajo Playwright (mira `navigator.webdriver`); aun así, arranca
   Chromium con `--disable-3d-apis`. Comprueba solo: `[data-modulo="lugar"][data-montado="1"]`,
   `[data-modo="plano"]`, que `.lugar__planob img` cargan y que hay `.lugar__marca` visibles. Si `data/faro.json`
   falta, la consola dará un 404 de ese fichero (esperado).
8. **Créditos**: el pie del módulo cita IGN (CC BY 4.0), Catastro y OSM. Si el aviso legal o una página de créditos
   lista fuentes, añade esas tres.
9. **Peso**: con `defer` y la carga diferida, nada de esto entra en el LCP. El 3D baja **2,6 MB** en escritorio y
   **1,8 MB** en móvil al pulsar el botón (Three.js 655 KB incluido, sin gzip); el plan B, **~120 KB**.
   `img/lugar/` entero: 2,55 MB.

### Para «Alrededor» y el mapa (importante): el pin de su web está mal

El enlace de Google Maps de su web (43.577007, -6.2514292) cae **en el bosque, ~190 m al oeste del edificio** (y
39 m al sur). El edificio real, por el Catastro (`E00306700QJ22G`), tiene su centro en **43.5773554, -6.2490802**.
Todo el 3D usa este origen. Si las rutas de OSRM de `ref/raw/rutas.json` salieron del pin, conviene rehacerlas desde
aquí (en coche saldrá casi igual, pero el punto de partida estaría en otra pista), y el mapa de Contacto debería
apuntar aquí.

## Datos (cómo se hicieron)

```
python -I -X utf8 scripts/lugar-osm.py     # lugares de OSM (Overpass con espejos) → ref/raw/lugar-cache/osm-lugares.json
python -I -X utf8 scripts/lugar-datos.py   # descargas (en caché), alturas, ortofotos, Catastro, árboles, plan B, lugar.json
node scripts/lugar-prueba.mjs --sin-navegador   # 67 comprobaciones en Node, sin pintar: sol, luna, ritmo, datos, recorrido
node scripts/lugar-prueba.mjs                   # + plan B en Chromium sin WebGL y la escena montada con Three.js real
                                                #   y un WebGLRenderer FALSO que no pinta (106 en total)
```

| Fuente | Servicio | Resolución usada |
|---|---|---|
| MDT05 IGN | WCS `servicios.idee.es/wcs-inspire/mdt`, `Elevacion4258_5` | nativo ~3,6 × 5 m → rejillas de 4 m (finca y cabo), 10 m (de la finca al faro), 20 m (caja cercana) |
| MDT25 IGN | mismo WCS, `Elevacion4258_25` (máximo 4096 px de lado por petición) | anillo lejano a ~350 m, mezcla de media y máximo para no aplanar las cumbres |
| PNOA | WMS `www.ign.es/wms-inspire/pnoa-ma` (caja cercana, medio y lejana; las peticiones que dan 502 se parten en cuatro) y **WMTS** `www.ign.es/wmts/pnoa-ma` zoom 19 (finca y cabo) | 4,6 · 1,7 · 0,3 · 0,55 · ~32 m/px |
| Catastro INSPIRE | WFS `wfsBU.aspx` (`BU:BuildingPart`, con plantas) | bloque, porche, faro y 36 vecinas |
| OSM | Overpass (UA genérico) | faro `node/100170985`, Cudillero `node/69248638`, Oviñana `node/100170735`, Playa de Vallina o del Gallo `way/554747277`, Penadrada (724 m) `node/575944537` |

Alturas en PNG RGB: `(R·256 + G) / 10 − 100` m. Coordenadas locales en metros desde el centro del bloque (x al este,
z al sur).

Licencias: relieve y ortofoto **© Instituto Geográfico Nacional, CC BY 4.0** (cita obligatoria, va en el pie del
módulo); plantas de edificios **© Dirección General del Catastro** (uso libre con cita de la fuente); lugares
**© colaboradores de OpenStreetMap, ODbL**; Three.js, MIT.

### Comprobaciones hechas (sin pintar)

- Sol: 69,9° el 21 de junio y 23,0° el 21 de diciembre a mediodía solar (lo teórico para 43,58° N); puesta de hoy,
  17:52 hora peninsular. Luna: llena el 24-nov-2026 (99,8 %), nueva el 9-dic-2026 (0,2 %).
- El faro queda a 1,83 km al norte de la casa, con el mar a 700 m al norte de la torre. Suelo en la finca 99 m;
  en el faro 85 m (la casa está más alta que el faro).
- El recorrido no se pasa de largo, no da saltos (máx. 3,5 m por 1/4000 de scroll) y la cámara va siempre a 22 m o
  más del suelo. En el encuadre final la casa queda a −8° y el faro a +16° del centro.
- Escena montada con el renderizador falso: ~735 000 triángulos, 136 objetos (169 de noche), sin NaN; de noche el
  faro está encendido y gira; al final, quieto y de día, no repinta; «Ver en plano» y `destruir()` funcionan.

## Rendimiento

Sin `transmission`, sin `RectAreaLight`, sin bloom (halos y destello dibujados con sprites aditivos, haz con un
cono aditivo de sombreado propio), colores en sRGB (`'#hex'`), DPR ≤ 1,5 (1,25 en móvil) con bajada automática (DPR 1
y luego sin sombras si los fotogramas pasan de 30 ms), sombras PCF solo en 180 m alrededor de la finca y recalculadas
solo cuando cambia el sol, pausa fuera de pantalla, `near` de la cámara según la altura. Pinta solo si hay cambio,
**salvo dos casos**: el mar anima hasta el 70 % del recorrido y, **de noche, el faro gira siempre** (bucle continuo
mientras la sección se ve). ~735 000 triángulos en escritorio (relieve cercano ~600 000).
La prueba con el renderizador falso **no compila los shaders**: un error de GLSL solo se vería en Chrome, en la
consola (`THREE.WebGLProgram: Shader Error`), con el suelo, el mar, el cielo o el haz en negro o sin pintar.

## Qué mirar (Álvaro, en su Chrome)

Con un servidor local: la web, o la página de prueba `scripts/lugar-prueba.html` (variables de relleno).

1. Abrir con **`?fps`**: arriba a la derecha salen fps, calidad, DPR, altura de la cámara y el ritmo del faro
   («neutro» o «1/5 s»). Si la calidad baja sola a 1 o 2, va justo; decirlo.
2. **De noche sin esperar**: `?hora=2026-11-25T22:30` (o cualquier fecha y hora). Mirar que el haz gire limpio, que
   destelle al pasar por la cámara, que la franja sobre el mar acompañe al haz, y la piscina y las ventanas encendidas.
   Al atardecer: `?hora=2026-11-25T17:45`.
3. Recorrer el scroll entero despacio y deprisa: que no haya saltos, que el arranque coincida con el póster, que la
   vuelta al faro se entienda y que el final se parezca a la foto de la fachada (porche delante, pabellón a la
   derecha, cabo al fondo).
4. **La casa de cerca**: el tejado en L sin grietas en la limahoya ni tejas atravesadas por los muros; el pabellón
   (¿está en su sitio y del tamaño que toca? lo puse por las fotos); los postes del porche.
5. **El faro de cerca**: proporción de la torre, colores (supuestos) y que la linterna no flote.
6. **Etiquetas**: que caigan en su sitio y no se monten (Oviñana y Las Riberas están cerca entre sí en el arranque).
7. **Móvil real**: el botón «Ver el recorrido en 3D», que el scroll no se trabe y que el escenario no salte al
   esconderse la barra del navegador.
8. Si va a menos de 5 fps: Chrome sin aceleración por hardware (`chrome://settings/system`).

## Pendiente

- **El ritmo del faro**: depende de que Web escriba `data/faro.json` con fuente oficial. Hasta entonces, giro neutro.
- **Pabellón de la piscina**: situado y medido por las fotos (no está en Catastro ni en la ortofoto). Confirmar con
  la dueña o con una foto aérea reciente.
- **Colores del faro** (torre y cúpula): supuestos.
- **El pin de Google Maps de su web** está ~190 m al oeste del edificio (ver «Para Web»).
- Nadie lo ha visto pintado: shaders, proporciones y rendimiento sin confirmar.
