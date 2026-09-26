// v0.3a: counter-steer. Łatwy: the front wheels show it on their own. Pro: real counter-steer regulates the angle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from './sim.mjs';

const kmh = (s) => s.speed * 3.6;
const fmt = (n, d = 1) => Number(n).toFixed(d);
const DEG = 180 / Math.PI;

async function simAt(target, opts) {
  const sim = await createSim(opts);
  sim.run(0.5, {});
  sim.run(12, (s) => ({ throttle: kmh(s) < target ? 1 : 0.4 }));
  return sim;
}
// Left drift from ~60 km/h: handbrake + full left for 0.4 s
function enterLeft(sim) {
  sim.run(0.4, { steer: 1, handbrake: 1, throttle: 1 });
  assert.ok(sim.car.state.drifting, 'w drifcie po wejściu');
}

test('Łatwy: w drifcie przednie koła same pokazują kontrę, proporcjonalnie do kąta', async (t) => {
  const sim = await simAt(60);
  // Grip: wheels follow the input
  sim.run(0.5, { steer: 0.5, throttle: 0.6 });
  const grip = sim.car.state.steerAngle;
  sim.run(1, { throttle: 0.6 });
  enterLeft(sim);
  const rows = [];
  // Player keeps steering INTO the turn (left), and later lets go: the wheels still point against the turn
  for (const [dur, steer] of [[1.2, 1], [0.8, 0.3], [0.8, 0]]) {
    sim.run(dur, { steer, throttle: 1 }, (x, s) => s.drifting && rows.push([s.driftAngle, s.steerAngle * DEG, steer]));
  }
  const inDrift = rows.slice(20);
  const opposite = inDrift.filter(([a, w]) => Math.sign(w) === -Math.sign(a)).length / inDrift.length;
  const ratio = inDrift.map(([a, w]) => Math.abs(w) / Math.max(1, Math.abs(a)));
  const mean = ratio.reduce((a, b) => a + b, 0) / ratio.length;
  const maxA = Math.max(...inDrift.map((r) => Math.abs(r[0])));
  const maxW = Math.max(...inDrift.map((r) => Math.abs(r[1])));
  t.diagnostic(`jazda: skręt 0,5 → koła ${fmt(grip * DEG)}° w lewo; drift: koła przeciwnie do zakrętu przez ${fmt(opposite * 100, 0)}% czasu, |koła|/|kąt| średnio ${fmt(mean, 2)}, max kąt ${fmt(maxA)}° → max kontra ${fmt(maxW)}°`);
  assert.ok(grip > 0.15, 'poza driftem koła skręcają w stronę wejścia');
  assert.ok(opposite > 0.95, 'w drifcie koła pokazują kontrę, choć gracz skręca w zakręt');
  assert.ok(mean > 0.7 && mean < 1.3, 'kontra ~ kąt driftu');
});

// Pad driver that holds `goal`° of drift with counter-steer only (P-controller on the angle)
function holdAngle(goal, gain = 0.03, bias = -0.45) {
  return (s) => {
    const side = Math.sign(s.driftAngle) || 1;
    const err = goal - Math.abs(s.driftAngle); // + = too shallow → less counter
    return { throttle: 1, steer: side * Math.max(-1, Math.min(1, bias + gain * err)) };
  };
}

test('Pro: kąt trzymany kontrą; puszczenie kontry go zwiększa, mocniejsza kontra zmniejsza', async (t) => {
  const sim = await simAt(60, { preset: 'Pro' });
  enterLeft(sim);
  // 3 s of holding ~30° with counter-steer
  const held = [];
  sim.run(3, holdAngle(30), (x, s) => held.push(s.driftAngle));
  const h = held.slice(60);
  const lo = Math.min(...h), hi = Math.max(...h);
  const steerHold = holdAngle(30)(sim.car.state).steer;
  // Let go of the counter-steer (neutral wheel, gas on): the angle grows
  const a0 = sim.car.state.driftAngle;
  sim.run(0.5, { throttle: 1, steer: 0 });
  const a1 = sim.car.state.driftAngle;
  // More counter-steer than needed: the angle drops
  sim.run(0.5, { throttle: 1, steer: -0.9 });
  const a2 = sim.car.state.driftAngle;
  t.diagnostic(`trzymanie 30° kontrą (skręt ${fmt(steerHold, 2)}): kąt ${fmt(lo)}–${fmt(hi)}° przez 2 s, drift ${sim.car.state.drifting || a2 < 5 ? 'utrzymany' : '?'}; puszczenie kontry 0,5 s: ${fmt(a0)}° → ${fmt(a1)}°; mocna kontra 0,5 s: → ${fmt(a2)}°; obroty ${sim.car.state.spins}`);
  assert.ok(lo > 22 && hi < 38, 'kontra utrzymuje kąt przez kilka sekund');
  assert.ok(steerHold < -0.1, 'do trzymania kąta potrzebna jest kontra (skręt przeciwny do zakrętu)');
  assert.ok(a1 > a0 + 8, 'puszczenie kontry zwiększa kąt');
  assert.ok(a2 < a1 - 15, 'kontra zmniejsza kąt');
  assert.equal(sim.car.state.spins, 0);
});

test('Pro: skręt w zakręt pogłębia drift aż do obrotu; w Łatwym obrotu nie ma', async (t) => {
  const run = async (preset) => {
    const sim = await simAt(60, { preset });
    enterLeft(sim);
    let maxA = 0, spunAt = null, minSpeed = Infinity;
    const t0 = sim.time;
    sim.run(3, { steer: 1, throttle: 1 }, (x, s) => {
      if (!s.spinning) maxA = Math.max(maxA, Math.abs(s.driftAngle));
      if (spunAt === null && s.spinning) spunAt = x.t - t0;
      if (s.spinning) minSpeed = Math.min(minSpeed, x.speed);
    });
    sim.run(2, {});
    const after = sim.car.state;
    // After the spin you can drive off again
    sim.run(3, { throttle: 1 });
    return { maxA, spunAt, spins: sim.car.state.spins, minSpeed, driveOff: kmh(sim.car.state), upY: Math.min(...sim.log.map((l) => l.upY)), stillSpinning: after.spinning };
  };
  const easy = await run('Łatwy');
  const pro = await run('Pro');
  t.diagnostic(`pełny skręt w zakręt + gaz: Łatwy max kąt ${fmt(easy.maxA)}°, obrotów ${easy.spins}; Pro max kąt ${fmt(pro.maxA)}°, obrót po ${fmt(pro.spunAt, 2)} s, prędkość w obrocie spada do ${fmt(pro.minSpeed, 0)} km/h, po 3 s gazu ${fmt(pro.driveOff, 0)} km/h, min up.y ${fmt(pro.upY, 3)}`);
  assert.equal(easy.spins, 0);
  assert.ok(easy.maxA <= 42.5);
  assert.ok(pro.spins >= 1 && pro.spunAt < 2, 'przesadzony skręt w zakręt kończy się obrotem');
  assert.ok(!pro.stillSpinning && pro.driveOff > 30, 'po obrocie da się odjechać');
  assert.ok(pro.upY > 0.95, 'bez dachowania');
});

test('Pro na klawiaturze: drift da się trzymać stukaniem kontry przez 4 s', async (t) => {
  const { rampValue, KEY_RAMP } = await import('../src/input.js');
  const sim = await simAt(60, { preset: 'Pro' });
  enterLeft(sim);
  const v = { steer: 1 };
  const angles = [];
  // Player: counter-steer key (right) while the angle is above ~30°, release below
  sim.run(4, (s) => {
    const want = Math.abs(s.driftAngle) > 30 ? -1 : 0;
    v.steer = rampValue(v.steer, want * Math.sign(s.driftAngle || 1), 1 / 60, KEY_RAMP.steerUp, KEY_RAMP.steerDown);
    return { throttle: 1, steer: v.steer };
  }, (x, s) => angles.push(s.drifting ? Math.abs(s.driftAngle) : 0));
  const h = angles.slice(60);
  t.diagnostic(`kąt ${fmt(Math.min(...h))}–${fmt(Math.max(...h))}°, średnio ${fmt(h.reduce((a, b) => a + b, 0) / h.length)}°, obroty ${sim.car.state.spins}, prędkość ${fmt(kmh(sim.car.state), 0)} km/h`);
  assert.equal(sim.car.state.spins, 0);
  assert.ok(Math.min(...h) > 12 && Math.max(...h) < 60);
});
