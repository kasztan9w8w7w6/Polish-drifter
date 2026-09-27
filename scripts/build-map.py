# Generates src/maps/osiedle.json from the plan in docs/mapa.md (v0.5c). A helper: the JSON is the source of truth
# afterwards and can be edited by hand. Coordinates: x east, z south (north = −z), metres.
import json, math

o = []
def add(model, x, z, **kw):
    d = {'model': model, 'x': x, 'z': z}; d.update(kw); o.append(d)

# --- Streets (ground.js paints them; corners are rounded on their own) ---
streets = [
    {'name': 'ul. Kosmonautów', 'kind': 'glowna', 'width': 10, 'sidewalk': 2.5, 'pts': [[-104, 72], [104, 72]]},
    {'name': 'ul. Lotników', 'width': 6, 'sidewalk': 1.5, 'pts': [[-60, -62], [-60, 72]]},
    {'name': 'ul. Gagarina', 'width': 6, 'sidewalk': 1.5, 'pts': [[30, -62], [30, 72]]},
    {'name': 'ul. Tereszkowej', 'width': 6, 'sidewalk': 1.5, 'pts': [[-104, -62], [30, -62]]},
    {'name': 'ul. Komarowa', 'width': 6, 'sidewalk': 1.5, 'pts': [[-60, 0], [30, 0]]},
]
# --- Asphalt lots and parking (join the street network: rounded where they meet it) ---
areas = [
    {'name': 'parking pod Blokiem 2', 'kind': 'asfalt', 'rect': [-42, 52, 12, 62]},
    {'name': 'wjazd na parking (zachód)', 'kind': 'asfalt', 'rect': [-42, 62, -35, 67.2]},
    {'name': 'wjazd na parking (wschód)', 'kind': 'asfalt', 'rect': [5, 62, 12, 67.2]},
    {'name': 'parking pod Blokiem 4', 'kind': 'asfalt', 'rect': [-72, 22, -63, 38]},
    {'name': 'plac przed garażami', 'kind': 'asfalt', 'rect': [-98, -82, -34, -65]},
    {'name': 'plac pod Supersamem', 'kind': 'asfalt', 'rect': [42, -70, 97, 62]},  # (9 m of grass from ul. Gagarina: less than 8 m would close into asphalt)
    {'name': 'wjazd na plac z Gagarina (północ)', 'kind': 'asfalt', 'rect': [33, -35, 42, -27]},
    {'name': 'wjazd na plac z Gagarina (południe)', 'kind': 'asfalt', 'rect': [33, 27, 42, 35]},
    {'name': 'wjazd na plac z głównej', 'kind': 'asfalt', 'rect': [64, 62, 72, 67.2]},
    {'name': 'parking przed Żappką', 'kind': 'asfalt', 'rect': [-10, 77, 10, 84]},
    {'name': 'bruk przed pawilonami', 'kind': 'bruk', 'rect': [-48, 79.5, -12, 85]},
    {'name': 'bruk przed pawilonami', 'kind': 'bruk', 'rect': [12, 79.5, 48, 85]},
    {'name': 'piasek placu zabaw', 'kind': 'ziemia', 'rect': [-32, -28, -18, -16]},
]
# --- Paths across the yards (paving) ---
paths = [
    {'width': 2.5, 'pts': [[-55.5, -37.5], [27.5, -37.5]]},   # along the front of Blok 1
    {'width': 2, 'pts': [[-15, -37.5], [-15, -4.5]]},         # north yard, to ul. Komarowa
    {'width': 2, 'pts': [[-39, -20], [27.5, -20]]},           # north yard, across
    {'width': 2, 'pts': [[-39.5, -34], [-39.5, -4.5]]},       # in front of Blok 3
    {'width': 2, 'pts': [[-35, 5.5], [10, 5.5]]},             # in front of Blok 5 (ul. Komarowa side)
    {'width': 2, 'pts': [[-15, 18.6], [-15, 38.4]]},          # south yard
    {'width': 2, 'pts': [[-39, 28], [27.5, 28]]},             # south yard, across
    {'width': 2, 'pts': [[-42, 51], [12, 51]]},               # in front of Blok 2
    {'width': 2, 'pts': [[-76, -44], [-76, -6]]},             # in front of Blok 6
    {'width': 2, 'pts': [[-76, -25], [-64.5, -25]]},          # Blok 6 → ul. Lotników
    {'width': 2, 'pts': [[-73, 30], [-72, 30]]},              # Blok 4 entrance
]

# --- Blocks of flats (blocks.js): yaw 0 = entrances to the south ---
blocks = [
    {'name': 'Blok 1 (ul. Tereszkowej 3)', 'x': -15, 'z': -46, 'yaw': 0, 'klatki': 4, 'pietra': 10, 'balkony': True, 'kolor': 'szary', 'maszt': True},
    {'name': 'Blok 3 (ul. Lotników 7)', 'x': -48, 'z': -20, 'yaw': 90, 'klatki': 2, 'pietra': 4, 'balkony': True, 'kolor': 'bez'},
    {'name': 'Blok 5 (ul. Komarowa 2)', 'x': -12, 'z': 13, 'yaw': 180, 'klatki': 3, 'pietra': 10, 'balkony': True, 'kolor': 'blekitny'},
    {'name': 'Blok 2 (ul. Kosmonautów 12)', 'x': -15, 'z': 44, 'yaw': 0, 'klatki': 4, 'pietra': 4, 'balkony': True, 'kolor': 'zolty'},
    {'name': 'Blok 4 (punktowiec, ul. Lotników 9)', 'x': -82, 'z': 30, 'yaw': 90, 'klatki': 1, 'pietra': 10, 'dlugosc': 16, 'glebokosc': 16, 'balkony': True, 'kolor': 'szary'},
    {'name': 'Blok 6 (ul. Lotników 11)', 'x': -84, 'z': -25, 'yaw': 90, 'klatki': 3, 'pietra': 4, 'balkony': True, 'kolor': 'blekitny'},
]
# More estate outside the fence (scenery, no collision, fewer texture pixels)
for i in range(14):
    a = (i / 14) * math.pi * 2 + 0.2; r = 132 + (i % 3) * 10
    x = round(math.cos(a) * r, 1); z = round(math.sin(a) * r, 1)
    blocks.append({'name': f'blok za płotem {i + 1}', 'x': x, 'z': z, 'yaw': round(math.degrees(math.atan2(-x, -z))),
                   'klatki': 3 + i % 3, 'pietra': 10 if i % 2 else 4, 'balkony': True,
                   'kolor': ['szary', 'bez', 'blekitny', 'zolty'][i % 4], 'collide': False})

# --- Market and shops (Kenney City Kit Commercial) ---
add('commercial/building-n', 70, -80, yaw=0, fit=[44, 9, 18], name='Supersam', occlude=True)
add('commercial/building-h', 0, 90, yaw=180, length=12, name='Żappka 24h', occlude=True)
add('commercial/detail-awning-wide', 0, 83.6, y=2.6, yaw=180, length=7, collide=False)
add('commercial/building-c', -30, 91, yaw=180, fit=[16, 6, 10], name='Pawilon (warzywniak, fryzjer)', occlude=True)
add('commercial/building-e', 30, 91, yaw=180, fit=[18, 6, 10], name='Pawilon (apteka, lombard)', occlude=True)
# --- Garages: a row along the north-west, doors to the south, the forecourt joins ul. Tereszkowej ---
add('city/building-garage', -94, -85, fit=[7.6, 2.8, 6], repeat={'count': 8, 'dx': 8, 'dz': 0}, name='garaże')
# --- Dumpsters: at the blocks, the garages, the market ---
for x, z, y in [[-44, -44, 90], [-44, -41, 90], [15, 57, 90], [-30, -80, 0], [95, -66, 0], [12, 88, 90], [-76, 40, 0]]:
    add('roads/dumpster', x, z, yaw=y, scale=6, surface='metal')
# --- Fences: the playground, the north edge ---
for x in [-33, -17]:
    add('suburban/fence-low', x, -22, yaw=90, length=8, surface='metal')
for x in range(-90, 91, 10):
    add('suburban/fence-1x4', x, -95, length=10, surface='metal', collide=False)
# --- Parked cars: only in bays, on the lots ---
for i, m in enumerate(['cars/sedan', 'cars/hatchback-sports', None, 'cars/suv', 'cars/van', None, 'cars/sedan-sports', 'cars/sedan', None, None, 'cars/taxi', 'cars/sedan', None, 'cars/suv', 'cars/hatchback-sports', None]):
    if m: add(m, -40.4 + i * 3.2 + 1.6, 54.75, yaw=0, length=4.8 if m.endswith('van') else 4.3, surface='car')  # Blok 2 parking
for z, m in [[25.2, 'cars/sedan'], [34.8, 'cars/van']]:
    add(m, -69.25, z, yaw=90, length=4.8 if m.endswith('van') else 4.3, surface='car')  # Blok 4 parking
for x, m in [[-8, 'cars/taxi'], [8, 'cars/sedan']]:
    add(m, x, 81.25, yaw=180, length=4.3, surface='car')  # Żappka
for x, m in [[45.4, 'cars/suv'], [48.6, 'cars/sedan'], [81.4, 'cars/delivery'], [87.8, 'cars/hatchback-sports']]:
    add(m, x, -67.25, yaw=0, length=5.2 if m.endswith('delivery') else 4.3, surface='car')  # under the market
for x, m in [[44, 'cars/sedan'], [53.6, 'cars/van'], [90.4, 'cars/taxi']]:
    add(m, x, 59.25, yaw=180, length=4.8 if m.endswith('van') else 4.3, surface='car')  # south edge of the lot
add('cars/garbage-truck', 93, -60, yaw=180, length=7.5, surface='car')
add('cars/van', -52, -78, yaw=90, length=4.8, surface='car')  # in front of the garages
# --- Trees: yards, verges, corners (never on asphalt or paths: test/map.test.mjs) ---
trees = [
    [-36, -12], [-4, -30], [18, -28], [20, -10], [-28, -8], [6, -12], [-50, -48], [-50, 10],     # north yard, verges
    [-34, 24], [4, 34], [20, 22], [-44, 34], [-26, 34], [14, 12], [-40, 12],                      # south yard
    [-92, 55], [-92, 5], [-70, 55], [-70, -48], [-92, -52], [-88, 10],                            # west
    [36, -50], [36, -12], [36, 12], [36, 50], [100 - 4, -96], [-20, -96], [10, -92], [-60, -94],   # east verge, north edge
    [-92, 90], [-60, 94], [60, 94], [92, 92], [-80, 60], [20, 60], [-50, 60],                     # south, main street verge
]
for x, z in trees:
    add('suburban/tree-large' if (x + z) % 3 else 'suburban/tree-small', x, z, scale=10, surface='tree')
for t in range(-90, 91, 45):
    add('roads/electricity-pole', t, 108, scale=12, collide=False)

# --- Street lamps: [x, z, yaw, double]; the arm points to local −Z (yaw 180: arm to the south, 0: north, 90: west, −90: east) ---
lamps = []
for x in [-90, -70, -50, -30, -10, 10, 50, 70, 90]:
    lamps.append([x, 65.8, 180, False])  # main street, north sidewalk
for x in [-80, -60, -40, -20, 20, 40, 60, 80]:
    lamps.append([x, 78.2, 0, False])  # main street, south sidewalk
for z in [-45, -20, 22, 48]:
    lamps.append([-56.2, z, 90, False])  # ul. Lotników, east sidewalk
    lamps.append([26.2, z, -90, False])  # ul. Gagarina, west sidewalk
for x in [-85, -40, -15, 10]:
    lamps.append([x, -58.2, 0, False])  # ul. Tereszkowej, south sidewalk
for x in [-40, -15, 10]:
    lamps.append([x, -3.8, 180, False])  # ul. Komarowa, north sidewalk
for x, z in [[44, -50], [93, -50], [44, -15], [93, -15], [44, 20], [93, 20], [44, 50], [93, 50]]:
    lamps.append([x, z, 0, True])  # the lot (edges: the middle stays free)
lamps += [[-12, -22, 0, False], [-12, 30, 0, False], [-74, -80.5, 0, False]]  # yards, garages

m = {
    '_help': 'Mapa osiedla (plan: docs/mapa.md). Współrzędne w metrach: x = wschód, z = południe (północ = -z). '
             'streets: ulice (pts: punkty osi, width, sidewalk = szerokość chodnika, kind glowna = linie na jezdni); narożniki zaokrąglają się same (cornerRadius). '
             'areas: prostokąty [x1, z1, x2, z2] podłoża (asfalt = place i parkingi, łączą się z ulicami; bruk; ziemia); paths: chodniki przez podwórka; reszta to trawa (ground.js). '
             'crossings: pasy na głównej [x, z]. blocks: bloki z wielkiej płyty (blocks.js): x, z, yaw (0 = wejścia na południe), klatki, pietra, balkony, kolor (szary/bez/blekitny/zolty), '
             'maszt, dlugosc/glebokosc (punktowiec), collide: false = dekoracja. '
             'objects: modele Kenneya, yaw w stopniach: 0 = front modelu na południe, 180 = na północ, 90 = na wschód, -90 = na zachód. Rozmiar: scale, length (najdłuższy bok w m) '
             'albo fit [szer., wys., głęb.] w m; y = wysokość nad ziemią. collide (domyślnie true): kolizja z geometrii na wysokości karoserii, '
             'surface = materiał (physics.js SURFACES). repeat = rząd kopii co dx/dz. props: rzeczy z własnej geometrii (lawka, trzepak, piaskownica, hustawka, przystanek). '
             'lamps: [x, z, yaw, podwójna]. points: miejsca dla misji (r = promień celu), heading auta: 0 = na wschód, 90 = na północ. '
             'npcs: postacie (id z src/story/postacie.json, x, z, yaw w stopniach); rozmowa: stań obok (< 4,5 m). '
             'routes: trasy wyścigów – rogi ulic w kolejności jazdy, zamknięta pętla (start/meta = pierwszy punkt).',
    'name': 'Osiedle Kosmonautów',
    'size': 200,
    'cornerRadius': 4,
    'streets': streets,
    'areas': areas,
    'paths': paths,
    'crossings': [[0, 72], [-70, 72]],
    'walls': [[0, 100, 200, 1], [0, -100, 200, 1], [100, 0, 1, 200], [-100, 0, 1, 200]],
    'blocks': blocks,
    'objects': o,
    'props': [
        {'type': 'przystanek', 'x': -70, 'z': 81, 'yaw': 180, 'name': 'Osiedle Kosmonautów'},
        {'type': 'piaskownica', 'x': -28, 'z': -22},
        {'type': 'hustawka', 'x': -21, 'z': -22, 'yaw': 90},
        {'type': 'trzepak', 'x': 6, 'z': -28},
        {'type': 'trzepak', 'x': -30, 'z': 31},
        {'type': 'piaskownica', 'x': 2, 'z': 23},
        {'type': 'lawka', 'x': -36, 'z': -28, 'yaw': 90},
        {'type': 'lawka', 'x': -6, 'z': -13, 'yaw': 180},
        {'type': 'lawka', 'x': -20, 'z': 24, 'yaw': 0},
        {'type': 'lawka', 'x': 10, 'z': 33, 'yaw': 180},
        {'type': 'lawka', 'x': -62, 'z': 81, 'yaw': 180},
        {'type': 'lawka', 'x': 12, 'z': -35.5, 'yaw': 180},
    ],
    'lamps': lamps,
    'cones': [[90, -40], [92, -40], [94, -40], [88, -40]],
    'tyres': [],
    'potholes': [[-60, 20, 0.9], [-60, -35, 0.8], [30, -30, 1.0], [30, 40, 0.8], [-20, -62, 1.1], [-40, 0, 0.7], [10, 0, 0.9], [-80, 72, 0.8], [50, 72, 1.0], [-90, -62, 0.7]],
    'parking': [
        {'x': -15, 'z': 54.75, 'yaw': 0, 'bays': 16, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': -69.25, 'z': 30, 'yaw': 90, 'bays': 4, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': -6.4, 'z': 81.25, 'yaw': 180, 'bays': 2, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': 6.4, 'z': 81.25, 'yaw': 180, 'bays': 2, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': 52, 'z': 59.25, 'yaw': 180, 'bays': 6, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': 84, 'z': 59.25, 'yaw': 180, 'bays': 7, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': 52, 'z': -67.25, 'yaw': 0, 'bays': 5, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': 84.6, 'z': -67.25, 'yaw': 0, 'bays': 5, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': 68, 'z': 0, 'yaw': 0, 'frame': [36, 60]},
    ],
    'signs': [
        {'text': 'Żappka 24h', 'at': [0, 4.2, 83.4], 'yaw': 180, 'colors': ['#062d14', '#ffe14a', '#9dff6a']},
        {'text': 'SUPERSAM', 'at': [70, 6.5, -70.6], 'yaw': 0, 'colors': ['#2a0606', '#ffd24a', '#ff5a4a']},
    ],
    'shop': {'light': [0, 3, 82.5], 'pad': {'x': 0, 'z': 80.5, 'w': 6, 'd': 4}},
    'locker': {'name': 'Paczkobox 24/7', 'x': -3, 'z': -38.9, 'yaw': 0},
    'points': {
        'spawn': {'x': -30, 'z': 59.5, 'heading': 0, 'label': 'parking pod Blokiem 2'},
        'garage': {'x': -60, 'z': -73, 'heading': 90, 'label': 'przed garażami'},
        'locker': {'x': -3, 'z': -35.5, 'r': 3.5, 'label': 'Paczkobox przy Bloku 1'},
        'lot': {'x': 68, 'z': 0, 'r': 25, 'label': 'plac pod Supersamem'},
        'delivery': {'x': -66, 'z': 30, 'r': 4, 'label': 'Blok 4, punktowiec'},
        'shop': {'x': 0, 'z': 80.5, 'r': 3, 'label': 'Żappka 24h'},
    },
    'npcs': [
        {'id': 'seba', 'x': 37.2, 'z': -6, 'yaw': 90},
        {'id': 'kamil', 'x': 36.4, 'z': -3.6, 'yaw': 110},
        {'id': 'dawid', 'x': 37.8, 'z': -8.4, 'yaw': 70},
        {'id': 'zbyszek', 'x': -15, 'z': 78.3, 'yaw': 180},
        {'id': 'halina', 'x': -24, 'z': -37.5, 'yaw': 0},
        {'id': 'mietek', 'x': -72, 'z': -76, 'yaw': 0},
        {'id': 'zdzisio', 'x': 12.8, 'z': 83, 'yaw': 180},
    ],
    'routes': {'petla': [[-15, 72], [30, 72], [30, -62], [-60, -62], [-60, 72]]},
}

def line(v): return json.dumps(v, ensure_ascii=False, separators=(', ', ': '))
out = ['{']
keys = list(m)
for i, k in enumerate(keys):
    v = m[k]; comma = ',' if i < len(keys) - 1 else ''
    if isinstance(v, list) and v and isinstance(v[0], (dict, list)):
        out.append(f' "{k}": [')
        out += ['  ' + line(x) + (',' if j < len(v) - 1 else '') for j, x in enumerate(v)]
        out.append(' ]' + comma)
    elif isinstance(v, dict) and k in ('points', 'shop', 'routes'):
        out.append(f' "{k}": {{')
        ks = list(v)
        out += [f'  "{kk}": ' + line(v[kk]) + (',' if j < len(ks) - 1 else '') for j, kk in enumerate(ks)]
        out.append(' }' + comma)
    else:
        out.append(f' "{k}": ' + line(v) + comma)
out.append('}')
open('src/maps/osiedle.json', 'w').write('\n'.join(out) + '\n')
