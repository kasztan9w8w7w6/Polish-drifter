import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from './sim.mjs';
import { presets } from '../src/tuning.ts';

const kmh = (s) => s.speed * 3.6;
const fmt = (n, d = 1) => Number(n).toFixed(d);

// Hold ~target km/h going straight
async function simAt(target, opts) {
  const sim = await createSim(opts);
  sim.run(0.5, {});
  sim.run(12, (s) => ({ throttle: kmh(s) < target ? 1 : 0.4 }));
  return sim;
}

// Accumulated yaw in degrees (handles the ±180° wrap)
function yawMeter(sim) {
  let prev = sim.log.at(-1).yaw, total = 0;
  return {
    step(x) {
      let d = x.yaw - prev;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      total += d;
      prev = x.yaw;
    },
    get total() { return total; },
  };
}

test('gaz = jazda prosto, bez znoszenia w bok', async (t) => {
  const sim = await createSim();
  sim.run(0.5, {});
  let maxSlip = 0;
  sim.run(6, { throttle: 1 }, (x) => (maxSlip = Math.max(maxSlip, Math.abs(x.slip))));
  const e = sim.log.at(-1);
  t.diagnostic(`po 6 s: ${fmt(e.speed, 0)} km/h, przejechane ${fmt(e.x)} m, zniesienie w bok ${fmt(e.z, 3)} m, obrót ${fmt(e.yaw, 2)}°, max poślizg ${fmt(maxSlip, 2)}°`);
  assert.ok(e.speed > 70, 'auto przyspiesza');
  assert.ok(Math.abs(e.z) < 0.3, 'nie znosi w bok');
  assert.ok(Math.abs(e.yaw) < 1, 'nie obraca się');
  assert.ok(maxSlip < 2);
});

test('zakręt z ręcznym przy ~60 km/h: kąt 20–45°, bez pełnego obrotu w 3 s', async (t) => {
  const sim = await simAt(60);
  const v0 = kmh(sim.car.state);
  const yaw = yawMeter(sim);
  let maxSlip = 0;
  const t0 = sim.time;
  // Naive player: full left + handbrake for 0.7 s, then keeps holding left with some throttle
  sim.run(3, (s, time) => (time - t0 < 0.7 ? { steer: 1, handbrake: 1 } : { steer: 1, throttle: 0.6 }), (x) => {
    yaw.step(x);
    maxSlip = Math.max(maxSlip, Math.abs(x.slip));
  });
  t.diagnostic(`start ${fmt(v0, 0)} km/h → max kąt ${fmt(maxSlip)}°, łączny obrót w 3 s ${fmt(Math.abs(yaw.total), 0)}°, prędkość po 3 s ${fmt(sim.log.at(-1).speed, 0)} km/h`);
  assert.ok(maxSlip >= 20 && maxSlip <= 45, `kąt ${fmt(maxSlip)}° poza 20–45°`);
  assert.ok(Math.abs(yaw.total) < 360, 'mniej niż pełny obrót');
});

test('drift da się utrzymać gazem i lekką kontrą przez min. 3 s', async (t) => {
  const sim = await simAt(60);
  const t0 = sim.time;
  let driftTime = 0, best = 0, minSpeed = Infinity;
  const slips = [];
  sim.run(6, (s, time) => (time - t0 < 0.6 ? { steer: 1, handbrake: 1, throttle: 0.5 } : { throttle: 1, steer: -0.2 }), (x) => {
    if (x.t - t0 < 0.6) return;
    if (Math.abs(x.slip) > 15) {
      driftTime += 1 / 60;
      best = Math.max(best, driftTime);
      minSpeed = Math.min(minSpeed, x.speed);
      slips.push(Math.abs(x.slip));
    } else driftTime = 0;
  });
  const avg = slips.reduce((a, b) => a + b, 0) / (slips.length || 1);
  t.diagnostic(`najdłuższy ciągły drift (>15°): ${fmt(best, 2)} s, średni kąt ${fmt(avg)}°, min prędkość w drifcie ${fmt(minSpeed, 0)} km/h`);
  assert.ok(best >= 3, `drift trwał tylko ${fmt(best, 2)} s`);
  assert.ok(minSpeed > 40, 'mała utrata prędkości');
});

test('kontra zmniejsza kąt, skręt w zakręt i gaz go zwiększają', async (t) => {
  const angleWith = async (inp) => {
    const sim = await simAt(60);
    const t0 = sim.time;
    sim.run(3, (s, time) => (time - t0 < 0.6 ? { steer: 1, handbrake: 1, throttle: 0.5 } : inp));
    return Math.abs(sim.car.state.slipAngle);
  };
  const counter = await angleWith({ throttle: 0.6, steer: -0.6 });
  const neutral = await angleWith({ throttle: 0.6, steer: 0 });
  const into = await angleWith({ throttle: 0.6, steer: 1 });
  const lessGas = await angleWith({ throttle: 0.3, steer: 0 });
  t.diagnostic(`kąt po 3 s: kontra ${fmt(counter)}°, kierownica prosto ${fmt(neutral)}°, w zakręt ${fmt(into)}°; mniej gazu ${fmt(lessGas)}°`);
  assert.ok(counter < neutral && neutral < into, 'kierownica reguluje kąt');
  assert.ok(lessGas < neutral, 'gaz reguluje kąt');
  assert.ok(into <= 46, 'nie przekracza limitu');
});

test('po puszczeniu gazu auto płynnie wraca do jazdy prosto', async (t) => {
  const sim = await simAt(60);
  const t0 = sim.time;
  sim.run(1.5, (s, time) => (time - t0 < 0.6 ? { steer: 1, handbrake: 1, throttle: 0.5 } : { throttle: 1, steer: 0.5 }));
  const slipAtRelease = Math.abs(sim.car.state.slipAngle);
  const t1 = sim.time;
  let settled = null, maxRate = 0, prev = slipAtRelease;
  sim.run(3, {}, (x) => {
    maxRate = Math.max(maxRate, Math.abs(Math.abs(x.slip) - prev) * 60);
    prev = Math.abs(x.slip);
    if (settled === null && Math.abs(x.slip) < 3) settled = x.t - t1;
  });
  t.diagnostic(`kąt przy puszczeniu: ${fmt(slipAtRelease)}°, prosto (<3°) po ${settled === null ? '—' : fmt(settled, 2) + ' s'}, najszybsza zmiana kąta ${fmt(maxRate, 0)}°/s, prędkość ${fmt(sim.log.at(-1).speed, 0)} km/h`);
  assert.ok(slipAtRelease > 20, 'był drift');
  assert.ok(settled !== null && settled < 2, 'auto się prostuje');
  assert.ok(settled > 0.3, 'płynnie, nie skokowo');
});

test('ostry skręt przy prędkości (bez ręcznego) wprowadza w drift', async (t) => {
  const sim = await simAt(75);
  let maxSlip = 0;
  sim.run(2, { throttle: 1, steer: 1 }, (x) => (maxSlip = Math.max(maxSlip, Math.abs(x.slip))));
  t.diagnostic(`max kąt w 2 s: ${fmt(maxSlip)}°`);
  assert.ok(maxSlip > 20 && maxSlip <= 46, `kąt ${fmt(maxSlip)}°`);
});

test('przekładka: drift w lewo → mocna kontra = drift w prawo', async (t) => {
  const sim = await simAt(60);
  const t0 = sim.time;
  sim.run(1.5, (s, time) => (time - t0 < 0.6 ? { steer: 1, handbrake: 1, throttle: 0.5 } : { throttle: 0.9, steer: 0 }));
  const before = sim.car.state.slipAngle;
  const t1 = sim.time;
  let otherSide = null;
  sim.run(2, { throttle: 0.9, steer: -1 }, (x) => {
    if (otherSide === null && Math.sign(x.slip) === -Math.sign(before) && Math.abs(x.slip) > 15) otherSide = x.t - t1;
  });
  const after = sim.car.state.slipAngle;
  t.diagnostic(`kąt przed: ${fmt(before)}°, po drugiej stronie (>15°) po ${otherSide === null ? '—' : fmt(otherSide, 2) + ' s'}, na końcu ${fmt(after)}°`);
  assert.ok(otherSide !== null && otherSide < 1.2);
  assert.ok(Math.abs(after) <= 46);
});

for (const preset of Object.keys(presets)) {
  test(`nie dachuje: bariery, krawężnik i skocznia (${preset})`, async (t) => {
    const sim = await createSim({ preset, walls: true });
    sim.run(0.5, {});
    let minUp = 1, maxImpact = 0;
    const track = (x) => { minUp = Math.min(minUp, x.upY); maxImpact = Math.max(maxImpact, x.impact); };
    sim.run(2.5, { throttle: 1 }, track);
    sim.run(6, (s, time) => ({ throttle: 1, steer: Math.sin(time * 5) > 0 ? 1 : -1, handbrake: Math.sin(time * 2.5) > 0.7 ? 1 : 0 }), track);
    sim.car.reset({ x: 0, y: 1, z: 0 }, 0);
    sim.run(4, { throttle: 1 }, track); // head-on into the +X wall
    sim.car.reset({ x: -10, y: 1, z: -10 }, Math.PI / 4);
    sim.run(4, { throttle: 1, steer: -0.3 }, track);
    // kerb + side ramp
    const r = await createSim({ preset, ramps: true });
    let maxY = 0;
    r.run(0.5, {});
    r.run(8, { throttle: 1 }, (x) => { track(x); maxY = Math.max(maxY, x.y); });
    r.car.reset({ x: 0, y: 1, z: 3 }, 0);
    r.run(8, { throttle: 1, steer: 0.1 }, (x) => { track(x); maxY = Math.max(maxY, x.y); });
    t.diagnostic(`min „up.y” = ${fmt(minUp, 3)} (1 = poziomo, 0 = na boku), max wysokość na rampach ${fmt(maxY, 2)} m, max siła uderzenia ${fmt(maxImpact / 1000, 0)} kN`);
    assert.ok(minUp > 0.5, 'auto nie przewraca się');
    assert.ok(maxY > 1.2, 'model wjechał na rampę');
  });
}
