// v0.5c: the estate (src/maps/osiedle.json, plan in docs/mapa.md) – everything exists, the streets form closed loops
// and are free, the yards are not road, every lot and the garages are joined to the streets, the corners are
// rounded, the mission spots and the people are free, and colliders are as big as things are at body height.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import map from '../src/maps/osiedle.json' with { type: 'json' };
import { colliders, overlaps, place } from './mapgeo.mjs';
import { rasterize, K, isAsphalt, RES, HALF } from '../src/ground.js';
import { blockLayout } from '../src/blocks.js';
import { createRoute } from '../src/race.js';

const fmt = (n, d = 1) => Number(n).toFixed(d);
const CAR = { hx: 2.15, hz: 0.85 }; // body footprint (vehicle.ts BODY_HALF)
const ground = rasterize(map);
const kindName = Object.fromEntries(Object.entries(K).map(([k, v]) => [v, k]));
const list = colliders(map);
const blocks = (map.blocks ?? []).filter((b) => b.collide !== false);

test('mapa: wszystkie modele istnieją, osiedle ma wszystkie strefy z planu (docs/mapa.md)', (t) => {
  const models = new Set(map.objects.map((o) => o.model));
  // "epoka/<id>" models (v0.8 cz. 8: Golf II, Fiat 126p on the street) live in public/models/<id>/, not the Kenney kits
  const missing = [...models].filter((m) => {
    const id = m.startsWith('epoka/') ? m.slice(6) : null;
    return !fs.existsSync(new URL(id ? `../public/models/${id}/${id}.gltf` : `../public/assets/kenney/${m}.gltf`, import.meta.url));
  });
  const named = (re) => map.objects.filter((o) => re.test(o.name ?? '')).length;
  const cars = map.objects.filter((o) => o.model.startsWith('cars/')).length;
  const garages = map.objects.filter((o) => o.model === 'city/building-garage').reduce((a, o) => a + (o.repeat?.count ?? 1), 0);
  const props = map.props.reduce((a, p) => ((a[p.type] = (a[p.type] ?? 0) + 1), a), {});
  const mainNorth = map.lamps.filter(([, z]) => z > 62 && z < 72).length, mainSouth = map.lamps.filter(([, z]) => z > 72 && z < 82).length;
  const tall = blocks.filter((b) => b.pietra >= 10).length, low = blocks.filter((b) => b.pietra === 4).length;
  t.diagnostic(`bloki z wielkiej płyty ${blocks.length} (10 pięter: ${tall}, 4 piętra: ${low}, maszt: ${blocks.filter((b) => b.maszt).length}) + ${map.blocks.length - blocks.length} za płotem; ${models.size} modeli Kenneya; pawilony ${named(/^Pawilon/)}, garaże ${garages}, zaparkowane auta ${cars}, latarnie ${map.lamps.length} (główna: ${mainNorth} + ${mainSouth}), rzeczy ${JSON.stringify(props)}, dziury ${map.potholes.length}, parkingi ${map.parking.length}`);
  assert.deepEqual(missing, []);
  assert.ok(blocks.length >= 5 && tall >= 2 && low >= 2 && blocks.some((b) => b.maszt));
  assert.ok(new Set(blocks.map((b) => blockLayout(b).length)).size >= 3, 'różne długości');
  assert.ok(named(/^Pawilon/) >= 1 && named(/^Supersam/) === 1 && named(/^Żappka/) === 1);
  assert.ok(garages >= 8 && cars >= 8);
  assert.ok(mainNorth >= 5 && mainSouth >= 5, 'latarnie po obu stronach głównej');
  assert.ok(props.przystanek === 1 && props.trzepak >= 2 && props.lawka >= 3 && props.piaskownica && props.hustawka);
  assert.ok(map.shop?.pad && map.locker && map.points.locker && map.points.delivery && map.points.shop && map.points.spawn && map.points.garage);
});

test('mapa: kolizje tylko tam, gdzie obiekt jest na wysokości karoserii (drzewo = pień, latarnia = słup, blok = obrys)', (t) => {
  const tree = place('suburban/tree-large', 0, 0, { scale: 10 });
  const lamp = place('roads/light-square', 0, 0, { scale: 7 / 0.6 });
  const garage = place('city/building-garage', 0, 0, { fit: [7.6, 2.8, 6] });
  const car = place('cars/sedan', 0, 0, { length: 4.3 });
  const b1 = blockLayout(blocks[0]);
  const row = (n, p) => `${n} ${fmt(p.hx * 2)}×${fmt(p.hz * 2)} m (cały model ${fmt(p.full.x * 2)}×${fmt(p.full.z * 2)} m)`;
  t.diagnostic([row('drzewo', tree), row('latarnia', lamp), row('garaż', garage), row('sedan', car), `${blocks[0].name} ${fmt(b1.length)}×${fmt(b1.depth)}×${fmt(b1.height)} m, ${b1.klatki} klatki`].join('; '));
  assert.ok(tree.hx * 2 < 1 && tree.hz * 2 < 1, 'drzewo zderza się pniem');
  assert.ok(lamp.hx * 2 < 0.8 && lamp.hz * 2 < 0.8, 'latarnia zderza się słupem, nie wysięgnikiem');
  for (const p of [garage, car]) assert.ok(p.hx <= p.full.x + 1e-6 && p.hz <= p.full.z + 1e-6, 'nigdy większe niż model');
});

// The street axes as segments; the loops of the network (junctions where one street's end touches another)
const segs = map.streets.flatMap((s) => s.pts.slice(1).map((p, k) => ({ s, a: s.pts[k], b: p })));
function junctions() {
  const pts = new Map();
  const key = (x, z) => `${Math.round(x)},${Math.round(z)}`;
  const on = (seg, [x, z]) => Math.abs((seg.b[0] - seg.a[0]) * (z - seg.a[1]) - (seg.b[1] - seg.a[1]) * (x - seg.a[0])) < 1e-6 && x >= Math.min(seg.a[0], seg.b[0]) - 1e-6 && x <= Math.max(seg.a[0], seg.b[0]) + 1e-6 && z >= Math.min(seg.a[1], seg.b[1]) - 1e-6 && z <= Math.max(seg.a[1], seg.b[1]) + 1e-6;
  for (const g of segs) for (const p of [g.a, g.b]) if (segs.some((h) => h.s !== g.s && on(h, p))) pts.set(key(...p), p);
  return [...pts.values()];
}

test('ulice: zamknięte pętle, zaokrąglone narożniki, linie tylko na głównej, pasy wolne', (t) => {
  // Graph: junction points split the streets into edges; loops = E − V + components (here 1)
  const nodes = junctions();
  const edges = [];
  for (const g of segs) {
    const along = (p) => Math.hypot(p[0] - g.a[0], p[1] - g.a[1]);
    const len = along(g.b);
    const cut = nodes.filter((p) => Math.abs((g.b[0] - g.a[0]) * (p[1] - g.a[1]) - (g.b[1] - g.a[1]) * (p[0] - g.a[0])) < 1e-6 && along(p) <= len + 1e-6).sort((p, q) => along(p) - along(q));
    for (let i = 1; i < cut.length; i++) edges.push([cut[i - 1], cut[i]]);
  }
  const loops = edges.length - nodes.length + 1; // independent loops (the big one is the sum of the two smaller ones)
  // Rounded corners: the inside corner of every junction is asphalt a bit inside the kerb line
  const corners = [];
  for (const [x, z] of nodes) {
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const k = ground.at(x + dx * 3.9, z + dz * 3.9); // 3 m = half an estate street; 0.9 m further = in the fillet
      corners.push(isAsphalt(k) || k === K.glowna);
    }
  }
  const rounded = corners.filter(Boolean).length;
  // Driving lanes: the whole width (minus 0.5 m at each kerb) free of colliders, every 1 m
  const blocked = new Set();
  for (const { s, a, b } of segs) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    for (let d = 0; d <= len; d += 1) {
      const x = a[0] + ((b[0] - a[0]) * d) / len, z = a[1] + ((b[1] - a[1]) * d) / len;
      if (Math.abs(x) > 98 || Math.abs(z) > 98) continue; // (the ends run into the fence)
      for (const h of overlaps(list, { cx: x, cz: z, yaw, hx: 0.5, hz: s.width / 2 - 0.5 })) blocked.add(`${h.name} na ${s.name} (${fmt(x, 0)}, ${fmt(z, 0)})`);
    }
  }
  const main = map.streets.filter((s) => s.kind === 'glowna');
  const estate = map.streets.filter((s) => s.kind !== 'glowna');
  t.diagnostic(`${map.streets.length} ulic, ${nodes.length} skrzyżowań/narożników, ${edges.length} odcinków → niezależnych pętli ${loops} (północna, południowa; duża = obie razem); zaokrąglone wewnętrzne narożniki ${rounded}/${corners.length}; linie tylko na: ${main.map((s) => s.name).join(', ')} (${main[0].width} m), uliczki ${[...new Set(estate.map((s) => s.width))].join('/')} m bez linii; przeszkody na jezdni: ${blocked.size ? [...blocked].join('; ') : 'brak'}`);
  assert.ok(loops >= 2, 'pętle: północna i południowa (a razem duża)');
  assert.ok(rounded >= nodes.length * 2, 'narożniki zaokrąglone');
  assert.equal(main.length, 1);
  assert.ok(estate.every((s) => s.width <= 6.5), 'uliczki osiedlowe węższe');
  assert.deepEqual([...blocked], []);
});

// Flood fill over asphalt from a point: which cells can be reached by car without leaving the asphalt
function reach(x, z) {
  const { n, cells } = ground;
  const seen = new Uint8Array(n * n);
  const i0 = Math.floor((z + HALF) / RES) * n + Math.floor((x + HALF) / RES);
  const stack = [i0];
  seen[i0] = 1;
  while (stack.length) {
    const i = stack.pop();
    for (const q of [i - 1, i + 1, i - n, i + n]) {
      if (q < 0 || q >= n * n || seen[q] || !isAsphalt(cells[q])) continue;
      seen[q] = 1;
      stack.push(q);
    }
  }
  return (px, pz) => seen[Math.floor((pz + HALF) / RES) * n + Math.floor((px + HALF) / RES)] === 1;
}

test('podłoże: podwórka to trawa i chodniki, place i garaże połączone z ulicami, trasa wyścigu po asfalcie', (t) => {
  // Yards: the middle between the blocks is not road
  const yards = { 'podwórko północne': [-5, -25], 'podwórko południowe': [0, 30], 'przy Bloku 3': [-38, -28], 'plac zabaw': [-28, -22] };
  const yardKinds = Object.entries(yards).map(([n, [x, z]]) => [n, kindName[ground.at(x, z)]]);
  // Around every block: grass or paving at the entrances, not a street
  const doors = blocks.flatMap((b) => blockLayout(b).entrances.map((e) => [b.name, kindName[ground.at(e.x, e.z)]]));
  // Everything drivable joined into one network
  const net = reach(0, 72);
  const joined = {
    'plac pod Supersamem': net(68, 0),
    'plac przed garażami': net(-66, -74),
    'parking pod Blokiem 2': net(-30, 57),
    'parking pod Blokiem 4': net(-67, 30),
    'parking przed Żappką': net(0, 80.5),
    'ul. Tereszkowej przy garażach': net(-90, -62),
  };
  // The race route (smoothed as the rival drives it): on asphalt, both lanes free
  const route = createRoute(map.routes.petla);
  let off = 0, lanesBlocked = new Set();
  for (let s = 0; s < route.length; s += 1) {
    const p = route.at(s);
    if (!isAsphalt(ground.at(p.x, p.z))) off++;
    for (const lane of [-1.8, 1.8]) {
      const x = p.x - p.dz * lane, z = p.z + p.dx * lane;
      if (!isAsphalt(ground.at(x, z))) off++;
      for (const h of overlaps(list, { cx: x, cz: z, yaw: Math.atan2(-p.dz, p.dx), hx: 1, hz: 0.85 })) lanesBlocked.add(h.name);
    }
  }
  t.diagnostic(`podwórka: ${yardKinds.map(([n, k]) => `${n} = ${k}`).join(', ')}; wejścia do klatek: ${[...new Set(doors.map(([, k]) => k))].join('/')}; połączone z ulicami: ${Object.entries(joined).map(([n, v]) => `${n} ${v ? 'tak' : 'NIE'}`).join(', ')}; trasa ${fmt(route.length, 0)} m, poza asfaltem ${off} próbek, przeszkody na pasach: ${lanesBlocked.size ? [...lanesBlocked].join(', ') : 'brak'}`);
  for (const [n, k] of yardKinds) assert.ok(k !== 'ulica' && k !== 'glowna' && k !== 'asfalt', `${n}: ${k}`);
  for (const [n, k] of doors) assert.ok(k === 'chodnik' || k === 'trawa' || k === 'bruk', `${n}: wejście na ${k}`);
  for (const [n, v] of Object.entries(joined)) assert.ok(v, n);
  assert.equal(off, 0);
  assert.deepEqual([...lanesBlocked], []);
});

test('mapa: cele misji, postacie i start wolne, plac do driftu pusty', (t) => {
  const pts = Object.entries(map.points).filter(([k]) => k !== 'lot').map(([k, p]) => {
    const hit = overlaps(list, { cx: p.x, cz: p.z, yaw: ((p.heading ?? 0) * Math.PI) / 180, hx: CAR.hx, hz: CAR.hz });
    return [k, hit.map((h) => h.name)];
  });
  // People: free spot, and a place next to them where the car can stop (< 4.5 m) without hitting anything
  const people = map.npcs.map((n) => {
    const hit = overlaps(list, { cx: n.x, cz: n.z, yaw: 0, hx: 0.3, hz: 0.3 }).map((h) => h.name);
    let stop = null;
    for (let a = 0; a < 16 && !stop; a++) {
      const x = n.x + Math.cos((a / 16) * Math.PI * 2) * 3.4, z = n.z + Math.sin((a / 16) * Math.PI * 2) * 3.4;
      for (const yaw of [0, Math.PI / 2]) if (!stop && !overlaps(list, { cx: x, cz: z, yaw, hx: CAR.hx, hz: CAR.hz }).length && !overlaps([{ cx: n.x, cz: n.z, hx: 0.3, hz: 0.3, yaw: 0 }], { cx: x, cz: z, yaw, hx: CAR.hx, hz: CAR.hz }).length) stop = [x, z];
    }
    return [n.id, hit, stop, kindName[ground.at(n.x, n.z)]];
  });
  const lot = map.points.lot;
  const lotFree = overlaps(list, { cx: lot.x, cz: lot.z, yaw: 0, hx: 15, hz: 15 }).map((h) => h.name);
  const lockerDist = Math.hypot(map.points.locker.x - map.locker.x, map.points.locker.z - map.locker.z);
  t.diagnostic(`cele: ${pts.map(([k, h]) => `${k} ${h.length ? 'ZAJĘTY ' + h.join('/') : 'wolny'}`).join(', ')}; postacie: ${people.map(([id, h, s, k]) => `${id} (${k}) ${h.length ? 'ZAJĘTY ' + h.join('/') : s ? 'ok' : 'BRAK MIEJSCA NA AUTO'}`).join(', ')}; plac do driftu 30 × 30 m ${lotFree.length ? 'ZAJĘTY ' + lotFree.join('/') : 'pusty'}; paczkomat ${fmt(lockerDist)} m od punktu odbioru`);
  for (const [k, h] of pts) assert.deepEqual(h, [], `${k} wolny`);
  for (const [id, h, stop] of people) {
    assert.deepEqual(h, [], `${id}: miejsce wolne`);
    assert.ok(stop, `${id}: da się podjechać`);
  }
  assert.deepEqual(lotFree, []);
  assert.ok(lockerDist < 6);
});
