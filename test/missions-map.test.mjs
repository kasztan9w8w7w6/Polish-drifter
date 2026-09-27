// v0.5c: missions 1–3 on the new estate. (1) Every mission target, every person and the race route can be reached by
// car from the start (a 0.5 m grid, obstacles grown by half the car's width). (2) The race for real: the Polonez
// (Normalny) driven by a simple autopilot round the route on the map's colliders, 2 laps against the rival (race.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import map from '../src/maps/osiedle.json' with { type: 'json' };
import { colliders } from './mapgeo.mjs';
import { createRoute, createRace } from '../src/race.js';
import { initPhysics, createPhysics } from '../src/physics.js';
import { createVehicle } from '../src/vehicle.ts';
import { presets } from '../src/tuning.ts';
import { applyCar } from '../src/cars.js';
import polonez from '../src/cars/polonez.json' with { type: 'json' };
import paczka from '../src/missions/paczka.json' with { type: 'json' };
import pokaz from '../src/missions/pokaz.json' with { type: 'json' };
import wyscig from '../src/missions/wyscig.json' with { type: 'json' };

const fmt = (n, d = 1) => Number(n).toFixed(d);
const list = colliders(map);

test('misje 1–3: każdy cel, każda postać i trasa wyścigu osiągalne autem ze startu', (t) => {
  const G = 0.5, HALF = 100, n = (2 * HALF) / G;
  const blocked = new Uint8Array(n * n);
  const grow = 1.0; // half the car's width, plus a little
  for (const c of list) {
    const r = Math.hypot(c.hx, c.hz) + grow;
    const ax = [Math.cos(c.yaw), -Math.sin(c.yaw)], az = [Math.sin(c.yaw), Math.cos(c.yaw)];
    for (let j = Math.max(0, Math.floor((c.cz - r + HALF) / G)); j <= Math.min(n - 1, Math.floor((c.cz + r + HALF) / G)); j++) {
      for (let i = Math.max(0, Math.floor((c.cx - r + HALF) / G)); i <= Math.min(n - 1, Math.floor((c.cx + r + HALF) / G)); i++) {
        const x = -HALF + (i + 0.5) * G - c.cx, z = -HALF + (j + 0.5) * G - c.cz;
        if (Math.abs(x * ax[0] + z * ax[1]) <= c.hx + grow && Math.abs(x * az[0] + z * az[1]) <= c.hz + grow) blocked[j * n + i] = 1;
      }
    }
  }
  const idx = (x, z) => Math.floor((z + HALF) / G) * n + Math.floor((x + HALF) / G);
  const seen = new Uint8Array(n * n);
  const start = idx(map.points.spawn.x, map.points.spawn.z);
  const q = [start];
  seen[start] = 1;
  while (q.length) {
    const i = q.pop();
    for (const k of [i - 1, i + 1, i - n, i + n]) if (k >= 0 && k < n * n && !seen[k] && !blocked[k]) (seen[k] = 1), q.push(k);
  }
  // reachable within r of a point (a target is reached when the car gets inside its radius)
  const near = (x, z, r) => {
    for (let dz = -r; dz <= r; dz += G) for (let dx = -r; dx <= r; dx += G) if (dx * dx + dz * dz <= r * r && seen[idx(x + dx, z + dz)]) return true;
    return false;
  };
  const targets = [];
  for (const m of [paczka, pokaz, wyscig]) {
    targets.push([`${m.id}: start`, map.points[m.start.point], 3]);
    for (const s of m.steps) {
      if (s.point) targets.push([`${m.id}/${s.id}`, map.points[s.point], Math.min(4, map.points[s.point].r ?? 4)]);
      if (s.npc) {
        const p = map.npcs.find((x) => x.id === s.npc);
        targets.push([`${m.id}/${s.id} (${s.npc})`, p, 4.5]);
      }
    }
  }
  for (const p of map.npcs) targets.push([`postać ${p.id}`, p, 4.5]);
  const route = createRoute(map.routes.petla);
  let routeOk = 0, routeN = 0;
  for (let s = 0; s < route.length; s += 2, routeN++) if (near(route.at(s).x, route.at(s).z, 1)) routeOk++;
  const miss = targets.filter(([, p, r]) => !near(p.x, p.z, r)).map(([k]) => k);
  t.diagnostic(`${targets.length} celów (misje 1–3 + postacie): nieosiągalne ${miss.length ? miss.join(', ') : 'żaden'}; trasa wyścigu osiągalna w ${routeOk}/${routeN} punktach`);
  assert.deepEqual(miss, []);
  assert.equal(routeOk, routeN);
});

test('misja 3 na nowej mapie: autopilot Poloneza jedzie 2 okrążenia z przeciwnikiem po prawdziwych kolizjach', async (t) => {
  await initPhysics();
  const physics = createPhysics();
  physics.addStaticBox({ x: 0, y: -1, z: 0 }, { x: 300, y: 1, z: 300 }, { friction: 0.8 });
  const yawQ = (y) => ({ x: 0, y: Math.sin(y / 2), z: 0, w: Math.cos(y / 2) });
  for (const c of list) physics.addStaticBox({ x: c.cx, y: 1.2, z: c.cz }, { x: c.hx, y: 1.2, z: c.hz }, { rotation: yawQ(c.yaw), surface: c.path === 'lamp' ? 'metal' : 'concrete' });
  const route = createRoute(map.routes.petla);
  const tuning = applyCar({ ...presets.Normalny }, polonez);
  // on the grid: left lane, 8 m behind the line (like main.js setupRace)
  const g = route.at(-8);
  const car = createVehicle(physics, { tuning, spawn: { x: g.x + g.dz * 1.8, y: 1, z: g.z - g.dx * 1.8 }, spawnYaw: Math.atan2(-g.dz, g.dx) });
  const race = createRace(route, { laps: 2, countdown: 3 });
  // a movable box for the rival like rival.js, so the player can bump into it
  const rivalBox = physics.addMovableBox({ x: 0.85, y: 0.7, z: 2.15 }, { surface: 'car' });
  let time = 0, maxJump = 0, crashes = 0, prev = null, topRival = 0, minGap = Infinity, maxGap = -Infinity;
  // Autopilot: pure pursuit on the route (8–14 m ahead, left of the line), speed from the curvature ahead
  const drive = (s) => {
    const p = s.position;
    const tot = race.state.playerTotal;
    const look = 8 + s.speed * 0.25;
    const a = route.at(tot + look);
    const tx = a.x + a.dz * 1.6, tz = a.z - a.dx * 1.6;
    const heading = Math.atan2(-(tx - p.x) * 0 - (tz - p.z), tx - p.x);
    const f = { x: 1, z: 0 };
    const q = s.quaternion;
    f.x = 1 - 2 * (q.y * q.y + q.z * q.z);
    f.z = 2 * (q.x * q.z - q.w * q.y);
    const yaw = Math.atan2(-f.z, f.x);
    let err = heading - yaw;
    err -= 2 * Math.PI * Math.round(err / (2 * Math.PI));
    let vmax = 22;
    for (let d = 0; d <= 35; d += 2) {
      const k = route.kappa(tot + d);
      const vc = k > 1e-4 ? Math.sqrt(5.5 / k) : 30;
      vmax = Math.min(vmax, Math.sqrt(vc * vc + 2 * 6 * d));
    }
    const go = race.state.time >= 0;
    return { throttle: go && s.speed < vmax ? 1 : 0.2 * (go ? 1 : 0), brake: s.speed > vmax + 2 ? 1 : 0, steer: Math.max(-1, Math.min(1, err * 2.2)), handbrake: 0 };
  };
  while (!race.state.result && time < 120) {
    const inp = drive(car.state);
    physics.step(1 / 60, (h) => car.update(inp, h), () => car.afterStep());
    const s = car.read();
    if (s.crash > 4) crashes++;
    race.update(1 / 60, { x: s.position.x, z: s.position.z, speed: s.speed });
    const r = race.rival.state;
    rivalBox.set(r.x, r.z, r.yaw + Math.PI / 2);
    if (prev) maxJump = Math.max(maxJump, Math.hypot(r.x - prev.x, r.z - prev.z));
    prev = { x: r.x, z: r.z };
    topRival = Math.max(topRival, r.speed);
    if (race.state.time > 5) (minGap = Math.min(minGap, race.state.gap)), (maxGap = Math.max(maxGap, race.state.gap));
    time += 1 / 60;
  }
  t.diagnostic(`wynik: ${race.state.result} po ${fmt(race.state.time)} s (2 × ${fmt(route.length, 0)} m); gracz-autopilot uderzeń > 14 km/h: ${crashes}; przeciwnik maks. ${fmt(topRival * 3.6, 0)} km/h, największy skok w klatce ${fmt(maxJump, 2)} m; różnica między autami od ${fmt(minGap, 0)} do ${fmt(maxGap, 0)} m`);
  assert.ok(race.state.result, 'wyścig się kończy (ktoś przejeżdża metę)');
  assert.ok(maxJump < 0.6, 'przeciwnik nie teleportuje się');
  assert.ok(crashes <= 2, 'trasa przejezdna bez obijania');
  assert.ok(maxGap - minGap < 200, 'tempo dopasowane');
});
