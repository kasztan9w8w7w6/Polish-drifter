// v0.6c: the real powertrain (engine.js) on the arcade sphere. Calibration: with fun = 1 the simulated Polonez Caro 1.6 GLE
// gets the catalogue 0–100 km/h and top speed (±10 %), the other engines keep their proportions, the gearbox shifts at
// sensible rpm, and the fun factor only makes it quicker (same top speed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, ENGINES } from './sim.mjs';
import { torqueCurve, torqueAt, tyreRadius } from '../src/engine.js';
import polonez from '../src/cars/polonez.json' with { type: 'json' };

const fmt = (n, d = 1) => Number(n).toFixed(d);

async function sprint(drive, seconds = 90) {
  const sim = await createSim({ preset: 'Normalny', drive });
  let t100 = null, vmax = 0, shifts = [], lastGear = 1, maxRpm = 0;
  sim.run(seconds, { throttle: 1 }, (x, s) => {
    const kmh = s.speed * 3.6;
    if (t100 === null && kmh >= 100) t100 = x.t;
    vmax = Math.max(vmax, kmh);
    maxRpm = Math.max(maxRpm, s.rpm);
    if (s.gear > lastGear) shifts.push(`${lastGear}→${s.gear} przy ${fmt(kmh, 0)} km/h`), (lastGear = s.gear);
  });
  return { t100, vmax, shifts, maxRpm, gear: sim.car.state.gear, rpm: sim.car.state.rpm };
}

test('silnik: krzywa momentu z danych, promień koła z rozmiaru opony', (t) => {
  const gle = ENGINES['fso-16-gle'];
  const c = torqueCurve(gle);
  const kw = (rpm) => (torqueAt(c, rpm) * rpm * 2 * Math.PI) / 60 / 1000;
  t.diagnostic(`krzywa GLE: ${c.map(([r, nm]) => `${r}:${fmt(nm, 0)} Nm`).join(', ')}; moc przy 5200: ${fmt(kw(5200))} kW (dane: ${gle.powerKw}); opona ${polonez.real.tyres} → r = ${fmt(tyreRadius(polonez.real.tyres), 3)} m`);
  assert.equal(torqueAt(c, gle.torqueRpm), gle.torqueNm);
  assert.ok(Math.abs(kw(gle.powerRpm) - gle.powerKw) < 1);
  assert.ok(Math.abs(tyreRadius('185/70 R13') - 0.286) < 0.01);
});

test('kalibracja (czynnik zabawy 1): Caro 1.6 GLE ma katalogowe 0–100 i vmax (±10 %)', async (t) => {
  const r = await sprint({ fun: 1 });
  const real = polonez.real;
  t.diagnostic(`0–100 km/h: ${fmt(r.t100)} s (katalog ${real.zeroTo100s} s); vmax ${fmt(r.vmax, 0)} km/h (katalog ${real.topSpeedKmh}); zmiany biegów: ${r.shifts.join(', ')}; na końcu bieg ${r.gear}, ${fmt(r.rpm, 0)} obr/min`);
  assert.ok(Math.abs(r.t100 - real.zeroTo100s) / real.zeroTo100s <= 0.1, '0–100 ±10 %');
  assert.ok(Math.abs(r.vmax - real.topSpeedKmh) / real.topSpeedKmh <= 0.1, 'vmax ±10 %');
  assert.equal(r.shifts.length, 4, 'wszystkie 5 biegów');
  assert.ok(r.maxRpm <= ENGINES['fso-16-gle'].redlineRpm + 200, 'obroty do czerwonego pola');
});

test('silniki do swapów: proporcje realne; czynnik zabawy przyspiesza, vmax bez zmian', async (t) => {
  const rows = [];
  for (const id of polonez.real.engines) {
    const r = await sprint({ engine: id, fun: 1 }, 70);
    rows.push([id, r]);
  }
  const fun = await sprint({ fun: 1.7 }, 60);
  const gle = rows.find(([id]) => id === 'fso-16-gle')[1];
  t.diagnostic(`${rows.map(([id, r]) => `${ENGINES[id].name}: 0–100 ${fmt(r.t100)} s, vmax ${fmt(r.vmax, 0)} km/h`).join('; ')}; GLE z czynnikiem zabawy 1,7: 0–100 ${fmt(fun.t100)} s, vmax ${fmt(fun.vmax, 0)} km/h`);
  const by = Object.fromEntries(rows);
  assert.ok(by['rover-14-16v'].t100 < gle.t100 && by['rover-14-16v'].vmax > gle.vmax, 'Rover 16V szybszy');
  assert.ok(by['fso-16-76'].t100 > gle.t100 && by['fso-16-76'].vmax < gle.vmax, '76 KM wolniejszy');
  assert.ok(by['xud9-19d'].t100 > by['fso-16-76'].t100, 'diesel najwolniej przyspiesza');
  assert.ok(Math.abs(by['fso-16-76'].t100 - 18.1) / 18.1 <= 0.1 && Math.abs(by['fso-16-76'].vmax - 154) / 154 <= 0.1, '1.6 76 KM zgodny z katalogiem (18,1 s, 154 km/h)');
  assert.ok(fun.t100 < gle.t100 * 0.7, 'czynnik zabawy: żwawiej');
  assert.ok(Math.abs(fun.vmax - gle.vmax) < 6, 'czynnik zabawy nie zmienia vmax');
});
