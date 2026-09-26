// v0.4a: the demanding default preset "Normalny" (and a harder "Pro"): ordinary steering keeps grip, a slide needs a real
// cause, and in the slide the player has to hold the angle with counter-steer and throttle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from './sim.mjs';
import { rampValue, KEY_RAMP } from '../src/input.js';

const kmh = (s) => s.speed * 3.6;
const fmt = (n, d = 1) => Number(n).toFixed(d);
const DT = 1 / 60;

async function simAt(target, preset = 'Normalny') {
  const sim = await createSim({ preset });
  sim.run(0.5, {});
  // (cruise control: the throttle that holds `target`, top speed 108 km/h)
  sim.run(14, (s) => ({ throttle: Math.max(0, Math.min(1, target / 108 + (target - kmh(s)) / 8)) }));
  return sim;
}
function watch(sim, seconds, input) {
  let drift = false, maxSlip = 0, spun = false, t0 = sim.time, firstDrift = null;
  sim.run(seconds, input, (x, s) => {
    if (s.drifting) { drift = true; if (firstDrift === null) firstDrift = x.t - t0; }
    if (s.spinning) spun = true;
    maxSlip = Math.max(maxSlip, Math.abs(s.slipAngle));
  });
  return { drift, maxSlip, spun, firstDrift, speed: kmh(sim.car.state) };
}
const enterLeft = (sim) => sim.run(0.35, { steer: 1, handbrake: 1, throttle: 0.8 });

test('Normalny: zwykły skręt (także pełny, z gazem) nie daje poślizgu', async (t) => {
  const rows = [];
  for (const [v, steer, throttle] of [[40, 1, 0.7], [60, 0.7, 0.7], [60, 1, 0.8], [80, 0.6, 0.6], [80, 1, 0.5]]) {
    const sim = await simAt(v);
    const r = watch(sim, 2.5, { steer, throttle });
    rows.push(`${v} km/h skręt ${steer} gaz ${throttle}: poślizg max ${fmt(r.maxSlip)}°${r.drift ? ' DRIFT' : ''}`);
    assert.equal(r.drift, false, `${v} km/h`);
    assert.ok(r.maxSlip < 12, `${v} km/h: kąt ${r.maxSlip}`);
  }
  // Keyboard: full lock on the gas at 60 km/h, the way a player takes a corner
  const sim = await simAt(60);
  let st = 0;
  const kb = watch(sim, 2.5, () => ({ throttle: 0.8, steer: (st = rampValue(st, 1, DT, KEY_RAMP.steerUp, KEY_RAMP.steerDown)) }));
  const easy = await simAt(60, 'Łatwy');
  st = 0;
  const e = watch(easy, 2.5, () => ({ throttle: 0.8, steer: (st = rampValue(st, 1, DT, KEY_RAMP.steerUp, KEY_RAMP.steerDown)) }));
  t.diagnostic(`${rows.join('; ')}; klawiatura 60 km/h pełny skręt: Normalny ${kb.drift ? 'DRIFT' : `bez driftu (${fmt(kb.maxSlip)}°)`}, Łatwy ${e.drift ? `drift po ${fmt(e.firstDrift, 2)} s` : 'bez driftu'}`);
  assert.equal(kb.drift, false);
});

test('Normalny: poślizg wywołuje ręczny, odpuszczenie gazu w szybkim zakręcie albo pełny gaz z mocnym skrętem', async (t) => {
  const hb30 = watch(await simAt(32), 0.6, { steer: 1, handbrake: 1, throttle: 0.5 });
  const hb60 = watch(await simAt(60), 0.6, { steer: 1, handbrake: 1, throttle: 0.5 });
  // Lift-off: full gas in a fast bend, then the throttle snapped shut
  const lift = async (v) => {
    const sim = await simAt(v);
    sim.run(0.3, { steer: 0.8, throttle: 1 });
    const at = kmh(sim.car.state);
    return { ...watch(sim, 0.8, { steer: 0.8, throttle: 0 }), at };
  };
  const lift45 = await lift(40), lift65 = await lift(62);
  const power = async (v) => watch(await simAt(v), 1.2, { steer: 1, throttle: 1 });
  const p55 = watch(await simAt(55), 0.6, { steer: 1, throttle: 1 }), p78 = await power(78);
  const s = (r) => (r.drift ? `drift po ${fmt(r.firstDrift, 2)} s` : 'brak');
  t.diagnostic(`ręczny 32 km/h ${s(hb30)}, 60 km/h ${s(hb60)}; odpuszczenie gazu przy ${fmt(lift45.at, 0)} km/h ${s(lift45)}, przy ${fmt(lift65.at, 0)} km/h ${s(lift65)}; pełny gaz + pełny skręt 55 km/h ${s(p55)}, 78 km/h ${s(p78)}`);
  assert.ok(!hb30.drift && hb60.drift);
  assert.ok(!lift45.drift && lift65.drift);
  assert.ok(!p55.drift && p78.drift);
});

// Pad driver holding `goal`° with counter-steer and throttle
function holder(goal) {
  return (s) => {
    const side = Math.sign(s.driftAngle) || 1;
    const err = goal - Math.abs(s.driftAngle); // + = too shallow
    return { throttle: Math.max(0, Math.min(1, 0.6 + 0.04 * err)), steer: side * Math.max(-1, Math.min(1, -0.35 + 0.04 * err)) };
  };
}

for (const preset of ['Normalny', 'Pro']) {
  test(`${preset}: poprawna kontra i gaz utrzymują drift; zaniedbany drift kończy się obrotem`, async (t) => {
    const sim = await simAt(60, preset);
    enterLeft(sim);
    const held = [];
    sim.run(4, holder(28), (x, s) => held.push(s.drifting ? Math.abs(s.driftAngle) : 0));
    const h = held.slice(60);
    const heldSpins = sim.car.state.spins;
    // Neglected: gas on, steering left alone (no counter)
    const sim2 = await simAt(60, preset);
    enterLeft(sim2);
    const neglect = watch(sim2, 3, { throttle: 1, steer: 0 });
    // Neglected with the steering still into the turn
    const sim3 = await simAt(60, preset);
    enterLeft(sim3);
    const into = watch(sim3, 3, { throttle: 0.8, steer: 0.5 });
    t.diagnostic(`kontra trzyma ${fmt(Math.min(...h))}–${fmt(Math.max(...h))}° przez 3 s (obrotów ${heldSpins}); bez kontry z gazem: ${neglect.spun ? 'obrót' : 'bez obrotu'} (max ${fmt(neglect.maxSlip)}°); skręt w zakręt: ${into.spun ? 'obrót' : 'bez obrotu'}`);
    assert.equal(heldSpins, 0);
    assert.ok(Math.min(...h) > 15 && Math.max(...h) < 45, 'kontra utrzymuje drift');
    assert.ok(neglect.spun && into.spun, 'zaniedbany drift = obrót');
  });
}

test('Normalny: za mało gazu – auto się prostuje; za mocna kontra przy wyjściu – zarzuca w drugą stronę', async (t) => {
  const sim = await simAt(60);
  enterLeft(sim);
  sim.run(0.5, holder(28));
  const a0 = sim.car.state.driftAngle;
  const lowGas = watch(sim, 2, { throttle: 0.1, steer: 0 });
  const endAngle = sim.car.state.driftAngle;
  const sim2 = await simAt(60);
  enterLeft(sim2);
  sim2.run(0.5, holder(28));
  const side0 = Math.sign(sim2.car.state.driftAngle);
  let flipped = false;
  sim2.run(1.5, { throttle: 0.7, steer: -side0 }, (x, s) => { if (s.drifting && Math.sign(s.driftAngle) === -side0 && Math.abs(s.driftAngle) > 10) flipped = true; });
  const sim3 = await simAt(60);
  enterLeft(sim3);
  sim3.run(0.5, holder(28));
  let flipped3 = false;
  sim3.run(1.5, (s) => ({ throttle: 0.2, steer: Math.abs(s.driftAngle) > 6 ? -0.3 * side0 : 0 }), (x, s) => { if (s.drifting && Math.sign(s.driftAngle) === -side0 && Math.abs(s.driftAngle) > 10) flipped3 = true; });
  t.diagnostic(`mało gazu: ${fmt(a0)}° → ${fmt(endAngle)}° w 2 s, drift ${sim.car.state.drifting ? 'trwa' : 'skończony'}, obrót ${lowGas.spun}; pełna kontra: ${flipped ? 'zarzuciło w drugą stronę' : 'bez zarzucenia'}; delikatna kontra: ${flipped3 ? 'zarzuciło' : 'czyste wyjście'} (${sim3.car.state.drifting ? 'drift' : 'przyczepność'})`);
  assert.ok(!sim.car.state.drifting && !lowGas.spun && Math.abs(endAngle) < 3);
  assert.ok(flipped, 'za mocna kontra zarzuca w drugą stronę');
  assert.ok(!flipped3 && !sim3.car.state.drifting, 'wyczute wyjście');
});

test('Normalny: auto ma pęd – w szybkim zakręcie wynosi je szerzej niż w Łatwym', async (t) => {
  const radius = async (preset) => {
    const sim = await simAt(85, preset);
    const p0 = sim.car.state.position.clone();
    let maxSlip = 0, drift = false;
    sim.run(1.5, { steer: 0.7, throttle: 0.6 }, (x, s) => { maxSlip = Math.max(maxSlip, Math.abs(s.slipAngle)); drift ||= s.drifting; });
    return { side: Math.abs(sim.car.state.position.z - p0.z), maxSlip, drift };
  };
  const e = await radius('Łatwy'), n = await radius('Normalny');
  t.diagnostic(`85 km/h, skręt 0,7 przez 1,5 s: zjazd w bok Łatwy ${fmt(e.side)} m, Normalny ${fmt(n.side)} m (auto ślizga się o ${fmt(n.maxSlip)}°, drift: ${n.drift})`);
  assert.ok(n.side < e.side * 0.92, 'szerszy łuk = pęd');
  assert.ok(!n.drift);
});
