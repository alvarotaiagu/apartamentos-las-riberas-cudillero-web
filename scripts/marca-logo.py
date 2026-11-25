"""El logo de Las Riberas, REDIBUJADO (memoria «Logo de JPG: redibujar las rectas»), no calcado.
Uso: python -I -X utf8 scripts/marca-logo.py      → marca/*.svg + marca/marca.json (con el IoU de cada pieza)

Fuentes (ref/fotos-originales/): favicon2021_lasriberas.png (513 px, el faro más preciso), lasriberas_logo2021.png
(181 px: el faro sobre la loma y las tres olas) y lasriberas_logo2022_m.png (172×43: LAS RIBERAS).
- El FARO se dibuja con primitivas medidas en el favicon (píxel a píxel, ver los comentarios): remate (rectángulo
  con la cabeza redonda), cúpula (media elipse), cornisa y balcón (rectángulos de cantos redondos), linterna
  (rectángulo amarillo) y torre (trapecio). Ni una curva calcada.
- La LOMA y las TRES OLAS son curvas libres: potrace (alphamax 1,1) sobre el alfa limpio ×8 del logo de 181 px. La
  torre del faro se borra del alfa antes de trazar la loma y se pone encima con sus rectas.
- LAS RIBERAS: L, A, I y E se redibujan como polígonos con sus medidas (misma altura de mayúscula, mismo grueso de
  asta); S, R y B por potrace, pero con el asta de R y B quitada del alfa y puesta como rectángulo exacto.
- Colores: mediana de los píxeles opacos de cada color del logo. Se valida con IoU contra el alfa original.
"""
import json, math, pathlib
import numpy as np
from PIL import Image, ImageDraw
import potrace

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIG = RAIZ / 'ref/fotos-originales'
SAL = RAIZ / 'marca'
SAL.mkdir(exist_ok=True)
K = 8  # ampliación de trabajo

def rgba(nombre):
    return np.array(Image.open(ORIG / nombre).convert('RGBA')).astype(np.float32)

def ampliar(alfa, k=K, suave=0.45):
    """alfa (0-1) ampliado ×k en bicúbico, suavizado (gaussiana de `suave` px del original) y cortado al 50 %
    (receta de El Sótano). El suavizado quita la escalera del PNG pequeño sin comerse los huecos blancos (~2 px)."""
    from PIL import ImageFilter
    im = Image.fromarray((alfa * 255).astype(np.uint8)).resize((alfa.shape[1] * k, alfa.shape[0] * k), Image.BICUBIC)
    if suave: im = im.filter(ImageFilter.GaussianBlur(radius=k * suave))
    return np.array(im).astype(np.float32) / 255 >= 0.5

def mascaras(im):
    r, g, b, a = [im[..., i] for i in range(4)]
    op = a / 255
    # pertenencia suave por color (distancia al color de referencia), multiplicada por el alfa
    def cerca(c, tol):
        d = np.sqrt((r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2)
        return np.clip(1 - (d - tol * .5) / tol, 0, 1) * op
    return cerca

def mediana(im, sel):
    return [int(v) for v in np.median(im[sel][:, :3], 0)]

hexa = lambda c: '#%02X%02X%02X' % tuple(c)

# ------------------------------------------------------------------ colores
fav = rgba('favicon2021_lasriberas.png')
R, G, B, A = [fav[..., i] for i in range(4)]
s_mar = (A > 200) & (B > R + 20) & (R < 90)
s_ama = (A > 200) & (R > 200) & (G > 150) & (B < 150)
s_cel = (A > 200) & (B > 200) & (R < 180) & (G > 170)
COL = {'marino': hexa(mediana(fav, s_mar)), 'luz': hexa(mediana(fav, s_ama)), 'ola': hexa(mediana(fav, s_cel))}
print('colores', COL)

# ------------------------------------------------------------------ el faro (unidades del favicon de 513 px)
# Medido fila a fila (scripts: ver README): remate x 244,5-266,5 desde y 33; cúpula de 129 de ancho (190-318) con su
# base en y 112,5 y 59 de alto; cornisa y 112,5-132,5, 156 de ancho, cantos de radio 10; linterna 124 × 59
# (x 192,5-316,5, y 132,5-191,5); balcón y 191,5-222,5, 180 de ancho, radio 12; torre: 156 de ancho arriba
# (y 222,5) y 215 en y 463,5 → cada lado se abre 0,1245 por unidad de alto.
CX = 254.75
FARO = {
    'cx': CX,
    'remate': {'w': 22, 'y0': 33, 'y1': 60},
    'cupula': {'rx': 64.5, 'ry': 59, 'cy': 112.5},
    'cornisa': {'w': 156, 'y0': 112.5, 'y1': 132.5, 'r': 10},
    'linterna': {'w': 124, 'y0': 132.5, 'y1': 191.5},
    'balcon': {'w': 180, 'y0': 191.5, 'y1': 222.5, 'r': 12},
    'torre': {'w0': 156, 'y0': 222.5, 'abre': 0.1245},
}

def rrect(x0, y0, x1, y1, r):
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    return (f'M{x0 + r:.2f} {y0:.2f}H{x1 - r:.2f}A{r:.2f} {r:.2f} 0 0 1 {x1:.2f} {y0 + r:.2f}V{y1 - r:.2f}'
            f'A{r:.2f} {r:.2f} 0 0 1 {x1 - r:.2f} {y1:.2f}H{x0 + r:.2f}A{r:.2f} {r:.2f} 0 0 1 {x0:.2f} {y1 - r:.2f}'
            f'V{y0 + r:.2f}A{r:.2f} {r:.2f} 0 0 1 {x0 + r:.2f} {y0:.2f}Z')

def faro_paths(F, base_y, t=lambda x, y: (x, y), esc=1.0):
    """Devuelve {'cuerpo': d, 'linterna': d} con la torre hasta base_y. t transforma (x, y) del favicon al destino."""
    cx = F['cx']
    def P(x, y):
        X, Y = t(x, y); return f'{X:.2f} {Y:.2f}'
    def rr(x0, y0, x1, y1, r):
        (X0, Y0), (X1, Y1) = t(x0, y0), t(x1, y1)
        return rrect(X0, Y0, X1, Y1, r * esc)
    re = F['remate']; cu = F['cupula']; co = F['cornisa']; li = F['linterna']; ba = F['balcon']; to = F['torre']
    w = re['w'] / 2
    rem = f'M{P(cx - w, re["y1"])}V{t(0, re["y0"] + w)[1]:.2f}A{w * esc:.2f} {w * esc:.2f} 0 0 1 {P(cx + w, re["y0"] + w)}V{t(0, re["y1"])[1]:.2f}Z'
    cup = f'M{P(cx - cu["rx"], cu["cy"] + .5)}V{t(0, cu["cy"])[1]:.2f}A{cu["rx"] * esc:.2f} {cu["ry"] * esc:.2f} 0 0 1 {P(cx + cu["rx"], cu["cy"])}V{t(0, cu["cy"] + .5)[1]:.2f}Z'
    cor = rr(cx - co['w'] / 2, co['y0'], cx + co['w'] / 2, co['y1'], co['r'])
    bal = rr(cx - ba['w'] / 2, ba['y0'], cx + ba['w'] / 2, ba['y1'], ba['r'])
    h = base_y - to['y0']
    tor = f'M{P(cx - to["w0"] / 2, to["y0"] - .5)}H{t(cx + to["w0"] / 2, 0)[0]:.2f}L{P(cx + to["w0"] / 2 + to["abre"] * h, base_y)}H{t(cx - to["w0"] / 2 - to["abre"] * h, 0)[0]:.2f}Z'
    lin = f'M{P(cx - li["w"] / 2, li["y0"] - .5)}H{t(cx + li["w"] / 2, 0)[0]:.2f}V{t(0, li["y1"] + .5)[1]:.2f}H{t(cx - li["w"] / 2, 0)[0]:.2f}Z'
    return {'cuerpo': rem + cup + cor + bal + tor, 'linterna': lin}

# ------------------------------------------------------------------ rasterizar para medir (IoU)
def bezier(p0, p1, p2, p3, n=12):
    return [((1 - s) ** 3 * p0[0] + 3 * (1 - s) ** 2 * s * p1[0] + 3 * (1 - s) * s * s * p2[0] + s ** 3 * p3[0],
             (1 - s) ** 3 * p0[1] + 3 * (1 - s) ** 2 * s * p1[1] + 3 * (1 - s) * s * s * p2[1] + s ** 3 * p3[1]) for s in np.linspace(0, 1, n)]

def raster_d(d, w, h, union=False, S=1):
    """Rasteriza un 'd' de SVG con M/H/V/L/A/C/Z (los que usa este script) a w×h: par-impar (potrace) o unión (piezas que se solapan)."""
    import re
    tok = re.findall(r'[MHVLACZ]|-?\d+(?:\.\d+)?', d)
    i = 0; polys = []; cur = []; x = y = 0; cmd = None
    def num():
        nonlocal i; v = float(tok[i]); i += 1; return v
    while i < len(tok):
        if tok[i] in 'MHVLACZ': cmd = tok[i]; i += 1
        if cmd == 'M':
            if cur: polys.append(cur)
            x, y = num(), num(); cur = [(x, y)]; cmd = 'L'
        elif cmd == 'H': x = num(); cur.append((x, y))
        elif cmd == 'V': y = num(); cur.append((x, y))
        elif cmd == 'L': x, y = num(), num(); cur.append((x, y))
        elif cmd == 'C':
            c1 = (num(), num()); c2 = (num(), num()); e = (num(), num())
            cur += bezier((x, y), c1, c2, e)[1:]; x, y = e
        elif cmd == 'A':
            rx, ry, _, la, sw, ex, ey = num(), num(), num(), num(), num(), num(), num()
            cur += arco(x, y, rx, ry, int(la), int(sw), ex, ey); x, y = ex, ey
        elif cmd == 'Z':
            if cur: polys.append(cur); cur = []
    if cur: polys.append(cur)
    im = Image.new('L', (w * S, h * S), 0)
    acc = np.zeros((h * S, w * S), bool)
    for p in polys:
        m = Image.new('1', (w * S, h * S), 0)
        ImageDraw.Draw(m).polygon([(a * S, b * S) for a, b in p], fill=1)
        if union: acc |= np.array(m, bool)
        else: acc ^= np.array(m, bool)
    return acc

def arco(x1, y1, rx, ry, la, sw, x2, y2, n=24):
    # conversión del arco SVG (sin giro) a puntos
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    if rx == 0 or ry == 0: return [(x2, y2)]
    lam = (dx / rx) ** 2 + (dy / ry) ** 2
    if lam > 1: rx *= math.sqrt(lam); ry *= math.sqrt(lam)
    num = rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx
    den = rx * rx * dy * dy + ry * ry * dx * dx
    co = math.sqrt(max(0, num / den)) * (-1 if la == sw else 1)
    cxp, cyp = co * rx * dy / ry, -co * ry * dx / rx
    cx, cy = cxp + (x1 + x2) / 2, cyp + (y1 + y2) / 2
    a1 = math.atan2((dy - cyp) / ry, (dx - cxp) / rx)
    a2 = math.atan2((-dy - cyp) / ry, (-dx - cxp) / rx)
    da = a2 - a1
    if sw and da < 0: da += 2 * math.pi
    if not sw and da > 0: da -= 2 * math.pi
    return [(cx + rx * math.cos(a1 + da * s), cy + ry * math.sin(a1 + da * s)) for s in np.linspace(0, 1, n)[1:]]

def iou(a, b):
    return float((a & b).sum() / max(1, (a | b).sum()))

# --- IoU del faro contra el favicon (dentro del círculo, donde no está el aro)
H, W = s_mar.shape
fp = faro_paths(FARO, 470)
cuerpo = raster_d(fp['cuerpo'], W, H, True)
yy, xx = np.mgrid[:H, :W]
dentro = (np.hypot(xx - 256, yy - 256) < 226) & (yy < 455)
alfa_mar = (fav[..., 3] > 127) & s_mar | ((fav[..., 3] > 127) & (B > R + 20) & (R < 120))
iou_faro = iou(cuerpo & dentro, alfa_mar & dentro)
lint = raster_d(fp['linterna'], W, H, True)
iou_lint = iou(lint, (fav[..., 3] > 127) & (R > 200) & (G > 150) & (B < 150))
print(f'IoU faro {iou_faro:.3f} · linterna {iou_lint:.3f}')

# ------------------------------------------------------------------ potrace
def trazar(mask, k, dx=0.0, dy=0.0, esc=1.0, alphamax=1.15, turd=40):
    """mask (bool, ya ×k) → d de SVG en unidades de la imagen original × esc, desplazado (dx, dy)."""
    path = potrace.Bitmap(~mask).trace(turdsize=turd, alphamax=alphamax, opticurve=True, opttolerance=0.5)
    f = lambda p: f'{(p.x / k) * esc + dx:.2f} {(p.y / k) * esc + dy:.2f}'
    out = []
    for c in path:
        s = 'M' + f(c.start_point)
        for seg in c.segments:
            if seg.is_corner: s += 'L' + f(seg.c) + 'L' + f(seg.end_point)
            else: s += 'C' + f(seg.c1) + ' ' + f(seg.c2) + ' ' + f(seg.end_point)
        out.append(s + 'Z')
    return ''.join(out)

# ------------------------------------------------------------------ el símbolo: loma + olas (logo de 181 px) + faro
lg = rgba('lasriberas_logo2021.png')
cerca = mascaras(lg)
lr, lgc, lb, la = [lg[..., i] for i in range(4)]
m_mar = cerca((45, 71, 94), 70)
m_cel = cerca((132, 205, 228), 70)
m_ama = cerca((253, 207, 96), 70)
# solo el dibujo (arriba de la palabra, y < 126)
m_mar[126:] = 0; m_cel[126:] = 0
# el faro del favicon colocado sobre el del logo: escala por el ancho de la linterna y alineado por su centro y su borde de arriba
ys, xs = np.where(m_ama > .5)
lx0, lx1, ly0 = xs.min() - .5, xs.max() + .5, ys.min() - .5
esc = (lx1 - lx0) / FARO['linterna']['w']
tx = (lx0 + lx1) / 2 - FARO['cx'] * esc
ty = ly0 - FARO['linterna']['y0'] * esc
T = lambda x, y: (x * esc + tx, y * esc + ty)
# la loma: su borde de arriba, columna a columna (fuera del faro), y un ajuste cuadrático bajo el faro
Mm = ampliar(m_mar)
Mc = ampliar(m_cel)
h8, w8 = Mm.shape
torre_x0 = T(FARO['cx'] - FARO['balcon']['w'] / 2 - 2, 0)[0] * K
torre_x1 = T(FARO['cx'] + FARO['balcon']['w'] / 2 + 2, 0)[0] * K
cols = [x for x in range(w8) if (x < torre_x0 - 6 or x > torre_x1 + 6)]
tops = {}
for x in cols:
    yy8 = np.where(Mm[int(70 * K):, x])[0]
    if len(yy8): tops[x] = yy8[0] + 70 * K
xs_t = np.array([x for x in tops if abs(x - (torre_x0 + torre_x1) / 2) < (torre_x1 - torre_x0) * 1.6])
ys_t = np.array([tops[x] for x in xs_t])
coef = np.polyfit(xs_t, ys_t, 2)
# borrar el faro por encima de la loma (con margen) y trazar la loma sola
loma = Mm.copy()
for x in range(int(torre_x0) - 4, int(torre_x1) + 5):
    ytop = int(np.polyval(coef, x))
    loma[:max(0, ytop), x] = False
d_loma = trazar(loma, K)
d_olas = trazar(Mc, K)
# la torre del símbolo baja hasta la loma (se tapa con ella)
base_y = ((np.polyval(coef, (torre_x0 + torre_x1) / 2) / K + 3) - ty) / esc
fs = faro_paths(FARO, base_y, T, esc)
# IoU del símbolo entero (marino) contra el logo
sim_mar = raster_d(d_loma, w8 // K, h8 // K) | raster_d(fs['cuerpo'], w8 // K, h8 // K, True)
ref_mar = (m_mar > .5)
iou_sim = iou(sim_mar[:126], ref_mar[:126])
iou_olas = iou(raster_d(d_olas, w8 // K, h8 // K)[:126], (m_cel > .5)[:126])
print(f'IoU símbolo (marino) {iou_sim:.3f} · olas {iou_olas:.3f}')
ys, xs = np.where((m_mar > .3) | (m_cel > .3))
SIM_VB = [float(xs.min() - 1), float(ys.min() - 1), float(xs.max() - xs.min() + 3), float(ys.max() - ys.min() + 3)]

# ------------------------------------------------------------------ LAS RIBERAS (172×43)
pm = rgba('lasriberas_logo2022_m.png')
alfa = pm[..., 3] / 255
alfa[27:] = 0
A8 = ampliar(alfa)
cols = (A8.any(0))
letras = []; s = None
for x, c in enumerate(cols):
    if c and s is None: s = x
    if not c and s is not None: letras.append((s, x - 1)); s = None
if s is not None: letras.append((s, len(cols) - 1))
assert len(letras) == 10, letras
NOMBRES = 'LASRIBERAS'
filas = np.where(A8.any(1))[0]
TOP, BOT = filas.min() / K, (filas.max() + 1) / K           # altura de mayúscula común (en px del original)
# grueso de asta: el de la I (rectángulo puro), en la mitad de su alto
i0, i1 = letras[4]
fila = A8[int((TOP + BOT) / 2 * K), i0:i1 + 1]
ASTA = fila.sum() / K
print(f'mayúscula {TOP:.2f}-{BOT:.2f} ({BOT - TOP:.2f} px), asta {ASTA:.2f} px')

def caja(n):
    x0, x1 = letras[n]; return x0 / K, (x1 + 1) / K

def rect(x0, y0, x1, y1):
    return f'M{x0:.2f} {y0:.2f}H{x1:.2f}V{y1:.2f}H{x0:.2f}Z'

def barra_y(n, desde, hasta):
    """centro de la barra horizontal de una letra entre dos alturas (en px): la fila más llena."""
    x0, x1 = letras[n]
    sub = A8[int(desde * K):int(hasta * K), x0:x1 + 1].sum(1)
    j = np.argmax(sub); return (desde * K + j) / K

rectas = []   # polígonos redibujados
curvas = []   # potrace (S, R y B sin el asta)
for n, ch in enumerate(NOMBRES):
    x0, x1 = caja(n)
    if ch == 'L':
        rectas.append(rect(x0, TOP, x0 + ASTA, BOT) + rect(x0, BOT - ASTA, x1, BOT))
    elif ch == 'I':
        rectas.append(rect(x0, TOP, x0 + ASTA, BOT))
    elif ch == 'E':
        ym = barra_y(n, TOP + 6, BOT - 6)
        # largo de la barra del medio: donde la fila de su centro deja de estar llena
        fila = A8[int(ym * K), letras[n][0]:letras[n][1] + 1]
        xm = x0 + np.where(fila)[0].max() / K
        rectas.append(rect(x0, TOP, x0 + ASTA, BOT) + rect(x0, TOP, x1, TOP + ASTA) + rect(x0, ym - ASTA / 2, xm, ym + ASTA / 2) + rect(x0, BOT - ASTA, x1, BOT))
    elif ch == 'A':
        # patas con el mismo grueso horizontal h; vértice plano de ancho h; travesaño a la altura medida
        h = ASTA * 1.18
        xc = (x0 + x1) / 2
        yb = barra_y(n, (TOP + BOT) / 2 + 2, BOT - 2)
        def pata(sig):
            xo = x0 if sig < 0 else x1
            xt = xc - h / 2 if sig < 0 else xc + h / 2
            xi = xo + h if sig < 0 else xo - h
            xti = xt + h if sig < 0 else xt - h
            pts = [(xo, BOT), (xt, TOP), (xti, TOP), (xi, BOT)]
            if sig > 0: pts.reverse()   # mismo sentido de giro en las dos patas (regla nonzero: se suman, no se restan)
            return 'M' + 'L'.join(f'{a:.2f} {b:.2f}' for a, b in pts) + 'Z'
        # travesaño: entre las caras de dentro de las patas a esa altura
        f = (BOT - yb) / (BOT - TOP)
        xl = x0 + h + (xc - h / 2 - x0) * f
        xr = x1 - h - (x1 - xc - h / 2) * f
        rectas.append(pata(-1) + pata(1) + rect(xl - .3, yb - ASTA / 2, xr + .3, yb + ASTA / 2))
    else:  # S, R, B
        sub = np.zeros_like(A8)
        sub[:, letras[n][0]:letras[n][1] + 1] = A8[:, letras[n][0]:letras[n][1] + 1]
        if ch in 'RB':
            corte = int((x0 + ASTA * .45) * K)   # el borde del corte queda DEBAJO del asta exacta
            sub[:, :corte] = False
            rectas.append(rect(x0, TOP, x0 + ASTA, BOT))
        curvas.append(trazar(sub, K, alphamax=1.1, turd=20))
PAL_VB = [0, TOP - .5, round(letras[-1][1] / K + 1.5, 2), round(BOT - TOP + 1, 2)]
d_rectas = ''.join(rectas)
# medido a ×8 contra el alfa limpio (a 1× los trazos de 3 px dan un IoU que es casi todo borde)
pal = raster_d(d_rectas, 172, 43, True, K) | raster_d(''.join(curvas), 172, 43, False, K)
iou_pal = iou(pal[:27 * K], A8[:27 * K])
print(f'IoU LAS RIBERAS {iou_pal:.3f}')

# ------------------------------------------------------------------ SVG
def svg(vb, cuerpo, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{" ".join(f"{v:g}" for v in vb)}"{extra}>{cuerpo}</svg>\n'

# palabra (currentColor; cada pieza en su <path>: los de potrace llevan par-impar por los huecos de la B y la R)
palabra = f'<path fill="currentColor" d="{d_rectas}"/>' + ''.join(f'<path fill="currentColor" fill-rule="evenodd" d="{c}"/>' for c in curvas)
(SAL / 'palabra.svg').write_text(svg(PAL_VB, palabra), encoding='utf-8')

def simbolo(marino, ola, luz):
    return (f'<path fill="{ola}" fill-rule="evenodd" d="{d_olas}"/>'
            f'<path fill="{marino}" d="{fs["cuerpo"]}"/>'
            f'<path fill="{marino}" fill-rule="evenodd" d="{d_loma}"/>'
            f'<path fill="{luz}" d="{fs["linterna"]}"/>')
(SAL / 'simbolo.svg').write_text(svg(SIM_VB, simbolo(COL['marino'], COL['ola'], COL['luz'])), encoding='utf-8')
(SAL / 'simbolo-claro.svg').write_text(svg(SIM_VB, simbolo('#EEF3F6', COL['ola'], COL['luz'])), encoding='utf-8')

# el faro suelto (para la portada, el pie y el 404): cuerpo currentColor y la linterna aparte; viewBox con origen 0
fx0 = FARO['cx'] - FARO['balcon']['w'] / 2
fT = lambda x, y: (x - fx0 + 30, y - FARO['remate']['y0'] + 2)
BASE = 560
fsolo = faro_paths(FARO, BASE, fT)
FARO_VB = [0, 0, FARO['balcon']['w'] + 60 + 2 * FARO['torre']['abre'] * (BASE - FARO['torre']['y0']), BASE - FARO['remate']['y0'] + 2]
# (ancho: el balcón + margen + lo que se abre la torre; se recoloca abajo para que quede centrado)
desp = (FARO_VB[2] - (FARO['balcon']['w'] + 60)) / 2
fT2 = lambda x, y: (x - fx0 + 30 + desp, y - FARO['remate']['y0'] + 2)
fsolo = faro_paths(FARO, BASE, fT2)
linterna_c = fT2(FARO['cx'], (FARO['linterna']['y0'] + FARO['linterna']['y1']) / 2)
(SAL / 'faro.svg').write_text(svg(FARO_VB, f'<path fill="currentColor" d="{fsolo["cuerpo"]}"/><path fill="{COL["luz"]}" d="{fsolo["linterna"]}"/>'), encoding='utf-8')

# logo apilado: símbolo arriba, palabra debajo (proporción del logo de 181 px: la palabra ocupa el ancho del dibujo)
ancho = SIM_VB[2]
k = ancho / PAL_VB[2]
alto = SIM_VB[3] + 10 + PAL_VB[3] * k
def logo(marino, ola, luz):
    return (f'<g transform="translate({-SIM_VB[0]:.2f} {-SIM_VB[1]:.2f})">{simbolo(marino, ola, luz)}</g>'
            f'<g transform="translate(0 {SIM_VB[3] + 10:.2f}) scale({k:.4f}) translate(0 {-PAL_VB[1]:.2f})" fill="{marino}">'
            + palabra.replace('currentColor', marino) + '</g>')
(SAL / 'logo.svg').write_text(svg([0, 0, round(ancho, 2), round(alto, 2)], logo(COL['marino'], COL['ola'], COL['luz'])), encoding='utf-8')
(SAL / 'logo-claro.svg').write_text(svg([0, 0, round(ancho, 2), round(alto, 2)], logo('#EEF3F6', COL['ola'], COL['luz'])), encoding='utf-8')

# validar con xml.etree
import xml.etree.ElementTree as ET
for f in ['palabra', 'simbolo', 'simbolo-claro', 'faro', 'logo', 'logo-claro']:
    ET.parse(SAL / f'{f}.svg')

datos = {
    'colores': COL,
    'faro': FARO,
    'faro_svg': {'viewBox': FARO_VB, 'base': BASE, 'linterna': [round(linterna_c[0], 2), round(linterna_c[1], 2)],
                 'cuerpo': fsolo['cuerpo'], 'luz': fsolo['linterna']},
    'simbolo': {'viewBox': SIM_VB},
    'palabra': {'viewBox': PAL_VB, 'mayuscula_px': round(BOT - TOP, 2), 'asta_px': round(ASTA, 2)},
    'iou': {'faro_favicon': round(iou_faro, 3), 'linterna': round(iou_lint, 3), 'simbolo_marino': round(iou_sim, 3), 'olas': round(iou_olas, 3), 'las_riberas': round(iou_pal, 3)},
}
(SAL / 'marca.json').write_text(json.dumps(datos, indent=1, ensure_ascii=False), encoding='utf-8')
print('marca/: palabra, simbolo(-claro), faro, logo(-claro).svg y marca.json')
