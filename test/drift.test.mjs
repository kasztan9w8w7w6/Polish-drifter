import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from './sim.mjs';

const kmh = (s) => s.speed * 3.6;
const fmt = (n, d = 1) => Number(n).toFixed(d);

// Hold ~target km/h going straight
async function simAt(target, opts) {
  const sim = await createSim(opts);
  sim.run(0.5, {});
  sim.run(15, (s) => ({ throttle: kmh(s) < target ? 1 : 0 }));
  return sim;
}

test('gaz = jazda prosto, bez znoszenia w bok', async (t) => {
  const sim = await createSim();
  sim.run(0.5, {});
  let maxSlip = 0;
  sim.run(6, { throttle: 1 }, (x) => (maxSlip = Math.max(maxSlip, Math.abs(x.slip))));
  const e = sim.log.at(-1);
  t.diagnostic(`po 6 s: ${fmt(e.speed, 0)} km/h, przejechane ${fmt(e.x)} m, zniesienie w bok ${fmt(e.z, 3)} m, obrót ${fmt(e.yaw, 2)}°, max poślizg ${fmt(maxSlip, 2)}°`);
  assert.ok(e.speed > 60, 'auto przyspiesza');
  assert.ok(Math.abs(e.z) < 0.3, 'nie znosi w bok');
  assert.ok(Math.abs(e.yaw) < 1, 'nie obraca się');
  assert.ok(maxSlip < 2);
});

test('zakręt z ręcznym przy ~60 km/h: poślizg 20–45°, bez obrotu o 360° w 3 s', async (t) => {
  const sim2 = await simAt(60);
  const v0 = kmh(sim2.car.state);
  let maxSlip = 0, maxSlipAll = 0, yawTravel = 0, prevYaw = sim2.log.at(-1).yaw;
  const t0 = sim2.time;
  // Naive player: full left + handbrake for 0.7 s, then keeps holding left with some throttle
  sim2.run(3, (s, time) => (time - t0 < 0.7 ? { steer: 1, handbrake: 1 } : { steer: 1, throttle: 0.6 }), (x) => {
    let d = x.yaw - prevYaw;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    yawTravel += d;
    prevYaw = x.yaw;
    if (x.t - t0 < 1.5) maxSlip = Math.max(maxSlip, Math.abs(x.slip));
    maxSlipAll = Math.max(maxSlipAll, Math.abs(x.slip));
  });
  t.diagnostic(`start ${fmt(v0, 0)} km/h → max poślizg w 1,5 s: ${fmt(maxSlip)}°, max w 3 s: ${fmt(maxSlipAll)}°, łączny obrót ${fmt(Math.abs(yawTravel), 0)}°, prędkość po 3 s ${fmt(sim2.log.at(-1).speed, 0)} km/h`);
  assert.ok(maxSlip >= 20 && maxSlip <= 45, `poślizg ${fmt(maxSlip)}° poza 20–45°`);
  assert.ok(maxSlipAll < 90, 'bez bączka (poślizg < 90°)');
  assert.ok(Math.abs(yawTravel) < 360, 'mniej niż pełny obrót');
});

test('drift da się utrzymać gazem i kontrą przez min. 3 s', async (t) => {
  const sim = await simAt(60);
  const t0 = sim.time;
  let driftTime = 0, best = 0, minSpeed = Infinity, slips = [];
  sim.run(6, (s, time) => {
    if (time - t0 < 0.6) return { steer: 1, handbrake: 1, throttle: 0.5 };
    // player: throttle + proportional counter-steer (steer towards the slide)
    return { throttle: 0.85, steer: Math.max(-1, Math.min(1, s.slipAngle / 35)) };
  }, (x) => {
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
  assert.ok(minSpeed > 25, 'drift nie zabija prędkości');
});

test('po puszczeniu ręcznego auto wraca do jazdy prosto', async (t) => {
  const sim = await simAt(60);
  const t0 = sim.time;
  sim.run(0.7, { steer: 1, handbrake: 1 });
  const slipAtRelease = Math.abs(sim.car.state.slipAngle);
  let settled = null;
  sim.run(3, { throttle: 0.3 }, (x) => {
    if (settled === null && Math.abs(x.slip) < 5 && Math.abs(sim.car.state.yawRate) < 0.15) settled = x.t - t0 - 0.7;
  });
  const e = sim.log.at(-1);
  t.diagnostic(`poślizg przy puszczeniu: ${fmt(slipAtRelease)}°, stabilizacja (<5°) po ${settled === null ? '—' : fmt(settled, 2) + ' s'}, na końcu ${fmt(Math.abs(e.slip), 2)}° przy ${fmt(e.speed, 0)} km/h`);
  assert.ok(settled !== null && settled < 2.5, 'auto się prostuje');
});

for (const preset of ['Przyczepny', 'Drift łatwy', 'Drift pro']) {
  test(`nie dachuje: ostre manewry i uderzenia w bariery (${preset})`, async (t) => {
    const sim = await createSim({ preset, walls: true });
    sim.run(0.5, {});
    let minUp = 1, maxImpact = 0;
    const track = (x) => { minUp = Math.min(minUp, x.upY); maxImpact = Math.max(maxImpact, x.impact); };
    // 1) slalom with full lock flips + handbrake pulses
    sim.run(2.5, { throttle: 1 }, track);
    sim.run(6, (s, time) => ({ throttle: 1, steer: Math.sin(time * 5) > 0 ? 1 : -1, handbrake: Math.sin(time * 2.5) > 0.7 ? 1 : 0 }), track);
    // 2) head-on and angled wall hits
    sim.car.reset({ x: 0, y: 1, z: 0 }, 0);
    sim.run(4, { throttle: 1 }, track); // into the +X wall at 20 m
    sim.car.reset({ x: -10, y: 1, z: -10 }, Math.PI / 4);
    sim.run(4, { throttle: 1, steer: -0.3, handbrake: 0 }, track);
    sim.car.reset({ x: 0, y: 1, z: 0 }, -Math.PI / 2);
    sim.run(4, (s, time) => ({ throttle: 1, steer: 1, handbrake: 1 }), track);
    t.diagnostic(`min „up.y” = ${fmt(minUp, 3)} (1 = poziomo, 0 = na boku), max siła uderzenia ${fmt(maxImpact / 1000, 0)} kN`);
    assert.ok(minUp > 0.5, 'auto nie przewraca się');
  });
}
