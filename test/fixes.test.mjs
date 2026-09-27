// v0.5a: reversing is not a slide (no tyre squeal), a spin-out is at most one turn and then the car stands
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, yawOf } from './sim.mjs';

const kmh = (s) => s.speed * 3.6;
const fmt = (n, d = 1) => Number(n).toFixed(d);

test('cofanie: bez poślizgu bocznego (bez pisku), pełny gaz ze startu = buksowanie', async (t) => {
  const sim = await createSim({ preset: 'Normalny' });
  let maxSide = 0, maxSlip = 0, spinStart = 0;
  sim.run(0.5, { throttle: 1 }, (x, s) => (spinStart = Math.max(spinStart, s.wheelspin)));
  sim.run(3, { brake: 0 });
  sim.run(4, { brake: 1 }, (x, s) => {
    if (s.forwardSpeed < -2) {
      maxSide = Math.max(maxSide, s.sideSlip);
      maxSlip = Math.max(maxSlip, Math.abs(s.slipAngle));
    }
  });
  const reverse = sim.car.state.forwardSpeed;
  // Reversing in an arc
  sim.run(2, { brake: 1, steer: 1 }, (x, s) => s.forwardSpeed < -2 && (maxSide = Math.max(maxSide, s.sideSlip)));
  const sliding = sim.car.state.wheels.some((w) => w.sliding);
  t.diagnostic(`wstecz ${fmt(reverse * 3.6, 0)} km/h: slipAngle ${fmt(maxSlip, 0)}° (stara miara), sideSlip maks. ${fmt(maxSide)}°, ślady: ${sliding}; buksowanie na starcie ${fmt(spinStart, 2)}`);
  assert.ok(reverse < -3, 'jedzie do tyłu');
  assert.ok(maxSide < 8, 'cofanie to nie poślizg (pisk od 8°)');
  assert.ok(!sliding);
  assert.ok(spinStart > 0.5, 'pełny gaz ze startu buksuje');
});

test('obrót: najwyżej jeden, potem auto traci obroty i staje (Normalny, Pro)', async (t) => {
  for (const preset of ['Normalny', 'Pro']) {
    const sim = await createSim({ preset });
    sim.run(12, (s) => ({ throttle: kmh(s) < 60 ? 1 : 0.4 }));
    sim.run(0.5, { throttle: 1, steer: 1, handbrake: 1 });
    // Hold everything into the slide (the worst case): the car spins out
    let yawTotal = 0, prev = yawOf(sim.car.state), spinYaw = 0, spinning = false;
    let endSpeed = 0, over = false;
    // (held until the spin ends, then let go: holding full throttle + full lock afterwards is a new slide)
    sim.run(5, (s) => (over || (spinning && !s.spinning) ? ((over = true), {}) : { throttle: 1, steer: 1 }), (x, s) => {
      const y = yawOf(s);
      let d = y - prev;
      d -= 360 * Math.round(d / 360);
      prev = y;
      yawTotal += d;
      if (s.spinning) {
        spinning = true;
        spinYaw += d;
      }
    });
    endSpeed = kmh(sim.car.state);
    t.diagnostic(`${preset}: obrotów ${sim.car.state.spins}, obrót nadwozia w fazie obrotu ${fmt(Math.abs(spinYaw), 0)}°, razem ${fmt(Math.abs(yawTotal), 0)}°, prędkość 5 s później ${fmt(endSpeed, 0)} km/h`);
    assert.ok(spinning, 'obrót wystąpił');
    assert.equal(sim.car.state.spins, 1, 'jeden obrót, nie dwa');
    assert.ok(Math.abs(spinYaw) <= 300, 'faza obrotu dodaje mniej niż pełny obrót');
    assert.ok(endSpeed < 5, 'auto staje');
  }
});
