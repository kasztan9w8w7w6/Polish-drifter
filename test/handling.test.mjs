// v0.2c: continuous drift control, power oversteer in Pro, no bouncing, no getting stuck.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from './sim.mjs';
import { rampValue, KEY_RAMP } from '../src/input.js';

const kmh = (s) => s.speed * 3.6;
const fmt = (n, d = 1) => Number(n).toFixed(d);
const DT = 1 / 60;

// Keyboard emulator: `keys(t)` returns which keys are held ({ left, right, gas, brake, hb }), the output is
// ramped exactly like src/input.js does it in the browser.
function keyboard(keys) {
  const v = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  return (state, time) => {
    const k = keys(time, state);
    v.throttle = rampValue(v.throttle, k.gas ? 1 : 0, DT, KEY_RAMP.pedalUp, KEY_RAMP.pedalDown);
    v.brake = rampValue(v.brake, k.brake ? 1 : 0, DT, KEY_RAMP.pedalUp, KEY_RAMP.pedalDown);
    v.steer = rampValue(v.steer, (k.left ? 1 : 0) - (k.right ? 1 : 0), DT, KEY_RAMP.steerUp, KEY_RAMP.steerDown);
    v.handbrake = k.hb ? 1 : 0;
    return { ...v };
  };
}

async function simAt(target, opts) {
  const sim = await createSim(opts);
  sim.run(0.5, {});
  sim.run(12, (s) => ({ throttle: kmh(s) < target ? 1 : 0.4 }));
  return sim;
}

test('klawiatura: skręt narasta 0→1 w 0,3–0,5 s i opada płynnie', (t) => {
  let v = 0, tUp = 0, tDown = 0;
  while (v < 1) { v = rampValue(v, 1, DT, KEY_RAMP.steerUp, KEY_RAMP.steerDown); tUp += DT; }
  while (v > 0) { v = rampValue(v, 0, DT, KEY_RAMP.steerUp, KEY_RAMP.steerDown); tDown += DT; }
  let steps = 0;
  v = 0;
  for (let i = 0; i < 60; i++) { const n = rampValue(v, 1, DT, KEY_RAMP.steerUp, KEY_RAMP.steerDown); if (n !== v && n < 1) steps++; v = n; }
  t.diagnostic(`0→1 w ${fmt(tUp, 2)} s, 1→0 w ${fmt(tDown, 2)} s, ${steps} pośrednich wartości po drodze`);
  assert.ok(tUp >= 0.3 && tUp <= 0.5);
  assert.ok(tDown >= 0.15 && tDown <= 0.5);
  assert.ok(steps >= 15);
});

test('drift: rozkład kątów – pośrednie kąty, nie tylko skrajne (klawiatura)', async (t) => {
  const sim = await simAt(60);
  const t0 = sim.time;
  // A player tapping the keys: handbrake entry, then short taps into the turn / counter / neutral, gas held
  const pattern = [
    [0.6, { left: 1, hb: 1, gas: 1 }],
    [0.8, { gas: 1 }], [0.5, { left: 1, gas: 1 }], [0.6, { gas: 1 }], [0.3, { right: 1, gas: 1 }], [0.6, { gas: 1 }],
    [0.9, { left: 1, gas: 1 }], [0.5, { gas: 1 }], [0.25, { right: 1, gas: 1 }], [0.4, { gas: 1 }], [0.35, { right: 1, gas: 1 }],
    [0.8, { gas: 1 }], [0.3, { left: 1, gas: 1 }], [0.7, { gas: 1 }],
  ];
  const total = pattern.reduce((a, [d]) => a + d, 0);
  const at = (time) => { let e = time - t0; for (const [d, k] of pattern) { if (e < d) return k; e -= d; } return { gas: 1 }; };
  const bins = [0, 0, 0, 0, 0]; // 0–10, 10–20, 20–30, 30–40, 40+
  const seen = new Set(); // 2° buckets the angle passed through
  let n = 0;
  sim.run(total, keyboard(at), (x) => {
    if (x.t - t0 < 0.8 || !x.drifting) return;
    bins[Math.min(4, Math.floor(Math.abs(x.slip) / 10))]++;
    seen.add(Math.floor(Math.abs(x.slip) / 2));
    n++;
  });
  const pct = bins.map((b) => (100 * b) / n);
  t.diagnostic(`kąt w drifcie: 0–10° ${fmt(pct[0], 0)}%, 10–20° ${fmt(pct[1], 0)}%, 20–30° ${fmt(pct[2], 0)}%, 30–40° ${fmt(pct[3], 0)}%, 40°+ ${fmt(pct[4], 0)}% (${n} próbek); odwiedzone przedziały 2°: ${seen.size}`);
  assert.ok(pct[1] + pct[2] + pct[3] > 70, 'większość czasu w kątach pośrednich');
  assert.ok(seen.size >= 10, 'kąt przechodzi płynnie przez wiele wartości');
  assert.ok(pct[4] < 15, 'nie siedzi na limicie');
});

test('drift: im dłużej trzymam skręt, tym głębszy kąt; lekka kontra zmniejsza go stopniowo', async (t) => {
  const sim = await simAt(60);
  const t0 = sim.time;
  sim.run(1.6, (s, time) => (time - t0 < 0.6 ? { steer: 1, handbrake: 1, throttle: 1 } : { throttle: 0.7, steer: 0.2 }));
  const a0 = Math.abs(sim.car.state.slipAngle);
  const t1 = sim.time;
  const into = [];
  sim.run(1.2, keyboard(() => ({ left: 1, gas: 1 })), (x) => into.push([x.t - t1, Math.abs(x.slip)]));
  const at = (arr, s) => arr.find(([tt]) => tt >= s)[1];
  const t2 = sim.time;
  const counter = [];
  sim.run(1.2, (s) => ({ throttle: 1, steer: -0.35 }), (x) => counter.push([x.t - t2, Math.abs(x.slip)]));
  t.diagnostic(`lekki skręt ${fmt(a0)}° → trzymam skręt: po 0,2 s ${fmt(at(into, 0.2))}°, 0,5 s ${fmt(at(into, 0.5))}°, 1,0 s ${fmt(at(into, 1.0))}°`);
  t.diagnostic(`lekka kontra (−0,35): po 0,2 s ${fmt(at(counter, 0.2))}°, 0,5 s ${fmt(at(counter, 0.5))}°, 1,0 s ${fmt(at(counter, 1.0))}°`);
  assert.ok(at(into, 0.2) < at(into, 0.5) && at(into, 0.5) < at(into, 1.0), 'kąt rośnie z czasem trzymania');
  assert.ok(at(into, 0.2) < 38, 'nie skacze od razu do limitu');
  assert.ok(at(counter, 0.2) > at(counter, 0.5) && at(counter, 0.5) > at(counter, 1.0), 'kontra zmniejsza stopniowo');
  assert.ok(at(counter, 1.0) > 8, 'lekka kontra nie przerzuca na drugą stronę');
});

test('pad (analog): kąt driftu rośnie proporcjonalnie ze skrętem', async (t) => {
  const angles = [];
  for (const steer of [0.1, 0.25, 0.4, 0.55, 0.7]) {
    const sim = await simAt(60);
    const t0 = sim.time;
    sim.run(3.5, (s, time) => (time - t0 < 0.6 ? { steer: 1, handbrake: 1, throttle: 1 } : { throttle: 0.8, steer }));
    angles.push(Math.abs(sim.car.state.slipAngle));
  }
  const d = angles.slice(1).map((a, i) => a - angles[i]);
  t.diagnostic(`skręt 0,1 / 0,25 / 0,4 / 0,55 / 0,7 → ${angles.map((a) => fmt(a)).join('° / ')}°`);
  assert.ok(d.every((x) => x > 2.5), 'każdy krok skrętu zmienia kąt');
  assert.ok(Math.max(...d) / Math.min(...d) < 3, 'mniej więcej liniowo');
});

test('Pro: drift wchodzi też gazem w ostrym zakręcie, trudniej niż w Łatwym', async (t) => {
  const tryPower = async (preset, speed) => {
    const sim = await simAt(speed, { preset });
    let entered = null;
    const t0 = sim.time;
    sim.run(2, keyboard(() => ({ left: 1, gas: 1 })), (x) => { if (entered === null && x.drifting) entered = x.t - t0; });
    return entered;
  };
  const easy50 = await tryPower('Łatwy', 52);
  const pro50 = await tryPower('Pro', 52);
  const pro75 = await tryPower('Pro', 75);
  const s = (v) => (v === null ? 'brak' : `${fmt(v, 2)} s`);
  t.diagnostic(`gaz + pełny skręt (klawiatura): Łatwy 52 km/h → drift po ${s(easy50)}, Pro 52 km/h → ${s(pro50)}, Pro 75 km/h → po ${s(pro75)}`);
  assert.ok(easy50 !== null && easy50 < 1, 'Łatwy: wchodzi przy 52 km/h');
  assert.ok(pro50 === null || pro50 > 1, 'Pro: przy 52 km/h nie od razu (dopiero gdy auto rozpędzi się w zakręcie)');
  assert.ok(pro75 !== null && pro75 < 1 && pro75 > easy50, 'Pro: przy 75 km/h wchodzi, ale później niż Łatwy');
});

test('lądowanie po skoku: bez odbić, model nie drga', async (t) => {
  const sim = await createSim();
  sim.run(0.5, {});
  sim.car.reset({ x: 0, y: 4, z: 0 }, 0); // 3 m above the ground
  sim.car.body.setLinvel({ x: 14, y: 0, z: 0 }, true);
  let landed = null, maxUpV = 0, bounces = 0, wasDown = false, turns = 0, prevDy = 0, prevY = null;
  const ys = [];
  sim.run(3, { throttle: 0.5 }, (x) => {
    const onGround = x.ballY < 1.08;
    if (landed === null && onGround) landed = x.t;
    if (landed !== null && x.t - landed > 0.05) {
      maxUpV = Math.max(maxUpV, x.ballVy);
      if (wasDown && !onGround) bounces++;
    }
    wasDown = onGround;
    // Model wobble after the landing: direction changes of its height (> 1 mm per frame)
    if (prevY !== null && landed !== null) {
      const dy = x.y - prevY;
      if (Math.abs(dy) > 0.001) { if (prevDy && Math.sign(dy) !== Math.sign(prevDy)) turns++; prevDy = dy; }
      if (x.t - landed > 0.3) ys.push(x.y);
    }
    prevY = x.y;
  });
  const settle = Math.max(...ys) - Math.min(...ys);
  t.diagnostic(`po lądowaniu: max prędkość kuli w górę ${fmt(maxUpV, 3)} m/s, oderwania od ziemi ${bounces}, zmiany kierunku ruchu modelu w pionie ${turns}, rozrzut wysokości modelu po 0,3 s ${fmt(settle * 100, 1)} cm`);
  assert.ok(landed !== null);
  assert.ok(maxUpV < 0.3, 'kula nie odbija się');
  assert.equal(bounces, 0);
  assert.ok(turns <= 1, 'model osiada raz, bez drgań');
  assert.ok(settle < 0.02);
});

test('nierówności (progi 15 cm co 4 m): model płynnie, auto nie podskakuje', async (t) => {
  const sim = await createSim({ bumps: true });
  sim.run(0.5, {});
  sim.run(3, (s) => ({ throttle: kmh(s) < 45 ? 1 : 0.3 }));
  let maxBall = 0, maxModelV = 0, maxBallV = 0, prevY = null, airborne = 0;
  sim.run(6, (s) => ({ throttle: kmh(s) < 45 ? 1 : 0.3 }), (x) => {
    maxBall = Math.max(maxBall, x.ballY);
    maxBallV = Math.max(maxBallV, Math.abs(x.ballVy));
    if (prevY !== null) maxModelV = Math.max(maxModelV, Math.abs(x.y - prevY) * 60);
    prevY = x.y;
    if (x.ballY > 1.4) airborne += DT;
  });
  t.diagnostic(`kula max ${fmt(maxBall - 1, 2)} m nad ziemią, pionowa prędkość kuli max ${fmt(maxBallV, 2)} m/s, modelu max ${fmt(maxModelV, 2)} m/s, w powietrzu (>0,4 m) ${fmt(airborne, 2)} s`);
  assert.ok(maxModelV < maxBallV * 0.8, 'model wygładza nierówności');
  assert.ok(airborne < 0.1, 'nie wyskakuje w powietrze');
});

test('seria uderzeń w przeszkody: auto nie utyka (auto‑wypchnięcie ≤ 1 s)', async (t) => {
  const sim = await createSim({ obstacles: true, walls: true });
  sim.run(0.5, {});
  // A minute of chaotic driving: gas held, steering and handbrake changing, reversing now and then
  let rng = 7;
  const rand = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
  let cur = { throttle: 1, steer: 0, handbrake: 0, brake: 0 }, next = 0;
  let stuckFor = 0, worst = 0, maxImpact = 0, embedded = 0;
  const { RAPIER, world } = sim.physics;
  const small = new RAPIER.Ball(0.5);
  sim.run(60, (s, time) => {
    if (time >= next) {
      next = time + 0.4 + rand() * 1.4;
      const reverse = rand() < 0.12;
      cur = { throttle: reverse ? 0 : 1, brake: reverse ? 1 : 0, steer: rand() * 2 - 1, handbrake: rand() < 0.2 ? 1 : 0 };
    }
    return cur;
  }, (x) => {
    maxImpact = Math.max(maxImpact, x.impact);
    stuckFor = (x.inp.throttle > 0.5 || x.inp.brake > 0.5) && x.speed < 2 ? stuckFor + DT : 0;
    worst = Math.max(worst, stuckFor);
    const b = sim.car.body.translation();
    if (world.intersectionWithShape(b, { x: 0, y: 0, z: 0, w: 1 }, small, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC)) embedded++;
  });
  // The chassis box is kinematic: Rapier gives it no contacts with static geometry, so it can't wedge the car
  let chassisStatic = 0;
  world.contactPairsWith(sim.car.chassisCollider, (c) => { if (c.parent()?.isFixed?.() ?? !c.parent()) chassisStatic++; });
  t.diagnostic(`60 s jazdy w przeszkody: najdłuższe stanie z wciśniętym pedałem ${fmt(worst, 2)} s, wypchnięć ${sim.car.state.unstuck}, klatek ze środkiem kuli w przeszkodzie ${embedded}, max siła ${fmt(maxImpact / 1000, 0)} kN, kontakty skrzyni z kolizjami statycznymi ${chassisStatic}`);
  assert.ok(worst < 1.6, 'nigdy nie stoi dłużej niż ~1 s');
  assert.equal(embedded, 0, 'kula nie wbija się w przeszkody (CCD)');
  assert.equal(chassisStatic, 0);
});

test('zaklinowanie (kula w wąskiej szparze / na krawędzi): wypchnięcie po ~1 s, R też działa', async (t) => {
  const sim = await createSim({ obstacles: true });
  sim.run(0.5, {});
  // Drop the ball into the 1.9 m gap between the two boxes at x = −14 (narrower than the ball)
  sim.car.reset({ x: -14, y: 3.2, z: 2.95 }, Math.PI / 2);
  const p0 = { ...sim.car.body.translation() };
  let freedAt = null;
  const t0 = sim.time;
  sim.run(3, { throttle: 1 }, (x) => { if (freedAt === null && x.unstuck > 0) freedAt = x.t - t0; });
  const p1 = sim.car.body.translation();
  sim.run(1, { throttle: 1 });
  const moving = kmh(sim.car.state);
  t.diagnostic(`start w szparze na wys. ${fmt(p0.y, 2)} m → wypchnięte po ${freedAt === null ? '—' : fmt(freedAt, 2) + ' s'} o ${fmt(Math.hypot(p1.x - p0.x, p1.z - p0.z), 1)} m, po 1 s gazu ${fmt(moving, 0)} km/h`);
  assert.ok(freedAt !== null && freedAt < 1.6);
  assert.ok(moving > 10, 'jedzie dalej');
  sim.car.reset();
  sim.run(0.2, {});
  const r = sim.car.body.translation();
  assert.ok(Math.hypot(r.x, r.z) < 0.5, 'R wraca na start');
});

test('puszczenie skrętu w drifcie: auto delikatnie się prostuje (jak wracająca kierownica)', async (t) => {
  const sim = await simAt(60);
  const t0 = sim.time;
  // Drift held with the key, then the steering key is released; gas stays on
  sim.run(2, keyboard((time) => (time - t0 < 0.6 ? { left: 1, hb: 1, gas: 1 } : { left: time - t0 < 1.3, gas: 1 })));
  const a0 = Math.abs(sim.car.state.slipAngle);
  const t1 = sim.time;
  const pts = [];
  let maxRate = 0, prev = a0, ended = null;
  sim.run(5, keyboard(() => ({ gas: 1 })), (x) => {
    const a = Math.abs(x.slip);
    maxRate = Math.max(maxRate, Math.abs(a - prev) * 60);
    prev = a;
    pts.push([x.t - t1, a]);
    if (ended === null && !x.drifting) ended = x.t - t1;
  });
  const at = (s) => pts.find(([tt]) => tt >= s)[1];
  const below5 = pts.find(([, a]) => a < 5)?.[0];
  t.diagnostic(`puszczony skręt przy ${fmt(a0)}°: po 0,5 s ${fmt(at(0.5))}°, 1 s ${fmt(at(1))}°, 2 s ${fmt(at(2))}°; < 5° po ${below5 === undefined ? '—' : fmt(below5, 2) + ' s'}, koniec driftu po ${ended === null ? '—' : fmt(ended, 2) + ' s'}, najszybsza zmiana ${fmt(maxRate, 0)}°/s`);
  assert.ok(a0 > 20, 'był drift');
  assert.ok(at(0.5) < a0 && at(1) < at(0.5) && at(2) < at(1), 'kąt stale maleje');
  assert.ok(below5 !== undefined && below5 > 1 && below5 < 4, 'delikatnie, ale do końca');
  assert.ok(ended !== null, 'drift się kończy');
  assert.ok(maxRate < 45, 'bez szarpnięcia');
});
