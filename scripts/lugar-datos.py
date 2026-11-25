# «Del faro a la casa» · datos del 3D de Apartamentos Las Riberas (Vivigo, Oviñana, Cudillero).
#
# Fuentes (todas abiertas):
#   - MDT05 y MDT25 del IGN por WCS (servicios.idee.es/wcs-inspire/mdt)            CC BY 4.0, © IGN
#   - Ortofoto PNOA por WMS y WMTS (www.ign.es/wms-inspire/pnoa-ma, wmts/pnoa-ma)  CC BY 4.0, © IGN
#   - Edificios del Catastro INSPIRE (ovc.catastro.meh.es, WFS BU)                 © Dirección General del Catastro
#   - Lugares de OpenStreetMap (scripts/lugar-osm.py)                               ODbL, © colaboradores de OSM
# Todo se cachea en ref/raw/lugar-cache/ (no viaja a la web) y la salida va a img/lugar/.
#
# Origen de coordenadas: el centro de la planta catastral del bloque de apartamentos (E00306700QJ22G).
# OJO: el pin de Google Maps de su web (43.577007, -6.2514292) cae en el bosque, ~190 m al oeste del edificio.
# Coordenadas locales en metros: x al este, z al sur, y arriba (metros sobre el mar).
# Alturas en PNG RGB: (R*256 + G) / 10 - 100 = metros sobre el mar (mar con fondo inventado, siempre < 0).
#
# Uso: python -I -X utf8 scripts/lugar-datos.py      (antes, una vez: scripts/lugar-osm.py)
import io, json, math, pathlib, re, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
import tifffile

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'lugar-cache'; CACHE.mkdir(parents=True, exist_ok=True)
OUT = R / 'img' / 'lugar'; OUT.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (compatible; sitio-web-dev)'}
REF_APART = 'E00306700QJ22G'                         # referencia catastral del bloque de apartamentos
PIN_WEB = (43.577007, -6.2514292)                    # el de su enlace de Google Maps (mal situado)
APROX = (43.57734, -6.24907)                         # para las cajas de descarga; el origen exacto sale del Catastro


def bajar(url, destino, intentos=5):
    if destino.exists() and destino.stat().st_size > 2000:
        return destino.read_bytes()
    for k in range(intentos):
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=240).read()
            if len(b) < 2000 and b'<' in b[:200]:
                raise IOError(b[:120])
            destino.write_bytes(b); print('bajado', destino.name, len(b) // 1024, 'KB', flush=True); return b
        except Exception as e:
            print('falla', destino.name, str(e)[:90], flush=True); time.sleep(3 + 4 * k)
    raise SystemExit('No se pudo bajar ' + destino.name)


# ------------------------------------------------------------------ Catastro (primero: da el origen)
def wfs(servicio, tipo, S, O, N, E, nombre):
    url = (f'https://ovc.catastro.meh.es/INSPIRE/{servicio}.aspx?service=WFS&version=2.0.0&request=GetFeature'
           f'&typenames={tipo}&srsname=EPSG::4258&bbox={S},{O},{N},{E}')
    return bajar(url, CACHE / nombre).decode('latin-1')


def poligonos(xml):
    out = []
    for m in re.finditer(r'<(?:gml:featureMember|wfs:member|member)>(.*?)</(?:gml:featureMember|wfs:member|member)>', xml, re.S):
        f = m.group(1)
        lid = re.search(r'localId>([^<]+)', f)
        pis = re.search(r'numberOfFloorsAboveGround>(\d+)', f)
        anillos = []
        for pl in re.findall(r'<gml:posList[^>]*>([^<]+)</gml:posList>', f):
            v = list(map(float, pl.split()))
            anillos.append([(v[i], v[i + 1]) for i in range(0, len(v), 2)])     # lat lon (EPSG:4258)
        if lid and anillos:
            out.append({'id': lid.group(1), 'pisos': int(pis.group(1)) if pis else None, 'anillos': anillos})
    return out


def area_signo(pts):
    return 0.5 * sum(pts[i - 1][0] * pts[i][1] - pts[i][0] * pts[i - 1][1] for i in range(len(pts)))


def centroide(pts):
    a = area_signo(pts); cx = cz = 0.0
    for i in range(len(pts)):
        x0, z0 = pts[i - 1]; x1, z1 = pts[i]; c = x0 * z1 - x1 * z0
        cx += (x0 + x1) * c; cz += (z0 + z1) * c
    return cx / (6 * a), cz / (6 * a)


# finca: caja de ~640 m alrededor del bloque
FS, FN = APROX[0] - 0.00289, APROX[0] + 0.00289
FO, FE = APROX[1] - 0.00397, APROX[1] + 0.00397
bp_f = poligonos(wfs('wfsBU', 'BU:BuildingPart', FS, FO, FN, FE, 'bp-finca-640.xml'))
p1 = next(b for b in bp_f if b['id'] == REF_APART + '_part1')
anillo_ll = p1['anillos'][0][:-1] if p1['anillos'][0][0] == p1['anillos'][0][-1] else p1['anillos'][0]
# centroide en lat/lon (con una proyección local provisional)
k0 = 111320 * math.cos(math.radians(APROX[0]))
pp = [((lo - APROX[1]) * k0, (APROX[0] - la) * 110950) for la, lo in anillo_ll]
cxp, czp = centroide(pp)
CASA = (round(APROX[0] - czp / 110950, 7), round(APROX[1] + cxp / k0, 7))
KX = 111320 * math.cos(math.radians(CASA[0])); KZ = 110950
def loc(lat, lon): return ((lon - CASA[1]) * KX, (CASA[0] - lat) * KZ)
def geo(x, z): return (CASA[0] - z / KZ, CASA[1] + x / KX)
print('origen (centro del bloque, Catastro):', CASA, '· el pin de su web queda a', [round(v) for v in loc(*PIN_WEB)], 'm', flush=True)

# ------------------------------------------------------------------ cajas
# cercana (MDT05 + PNOA): de la playa de Gavieiro a Cudillero, del mar (2 km más allá del faro) a la sierra
CS, CN, CO, CE = 43.545, 43.612, -6.310, -6.135
DLON, DLAT = (CE - CO) / 40, (CN - CS) / 24              # lejana alineada con la cercana
LO, LE = CO - 88 * DLON, CE + 76 * DLON
LS, LN = CS - 105 * DLAT, CN + 49 * DLAT
CAJA5 = (CS, CN, CO, CE); CAJA25 = (43.25, 43.75, -6.70, -5.80)   # el WCS da como mucho 4096 px de lado


def wms(S, O, N, E, w, h, nombre, nivel=0):
    """Una petición WMS; si el servidor da 502 una y otra vez (le pasa con algunas cajas), se parte en cuatro."""
    url = ('https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=OI.OrthoimageCoverage'
           f'&STYLES=&CRS=EPSG:4326&BBOX={S},{O},{N},{E}&WIDTH={w}&HEIGHT={h}&FORMAT=image/jpeg')
    try:
        return Image.open(io.BytesIO(bajar(url, CACHE / nombre, 3 if nivel < 2 else 6))).convert('RGB')
    except SystemExit:
        if nivel >= 2:
            raise
        print('se parte en cuatro', nombre, flush=True)
        im = Image.new('RGB', (w, h)); w2, h2 = w // 2, h // 2; Om, Nm = (O + E) / 2, (N + S) / 2
        for i, (o, e, x0, ww) in enumerate(((O, Om, 0, w2), (Om, E, w2, w - w2))):
            for j, (n, s_, y0, hh) in enumerate(((N, Nm, 0, h2), (Nm, S, h2, h - h2))):
                im.paste(wms(s_, o, n, e, ww, hh, nombre.replace('.jpg', f'-{i}{j}.jpg'), nivel + 1), (x0, y0))
        return im


def mosaico(S, O, N, E, W, H, nx, ny, base):
    f = CACHE / (base + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    im = Image.new('RGB', (W, H))
    for i in range(nx):
        for j in range(ny):
            o, e = O + (E - O) * i / nx, O + (E - O) * (i + 1) / nx
            n, s = N - (N - S) * j / ny, N - (N - S) * (j + 1) / ny
            im.paste(wms(s, o, n, e, W // nx, H // ny, f'{base}-{i}{j}.jpg'), (i * W // nx, j * H // ny))
    im.save(f); return im


def wmts_caja(S, O, N, E, zoom, W, H, nombre):
    """Ortofoto PNOA por teselas WMTS (GoogleMapsCompatible) recortada y llevada a la caja lat/lon (W x H)."""
    f = CACHE / (nombre + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    n = 2 ** zoom
    tx = lambda lon: (np.asarray(lon, np.float64) + 180) / 360 * n
    ty = lambda lat: (1 - np.arcsinh(np.tan(np.radians(np.asarray(lat, np.float64)))) / np.pi) / 2 * n
    x0, x1, y0, y1 = tx(O), tx(E), ty(N), ty(S)
    cols = range(int(x0), int(x1) + 1); filas = range(int(y0), int(y1) + 1)
    lienzo = Image.new('RGB', (len(cols) * 256, len(filas) * 256))
    tdir = CACHE / f'wmts{zoom}'; tdir.mkdir(exist_ok=True)
    for i, c in enumerate(cols):
        for j, r in enumerate(filas):
            url = ('https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible'
                   f'&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={zoom}&TileCol={c}&TileRow={r}')
            lienzo.paste(Image.open(io.BytesIO(bajar(url, tdir / f'{c}-{r}.jpg'))).convert('RGB'), (i * 256, j * 256))
    a = np.asarray(lienzo, np.float32)
    lat = N - (np.arange(H) + 0.5) / H * (N - S); lon = O + (np.arange(W) + 0.5) / W * (E - O)
    py = (ty(lat) - int(y0)) * 256 - 0.5; px = (tx(lon) - int(x0)) * 256 - 0.5
    PY, PX = np.meshgrid(py, px, indexing='ij')
    out = np.stack([ndimage.map_coordinates(a[..., k], [PY, PX], order=1) for k in range(3)], -1)
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)); im.save(f); return im


def wcs(cov, S, N, O, E, nombre):
    url = ('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage'
           f'&COVERAGEID={cov}&FORMAT=image/tiff&SUBSET=Lat({S},{N})&SUBSET=Long({O},{E})')
    bajar(url, CACHE / nombre)
    return tifffile.imread(CACHE / nombre).astype(np.float32)


# ------------------------------------------------------------------ el faro (OSM + Catastro)
osm = json.loads((CACHE / 'osm-lugares.json').read_text(encoding='utf-8'))['elements']
def coords(e):
    return e.get('lat', e.get('center', {}).get('lat')), e.get('lon', e.get('center', {}).get('lon'))
faro_osm = next(e for e in osm if e.get('tags', {}).get('man_made') == 'lighthouse' and 'Vidio' in e['tags'].get('name', ''))
FLAT, FLON = coords(faro_osm)
bp_faro = poligonos(wfs('wfsBU', 'BU:BuildingPart', FLAT - 0.0012, FLON - 0.0016, FLAT + 0.0012, FLON + 0.0016, 'bp-faro-cerca.xml'))

# ------------------------------------------------------------------ descargas
mdt5 = wcs('Elevacion4258_5', CS, CN, CO, CE, 'mdt5-cerca.tif')
mdt25 = wcs('Elevacion4258_25', CAJA25[0], CAJA25[1], CAJA25[2], CAJA25[3], 'mdt25-lejos.tif')
print('MDT05', mdt5.shape, mdt5.min(), mdt5.max(), 'MDT25', mdt25.shape, flush=True)
cx0, cz0 = loc(CN, CO); cx1, cz1 = loc(CS, CE)
ANCHO_C = 3072; ALTO_C = int(round(ANCHO_C * (cz1 - cz0) / (cx1 - cx0) / 4)) * 4
orto_c = mosaico(CS, CO, CN, CE, ANCHO_C, ALTO_C, 4, 2, 'pnoa-cerca4')
orto_l = wms(CAJA25[0], CAJA25[2], CAJA25[1], CAJA25[3], 2048, int(2048 * 0.5 * 110950 / (1.0 * 111320 * math.cos(math.radians(43.5)))), 'pnoa-lejos.jpg')


# ------------------------------------------------------------------ muestreo geográfico
def muestrea(a, caja, lat, lon, orden=1):
    """Muestrea el ráster `a` (fila 0 = norte) de caja (S, N, O, E) en lat/lon (arrays)."""
    S, N, O, E = caja
    fil = (N - lat) / (N - S) * a.shape[0] - 0.5
    col = (lon - O) / (E - O) * a.shape[1] - 0.5
    return ndimage.map_coordinates(a, [fil, col], order=orden, mode='nearest')


mdt5 = np.where(mdt5 < -50, 0, mdt5)                     # sin dato = mar
mdt5_s = ndimage.gaussian_filter(mdt5, 1.3)              # viene en metros enteros: se quitan los escalones
mar5 = mdt5 <= 0.4
et, n = ndimage.label(mar5)
toca = set(np.unique(et[0, :])) - {0}                    # el mar toca el borde norte
mar5 = np.isin(et, list(toca))
paso5 = ((CE - CO) * KX / mdt5.shape[1], (CN - CS) * KZ / mdt5.shape[0])
dist5 = ndimage.distance_transform_edt(mar5, sampling=(paso5[1], paso5[0]))
fondo5 = -2.0 - np.minimum(dist5 * 0.05, 45.0)
alt5 = np.where(mar5, fondo5, np.maximum(mdt5_s, 0.7))
mdt25 = np.where(mdt25 < -50, 0, mdt25)
mar25 = mdt25 <= 0.4
et, n = ndimage.label(mar25); toca = set(np.unique(et[0, :])) - {0}; mar25 = np.isin(et, list(toca))
dist25 = ndimage.distance_transform_edt(mar25, sampling=(25.0, 25.0))
alt25 = np.where(mar25, -30.0 - np.minimum(dist25 * 0.02, 60), np.maximum(mdt25, 0.7))


def alt_en(lat, lon, fina=True):
    lat = np.asarray(lat, np.float64); lon = np.asarray(lon, np.float64)
    a = muestrea(alt25, CAJA25, lat, lon)
    if fina:
        dentro = (lat >= CS) & (lat <= CN) & (lon >= CO) & (lon <= CE)
        if dentro.any():
            a = a.copy(); a[dentro] = muestrea(alt5, CAJA5, lat[dentro], lon[dentro])
    return a


def alt_xz(x, z):
    la, lo = geo(x, z); return float(alt_en(np.array([la]), np.array([lo]))[0])


def png_alturas(h, nombre):
    v = np.clip(np.round((h + 100.0) * 10), 0, 65535).astype(np.uint16)
    rgb = np.stack([(v >> 8).astype(np.uint8), (v & 255).astype(np.uint8), np.zeros_like(v, np.uint8)], -1)
    Image.fromarray(rgb, 'RGB').save(OUT / nombre, optimize=True)


def rejilla_local(x0, z0, x1, z1, paso):
    nx = int(round((x1 - x0) / paso)) + 1; nz = int(round((z1 - z0) / paso)) + 1
    xs = np.linspace(x0, x1, nx); zs = np.linspace(z0, z1, nz)
    X, Z = np.meshgrid(xs, zs)
    lat, lon = geo(X, Z)
    return X, Z, lat, lon, nx, nz


FX, FZ = loc(FLAT, FLON)                                  # el faro (nodo OSM), en metros locales
print('faro (OSM node/%s) en' % faro_osm['id'], round(FX), round(FZ), 'suelo', round(alt_xz(FX, FZ), 1), 'm', flush=True)
rasters = {}
CAJAS_R = {
    'cerca': (cx0, cz0, cx1, cz1, 20.0),
    'medio': (-1700.0, -2500.0, 1700.0, 900.0, 10.0),
    'finca': (-320.0, -320.0, 320.0, 320.0, 4.0),
    'cabo': (round(FX) - 280.0, round(FZ) - 280.0, round(FX) + 280.0, round(FZ) + 280.0, 4.0),
}
for nombre, (x0, z0, x1, z1, paso) in CAJAS_R.items():
    X, Z, lat, lon, nx, nz = rejilla_local(x0, z0, x1, z1, paso)
    h = alt_en(lat, lon)
    png_alturas(h, f'alturas-{nombre}.png')
    rasters[nombre] = {'x0': round(x0, 2), 'z0': round(z0, 2), 'x1': round(x1, 2), 'z1': round(z1, 2), 'w': nx, 'h': nz,
                       'archivo': f'alturas-{nombre}.png'}
    print('alturas', nombre, nx, 'x', nz, round(float(h.min()), 1), round(float(h.max()), 1), flush=True)

# anillo lejano: vértices sobre la rejilla alineada (los bordes coinciden con la caja cercana)
nlx = int(round((LE - LO) / DLON)) + 1; nlz = int(round((LN - LS) / DLAT)) + 1
lons = LO + np.arange(nlx) * DLON; lats = LN - np.arange(nlz) * DLAT
LON_, LAT_ = np.meshgrid(lons, lats)
k = max(1, int(round(DLON * KX / 19.0)))
med = ndimage.uniform_filter(alt25, size=k); mx = ndimage.maximum_filter(alt25, size=k)
mezcla = np.where(alt25 > 0, 0.55 * med + 0.45 * mx, med)          # si no, las cumbres se aplanan
hl = muestrea(mezcla, CAJA25, LAT_, LON_)
dentro = (LAT_ >= CS - 1e-9) & (LAT_ <= CN + 1e-9) & (LON_ >= CO - 1e-9) & (LON_ <= CE + 1e-9)
hl[dentro] = muestrea(alt5, CAJA5, LAT_[dentro], LON_[dentro])
png_alturas(hl, 'alturas-lejos.png')
lx0, lz0 = loc(LN, LO); lx1, lz1 = loc(LS, LE)
rasters['lejos'] = {'x0': round(lx0, 2), 'z0': round(lz0, 2), 'x1': round(lx1, 2), 'z1': round(lz1, 2), 'w': nlx, 'h': nlz,
                    'archivo': 'alturas-lejos.png',
                    'hueco': [int(round((CO - LO) / DLON)), int(round((LN - CN) / DLAT)), int(round((CE - LO) / DLON)), int(round((LN - CS) / DLAT))]}
print('lejos', nlx, 'x', nlz, 'hueco', rasters['lejos']['hueco'], flush=True)

# ------------------------------------------------------------------ costa (para el agua)
CW, CH = 1024, 512
fil = np.linspace(0, mdt5.shape[0] - 1, CH); col = np.linspace(0, mdt5.shape[1] - 1, CW)
F_, C_ = np.meshgrid(fil, col, indexing='ij')
d = ndimage.map_coordinates(dist5, [F_, C_], order=1)
tierra = ndimage.map_coordinates((~mar5).astype(np.float32), [F_, C_], order=1)
costa = np.stack([np.clip(d / 3.0, 0, 255), np.clip(tierra * 255, 0, 255), np.zeros_like(d)], -1).astype(np.uint8)
Image.fromarray(costa, 'RGB').save(OUT / 'costa.png', optimize=True)


# ------------------------------------------------------------------ edificios
def rect_orientado(pts):
    P = np.array(pts); mejor = None
    for g in np.radians(np.arange(0, 90, 0.5)):
        c, s = math.cos(g), math.sin(g)
        u = P[:, 0] * c + P[:, 1] * s; v = -P[:, 0] * s + P[:, 1] * c
        a = (u.max() - u.min()) * (v.max() - v.min())
        if mejor is None or a < mejor[0]:
            mejor = (a, g, (u.max() + u.min()) / 2, (v.max() + v.min()) / 2, u.max() - u.min(), v.max() - v.min())
    a, g, uc, vc, lu, lv = mejor
    c, s = math.cos(g), math.sin(g)
    cx, cz = uc * c - vc * s, uc * s + vc * c
    if lv > lu:
        lu, lv, g = lv, lu, g + math.pi / 2
    return {'cx': round(cx, 2), 'cz': round(cz, 2), 'largo': round(lu, 2), 'fondo': round(lv, 2), 'ang': round(g, 4)}


def anillo_local(b):
    pts = [loc(la, lo) for la, lo in b['anillos'][0]]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    return pts


def dentro_pol(pt, an):
    c = False
    for i in range(len(an)):
        a, b = an[i], an[i - 1]
        if (a[1] > pt[1]) != (b[1] > pt[1]) and pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]:
            c = not c
    return c


def suelo_de(pts):
    lat = np.array([geo(x, z)[0] for x, z in pts]); lon = np.array([geo(x, z)[1] for x, z in pts])
    hs = alt_en(lat, lon); return round(float(hs.min()), 2), round(float(hs.max()), 2)


edificios = []
# 1) el bloque de apartamentos: part1 = la planta cerrada; part2 = el porche (bajo el mismo tejado)
ap = anillo_local(p1)
porche_b = next(b for b in bp_f if b['id'] == REF_APART + '_part2')
po = anillo_local(porche_b)
s0, s1 = suelo_de(ap + po)
edificios.append({'id': p1['id'], 'tipo': 'apartamentos', 'pisos': p1['pisos'] or 1, 'suelo': s0, 'suelo_max': s1,
                  'anillo': [[round(x, 2), round(z, 2)] for x, z in ap], 'rect': rect_orientado(ap), 'area': round(abs(area_signo(ap)), 1)})

# el tejado en L: dos alas (rectángulos con faldones) que se cortan solas en la limatesa y la limahoya
union = ap + po
L_rect = rect_orientado(union)
g = L_rect['ang']; cg, sg = math.cos(g), math.sin(g)
def a_uv(x, z): return ((x - L_rect['cx']) * cg + (z - L_rect['cz']) * sg, -(x - L_rect['cx']) * sg + (z - L_rect['cz']) * cg)
def de_uv(u, v): return (L_rect['cx'] + u * cg - v * sg, L_rect['cz'] + u * sg + v * cg)
UL, VL = L_rect['largo'] / 2, L_rect['fondo'] / 2
# rejilla de ocupación en el marco del ala larga (0,25 m)
paso_o = 0.25
us = np.arange(-UL, UL, paso_o) + paso_o / 2; vs = np.arange(-VL, VL, paso_o) + paso_o / 2
occ_im = Image.new('L', (len(us), len(vs)), 0); dd_ = ImageDraw.Draw(occ_im)
for an in (ap, po):
    dd_.polygon([((u + UL) / paso_o - 0.5, (v + VL) / paso_o - 0.5) for u, v in (a_uv(x, z) for x, z in an)], fill=255)
occ = np.asarray(occ_im) > 0
esq = {(su, sv): bool(occ[(4 if sv < 0 else -5), (4 if su < 0 else -5)]) for su in (-1, 1) for sv in (-1, 1)}   # 1 m hacia dentro
hueca = [kk for kk, v in esq.items() if not v]
assert len(hueca) == 1, ('el bloque no tiene forma de L', esq)
hu, hv = hueca[0]                                         # esquina vacía = el patio del porche
# grueso de cada ala: el ala larga ocupa en v desde el borde exterior (-hv) hasta donde acaba la ocupación junto a la
# esquina vacía; el ala corta, en u, desde el borde exterior (-hu)
col_lejos = occ[:, -5 if hu > 0 else 4]                   # columna en el extremo donde solo está el ala larga
fila_lejos = occ[-5 if hv > 0 else 4, :]                  # fila en el extremo donde solo está el ala corta
gv = col_lejos.sum() * paso_o; gu = fila_lejos.sum() * paso_o
ala_larga = {'u0': -UL, 'u1': UL, 'v0': -VL if hv > 0 else VL - gv, 'v1': -VL + gv if hv > 0 else VL}
ala_corta = {'u0': -UL if hu > 0 else UL - gu, 'u1': -UL + gu if hu > 0 else UL, 'v0': -VL, 'v1': VL}
def rect_de(a):
    u0, u1, v0, v1 = a['u0'], a['u1'], a['v0'], a['v1']
    cx, cz = de_uv((u0 + u1) / 2, (v0 + v1) / 2)
    lu, lv, ang = u1 - u0, v1 - v0, g
    if lv > lu:
        lu, lv, ang = lv, lu, g + math.pi / 2
    return {'cx': round(cx, 2), 'cz': round(cz, 2), 'largo': round(lu, 2), 'fondo': round(lv, 2), 'ang': round(ang, 4)}
tejado_L = [rect_de(ala_larga), rect_de(ala_corta)]
print('bloque en L:', round(2 * UL, 1), 'x', round(2 * VL, 1), 'm; alas de', round(gv, 1), 'y', round(gu, 1), 'm de fondo; patio hacia', hueca[0], flush=True)

# postes del porche: los lados de part2 que no tocan part1 (el borde abierto bajo el alero)
postes = []
for i in range(len(po)):
    a, b = po[i - 1], po[i]
    l = math.hypot(b[0] - a[0], b[1] - a[1])
    if l < 2.0:
        continue
    nx_, nz_ = (b[1] - a[1]) / l, -(b[0] - a[0]) / l
    mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    if dentro_pol((mid[0] + nx_ * 0.4, mid[1] + nz_ * 0.4), ap) or dentro_pol((mid[0] - nx_ * 0.4, mid[1] - nz_ * 0.4), ap):
        continue                                          # lado pegado a la pared
    n_ = max(1, int(round(l / 3.7)))
    for kk in range(n_ + 1):
        t = kk / n_
        postes.append([round(a[0] + (b[0] - a[0]) * t, 2), round(a[1] + (b[1] - a[1]) * t, 2)])
# quita duplicados (esquinas)
uniq = []
for p in postes:
    if all(math.hypot(p[0] - q[0], p[1] - q[1]) > 1.2 for q in uniq):
        uniq.append(p)
postes = uniq
print('postes del porche', len(postes), flush=True)

# 2) el pabellón de la piscina: NO está en el Catastro ni en la ortofoto PNOA (en su sitio se ve una terraza).
#    Se pone por las fotos (fachada y Piscina7/8): cuerpo de madera y cristal con tejado a dos aguas que sale del
#    ala larga hacia el patio, en su extremo libre (el del lado del mar en la foto de la fachada). Tamaño estimado.
u_fin = ala_larga['u1'] if hu > 0 else ala_larga['u0']    # extremo libre del ala larga (lado de la esquina vacía)
sgn = 1 if hu > 0 else -1
v_borde = ala_larga['v1'] if hv > 0 else ala_larga['v0']  # borde del alero hacia el patio
PAB_ANCHO, PAB_SALE = 8.4, 7.6
pu = u_fin - sgn * (0.5 + PAB_ANCHO / 2); pv = v_borde + (1 if hv > 0 else -1) * (PAB_SALE / 2 - 1.2)
pcx, pcz = de_uv(pu, pv)
pab_ang = g + math.pi / 2                                 # el lado largo (la cumbrera) va hacia el patio
pabellon = {'cx': round(pcx, 2), 'cz': round(pcz, 2), 'largo': PAB_SALE + 2.4, 'fondo': PAB_ANCHO, 'ang': round(pab_ang, 4),
            'sale': PAB_SALE, 'hacia': [round(-sg * (1 if hv > 0 else -1), 4), round(cg * (1 if hv > 0 else -1), 4)]}
pabellon['suelo'] = round(alt_xz(pcx, pcz), 2)

# 3) el faro: casa del torrero (Catastro) y torre redonda (el arco de su planta)
faro_partes = [b for b in bp_faro if b['id'].startswith(bp_faro[0]['id'].split('_')[0])] if bp_faro else []
torre = None
for b in faro_partes:
    pts = anillo_local(b)
    s0, s1 = suelo_de(pts)
    edificios.append({'id': b['id'], 'tipo': 'faro', 'pisos': b['pisos'] or 1, 'suelo': s0, 'suelo_max': s1,
                      'anillo': [[round(x, 2), round(z, 2)] for x, z in pts], 'rect': rect_orientado(pts), 'area': round(abs(area_signo(pts)), 1)})
    # el arco: vértices muy juntos (< 1 m) seguidos
    cand = [pts[i] for i in range(len(pts)) if math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) < 1.0
            and math.hypot(pts[(i + 1) % len(pts)][0] - pts[i][0], pts[(i + 1) % len(pts)][1] - pts[i][1]) < 1.0]
    if len(cand) >= 6:
        A = np.array([[2 * x, 2 * z, 1] for x, z in cand]); bb = np.array([x * x + z * z for x, z in cand])
        sol_ = np.linalg.lstsq(A, bb, rcond=None)[0]
        r_ = math.sqrt(sol_[2] + sol_[0] ** 2 + sol_[1] ** 2)
        torre = {'x': round(sol_[0], 2), 'z': round(sol_[1], 2), 'r': round(r_, 2)}
if torre is None:
    torre = {'x': round(FX, 2), 'z': round(FZ, 2), 'r': 2.1}
torre['suelo'] = round(alt_xz(torre['x'], torre['z']), 2)
torre['foco'] = 101.0                                     # altura del plano focal sobre el mar (Wikipedia; OSM seamark:light:height=101)
print('torre del faro', torre, '· a', round(math.hypot(torre['x'] - FX, torre['z'] - FZ), 1), 'm del nodo OSM', flush=True)

# 4) vecinas a menos de 300 m del bloque
for b in bp_f:
    if b['id'].startswith(REF_APART):
        continue
    pts = anillo_local(b)
    if abs(area_signo(pts)) < 6 or math.hypot(*np.mean(pts, axis=0)) > 300:
        continue
    s0, s1 = suelo_de(pts)
    rc = rect_orientado(pts)
    edificios.append({'id': b['id'], 'tipo': 'vecina', 'pisos': b['pisos'] or 1, 'suelo': s0, 'suelo_max': s1,
                      'anillo': [[round(x, 2), round(z, 2)] for x, z in pts], 'rect': rc, 'area': round(abs(area_signo(pts)), 1)})
print('edificios', len(edificios), {t: sum(1 for e in edificios if e['tipo'] == t) for t in ('apartamentos', 'faro', 'vecina')}, flush=True)

# ------------------------------------------------------------------ ortofotos
def gradua(img, ref_img, mascara_img=None, mascara_ref=None):
    a = np.asarray(img, np.float32); b = np.asarray(ref_img, np.float32)
    ma = a.reshape(-1, 3) if mascara_img is None else a[mascara_img]
    mb = b.reshape(-1, 3) if mascara_ref is None else b[mascara_ref]
    out = (a - ma.mean(0)) / (ma.std(0) + 1e-3) * mb.std(0) + mb.mean(0)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def mar_a(w, h, caja):
    S, N, O, E = caja
    lat = N - (np.arange(h) + 0.5) / h * (N - S); lon = O + (np.arange(w) + 0.5) / w * (E - O)
    LON2, LAT2 = np.meshgrid(lon, lat)
    return alt_en(LAT2, LON2) < 0


MAR_RGB = [26, 60, 76]
oc = np.asarray(orto_c, np.float32).copy()
marC = mar_a(oc.shape[1], oc.shape[0], CAJA5)
oc[marC] = MAR_RGB
orto_c2 = Image.fromarray(oc.astype(np.uint8))
orto_c2.save(OUT / 'orto-cerca-3072.webp', quality=70, method=6)
orto_c2.resize((2048, int(round(2048 * ALTO_C / ANCHO_C))), Image.LANCZOS).save(OUT / 'orto-cerca-2048.webp', quality=72, method=6)

# la ortofoto lejana (mosaico de poca resolución) trae nubes: se rellenan con el color de alrededor
def sin_nubes(img):
    a = np.asarray(img, np.float32).copy()
    lum = a.mean(-1); sat = a.max(-1) - a.min(-1)
    nube = ndimage.binary_dilation((lum > 150) & (sat < 45), iterations=3)
    libre = (~nube).astype(np.float32)
    for k in range(3):
        num = ndimage.gaussian_filter(a[..., k] * libre, 14); den = ndimage.gaussian_filter(libre, 14) + 1e-4
        a[..., k] = np.where(nube, num / den, a[..., k])
    print('nubes quitadas de la ortofoto lejana:', round(float(nube.mean()) * 100, 1), '% de la imagen', flush=True)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


ol = sin_nubes(orto_l); S, N, O, E = CAJA25
i0 = int((CO - O) / (E - O) * ol.width); i1 = int((CE - O) / (E - O) * ol.width)
j0 = int((N - CN) / (N - S) * ol.height); j1 = int((N - CS) / (N - S) * ol.height)
marL = mar_a(ol.width, ol.height, CAJA25)
ref = orto_c2.resize((i1 - i0, j1 - j0), Image.LANCZOS)
marRef = mar_a(i1 - i0, j1 - j0, CAJA5)
olg = np.asarray(gradua(ol, ref, ~marL & (np.asarray(ol).sum(-1) < 700), ~marRef), np.float32)
gris = olg.mean(-1, keepdims=True); olg = gris + (olg - gris) * 0.7
olg[marL] = MAR_RGB
Image.fromarray(olg.astype(np.uint8)).save(OUT / 'orto-lejos-2048.webp', quality=70, method=6)

# medio (de la finca al faro): WMS a ~1,7 m/px
mx0, mz0, mx1, mz1, _ = CAJAS_R['medio']
mN, mO = geo(mx0, mz0); mS, mE = geo(mx1, mz1)
orto_m = mosaico(mS, mO, mN, mE, 2048, 2048, 2, 2, 'pnoa-medio')
om = np.asarray(orto_m, np.float32).copy(); om[mar_a(2048, 2048, (mS, mN, mO, mE))] = MAR_RGB
orto_m = Image.fromarray(om.astype(np.uint8))

# finca y cabo: WMTS zoom 19 (~0,3 m/px)
fx0, fz0, fx1, fz1, _ = CAJAS_R['finca']
fN, fO = geo(fx0, fz0); fS, fE = geo(fx1, fz1)
orto_f = wmts_caja(fS, fO, fN, fE, 19, 2048, 2048, 'pnoa-finca-z19')
bx0, bz0, bx1, bz1, _ = CAJAS_R['cabo']
bN, bO = geo(bx0, bz0); bS, bE = geo(bx1, bz1)
orto_b = wmts_caja(bS, bO, bN, bE, 19, 1536, 1536, 'pnoa-cabo-z19')


def borra_tejados(img, caja_xz, poligonos_xz, margen_px=5):
    """Bajo los edificios 3D, el color de alrededor (para que no se vea el tejado de la foto dos veces)."""
    a = np.asarray(img, np.float32).copy(); W, H = img.size
    x0, z0, x1, z1 = caja_xz
    a_px = lambda x, z: ((x - x0) / (x1 - x0) * W, (z - z0) / (z1 - z0) * H)
    masc = Image.new('L', (W, H), 0); dm = ImageDraw.Draw(masc)
    for pol in poligonos_xz:
        dm.polygon([a_px(x, z) for x, z in pol], fill=255)
    masc = masc.filter(ImageFilter.MaxFilter(margen_px | 1))
    m_ = np.asarray(masc, np.float32) / 255.0; libre = 1.0 - m_
    num = np.stack([ndimage.gaussian_filter(a[..., k] * libre, 18) for k in range(3)], -1)
    den = ndimage.gaussian_filter(libre, 18)[..., None] + 1e-4
    relleno = num / den * (0.94 + 0.06 * np.random.default_rng(3).random(a.shape[:2] + (1,)))
    suave = ndimage.gaussian_filter(m_, 2.0)[..., None]
    return Image.fromarray(np.clip(a * (1 - suave) + relleno * suave, 0, 255).astype(np.uint8)), masc


def rect_pol(rc, extra=0.0):
    c, s = math.cos(rc['ang']), math.sin(rc['ang']); L, F = rc['largo'] / 2 + extra, rc['fondo'] / 2 + extra
    return [(rc['cx'] + u * c - v * s, rc['cz'] + u * s + v * c) for u, v in ((-L, -F), (L, -F), (L, F), (-L, F))]


pol_finca = [rect_pol(r, 1.0) for r in tejado_L] + [rect_pol(pabellon, 1.4)] + \
            [rect_pol(e['rect'], 1.2) for e in edificios if e['tipo'] == 'vecina'] + [e['anillo'] for e in edificios if e['tipo'] == 'vecina']
orto_f2, masc_f = borra_tejados(orto_f, (fx0, fz0, fx1, fz1), pol_finca, 7)
orto_f2.save(OUT / 'orto-finca-2048.webp', quality=74, method=6)
orto_f2.resize((1024, 1024), Image.LANCZOS).save(OUT / 'orto-finca-1024.webp', quality=76, method=6)
pol_faro = [rect_pol(e['rect'], 1.0) for e in edificios if e['tipo'] == 'faro']
pol_faro.append([(torre['x'] + (torre['r'] + 1.2) * math.cos(a), torre['z'] + (torre['r'] + 1.2) * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 20)])
ob = np.asarray(orto_b, np.float32).copy(); ob[mar_a(1536, 1536, (bS, bN, bO, bE))] = MAR_RGB
orto_b2, _ = borra_tejados(Image.fromarray(ob.astype(np.uint8)), (bx0, bz0, bx1, bz1), pol_faro, 7)
orto_b2.resize((1024, 1024), Image.LANCZOS).save(OUT / 'orto-cabo-1024.webp', quality=76, method=6)
orto_b2.resize((512, 512), Image.LANCZOS).save(OUT / 'orto-cabo-512.webp', quality=78, method=6)
# el medio, con la finca y el cabo ya limpios encima (para que no cambie de foto al pasar de un nivel a otro)
def pega(dst, dst_caja, src, src_caja):
    x0, z0, x1, z1 = dst_caja; W, H = dst.size
    sx0, sz0, sx1, sz1 = src_caja
    i0, j0 = int((sx0 - x0) / (x1 - x0) * W), int((sz0 - z0) / (z1 - z0) * H)
    i1, j1 = int((sx1 - x0) / (x1 - x0) * W), int((sz1 - z0) / (z1 - z0) * H)
    dst.paste(src.resize((i1 - i0, j1 - j0), Image.LANCZOS), (i0, j0))
pega(orto_m, (mx0, mz0, mx1, mz1), orto_f2, (fx0, fz0, fx1, fz1))
pega(orto_m, (mx0, mz0, mx1, mz1), orto_b2, (bx0, bz0, bx1, bz1))
orto_m.save(OUT / 'orto-medio-2048.webp', quality=72, method=6)
orto_m.resize((1024, 1024), Image.LANCZOS).save(OUT / 'orto-medio-1024.webp', quality=74, method=6)


# ------------------------------------------------------------------ árboles alrededor de la finca
def arboles():
    """Copas detectadas en la ortofoto de detalle (verde oscuro y rugoso), en ~240 m alrededor del bloque."""
    a = np.asarray(orto_f, np.float32)
    lum = a.mean(-1); verde = a[..., 1] - (a[..., 0] + a[..., 2]) / 2
    rug = ndimage.generic_filter(ndimage.zoom(lum, 0.25, order=1), np.std, size=5)
    rug = ndimage.zoom(rug, 4, order=1)[:lum.shape[0], :lum.shape[1]]
    lum_s = ndimage.gaussian_filter(lum, 3)
    copa = (lum_s < 92) & (rug > 9) & (ndimage.gaussian_filter(verde, 3) > -6)
    copa = ndimage.binary_opening(copa, iterations=3)
    copa &= ~(np.asarray(masc_f) > 0)
    paso_m = (fx1 - fx0) / orto_f.size[0]
    rng = np.random.default_rng(7)
    cand = np.argwhere(copa[::5, ::5]) * 5
    rng.shuffle(cand)
    celda = {}; lista = []
    for fy, fxp in cand:
        x = fx0 + fxp * paso_m; z = fz0 + fy * paso_m
        if math.hypot(x, z) > 240 or len(lista) >= 1400:
            continue
        r = 2.4 + rng.random() * 2.4
        ci, cj = int(x // 10), int(z // 10); choca = False
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for ox, oz, orr in celda.get((ci + di, cj + dj), ()):
                    if (x - ox) ** 2 + (z - oz) ** 2 < (0.95 * (r + orr)) ** 2:
                        choca = True; break
        if choca:
            continue
        celda.setdefault((ci, cj), []).append((x, z, r))
        colr = a[max(0, fy - 4):fy + 4, max(0, fxp - 4):fxp + 4].reshape(-1, 3).mean(0)
        h0 = alt_xz(x, z)
        alto = r * (2.2 + rng.random() * 1.6)
        lista.append([round(x, 1), round(h0, 1), round(z, 1), round(r, 2), round(alto, 1), '#%02x%02x%02x' % tuple(int(v) for v in colr)])
    return lista


arb = arboles()
print('árboles', len(arb), flush=True)


# ------------------------------------------------------------------ lugares (OSM, comprobados)
def busca(cond, cerca_de=None, max_m=None):
    mejor = None
    for e in osm:
        t = e.get('tags', {}); lat, lon = coords(e)
        if lat is None or not cond(t):
            continue
        x, z = loc(lat, lon)
        dd = 0 if cerca_de is None else math.hypot(x - cerca_de[0], z - cerca_de[1])
        if max_m is not None and dd > max_m:
            continue
        if mejor is None or dd < mejor[0]:
            mejor = (dd, e, x, z)
    if mejor is None:
        raise SystemExit('No encuentro en OSM un lugar que cumpla la condición')
    return mejor


lugares = []
def pon(clave, nombre, sub, e, x, z, dy, fase, nota):
    lugares.append({'clave': clave, 'nombre': nombre, 'sub': sub, 'x': round(x, 1), 'z': round(z, 1),
                    'y': round(max(alt_xz(x, z), 0) + dy, 1), 'dy': dy, 'fase': fase,
                    'osm': f"{e['type']}/{e['id']}" if e else None, 'nota': nota})


lugares.append({'clave': 'mar', 'nombre': 'Mar Cantábrico', 'sub': None, 'x': round(FX - 650, 1), 'y': 40.0, 'z': round(FZ - 1400, 1), 'dy': 40,
                'fase': [0.0, 0.24], 'osm': None, 'nota': 'rótulo en el mar'})
pon('faro', 'Cabo Vidio', 'El faro', faro_osm, torre['x'], torre['z'], 26, [0.0, 0.62], 'man_made=lighthouse node/%s' % faro_osm['id'])
_, e, x, z = busca(lambda t: t.get('place') == 'village' and t.get('name', '').startswith('Cudillero'))
pon('cudillero', 'Cudillero', None, e, x, z, 60, [0.0, 0.3], 'place=village')
_, e, x, z = busca(lambda t: t.get('place') == 'hamlet' and t.get('name') == 'Oviñana', (0, 0), 2500)
pon('ovinana', 'Oviñana', None, e, x, z, 30, [0.0, 0.86], 'place=hamlet')
_, e, x, z = busca(lambda t: t.get('natural') == 'beach' and 'Vallina' in t.get('name', ''), (0, 0), 2000)
pon('vallina', 'Playa de La Vallina', None, e, x, z, 26, [0.0, 0.86], 'natural=beach «%s»' % e['tags'].get('name'))
_, e, x, z = busca(lambda t: t.get('natural') == 'peak' and t.get('name') == 'Penadrada')
pon('sierra', 'Penadrada', 'la sierra', e, x, z, 80, [0.0, 0.62], 'natural=peak ele=%s' % e['tags'].get('ele'))
apr = next(x for x in edificios if x['tipo'] == 'apartamentos')
lugares.append({'clave': 'casa', 'nombre': 'Las Riberas', 'sub': None, 'x': L_rect['cx'], 'z': L_rect['cz'],
                'y': round(apr['suelo'] + 16, 1), 'dy': 16, 'fase': [0.0, 0.84], 'osm': None, 'nota': 'Catastro ' + REF_APART})
cx_l, cz_l = de_uv((ala_larga['u0'] + ala_larga['u1']) / 2 - sgn * 6, (ala_larga['v0'] + ala_larga['v1']) / 2)
lugares.append({'clave': 'apartamentos', 'nombre': 'Los apartamentos', 'sub': None, 'x': round(cx_l, 1), 'z': round(cz_l, 1),
                'y': round(apr['suelo'] + 7.5, 1), 'dy': 7.5, 'fase': [0.86, 1.01], 'osm': None, 'nota': 'Catastro'})
lugares.append({'clave': 'piscina', 'nombre': 'La piscina', 'sub': 'climatizada', 'x': pabellon['cx'], 'z': pabellon['cz'],
                'y': round(pabellon['suelo'] + 7.5, 1), 'dy': 7.5, 'fase': [0.86, 1.01], 'osm': None, 'nota': 'por las fotos'})
for l in lugares:
    print('lugar', l['clave'], l['x'], l['z'], l['y'], l['nota'], flush=True)

# ------------------------------------------------------------------ recorrido de la cámara
TX, TZ = torre['x'], torre['z']; TY = torre['suelo']
CXL, CZL = L_rect['cx'], L_rect['cz']; HY = apr['suelo']
# mirada final: desde el sur del patio, hacia el norte: la casa delante y, al fondo, el cabo con el faro
dirf = np.array([TX - CXL, TZ - CZL]); dirf /= np.linalg.norm(dirf)
ini_mira = np.array([(TX + CXL) / 2, 0, 2000.0])
rec = [  # p: progreso del scroll (0..1); pos y mira en metros locales (y = altura sobre el mar)
    {'p': 0.00, 'pos': [TX - 380, 330, TZ - 3300], 'mira': [TX + 250, -260, TZ + 3600]},
    {'p': 0.17, 'pos': [TX - 380, 230, TZ - 1900], 'mira': [TX, TY + 10, TZ + 120]},
    {'p': 0.30, 'pos': [TX - 120, TY + 70, TZ - 420], 'mira': [TX, TY + 8, TZ]},
    {'p': 0.40, 'pos': [TX - 330, TY + 52, TZ - 60], 'mira': [TX, TY + 8, TZ]},
    {'p': 0.50, 'pos': [TX - 180, TY + 60, TZ + 300], 'mira': [TX, TY + 6, TZ - 40]},
    {'p': 0.62, 'pos': [TX - 260, TY + 110, TZ + 700], 'mira': [CXL, HY + 10, CZL - 200]},
    {'p': 0.74, 'pos': [CXL - 120, HY + 120, CZL - 640], 'mira': [CXL, HY, CZL]},
    {'p': 0.84, 'pos': [CXL - 150, HY + 60, CZL - 90], 'mira': [CXL, HY + 2, CZL]},
    {'p': 0.92, 'pos': [CXL - 70, HY + 34, CZL + 120], 'mira': [CXL, HY + 3, CZL]},
    {'p': 1.00, 'pos': [CXL + 22, HY + 22, CZL + 112], 'mira': [CXL + 12, HY + 6, CZL - 120]},
]
for r_ in rec:
    r_['pos'] = [round(float(v), 2) for v in r_['pos']]; r_['mira'] = [round(float(v), 2) for v in r_['mira']]


def monotona(ps, vs):
    n = len(ps); d_ = [(vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]) for i in range(n - 1)]; m = [0.0] * n
    for i in range(1, n - 1):
        if d_[i - 1] * d_[i] <= 0:
            continue
        h0, h1 = ps[i] - ps[i - 1], ps[i + 1] - ps[i]
        m[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d_[i - 1] + (h1 + 2 * h0) / d_[i])
    def f(p):
        if p <= ps[0]: return vs[0]
        if p >= ps[-1]: return vs[-1]
        k_ = 0
        while k_ < n - 2 and p > ps[k_ + 1]: k_ += 1
        h = ps[k_ + 1] - ps[k_]; t = (p - ps[k_]) / h; t2, t3 = t * t, t * t * t
        return (2 * t3 - 3 * t2 + 1) * vs[k_] + (t3 - 2 * t2 + t) * h * m[k_] + (-2 * t3 + 3 * t2) * vs[k_ + 1] + (t3 - t2) * h * m[k_ + 1]
    return f


ps_ = [r_['p'] for r_ in rec]
fpos = [monotona(ps_, [r_['pos'][k] for r_ in rec]) for k in range(3)]
holgura = min((fpos[1](p) - max(0.0, alt_xz(fpos[0](p), fpos[2](p))), p) for p in np.linspace(0, 1, 801))
print('recorrido: la cámara pasa como poco a %.1f m sobre el suelo (p=%.3f)' % holgura, flush=True)
assert holgura[0] > 8, 'la cámara se mete en el terreno'


# ------------------------------------------------------------------ plan B: la vista desde el mar, dibujada
EXAG = {'lejos': 1.3, 'desde': 4000, 'hasta': 14000}
def exag_de(dc):
    t = np.clip((dc - EXAG['desde']) / (EXAG['hasta'] - EXAG['desde']), 0, 1)
    return 1 + (EXAG['lejos'] - 1) * t * t * (3 - 2 * t)


def vista_desde_mar(W, Hh, pos, mira, fov=40.0):
    """Render por columnas (voxel space): relieve real + ortofoto, con bruma, mar y cielo. Sin WebGL."""
    px_, py_, pz_ = pos
    yaw = math.atan2(mira[0] - px_, mira[2] - pz_)
    pitch = math.atan2(mira[1] - py_, math.hypot(mira[0] - px_, mira[2] - pz_))
    f = (Hh / 2) / math.tan(math.radians(fov / 2))
    K = 2600
    dd = 40.0 * (90000 / 40.0) ** (np.arange(K) / (K - 1))
    cols = np.arange(W) - W / 2 + 0.5
    ang = yaw + np.arctan(cols / f)
    cosd = np.cos(ang - yaw)
    X = px_ + np.outer(dd, np.sin(ang)); Z = pz_ + np.outer(dd, np.cos(ang))
    lat, lon = geo(X, Z)
    h = alt_en(lat, lon)
    ex = exag_de(np.hypot(X, Z))
    agua = h < 0
    hv = np.where(agua, 0.0, h * ex)
    prof = dd[:, None] * cosd[None, :]
    y = Hh / 2 - f * (hv - py_) / prof - f * math.tan(pitch)
    oc_ = np.asarray(orto_c2, np.float32)
    def col_de(img, caja):
        S, N, O, E = caja
        fy = (N - lat) / (N - S) * img.shape[0] - 0.5; fx = (lon - O) / (E - O) * img.shape[1] - 0.5
        return np.stack([ndimage.map_coordinates(img[..., c], [fy, fx], order=1, mode='nearest') for c in range(3)], -1)
    color = col_de(olg, CAJA25)
    dentro_ = (lat >= CS) & (lat <= CN) & (lon >= CO) & (lon <= CE)
    cc = col_de(oc_, CAJA5); color[dentro_] = cc[dentro_]
    e = 12.0
    hx = alt_en(*geo(X + e, Z)); hz = alt_en(*geo(X, Z + e))
    nx_, nz_ = -(hx - h) / e * ex, -(hz - h) / e * ex
    luz = np.array([-0.55, 0.6, 0.35]); luz /= np.linalg.norm(luz)
    sh = (nx_ * luz[0] + luz[1] + nz_ * luz[2]) / np.sqrt(nx_ ** 2 + nz_ ** 2 + 1)
    color *= np.clip(0.55 + 0.75 * sh, 0.35, 1.25)[..., None]
    dc = np.where(dentro_, ndimage.map_coordinates(dist5, [(CN - lat) / (CN - CS) * dist5.shape[0], (lon - CO) / (CE - CO) * dist5.shape[1]], order=1, mode='nearest'), 2000)
    somero = np.clip(1 - dc / 260, 0, 1)
    mar_c = np.array([22, 62, 84], np.float32) * (1 - somero[..., None]) + np.array([48, 118, 128], np.float32) * somero[..., None]
    rasante = np.clip(1 - (py_ / prof) * 6, 0, 1)[..., None]
    mar_c = mar_c * (1 - 0.55 * rasante) + np.array([196, 206, 214], np.float32) * 0.55 * rasante
    mar_c[(dc < 14) & agua] = [236, 240, 238]
    color = np.where(agua[..., None], mar_c, color)
    bruma = np.array([206, 214, 222], np.float32)
    kf = 1 - np.exp(-(dd / 42000.0) ** 2 * 1.6)
    color = color * (1 - kf[:, None, None]) + bruma * kf[:, None, None]
    img = np.zeros((Hh, W, 3), np.float32)
    filas = np.arange(Hh)
    yy = np.minimum.accumulate(np.minimum(y, Hh), axis=0)
    cielo_t = np.array([118, 158, 204], np.float32); cielo_h = np.array([226, 230, 232], np.float32)
    for c_ in range(W):
        idx = np.searchsorted(-yy[:, c_], -filas, side='left')
        ok = idx < K
        img[ok, c_] = color[idx[ok], c_]
        t = np.clip(filas[~ok] / (Hh * 0.55), 0, 1)[:, None]
        img[~ok, c_] = cielo_t * (1 - t) + cielo_h * t
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), (f, yaw, pitch)


def proyecta(pt, pos, f, yaw, pitch, W, Hh):
    dx, dz = pt[0] - pos[0], pt[2] - pos[2]
    fr = dx * math.sin(yaw) + dz * math.cos(yaw); la = dx * math.cos(yaw) - dz * math.sin(yaw)
    if fr <= 0:
        return None
    return (W / 2 + f * la / fr, Hh / 2 - f * (pt[1] - pos[1]) / fr - f * math.tan(pitch))


WB, HB = 1600, 1000
p0 = rec[0]
vista, (fB, yawB, pitchB) = vista_desde_mar(WB, HB, p0['pos'], p0['mira'])
vista.save(OUT / 'vista-mar-1600.webp', quality=74, method=6)
vista.resize((960, 600), Image.LANCZOS).save(OUT / 'vista-mar-960.webp', quality=76, method=6)
marcas_b = []
for l in lugares:
    if l['fase'][0] > 0.01:
        continue
    dc_ = math.hypot(l['x'], l['z'])
    pt = (l['x'], (l['y'] - l['dy']) * float(exag_de(dc_)) + l['dy'] if l['clave'] != 'mar' else l['y'], l['z'])
    pr = proyecta(pt, p0['pos'], fB, yawB, pitchB, WB, HB)
    if pr and 0 < pr[0] < WB and 0 < pr[1] < HB:
        marcas_b.append({'clave': l['clave'], 'x': round(pr[0] / WB * 100, 2), 'y': round(pr[1] / HB * 100, 2)})
print('plan B, marcas', marcas_b, flush=True)

# plan B: la finca y el faro desde el aire (ortofoto tal cual, con sus tejados)
PL = 130.0
pcx_, pcz_ = CXL + 4, CZL + 6
def recorte(img, caja, cx, cz, lado, salida, nombre):
    x0, z0, x1, z1 = caja; W, H = img.size
    i0, j0 = (cx - lado / 2 - x0) / (x1 - x0) * W, (cz - lado / 2 - z0) / (z1 - z0) * H
    i1, j1 = (cx + lado / 2 - x0) / (x1 - x0) * W, (cz + lado / 2 - z0) / (z1 - z0) * H
    img.crop((int(i0), int(j0), int(i1), int(j1))).resize((salida, salida), Image.LANCZOS).save(OUT / nombre, quality=76, method=6)
recorte(orto_f, (fx0, fz0, fx1, fz1), pcx_, pcz_, PL, 900, 'plano-finca-900.webp')
PLF = 110.0
recorte(orto_b, (bx0, bz0, bx1, bz1), TX - 6, TZ + 8, PLF, 600, 'plano-faro-600.webp')

# ------------------------------------------------------------------ metadatos
caja_xz = lambda k: {'x0': CAJAS_R[k][0], 'z0': CAJAS_R[k][1], 'x1': CAJAS_R[k][2], 'z1': CAJAS_R[k][3]}
meta = {
    'version': 1,
    'origen': {'lat': CASA[0], 'lon': CASA[1], 'catastro': REF_APART, 'pin_web_m': [round(v, 1) for v in loc(*PIN_WEB)]},
    'kx': round(KX, 3), 'kz': KZ,
    'exag': EXAG,
    'rasters': rasters,
    'orto': {
        'cerca': dict(caja_xz('cerca'), archivos={'alta': 'orto-cerca-3072.webp', 'baja': 'orto-cerca-2048.webp'}),
        'medio': dict(caja_xz('medio'), archivos={'alta': 'orto-medio-2048.webp', 'baja': 'orto-medio-1024.webp'}),
        'finca': dict(caja_xz('finca'), archivos={'alta': 'orto-finca-2048.webp', 'baja': 'orto-finca-1024.webp'}),
        'cabo': dict(caja_xz('cabo'), archivos={'alta': 'orto-cabo-1024.webp', 'baja': 'orto-cabo-512.webp'}),
        'lejos': {'x0': round(loc(CAJA25[1], CAJA25[2])[0], 2), 'z0': round(loc(CAJA25[1], CAJA25[2])[1], 2),
                  'x1': round(loc(CAJA25[0], CAJA25[3])[0], 2), 'z1': round(loc(CAJA25[0], CAJA25[3])[1], 2),
                  'archivos': {'alta': 'orto-lejos-2048.webp', 'baja': 'orto-lejos-2048.webp'}},
        'costa': {'archivo': 'costa.png', 'metros_por_unidad': 3.0},
    },
    'edificios': edificios,
    'tejadoL': tejado_L,
    'porche': {'postes': postes, 'anillo': [[round(x, 2), round(z, 2)] for x, z in po]},
    'pabellon': pabellon,
    'faro': dict(torre, osm='node/%s' % faro_osm['id'], nodo=[round(FX, 1), round(FZ, 1)]),
    'arboles': arb,
    'lugares': lugares,
    'recorrido': rec,
    'planB': {'vista': {'archivos': ['vista-mar-960.webp', 'vista-mar-1600.webp'], 'ancho': WB, 'alto': HB, 'marcas': marcas_b},
              'plano': {'archivo': 'plano-finca-900.webp', 'cx': pcx_, 'cz': pcz_, 'lado': PL},
              'faro': {'archivo': 'plano-faro-600.webp', 'cx': TX - 6, 'cz': TZ + 8, 'lado': PLF}},
    'fuentes': {
        'ign': 'Relieve MDT05 y MDT25 y ortofoto PNOA © Instituto Geográfico Nacional (CC BY 4.0)',
        'catastro': 'Planta de los edificios © Dirección General del Catastro',
        'osm': 'Lugares © colaboradores de OpenStreetMap (ODbL)',
    },
    'fecha_datos': time.strftime('%Y-%m-%d'),
}
(OUT / 'lugar.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
tot = 0
for f in sorted(OUT.iterdir()):
    tot += f.stat().st_size; print(f'{f.name:28s} {f.stat().st_size // 1024:6d} KB')
print('total img/lugar', tot // 1024, 'KB')
