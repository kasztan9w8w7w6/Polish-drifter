// v0.6b: the drift balance zone (Normalny, Pro). Full throttle deepens the angle gradually, about half throttle holds
// it, backing off reduces it; over proDangerAngle, held without correcting for proSpinDelay s, the car spins – and in
// that window it warns (state.spinWarning: louder squeal, camera shake) and can still be saved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from './sim.mjs';

const kmh = (s) => s.speed * 3.6;
const fmt = (n, d = 1) => Number(n).toFixed(d);

async function driftAt(preset, v = 60, drive = false) {
  const sim = await createSim({ preset, drive });
  sim.run(0.5, {});
  sim.run(14, (s) => ({ throttle: Math.max(0, Math.min(1, v / 108 + (v - kmh(s)) / 8)) }));
  sim.run(0.35, { steer: 1, handbrake: 1, throttle: 0.8 }); // handbrake entry, left
  return sim;
}

// both drives: the old arcade one and the real powertrain the game uses (v0.6c)
for (const [preset, drive] of [['Normalny', false], ['Pro', false], ['Normalny', true], ['Pro', true]]) {
  const tag = `${preset}${drive ? ' (napęd realny)' : ''}`;
  test(`${tag}: pełny gaz bez korekt – kąt rośnie stopniowo, obrót dopiero po czasie, z ostrzeżeniem`, async (t) => {
    const sim = await driftAt(preset, 60, drive);
    const t0 = sim.time;
    let at35 = null, dangerAt = null, spunAt = null, warnMax = 0, warnAtHalf = null;
    const danger = sim.tuning.proDangerAngle;
    sim.run(8, { throttle: 1, steer: 0 }, (x, s) => {
      const a = Math.abs(s.driftAngle), tt = x.t - t0;
      if (at35 === null && a >= 35) at35 = tt;
      if (dangerAt === null && a >= danger) dangerAt = tt;
      if (spunAt === null && s.spinning) spunAt = tt;
      if (spunAt === null) warnMax = Math.max(warnMax, s.spinWarning);
      if (warnAtHalf === null && s.spinWarning >= 0.5) warnAtHalf = tt;
    });
    t.diagnostic(`kąt 35° po ${fmt(at35, 2)} s, strefa (${danger}°) po ${fmt(dangerAt, 2)} s, ostrzeżenie 50% po ${fmt(warnAtHalf, 2)} s, obrót po ${fmt(spunAt, 2)} s (${fmt(spunAt - dangerAt, 2)} s w strefie), ostrzeżenie maks. ${fmt(warnMax, 2)}`);
    assert.ok(spunAt !== null, 'bez korekt kończy się obrotem');
    assert.ok(at35 > 0.6, 'kąt rośnie stopniowo, nie skokiem');
    assert.ok(spunAt - dangerAt >= 0.75 && spunAt - dangerAt <= 1.4, 'obrót po 0,8–1,2 s w strefie');
    assert.ok(spunAt >= 1.8, 'nie obraca od razu');
    assert.ok(warnMax > 0.9, 'ostrzeżenie przed obrotem');
  });

  test(`${tag}: reakcja w oknie ostrzeżenia ratuje auto; pół gazu trzyma kąt, odpuszczenie go zmniejsza`, async (t) => {
    // Full throttle until the warning reaches 60 %, then react: counter-steer, or back off the throttle
    const react = async (fix) => {
      const sim = await driftAt(preset, 60, drive);
      let reacted = null, spun = false, minAfter = 90;
      sim.run(6, (s) => {
        if (reacted === null && s.spinWarning >= 0.6) reacted = sim.time;
        return reacted === null ? { throttle: 1, steer: 0 } : fix(s);
      }, (x, s) => {
        if (s.spinning) spun = true;
        if (reacted !== null) minAfter = Math.min(minAfter, Math.abs(s.driftAngle));
      });
      return { spun, reacted: reacted !== null, minAfter, drifting: sim.car.state.drifting, speed: kmh(sim.car.state) };
    };
    const counter = await react((s) => ({ throttle: 0.6, steer: -Math.sign(s.driftAngle) * (Math.abs(s.driftAngle) > 30 ? 0.8 : 0.2) }));
    const lift = await react(() => ({ throttle: 0.2, steer: 0 }));
    // Half throttle holds, backing off reduces (measured from ~30°)
    const sim = await driftAt(preset, 60, drive);
    sim.run(3, (s) => ({ throttle: Math.abs(s.driftAngle) < 30 ? 1 : 0.5, steer: 0 }));
    const a0 = Math.abs(sim.car.state.driftAngle);
    sim.run(1.5, { throttle: 0.5, steer: 0 });
    const aHalf = Math.abs(sim.car.state.driftAngle);
    sim.run(1, { throttle: 0.1, steer: 0 });
    const aLift = Math.abs(sim.car.state.driftAngle);
    t.diagnostic(`kontra przy 60% ostrzeżenia: ${counter.spun ? 'OBRÓT' : 'uratowane'} (kąt spadł do ${fmt(counter.minAfter)}°, drift ${counter.drifting ? 'trwa' : 'złapany'}); odpuszczenie gazu: ${lift.spun ? 'OBRÓT' : 'uratowane'}; pół gazu: ${fmt(a0)}° → ${fmt(aHalf)}° w 1,5 s; odpuszczenie: → ${fmt(aLift)}° w 1 s`);
    assert.ok(counter.reacted && !counter.spun, 'kontra ratuje');
    assert.ok(lift.reacted && !lift.spun, 'odpuszczenie gazu ratuje');
    assert.ok(Math.abs(aHalf - a0) < 5, 'pół gazu trzyma kąt');
    assert.ok(aLift < aHalf - 5, 'odpuszczenie zmniejsza kąt');
  });
}
