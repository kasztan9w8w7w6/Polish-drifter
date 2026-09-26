// v0.3c: battery, headlights, running flat, the shop as a save point.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSurvival, headlightLevel, batterySettings } from '../src/survival.js';
import { createSim } from './sim.mjs';

const fmt = (n, d = 1) => Number(n).toFixed(d);
const DT = 1 / 60;
const PAD = { x: 40, z: 32.5, w: 6, d: 4 };
const run = (sv, seconds, car) => {
  const ev = [];
  for (let t = 0; t < seconds; t += DT) ev.push(...sv.update(DT, typeof car === 'function' ? car(t) : car));
  return ev;
};
const cruise = { x: 0, z: 0, heading: 0, speed: 15, topSpeed: 30, angle: 0, grounded: true, highBeam: false };

test('bateria: rozładowuje się powoli w jeździe, szybciej na długich światłach; na postoju prawie nic', (t) => {
  const idle = createSurvival(), drive = createSurvival(), high = createSurvival();
  run(idle, 60, { ...cruise, speed: 0 });
  run(drive, 60, cruise);
  run(high, 60, { ...cruise, highBeam: true });
  const d = (sv) => 100 - sv.state.level;
  t.diagnostic(`minuta: postój −${fmt(d(idle))}%, 54 km/h −${fmt(d(drive))}%, 54 km/h na długich −${fmt(d(high))}%; pełna bateria starcza na ${fmt(100 / d(drive), 1)} min jazdy`);
  assert.ok(d(idle) < d(drive) && d(drive) < d(high));
  assert.ok(d(drive) > 10 && d(drive) < 40, 'powoli: kilka minut jazdy na pełnej');
});

test('bateria: ładuje się TYLKO w drifcie, proporcjonalnie do kąta i prędkości', (t) => {
  const at = (angle, speed) => {
    const sv = createSurvival({ level: 50 });
    run(sv, 1, { ...cruise, angle, speed });
    return sv.state.level - 50;
  };
  const straight = at(0, 20), small = at(8, 20), a20 = at(20, 15), a40 = at(40, 15), a40fast = at(40, 25), slow = at(40, 4);
  t.diagnostic(`zmiana w 1 s: prosto 20 m/s ${fmt(straight, 2)}%, 8° ${fmt(small, 2)}%, 20° 15 m/s +${fmt(a20, 2)}%, 40° 15 m/s +${fmt(a40, 2)}%, 40° 25 m/s +${fmt(a40fast, 2)}%, 40° 4 m/s ${fmt(slow, 2)}%`);
  assert.ok(straight < 0 && small < 0 && slow < 0, 'bez driftu nie ładuje');
  assert.ok(a20 > 0 && a40 > a20 * 1.7 && a40fast > a40 * 1.5, 'rośnie z kątem i prędkością');
});

test('bateria z prawdziwej jazdy (symulacja): drift ją ładuje, jazda prosto rozładowuje', async (t) => {
  const sim = await createSim();
  sim.run(0.5, {});
  sim.run(8, (s) => ({ throttle: s.speed * 3.6 < 60 ? 1 : 0.4 }));
  const sv = createSurvival({ level: 40 });
  const feed = (x, s) => sv.update(DT, { x: s.position.x, z: s.position.z, heading: 0, speed: s.speed, topSpeed: 30, angle: s.slipAngle, grounded: s.grounded, highBeam: false });
  sim.run(3, { throttle: 0.6 }, feed);
  const straight = sv.state.level - 40;
  const before = sv.state.level;
  sim.run(0.5, { steer: 1, handbrake: 1, throttle: 1 }, feed);
  sim.run(4, { steer: 0.5, throttle: 1 }, feed);
  const drift = sv.state.level - before;
  t.diagnostic(`3 s prosto ${fmt(straight, 2)}%, 4,5 s driftu +${fmt(drift, 1)}% (na końcu ${fmt(sv.state.level)}%)`);
  assert.ok(straight < 0);
  assert.ok(drift > 10, 'kilka sekund driftu wyraźnie ładuje');
});

test('reflektory: słabną z baterią, poniżej 20% migoczą, poniżej 10% ostrzeżenie', (t) => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stats = (level) => {
    const b = Array.from({ length: 600 }, () => headlightLevel(level, batterySettings, rnd).brightness);
    const mean = b.reduce((a, x) => a + x, 0) / b.length;
    const dips = b.filter((x) => x < mean * 0.7).length / b.length;
    return { mean, dips, reach: headlightLevel(level, batterySettings, () => 1).reach };
  };
  const r = [100, 50, 25, 15, 5].map((l) => [l, stats(l)]);
  t.diagnostic(`${r.map(([l, s]) => `${l}%: jasność ${fmt(s.mean, 2)}, zasięg ${fmt(s.reach, 2)}, mrugnięcia ${fmt(s.dips * 100, 0)}%`).join('; ')}`);
  const sv = createSurvival({ level: 21 });
  const ev = run(sv, 30, cruise);
  assert.ok(r[0][1].mean > r[1][1].mean && r[1][1].mean > r[2][1].mean);
  assert.ok(r[0][1].reach > r[2][1].reach);
  assert.equal(r[0][1].dips + r[1][1].dips + r[2][1].dips, 0, 'powyżej 20% bez migotania');
  assert.ok(r[3][1].dips > 0.05 && r[4][1].dips > r[3][1].dips, 'poniżej 20% miga, im mniej, tym częściej');
  assert.ok(ev.includes('low') && ev.includes('warn') && sv.state.warn, 'zdarzenia progów i ostrzeżenie');
});

test('0%: silnik gaśnie, ekran ciemnieje, restart z ostatniego punktu zapisu', (t) => {
  const sv = createSurvival({ level: 3, save: { x: -30, z: 28, heading: 90 }, pad: PAD });
  const ev = [];
  let deadAt = null, darkAt = null, respawnAt = null;
  for (let t = 0; t < 20 && !respawnAt; t += DT) {
    const e = sv.update(DT, cruise);
    if (e.includes('dead')) deadAt = t;
    if (e.includes('dark')) darkAt = t;
    if (e.includes('respawn')) respawnAt = t;
    if (deadAt !== null && respawnAt === null) assert.equal(sv.engineOn, false, 'silnik zgaszony do restartu');
    ev.push(...e);
  }
  t.diagnostic(`3% przy 54 km/h: pada po ${fmt(deadAt)} s, ciemno po ${fmt(darkAt - deadAt)} s, restart po kolejnych ${fmt(respawnAt - darkAt)} s w (${sv.state.save.x}, ${sv.state.save.z}) z ${fmt(sv.state.level, 0)}%`);
  assert.deepEqual(ev.filter((e) => ['dead', 'dark', 'respawn'].includes(e)), ['dead', 'dark', 'respawn']);
  assert.ok(sv.engineOn && sv.state.level === batterySettings.respawnMin && sv.state.save.x === -30, 'z punktu zapisu, z minimalnym zapasem baterii');
});

test('Żappka: stanięcie na polu ładuje do 100% i zapisuje punkt odrodzenia', (t) => {
  const sv = createSurvival({ level: 12, save: { x: -30, z: 28, heading: 90 }, pad: PAD });
  // Driving over the pad without stopping does nothing
  let ev = run(sv, 1, { ...cruise, x: 40, z: 32.5, speed: 8 });
  const passing = sv.state.level;
  // Stopped next to the pad: nothing either
  run(sv, 1, { ...cruise, x: 40, z: 38, speed: 0 });
  const beside = sv.state.level;
  // Stopped on it
  let full = null;
  for (let t = 0; t < 5; t += DT) {
    const e = sv.update(DT, { ...cruise, x: 41, z: 33, speed: 0.3, heading: 180 });
    ev.push(...e);
    if (e.includes('saved')) full = t;
  }
  t.diagnostic(`przejazd przez pole: ${fmt(passing)}%, obok pola: ${fmt(beside)}%, na polu: 100% po ${fmt(full)} s, zapis (${sv.state.save.x}, ${sv.state.save.z}), kolejne zapisy przy dalszym staniu: ${ev.filter((e) => e === 'saved').length - 1}`);
  assert.ok(passing < 12 && beside < 12);
  assert.ok(full !== null && full < 4);
  assert.equal(sv.state.level, 100);
  assert.deepEqual(sv.state.save, { x: 40, z: 32.5, heading: 180, level: 100 });
  assert.equal(ev.filter((e) => e === 'saved').length, 1);
  // A later death restarts at the shop with a full battery
  sv.state.level = 0.01;
  let back = null;
  for (let t = 0; t < 10 && !back; t += DT) if (sv.update(DT, { ...cruise, x: 0, z: 0 }).includes('respawn')) back = { ...sv.state.save, level: sv.state.level };
  assert.deepEqual(back, { x: 40, z: 32.5, heading: 180, level: 100 });
});
