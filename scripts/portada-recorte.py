"""La fachada SIN su cielo, para la portada «La luz de Vidio» (el cielo lo pone la web: de día o de noche, con la hora
real de Cudillero). Uso: python -I -X utf8 scripts/portada-recorte.py → ref/recortes/fachada-recorte.png (RGBA, 1920×989)
y ref/raw/recorte.json (la línea del tejado, columna a columna, y el horizonte del mar).

Cómo: columna a columna, de arriba abajo, el primer tramo de ≥ 5 píxeles que NO es cielo (ni azul ni nube) es el tejado,
un árbol o el césped. El mar (azul, a la derecha del pabellón) se confundiría con el cielo: por eso la línea nunca baja
del horizonte (se mide: la fila donde el azul se oscurece de golpe al pasar de cielo a mar). Mediana de 5 columnas para
quitar el ruido de las tejas sin redondear los picos; borde suavizado de 1,5 px.
"""
import json, pathlib
import numpy as np
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
im = Image.open(RAIZ / 'ref/fotos-originales/apartamentos_lasriberas_inicio.jpg').convert('RGB')
a = np.asarray(im).astype(np.float32) / 255
H, W, _ = a.shape
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx, mn = a.max(2), a.min(2)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
azul = (b > r + 0.06) & (b >= g - 0.02)
nube = (sat < 0.16) & (mx > 0.62) & (np.abs(r - b) < 0.10)
cielo = azul | nube

# horizonte del mar: en las columnas de la derecha (sin casa), la fila donde el brillo cae más de golpe entre y 470 y 560
der = slice(int(W * .955), W - 4)
lum = a[:, der].mean(2).mean(1)
d = np.diff(lum[470:560])
horizonte = 470 + int(np.argmin(d)) + 1
print('horizonte del mar en la fila', horizonte)

linea = np.zeros(W, int)
for x in range(W):
    col = ~cielo[:, x]
    y = 0
    while y < H - 5:
        if col[y:y + 5].all(): break
        y += 1
    linea[x] = min(y, horizonte)
# mediana de 5 columnas (quita el ruido de las tejas; los picos del tejado duran decenas de columnas)
med = np.array([int(np.median(linea[max(0, x - 2):x + 3])) for x in range(W)])
yy = np.arange(H)[:, None].astype(np.float32)
alfa = np.clip((yy - (med[None, :] - 1.5)) / 1.5, 0, 1)
rgba = np.dstack([np.asarray(im), (alfa * 255).astype(np.uint8)])
(RAIZ / 'ref/recortes').mkdir(parents=True, exist_ok=True)
Image.fromarray(rgba, 'RGBA').save(RAIZ / 'ref/recortes/fachada-recorte.png', optimize=True)
tej = med[(med < horizonte - 4)]
datos = {'ancho': W, 'alto': H, 'horizonte': horizonte, 'tejado_min': int(tej.min()) if len(tej) else None,
         'linea_cada_16': [int(v) for v in med[::16]]}
(RAIZ / 'ref/raw').mkdir(parents=True, exist_ok=True)
(RAIZ / 'ref/raw/recorte.json').write_text(json.dumps(datos), encoding='utf-8')
print('ref/recortes/fachada-recorte.png · lo más alto del tejado en y =', datos['tejado_min'])
