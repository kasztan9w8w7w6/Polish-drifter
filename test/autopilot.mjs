// An autopilot for the six-post run (test/slupki.test.mjs): drives the real car (vehicle.ts + engine.js, Normalny preset)
// through the slalom like a player of some skill. It follows a weaving line through the posts' sides, kicks the tail
// out with a short handbrake pull before each post and holds the slide with the throttle; skill = how precise it is.
//   blad: steering noise (share of full lock), opoznienie: reaction delay (s), rozrzut: timing error of the handbrake
//   pull (m), gaz: throttle error, predkosc: target speed (km/h)
import { createCourse, createRun, slupkiSettings } from '../src/fabula/slupki.js';
import { createSim, yawOf } from './sim.mjs';
import { losowanie } from '../src/fabula/silnik.js';

// technique (the same for everyone): kick ~0.75 s before a post, steer into the slide, counter-steer firmly after it,
// ~44 km/h, a line 4 m either side of the posts; skill = how much of it goes wrong
const TECHNIKA = { tKop: 0.75, kontra: 0.9, amp: 4, predkosc: 44, wkret: 0.45 };
export const POZIOMY = {
  slaby: { ...TECHNIKA, blad: 0.3, opoznienie: 0.22, rozrzut: 3.5, gaz: 0.25 },
  sredni: { ...TECHNIKA, blad: 0.16, opoznienie: 0.14, rozrzut: 2.2, gaz: 0.15 },
  dobry: { ...TECHNIKA, blad: 0.06, opoznienie: 0.07, rozrzut: 0.8, gaz: 0.06 },
};

const gauss = (rng) => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());

// One attempt → { czyste, wyniki }
export async function przejazd(poziom, seed, settings = slupkiSettings, opts = {}) {
  const preset = opts.preset ?? 'Normalny';
  const P = typeof poziom === 'string' ? POZIOMY[poziom] : poziom;
  const rng = losowanie(seed);
  const sim = await createSim({ preset, drive: true });
  const course = createCourse({ x: 0, z: 0, heading: 0, odstep: settings.odstep, rozbieg: settings.rozbieg });
  const run = createRun(course, settings);
  // start 30 m before the line, already a bit to the right – a player lines up for the first post on the way in
  sim.car.reset({ x: -30, y: 1, z: 2.5 }, 0);
  const amp = P.amp ?? 4;
  const lat = (s) => {
    const p = course.posts;
    const L = (k) => p[k].strona * amp;
    if (s <= p[0].s) return L(0);
    if (s >= p.at(-1).s) return L(p.length - 1);
    const k = p.findIndex((q, i) => i + 1 < p.length && s >= q.s && s < p[i + 1].s);
    const u = (s - p[k].s) / (p[k + 1].s - p[k].s);
    return L(k) + (L(k + 1) - L(k)) * (1 - Math.cos(Math.PI * u)) / 2;
  };
  const delayQ = [];
  const jitter = course.posts.map(() => gauss(rng) * P.rozrzut);
  const steerNoise = { v: 0 };
  let faza = 'jazda', timer = 0, k = 0; // phase machine per post: jazda → kopniak (handbrake) → drift → lapanie
  const out = { czyste: 0, wyniki: [] };
  const DT = 1 / 60;
  let done = false;
  const trace = [];
  sim.run(40, (st, t) => {
    if (done) return { throttle: 0, brake: 1 };
    const yaw = (yawOf(st) * Math.PI) / 180;
    const x = st.position.x, z = st.position.z;
    const ev = run.update(DT, { x, z, yaw, sideSlip: st.sideSlip });
    for (const e of ev) if (e.typ === 'koniec') ((done = true), (out.czyste = e.czyste), (out.wyniki = run.state.wyniki));
    // what the driver sees, `opoznienie` s late
    delayQ.push({ x, z, v: { ...st.velocity }, speed: st.speed, drifting: st.drifting, slip: st.sideSlip });
    const seen = delayQ[Math.max(0, delayQ.length - 1 - Math.round(P.opoznienie / DT))];
    const { s, d } = course.local(seen.x, seen.z);
    const post = course.posts[Math.min(k, course.posts.length - 1)];
    if (k < course.posts.length && s > post.s + (P.lap ?? 1) && faza !== 'lapanie') ((faza = 'lapanie'), (timer = 0));
    const look = 8;
    const want = Math.atan2(lat(s + look) - d, look); // + = to the right
    const vt = Math.atan2(seen.v.x * course.r.x + seen.v.z * course.r.z, seen.v.x * course.f.x + seen.v.z * course.f.z);
    steerNoise.v += (gauss(rng) * P.blad - steerNoise.v) * 0.08;
    const kmh = seen.speed * 3.6;
    let steer = -(want - vt) * 2.4, handbrake = 0, throttle = kmh < P.predkosc ? 0.9 : 0.3;
    timer += DT;
    if (faza === 'jazda' && k < course.posts.length && (post.s - s - jitter[k]) / Math.max(1, seen.speed) < (P.tKop ?? 0.6)) ((faza = 'kopniak'), (timer = 0));
    if (faza === 'kopniak') {
      handbrake = 1;
      steer = post.strona;
      throttle = 0.5;
      if (timer > 0.22) ((faza = 'drift'), (timer = 0));
    } else if (faza === 'drift') {
      steer = post.strona * (P.wkret ?? 0.35) - (want - vt) * 0.8;
      throttle = kmh < P.predkosc ? 0.62 : 0.5;
    } else if (faza === 'lapanie') {
      steer = -post.strona * (P.kontra ?? 0.6) - (want - vt) * 1.5;
      throttle = kmh < P.predkosc ? 0.8 : 0.5;
      if (seen.slip < 6 || timer > 0.6) ((faza = 'jazda'), k++, (timer = 0));
    }
    steer = Math.max(-1, Math.min(1, steer + steerNoise.v));
    throttle = Math.max(0, Math.min(1, throttle + gauss(rng) * P.gaz));
    if (opts.trace && Math.round(t * 60) % 6 === 0) trace.push(`${t.toFixed(1)} ${faza[0]}${k} s${s.toFixed(0)} d${d.toFixed(1)} v${(seen.speed * 3.6).toFixed(0)} a${seen.slip.toFixed(0)} st${steer.toFixed(1)}`);
    return { throttle, steer, handbrake, brake: 0 };
  });
  if (opts.trace) console.log(trace.join(' | '));
  if (!done) {
    out.czyste = run.state.czyste;
    out.wyniki = run.state.wyniki;
  }
  return out;
}

// n attempts → share with ≥ 4 clean, average clean
export async function seria(poziom, n, settings = slupkiSettings, seed0 = 1) {
  let ok = 0, sum = 0;
  const hist = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const r = await przejazd(poziom, seed0 + i * 7919, settings);
    if (r.czyste >= 4) ok++;
    sum += r.czyste;
    hist[r.czyste]++;
  }
  return { udzial: ok / n, srednio: sum / n, hist };
}
