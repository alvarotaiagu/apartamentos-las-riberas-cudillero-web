# Lugares de OpenStreetMap para los rótulos del 3D de Las Riberas (© colaboradores de OpenStreetMap, ODbL).
# Pide a Overpass (con espejos y reintentos) los candidatos y guarda la respuesta cruda en
# ref/raw/lugar-cache/osm-lugares.json. El emparejado y la comprobación de coordenadas los hace
# scripts/lugar-datos.py (no se fía del nombre: mira etiquetas y distancia a la casa).
# Uso: python -I -X utf8 scripts/lugar-osm.py
import json, pathlib, time, urllib.parse, urllib.request

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'lugar-cache'; CACHE.mkdir(parents=True, exist_ok=True)
UA = 'datos-mapa-script/1.0 (uso puntual)'          # sin datos personales; con UA de navegador responde 406
ESPEJOS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
           'https://overpass.private.coffee/api/interpreter', 'https://overpass.osm.ch/api/interpreter']
Q = '''[out:json][timeout:80];
(
  node["place"~"town|village|hamlet|locality"](43.53,-6.36,43.62,-6.10);
  nwr["man_made"="lighthouse"](43.54,-6.36,43.62,-6.10);
  nwr["natural"~"beach|cape|peak|bay"]["name"](43.53,-6.36,43.62,-6.10);
  node["natural"="peak"]["name"](43.30,-6.60,43.53,-6.00);
  nwr["name"~"Riberas",i](43.57,-6.26,43.585,-6.24);
);
out center tags;'''


def pedir():
    datos = urllib.parse.urlencode({'data': Q}).encode()
    espera = 4
    for vuelta in range(4):
        for url in ESPEJOS:
            try:
                req = urllib.request.Request(url, data=datos, headers={'User-Agent': UA})
                cuerpo = urllib.request.urlopen(req, timeout=120).read()
                j = json.loads(cuerpo)
                if 'elements' in j and j['elements']:
                    print('OK', url, len(j['elements']), 'elementos')
                    return j
                print('vacío', url)
            except Exception as e:
                print('falla', url, str(e)[:80])
        print('reintento en', espera, 's'); time.sleep(espera); espera *= 2
    raise SystemExit('Overpass no responde: vuelve a probar más tarde')


j = pedir()
(CACHE / 'osm-lugares.json').write_text(json.dumps(j, ensure_ascii=False), encoding='utf-8')
