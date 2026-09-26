// v0.3b: the hand-made estate map (src/maps/osiedle.json) – everything exists, the streets are drivable, the mission
// spots are free, and colliders are as big as the objects are at body height (not bigger).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import map from '../src/maps/osiedle.json' with { type: 'json' };
import { colliders, overlaps, place } from './mapgeo.mjs';

const fmt = (n, d = 1) => Number(n).toFixed(d);
const CAR = { hx: 2.15, hz: 0.85 }; // body footprint (vehicle.ts BODY_HALF)

test('mapa: wszystkie modele istnieją, układ ma wymagane elementy', (t) => {
  const models = new Set(map.objects.map((o) => o.model));
  const missing = [...models].filter((m) => !fs.existsSync(new URL(`../public/assets/kenney/${m}.gltf`, import.meta.url)));
  const count = (re) => map.objects.filter((o) => re.test(o.name ?? '')).length;
  const cars = map.objects.filter((o) => o.model.startsWith('cars/')).length;
  const garages = map.objects.filter((o) => o.model === 'city/building-garage').reduce((a, o) => a + (o.repeat?.count ?? 1), 0);
  t.diagnostic(`${map.objects.length} wpisów, ${models.size} modeli; bloki ${count(/^Blok/)}, garaże ${garages}, zaparkowane auta ${cars}, latarnie ${map.lamps.length}, dziury ${map.potholes.length}, parkingi ${map.parking.length}`);
  assert.deepEqual(missing, []);
  assert.ok(count(/^Blok/) >= 3 && count(/^Blok/) <= 4);
  assert.ok(garages >= 6 && cars >= 4 && map.lamps.length >= 12 && map.potholes.length >= 3);
  assert.ok(map.shop?.pad && map.locker && map.points.locker && map.points.delivery && map.points.shop && map.points.spawn);
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

test('mapa: pętla ulic przejezdna, cele misji i start wolne', (t) => {
  const list = colliders(map);
  const L = map.roadLoop.half;
  // Walk the loop every 2 m; at each spot the car must fit somewhere across the road (±4 m from the centre line)
  let blocked = [], narrow = 0, samples = 0;
  for (let s = -L; s <= L; s += 2) {
    for (const [x, z, yaw, ox, oz] of [[s, -L, 0, 0, 1], [s, L, 0, 0, 1], [-L, s, Math.PI / 2, 1, 0], [L, s, Math.PI / 2, 1, 0]]) {
      samples++;
      const free = [-4, -3, -2, -1, 0, 1, 2, 3, 4].filter((d) => overlaps(list, { cx: x + ox * d, cz: z + oz * d, yaw, hx: 1.2, hz: CAR.hz + 0.2 }).length === 0);
      if (!free.length) blocked.push(`${x},${z}`);
      else if (free.length < 5) narrow++;
    }
  }
  const pts = Object.entries(map.points).map(([k, p]) => {
    const hit = overlaps(list, { cx: p.x, cz: p.z, yaw: ((p.heading ?? 0) * Math.PI) / 180, hx: CAR.hx, hz: CAR.hz });
    return [k, hit.map((h) => h.name)];
  });
  const lockerDist = Math.hypot(map.points.locker.x - map.locker.x, map.points.locker.z - map.locker.z);
  t.diagnostic(`pętla: ${samples} punktów, zablokowane ${blocked.length}, zwężone (<5 m wolnego) ${narrow}; cele: ${pts.map(([k, h]) => `${k} ${h.length ? 'ZAJĘTY ' + h.join('/') : 'wolny'}`).join(', ')}; paczkomat ${fmt(lockerDist)} m od punktu odbioru`);
  assert.deepEqual(blocked, []);
  assert.ok(narrow <= 8, 'tylko roboty drogowe zwężają jezdnię');
  for (const [k, h] of pts) assert.deepEqual(h, [], `${k} wolny`);
  assert.ok(lockerDist < 6);
});
