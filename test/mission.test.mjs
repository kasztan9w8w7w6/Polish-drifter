// v0.3c: narrator and mission 1 "Paczka", step by step (logic only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMission, formatTime } from '../src/mission.js';
import { createNarrator } from '../src/narrator.js';
import { createEconomy } from '../src/economy.js';
import gle from '../src/engines/fso-16-gle.json' with { type: 'json' };
import paczka from '../src/missions/paczka.json' with { type: 'json' };
import map from '../src/maps/osiedle.json' with { type: 'json' };

const fmt = (n, d = 1) => Number(n).toFixed(d);
const DT = 1 / 60;
const P = map.points;

test('narrator: pisze litera po literze, znika po kilku sekundach, kolejka linii', (t) => {
  const n = createNarrator();
  const line = 'Osiedle Kosmonautów. Trzecia w nocy.';
  n.say([line, 'Druga linia.']);
  const seen = [];
  let full = null, gone = null, second = null, keys = 0;
  for (let time = 0; time < 30; time += DT) {
    const s = n.update(DT);
    if (full === null) keys += s.keys;
    seen.push(s.text.length);
    if (full === null && s.text === line) full = time;
    if (gone === null && full !== null && s.text === 'D') gone = time;
    if (second === null && s.text === 'Druga linia.') second = time;
  }
  const lengths = new Set(seen.filter((l) => l > 0 && l < line.length));
  t.diagnostic(`${line.length} znaków napisane w ${fmt(full, 2)} s (${lengths.size} pośrednich długości, ${keys} kliknięć), następna linia po ${fmt(gone, 1)} s, cała kolejka pusta: ${n.idle}`);
  assert.ok(full > 1.8 && full < 4 && lengths.size > 20, 'litera po literze, wolno (maszyna do pisania)');
  assert.equal(keys, line.replace(/\s/g, '').length, 'kliknięcie na każdą literę, nie na spacje');
  assert.ok(gone > 7 && gone < 14, 'linia zostaje dłużej, potem znika');
  assert.ok(second !== null && n.idle);
});

// Drives the mission with a scripted "player": teleports between points, stops, drifts to charge
test('misja 1 „Paczka”: przejście krok po kroku, z podsumowaniem', (t) => {
  const m = createMission(paczka, P);
  const said = [];
  const log = (ev) => ev.forEach((e) => (e.type === 'say' ? said.push(...e.lines) : e.type === 'step' ? said.push(`[${e.step.id}]`) : null));
  log(m.start(1000));
  const car = { x: P.spawn.x, z: P.spawn.z, speed: 0, money: 0, fuelPct: 25, score: 1000 };
  const tick = (s = 1) => { for (let i = 0; i < s * 60; i++) log(m.update(DT, car)); };
  const steps = [];
  const at = () => { steps.push(`${m.state.step?.id ?? 'koniec'}`); return m.state.step?.id; };

  assert.equal(at(), 'odbior');
  assert.equal(m.target().id, 'locker');
  // Driving past the locker is not enough, stopping next to it is
  Object.assign(car, { x: P.locker.x, z: P.locker.z, speed: 10 });
  tick(0.5);
  assert.equal(at(), 'odbior', 'przejazd obok nie odbiera paczki');
  car.speed = 0.5;
  tick(0.1);
  assert.equal(at(), 'zarobek');
  // Cash step: counts what is earned from its start (drifting on the lot during the mission)
  car.money = 5;
  tick(0.5);
  assert.equal(at(), 'zarobek', '5 zł to za mało');
  car.money = 31;
  car.score = 5400;
  tick(0.1);
  assert.equal(at(), 'tankowanie');
  // Fuel step: 25 % in the tank is not enough, fill up to 40 %
  tick(0.5);
  assert.equal(at(), 'tankowanie');
  car.fuelPct = 64;
  tick(0.1);
  assert.equal(at(), 'dostawa');
  assert.equal(m.target().id, 'delivery');
  Object.assign(car, { x: P.delivery.x + 1, z: P.delivery.z - 1, speed: 0 });
  tick(0.1);
  assert.equal(at(), 'sklep');
  Object.assign(car, { x: P.shop.x, z: P.shop.z, speed: 0 });
  let summary = null;
  for (let i = 0; i < 10 && !summary; i++) m.update(DT, car).forEach((e) => e.type === 'complete' && (summary = e.summary));
  at();
  t.diagnostic(`kroki: ${steps.join(' → ')}; podsumowanie: czas ${formatTime(summary.time)}, punkty za drift ${summary.driftPoints}; narrator: ${said.filter((s) => !s.startsWith('[')).length} linii`);
  assert.ok(m.state.complete && summary.driftPoints === 4400);
  assert.deepEqual(summary.reward, paczka.reward, 'nagroda: kasa i szacun');
  assert.ok(said.some((s) => /5G/.test(s)) && said.some((s) => /mgła/i.test(s)), 'klimat: mgła i 5G');
});

test('misja + paliwo: rezerwa i pusty bak dają podpowiedzi narratora, misja się nie cofa', (t) => {
  const m = createMission(paczka, P);
  m.start();
  const eco = createEconomy({ engine: gle, tankL: 45, fuel: 7.2 });
  const hints = [];
  for (let time = 0; time < 600 && !eco.state.empty; time += DT) {
    for (const e of eco.update(DT, { rpm: 4000, load: 0.8, drifting: false, running: true })) for (const ev of m.notify(e)) hints.push(`${e}: ${ev.lines[0].slice(0, 30)}…`);
    m.update(DT, { x: 0, z: 0, speed: 10, money: 0, fuelPct: (100 * eco.state.fuel) / 45, score: 0 });
  }
  t.diagnostic(`${hints.join(' | ')}; krok: ${m.state.step.id}`);
  assert.deepEqual(hints.map((h) => h.split(':')[0]), ['rezerwa', 'pusty']);
  assert.equal(m.state.step.id, 'odbior');
  // once-only hints stay once
  assert.deepEqual(m.notify('rezerwa'), []);
});
