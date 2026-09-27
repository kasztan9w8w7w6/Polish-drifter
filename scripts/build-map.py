# Generates src/maps/osiedle.json from the plan in docs/mapa.md (one-off helper; the JSON is the source of truth
# afterwards and can be edited by hand). Coordinates: x east, z south, 10 m grid.
import json, math

o = []
def add(model, x, z, **kw):
    d = {'model': model, 'x': x, 'z': z}; d.update(kw); o.append(d)

# --- Blocks of flats (wielka płyta: long stretched Kenney buildings) ---
add('commercial/building-k', -15, -40, yaw=0, fit=[44, 15, 12], name='Blok 1 (ul. Tereszkowej 3)', occlude=True)
add('commercial/building-j', -15, 40, yaw=180, fit=[44, 15, 12], name='Blok 2 (ul. Kosmonautów 12)', occlude=True)
add('commercial/building-j', -80, -10, yaw=90, fit=[46, 15, 12], name='Blok 3 (ul. Lotników 7)', occlude=True)
add('commercial/building-skyscraper-a', -80, 40, yaw=90, scale=9, name='Blok 4 (punktowiec, ul. Lotników 9)', occlude=True)
# --- Market "Supersam" north of the big lot ---
add('commercial/building-n', 62, -40, yaw=0, fit=[40, 9, 16], name='Supersam', occlude=True)
# --- Shops on the south side of the main street ---
add('commercial/building-h', 0, 88, yaw=180, length=12, name='Żappka 24h', occlude=True)
add('commercial/detail-awning-wide', 0, 81.6, y=2.6, yaw=180, length=7, collide=False)
add('commercial/building-c', -38, 88, yaw=180, fit=[16, 6, 10], name='Pawilon (warzywniak, fryzjer)', occlude=True)
add('commercial/building-e', 38, 88, yaw=180, fit=[18, 6, 10], name='Pawilon (apteka, lombard)', occlude=True)
# --- Garages along the north edge, doors facing the street ---
add('city/building-garage', -76, -78, fit=[7.6, 2.8, 6], repeat={'count': 11, 'dx': 8, 'dz': 0}, name='garaże')
# --- Dumpsters next to blocks, garages, the market ---
for x, z, y in [[-40, -32, 90], [-40, -29, 90], [10, 32, 90], [-70, 22, 0], [-72, -86, 0], [88, -30, 0], [88, -26, 0], [12, 80, 90]]:
    add('roads/dumpster', x, z, yaw=y, scale=6, surface='metal')
# --- Fences: around the playground, behind the garages ---
for x in [-26, -34]:
    add('suburban/fence-low', x, -12, length=8, surface='metal')
for x in [0, 30, 60, 90]:
    add('suburban/fence-1x4', x - 90, -93, length=10, surface='metal', collide=False)
# --- Parked cars: only in bays and at the kerb ---
bay2 = ['cars/sedan', 'cars/hatchback-sports', 'cars/suv', 'cars/van', 'cars/sedan-sports', 'cars/sedan']
for i, m in enumerate(bay2):
    add(m, -34 + i * 3.2 + (0 if i < 3 else 12.8), 58.5, yaw=180, length=4.8 if m.endswith('van') else 4.3, surface='car')  # bays in front of Blok 2
for x, z, m in [[-44.2, -25, 'cars/sedan'], [-44.2, 5, 'cars/suv'], [13.8, -20, 'cars/hatchback-sports'], [13.8, 25, 'cars/sedan']]:
    add(m, x, z, yaw=0, length=4.3, surface='car')  # at the kerb of the inner streets (parallel)
for x, m in [[-52, 'cars/sedan'], [55, 'cars/van'], [-22, 'cars/taxi']]:
    add(m, x, 77.3, yaw=90, length=4.8 if m.endswith('van') else 4.3, surface='car')  # kerb on the south side of the main street
for x, m in [[-10, 'cars/taxi'], [13.2, 'cars/sedan']]:
    add(m, x, 79.5, yaw=180, length=4.3, surface='car')  # Żappka parking
for x, m in [[45, 'cars/suv'], [48.2, 'cars/sedan'], [80, 'cars/delivery'], [76.8, 'cars/hatchback-sports']]:
    add(m, x, -26, yaw=180, length=5.2 if m.endswith('delivery') else 4.3, surface='car')  # under the market entrance
add('cars/garbage-truck', 92, -22, yaw=180, length=7.5, surface='car')  # at the market's bins
add('cars/van', -60, -70, yaw=90, length=4.8, surface='car')  # in front of the garages
# --- Trees: courtyard, verges, corners ---
trees = [[-40, -20], [8, -24], [-40, 24], [8, 22], [-18, 12], [-2, -8], [-62, -40], [-62, 12], [-92, 60], [-92, -48],
         [30, -54], [96, -54], [30, 58], [96, 58], [-92, 90], [92, 92], [-20, 96], [20, 96], [-65, -92], [60, -92], [-60, 58], [8, 58]]
for x, z in trees:
    add('suburban/tree-large' if (x + z) % 3 else 'suburban/tree-small', x, z, scale=10, surface='tree')
# --- Decoration outside the fence (never reached, no collision): more estate, poles ---
blocks = ['commercial/building-skyscraper-a', 'commercial/building-f', 'commercial/building-skyscraper-b', 'commercial/building-j', 'commercial/building-skyscraper-d', 'commercial/building-k', 'commercial/building-skyscraper-e', 'commercial/building-l', 'commercial/building-n']
for i in range(18):
    a = (i / 18) * math.pi * 2 + 0.15; r = 128 + (i % 3) * 12
    x = round(math.cos(a) * r, 1); z = round(math.sin(a) * r, 1)
    add(blocks[i % len(blocks)], x, z, scale=11, yaw=round(math.degrees(math.atan2(-x, -z))), collide=False)
for t in range(-90, 91, 45):
    add('roads/electricity-pole', t, 108, scale=12, collide=False)

# --- Street lamps: [x, z, yaw, double]; the arm points to local −Z (yaw 180: arm to the south, 0: north, 90: west, −90: east) ---
lamps = []
for x in [-85, -65, -35, -15, 5, 35, 55, 75]:
    lamps.append([x, 63.5, 180, False])  # main street, north side
for x in [-75, -55, -25, 25, 45, 65, 85]:
    lamps.append([x, 76.5, 0, False])  # main street, south side (staggered)
for z in [-40, -15, 15, 45]:
    lamps.append([-43.5, z, 90, False])  # ul. Lotników, east side
    lamps.append([13.5, z, -90, False])  # ul. Gagarina, west side
for x in [-70, -40, -10]:
    lamps.append([x, -53.5, 0, False])  # ul. Tereszkowej, south side
for x, z in [[46, -6], [76, -6], [46, 40], [76, 40], [34, 17], [88, 17]]:
    lamps.append([x, z, 0, True])  # market lot
lamps.append([-15, 2, 0, True])  # courtyard

m = {
    '_help': 'Mapa osiedla (plan: docs/mapa.md). Współrzędne w metrach: x = wschód, z = południe (północ = -z), siatka 10 m. '
             'roads: odcinki ulic [[x1, z1], [x2, z2]] wzdłuż osi, kafle skrzyżowań i łuków dobierają się same; crossings: pasy dla pieszych. '
             'objects: yaw w stopniach: 0 = front modelu na południe, 180 = na północ, 90 = na wschód, -90 = na zachód. Rozmiar: scale, length (najdłuższy bok w m) '
             'albo fit [szer., wys., głęb.] w m; y = wysokość nad ziemią. collide (domyślnie true): kolizja z geometrii na wysokości karoserii, '
             'surface = materiał (physics.js SURFACES). repeat = rząd kopii co dx/dz. props: rzeczy z własnej geometrii (lawka, trzepak, piaskownica, hustawka, przystanek). '
             'lamps: [x, z, yaw, podwójna]. points: miejsca dla misji (r = promień celu), heading auta: 0 = na wschód, 90 = na północ.',
    'name': 'Osiedle Kosmonautów',
    'size': 200,
    'roads': [
        [[-90, 70], [90, 70]],   # ul. Kosmonautów (main)
        [[-50, -60], [-50, 70]], # ul. Lotników
        [[20, -60], [20, 70]],   # ul. Gagarina
        [[-80, -60], [20, -60]], # ul. Tereszkowej
    ],
    'crossings': [[0, 70], [-50, 20], [20, 0]],
    'walls': [[0, 100, 200, 1], [0, -100, 200, 1], [100, 0, 1, 200], [-100, 0, 1, 200]],
    'objects': o,
    'props': [
        {'type': 'przystanek', 'x': -65, 'z': 79.5, 'yaw': 180, 'name': 'Osiedle Kosmonautów'},
        {'type': 'piaskownica', 'x': -30, 'z': -4},
        {'type': 'hustawka', 'x': -22, 'z': 4, 'yaw': 90},
        {'type': 'trzepak', 'x': 0, 'z': -20},
        {'type': 'trzepak', 'x': -32, 'z': 20},
        {'type': 'lawka', 'x': -36, 'z': 4, 'yaw': 90},
        {'type': 'lawka', 'x': -36, 'z': -8, 'yaw': 90},
        {'type': 'lawka', 'x': -8, 'z': 10, 'yaw': 180},
        {'type': 'lawka', 'x': -60, 'z': 79.5, 'yaw': 180},
        {'type': 'lawka', 'x': -5, 'z': -30, 'yaw': 0},
    ],
    'lamps': lamps,
    'cones': [[86, -14], [88, -14], [90, -14], [84, -14]],
    'tyres': [],
    'potholes': [[-50, 10, 1.0], [-20, 70, 0.9], [40, 70, 1.2], [20, -30, 0.8], [-65, -60, 0.7], [60, 70, 0.6], [-50, -35, 0.9], [-10, -60, 1.1]],
    'parking': [
        {'x': -24.4, 'z': 58.5, 'yaw': 180, 'bays': 3, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': -1.6, 'z': 58.5, 'yaw': 180, 'bays': 3, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': -11.6, 'z': 79.5, 'yaw': 180, 'bays': 2, 'bayWidth': 3.2, 'depth': 5},
        {'x': 11.6, 'z': 79.5, 'yaw': 180, 'bays': 2, 'bayWidth': 3.2, 'depth': 5},
        {'x': 46.6, 'z': -26, 'yaw': 180, 'bays': 3, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': 78.4, 'z': -26, 'yaw': 180, 'bays': 3, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': 61, 'z': 17, 'yaw': 0, 'frame': [64, 76]},
        {'x': 61, 'z': 49, 'yaw': 180, 'bays': 14, 'bayWidth': 3.2, 'depth': 5.5},
        {'x': 61, 'z': -14, 'yaw': 0, 'bays': 14, 'bayWidth': 3.2, 'depth': 5.5},
    ],
    'signs': [
        {'text': 'Żappka 24h', 'at': [0, 4.2, 81.4], 'yaw': 180, 'colors': ['#062d14', '#ffe14a', '#9dff6a']},
        {'text': 'SUPERSAM', 'at': [62, 6.5, -31.6], 'yaw': 0, 'colors': ['#2a0606', '#ffd24a', '#ff5a4a']},
    ],
    'shop': {'light': [0, 3, 79], 'pad': {'x': 0, 'z': 79.5, 'w': 6, 'd': 4}},
    'locker': {'name': 'Paczkobox 24/7', 'x': -15, 'z': -32.6, 'yaw': 0},
    'points': {
        'spawn': {'x': -30, 'z': 52, 'heading': 0, 'label': 'parking przed Blokiem 2'},
        'garage': {'x': -44, 'z': -70, 'heading': 90, 'label': 'przed garażami'},
        'locker': {'x': -15, 'z': -27.5, 'r': 3.5, 'label': 'Paczkobox przy Bloku 1'},
        'lot': {'x': 61, 'z': 17, 'r': 25, 'label': 'plac pod Supersamem'},
        'delivery': {'x': -66, 'z': 40, 'r': 4, 'label': 'Blok 4, punktowiec'},
        'shop': {'x': 0, 'z': 79.5, 'r': 3, 'label': 'Żappka 24h'},
    },
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
    elif isinstance(v, dict) and k in ('points', 'shop'):
        out.append(f' "{k}": {{')
        ks = list(v)
        out += [f'  "{kk}": ' + line(v[kk]) + (',' if j < len(ks) - 1 else '') for j, kk in enumerate(ks)]
        out.append(' }' + comma)
    else:
        out.append(f' "{k}": ' + line(v) + comma)
out.append('}')
open('src/maps/osiedle.json', 'w').write('\n'.join(out) + '\n')
print(len(o), 'objects,', len(lamps), 'lamps')
