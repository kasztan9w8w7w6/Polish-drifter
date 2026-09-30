// An autopilot for the six-post run (test/slupki.test.mjs): drives the real car (vehicle.ts + engine.js, Normalny
// preset) through the slalom like a player of some skill. The driving logic itself is src/npcAutopilot.js (v0.8: the
// same module drives the NPC cars in the game, src/fabula/gra.js) – this file only wires it to the headless sim.
import { createCourse, createRun, slupkiSettings } from '../src/fabula/slupki.js';
import { createSim, yawOf } from './sim.mjs';
import { createAutopilot, POZIOMY } from '../src/npcAutopilot.js';
import polonez from '../src/cars/polonez.json' with { type: 'json' };

export { POZIOMY };

// One attempt → { czyste, wyniki }
export async function przejazd(poziom, seed, settings = slupkiSettings, opts = {}) {
  const preset = opts.preset ?? 'Normalny';
  const sim = await createSim({ preset, drive: opts.drive ?? true, car: opts.car ?? polonez });
  const course = createCourse({ x: 0, z: 0, heading: 0, odstep: settings.odstep, rozbieg: settings.rozbieg });
  const run = createRun(course, settings);
  const auto = createAutopilot(course, poziom, seed, { trace: opts.trace });
  // start 30 m before the line, already a bit to the right – a player lines up for the first post on the way in
  sim.car.reset({ x: -30, y: 1, z: 2.5 }, 0);
  const out = { czyste: 0, wyniki: [] };
  const DT = 1 / 60;
  let done = false;
  sim.run(40, (st, t) => {
    if (done) return { throttle: 0, brake: 1 };
    const yaw = (yawOf(st) * Math.PI) / 180;
    const x = st.position.x, z = st.position.z;
    const ev = run.update(DT, { x, z, yaw, sideSlip: st.sideSlip });
    for (const e of ev) if (e.typ === 'koniec') ((done = true), (out.czyste = e.czyste), (out.wyniki = run.state.wyniki));
    return auto.step({ x, z, velocity: st.velocity, speed: st.speed, sideSlip: st.sideSlip }, DT);
  });
  if (opts.trace) console.log(auto.log.join(' | '));
  if (!done) {
    out.czyste = run.state.czyste;
    out.wyniki = run.state.wyniki;
  }
  return out;
}

// n attempts → share with ≥ 4 clean, average clean
export async function seria(poziom, n, settings = slupkiSettings, seed0 = 1, opts = {}) {
  let ok = 0, sum = 0;
  const hist = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const r = await przejazd(poziom, seed0 + i * 7919, settings, opts);
    if (r.czyste >= 4) ok++;
    sum += r.czyste;
    hist[r.czyste]++;
  }
  return { udzial: ok / n, srednio: sum / n, hist };
}
