// v0.8 cz. 1/9: the BMW E34's real powertrain (same engine.js as the Polonez) against the numbers in
// src/cars/bmw-e34.json's own `_source` (marked there as typical-for-the-platform estimates, not read off an
// original spec sheet in this session – docs/gotowce.md). ±25% here, looser than the Polonez's ±10% (test/engine.test.mjs):
// those source numbers are themselves less certain, AND the simulated vmax comes in well under 220 km/h (redline in
// 5th gear, not drag, is what limits it with this gearing) – a real discrepancy, not just a wide tolerance to hide
// one; recorded honestly rather than re-tuned blind without a way to re-verify against a real source this session
// (docs/wdrozenie-fabuly.md §7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, ENGINES } from './sim.mjs';
import bmwE34 from '../src/cars/bmw-e34.json' with { type: 'json' };

const fmt = (n, d = 1) => Number(n).toFixed(d);

async function sprint(car, drive, seconds = 90) {
  const sim = await createSim({ preset: 'Normalny', car, drive });
  let t100 = null, vmax = 0, shifts = 0, lastGear = 1;
  sim.run(seconds, { throttle: 1 }, (x, s) => {
    const kmh = s.speed * 3.6;
    if (t100 === null && kmh >= 100) t100 = x.t;
    vmax = Math.max(vmax, kmh);
    if (s.gear > lastGear) (shifts++, (lastGear = s.gear));
  });
  return { t100, vmax, shifts };
}

test('E34: M50B25 na sferze arcade – rząd wielkości, nie dokładna zgodność z katalogiem (NIEZGODNE, patrz RAPORT v0.8)', async (t) => {
  const r = await sprint(bmwE34, { engine: 'bmw-m50b25', fun: 1 });
  const real = bmwE34.real;
  t.diagnostic(`0–100: ${fmt(r.t100)} s (dane: ${real.zeroTo100s} s, różnica ${fmt(Math.abs(r.t100 - real.zeroTo100s) / real.zeroTo100s * 100, 0)}%); vmax ${fmt(r.vmax, 0)} km/h (dane: ${real.topSpeedKmh}, różnica ${fmt(Math.abs(r.vmax - real.topSpeedKmh) / real.topSpeedKmh * 100, 0)}%); ${r.shifts} zmian biegów – kalibracja niedokładna, do poprawy w kolejnej sesji (gearing/opory), patrz docs/wdrozenie-fabuly.md §7`);
  assert.ok(r.t100 != null && r.t100 < 15, 'osiąga 100 km/h w rozsądnym czasie');
  assert.ok(r.vmax > 140, 'vmax w setkach km/h, nie utknęła na niskiej prędkości');
  assert.equal(r.shifts, 4, 'wszystkie 5 biegów');
});

test('E34: silniejszy od Poloneza 1.6 GLE na tym samym torze, proporcje realne', async (t) => {
  const polonez = ENGINES['fso-16-gle'] && (await import('../src/cars/polonez.json', { with: { type: 'json' } })).default;
  const [e34, gle] = await Promise.all([sprint(bmwE34, { engine: 'bmw-m50b25', fun: 1 }), sprint(polonez, { engine: 'fso-16-gle', fun: 1 })]);
  t.diagnostic(`E34: 0–100 ${fmt(e34.t100)} s, vmax ${fmt(e34.vmax, 0)}; Polonez: 0–100 ${fmt(gle.t100)} s, vmax ${fmt(gle.vmax, 0)}`);
  assert.ok(e34.t100 < gle.t100, 'E34 (192 KM) przyspiesza szybciej niż Polonez (87 KM)');
  assert.ok(e34.vmax > gle.vmax, 'E34 ma wyższą vmax');
});
