// v0.3b: the hand-made estate map (src/maps/osiedle.json) – everything exists, the streets are drivable, the mission
// spots are free, and colliders are as big as the objects are at body height (not bigger).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import map from '../src/maps/osiedle.json' with { type: 'json' };
import { colliders, overlaps, place } from './mapgeo.mjs';
import { roadTiles, ROAD_TILE } from '../src/roads.js';

const fmt = (n, d = 1) => Number(n).toFixed(d);
const CAR = { hx: 2.15, hz: 0.85 }; // body footprint (vehicle.ts BODY_HALF)

test('mapa: wszystkie modele istnieją, osiedle ma wszystkie strefy z planu (docs/mapa.md)', (t) => {
  const models = new Set(map.objects.map((o) => o.model));
  const missing = [...models].filter((m) => !fs.existsSync(new URL(`../public/assets/kenney/${m}.gltf`, import.meta.url)));
  const named = (re) => map.objects.filter((o) => re.test(o.name ?? '')).length;
  const cars = map.objects.filter((o) => o.model.startsWith('cars/')).length;
  const garages = map.objects.filter((o) => o.model === 'city/building-garage').reduce((a, o) => a + (o.repeat?.count ?? 1), 0);
  const props = map.props.reduce((a, p) => ((a[p.type] = (a[p.type] ?? 0) + 1), a), {});
  const mainNorth = map.lamps.filter(([, z]) => z > 60 && z < 70).length, mainSouth = map.lamps.filter(([, z]) => z > 70 && z < 80).length;
  const tiles = roadTiles(map.roads, map.crossings);
  const kinds = tiles.reduce((a, x) => ((a[x.model.slice(6)] = (a[x.model.slice(6)] ?? 0) + 1), a), {});
  t.diagnostic(`${map.objects.length} wpisów, ${models.size} modeli; bloki ${named(/^Blok/)}, pawilony ${named(/^Pawilon/)}, garaże ${garages}, zaparkowane auta ${cars}, latarnie ${map.lamps.length} (główna: ${mainNorth} + ${mainSouth}), rzeczy ${JSON.stringify(props)}, dziury ${map.potholes.length}, parkingi ${map.parking.length}; kafle ulic ${JSON.stringify(kinds)}`);
  assert.deepEqual(missing, []);
  assert.ok(named(/^Blok/) >= 4 && named(/^Pawilon/) >= 1 && named(/^Supersam/) === 1 && named(/^Żappka/) === 1);
  assert.ok(garages >= 8 && cars >= 8);
  assert.ok(mainNorth >= 5 && mainSouth >= 5, 'latarnie po obu stronach głównej');
  assert.ok(props.przystanek === 1 && props.trzepak >= 1 && props.lawka >= 2 && props.piaskownica && props.hustawka);
  assert.ok(kinds['road-intersection'] >= 3 && kinds['road-bend'] >= 1, 'uliczki odchodzą od głównej');
  assert.ok(map.shop?.pad && map.locker && map.points.locker && map.points.delivery && map.points.shop && map.points.spawn && map.points.garage);
});

test('mapa: kolizje tylko tam, gdzie obiekt jest na wysokości karoserii (drzewo = pień, latarnia = słup)', (t) => {
  const tree = place('suburban/tree-large', 0, 0, { scale: 10 });
  const lamp = place('roads/light-square', 0, 0, { scale: 7 / 0.6 });
  const garage = place('city/building-garage', 0, 0, { fit: [7.6, 2.8, 6] });
  const blok = place('commercial/building-k', 0, 0, { fit: [36, 16, 12] });
  const car = place('cars/sedan', 0, 0, { length: 4.3 });
  const row = (n, p) => `${n} ${fmt(p.hx * 2)}×${fmt(p.hz * 2)} m (cały model ${fmt(p.full.x * 2)}×${fmt(p.full.z * 2)} m)`;
  t.diagnostic([row('drzewo', tree), row('latarnia', lamp), row('garaż', garage), row('blok 1', blok), row('sedan', car)].join('; '));
  assert.ok(tree.hx * 2 < 1 && tree.hz * 2 < 1, 'drzewo zderza się pniem');
  assert.ok(lamp.hx * 2 < 0.8 && lamp.hz * 2 < 0.8, 'latarnia zderza się słupem, nie wysięgnikiem');
  for (const p of [garage, blok, car]) assert.ok(p.hx <= p.full.x + 1e-6 && p.hz <= p.full.z + 1e-6, 'nigdy większe niż model');
});

test('mapa: nic nie stoi na jezdni, każda ulica przejezdna, cele misji i start wolne', (t) => {
  const list = colliders(map);
  const tiles = roadTiles(map.roads, map.crossings);
  // The driving lane of every road cell (6 m wide along each open direction) must be completely free
  const onLane = new Set();
  for (const c of tiles) {
    for (const d of c.open) {
      const along = d === 'E' || d === 'W';
      const lane = { cx: c.x + (d === 'E' ? 2.5 : d === 'W' ? -2.5 : 0), cz: c.z + (d === 'S' ? 2.5 : d === 'N' ? -2.5 : 0), yaw: 0, hx: along ? 2.5 : 3, hz: along ? 3 : 2.5 };
      for (const h of overlaps(list, lane)) onLane.add(`${h.name} przy (${c.x}, ${c.z})`);
    }
  }
  const pts = Object.entries(map.points).filter(([k]) => k !== 'lot').map(([k, p]) => {
    const hit = overlaps(list, { cx: p.x, cz: p.z, yaw: ((p.heading ?? 0) * Math.PI) / 180, hx: CAR.hx, hz: CAR.hz });
    return [k, hit.map((h) => h.name)];
  });
  // The big lot is really empty in the middle (drift area): a 30 × 30 m square without anything in it
  const lotFree = overlaps(list, { cx: map.points.lot.x, cz: map.points.lot.z, yaw: 0, hx: 15, hz: 12 }).map((h) => h.name);
  const lockerDist = Math.hypot(map.points.locker.x - map.locker.x, map.points.locker.z - map.locker.z);
  t.diagnostic(`${tiles.length} kafli ulic, na jezdni: ${onLane.size ? [...onLane].join(', ') : 'nic'}; cele: ${pts.map(([k, h]) => `${k} ${h.length ? 'ZAJĘTY ' + h.join('/') : 'wolny'}`).join(', ')}; plac do driftu 30 × 24 m ${lotFree.length ? 'ZAJĘTY ' + lotFree.join('/') : 'pusty'}; paczkomat ${fmt(lockerDist)} m od punktu odbioru`);
  assert.deepEqual([...onLane], []);
  for (const [k, h] of pts) assert.deepEqual(h, [], `${k} wolny`);
  assert.deepEqual(lotFree, []);
  assert.ok(lockerDist < 6);
});
