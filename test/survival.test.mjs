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

test('bateria: bez driftu auto gaśnie po 60–90 s jazdy; długie światła szybciej; postój wolniej', (t) => {
  const flat = (car) => {
    const sv = createSurvival();
    let time = 0;
    while (sv.state.phase === 'drive' && time < 400) { sv.update(DT, car); time += DT; }
    return time;
  };
  const t40 = flat({ ...cruise, speed: 11 }), t54 = flat(cruise), t80 = flat({ ...cruise, speed: 22 }), t54h = flat({ ...cruise, highBeam: true }), idle = flat({ ...cruise, speed: 0 });
  t.diagnostic(`od 100% do zera: 40 km/h ${fmt(t40, 0)} s, 54 km/h ${fmt(t54, 0)} s, 80 km/h ${fmt(t80, 0)} s, 54 km/h na długich ${fmt(t54h, 0)} s, postój z pracującym silnikiem ${fmt(idle, 0)} s`);
  for (const x of [t40, t54, t80]) assert.ok(x >= 60 && x <= 95, `${x} s`);
  assert.ok(t54h < t54 && idle > t40);
});

test('bateria: ładuje tylko porządny drift (kąt i prędkość powyżej progów), tym szybciej, im dłużej czysty', (t) => {
  const gain = (angle, speed, seconds = 1) => {
    const sv = createSurvival({ level: 50 });
    run(sv, seconds, { ...cruise, angle, speed });
    return sv.state.level - 50;
  };
  const straight = gain(0, 15), shallow = gain(15, 15), slow = gain(35, 7), a25 = gain(25, 15), a40 = gain(40, 15), a40fast = gain(40, 22);
  // Rate over a 4 s clean drift: second by second
  const sv = createSurvival({ level: 20 });
  const perSecond = [];
  for (let i = 0; i < 4; i++) { const l0 = sv.state.level; run(sv, 1, { ...cruise, angle: 30 }); perSecond.push(sv.state.level - l0); }
  t.diagnostic(`1 s: prosto ${fmt(straight, 2)}%, 15° ${fmt(shallow, 2)}%, 35° przy 25 km/h ${fmt(slow, 2)}%, 25° 54 km/h +${fmt(a25, 2)}%, 40° 54 km/h +${fmt(a40, 2)}%, 40° 79 km/h +${fmt(a40fast, 2)}%; czysty drift 30°/54 km/h sekunda po sekundzie: ${perSecond.map((x) => `+${fmt(x, 1)}`).join(', ')}%`);
  assert.ok(straight < 0 && shallow < 0 && slow < 0, 'płytki albo wolny poślizg nie ładuje');
  assert.ok(a25 > 0 && a40 > a25 && a40fast > a40);
  assert.ok(perSecond[3] > perSecond[0] * 1.8, 'dłuższy czysty drift ładuje szybciej');
});

test('bateria: uderzenie przerywa ładowanie i zeruje serię', (t) => {
  const sv = createSurvival({ level: 40 });
  run(sv, 3, { ...cruise, angle: 30 });
  const before = sv.state.streak;
  const ev = sv.update(DT, { ...cruise, angle: 30, crash: 6 });
  const l0 = sv.state.level;
  run(sv, 1.5, { ...cruise, angle: 30 });
  const during = sv.state.level - l0;
  run(sv, 1, { ...cruise, angle: 30 });
  t.diagnostic(`seria przed uderzeniem ${fmt(before, 1)} s → ${ev.includes('hit') ? 'uderzenie' : '?'}; przez 1,5 s po uderzeniu ${fmt(during, 2)}% (bez ładowania), potem seria od nowa: ${fmt(sv.state.streak, 1)} s`);
  assert.ok(ev.includes('hit') && during < 0 && sv.state.streak < 1);
});

test('bateria: cel projektowy – 2–3 dobre drifty co ~30 s wystarczą, bez driftu nie', (t) => {
  // 30 s cycles at 54 km/h: n drifts of 3.5 s at 30° (the rest straight driving)
  const cycle = (n, cycles = 4) => {
    const sv = createSurvival({ level: 60 });
    for (let c = 0; c < cycles && sv.state.phase === 'drive'; c++) {
      for (let i = 0; i < n; i++) { run(sv, 3.5, { ...cruise, angle: 30 }); run(sv, 2, cruise); }
      run(sv, 30 - n * 5.5, cruise);
    }
    return sv.state.deaths ? 0 : sv.state.level;
  };
  const r = [0, 1, 2, 3].map((n) => cycle(n));
  t.diagnostic(`start 60%, 2 min jazdy 54 km/h: bez driftu ${fmt(r[0], 0)}%, 1 drift/30 s ${fmt(r[1], 0)}%, 2 drifty ${fmt(r[2], 0)}%, 3 drifty ${fmt(r[3], 0)}% (drift = 3,5 s pod kątem 30°)`);
  assert.equal(r[0], 0);
  assert.ok(r[1] < 20, 'jeden drift na 30 s to za mało');
  assert.ok(r[2] > 20 && r[3] > r[2], '2–3 drifty utrzymują baterię');
});

test('bateria z prawdziwej jazdy (Normalny): pilnowany drift ładuje, jazda prosto rozładowuje', async (t) => {
  const sim = await createSim({ preset: 'Normalny' });
  sim.run(0.5, {});
  sim.run(10, (s) => ({ throttle: Math.min(1, 0.55 + (60 - s.speed * 3.6) / 8) }));
  const sv = createSurvival({ level: 40 });
  const feed = (x, s) => sv.update(DT, { x: s.position.x, z: s.position.z, heading: 0, speed: s.speed, topSpeed: 30, angle: s.slipAngle, grounded: s.grounded, highBeam: false, crash: s.crash });
  sim.run(3, { throttle: 0.55 }, feed);
  const straight = sv.state.level - 40;
  const before = sv.state.level;
  sim.run(0.35, { steer: 1, handbrake: 1, throttle: 0.8 }, feed);
  sim.run(4, (s) => { const side = Math.sign(s.driftAngle) || 1, err = 30 - Math.abs(s.driftAngle); return { throttle: Math.max(0, Math.min(1, 0.6 + 0.04 * err)), steer: side * Math.max(-1, Math.min(1, -0.35 + 0.04 * err)) }; }, feed);
  const drift = sv.state.level - before;
  t.diagnostic(`3 s prosto ${fmt(straight, 2)}%, 4,4 s pilnowanego driftu +${fmt(drift, 1)}% (na końcu ${fmt(sv.state.level)}%)`);
  assert.ok(straight < -2);
  assert.ok(drift > 10, 'porządny drift wyraźnie ładuje');
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
  const ev = run(sv, 10, cruise);
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
