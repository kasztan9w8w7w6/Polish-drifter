// A driver for the six-post run that steers a real vehicle.ts car (no DOM, used by test/autopilot.mjs AND the game's
// NPC cars, src/fabula/gra.js): follows a weaving line through the posts' sides, kicks the tail out with a short
// handbrake pull before each post and holds the slide with the throttle; skill = how much of it goes wrong.
//   blad: steering noise (share of full lock), opoznienie: reaction delay (s), rozrzut: timing error of the handbrake
//   pull (m), gaz: throttle error, predkosc: target speed (km/h)
import { losowanie } from './fabula/silnik.js';

// technique (the same for everyone): kick ~0.75 s before a post, steer into the slide, counter-steer firmly after it,
// ~44 km/h, a line 4 m either side of the posts; skill = how much of it goes wrong
const TECHNIKA = { tKop: 0.75, kontra: 0.9, amp: 4, predkosc: 44, wkret: 0.45 };
export const POZIOMY = {
  slaby: { ...TECHNIKA, blad: 0.3, opoznienie: 0.22, rozrzut: 3.5, gaz: 0.25 },
  sredni: { ...TECHNIKA, blad: 0.16, opoznienie: 0.14, rozrzut: 2.2, gaz: 0.15 },
  dobry: { ...TECHNIKA, blad: 0.06, opoznienie: 0.07, rozrzut: 0.8, gaz: 0.06 },
};
// A post the story engine's roll (q_ukryte) requires clean borrows this, not just "dobry" – near-zero noise so a
// forced-clean post is a much better bet than the driver's own skill level, whatever that is for the rest of the run
// (still not a guarantee: the six-post technique is touch-sensitive by design, see the header comment below).
const GWARANT = { ...TECHNIKA, blad: 0.015, opoznienie: 0.05, rozrzut: 0.25, gaz: 0.015 };

const gauss = (rng) => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
const DT = 1 / 60;

// course: slupki.js createCourse(); poziom: a POZIOMY key or a custom object of the same shape; seed: RNG seed.
// Returns { step({ x, z, velocity, speed, sideSlip }, dt) → { throttle, steer, handbrake, brake } } – call step()
// once per physics sub-step; it does not know about the run's post-crossing bookkeeping (slupki.js createRun does
// that separately, from x/z/yaw/sideSlip).
// forced: optional array (one entry per post) – true biases that post towards a clean pass, false makes it skip the
// handbrake kick (drives straight through, no slide – WERDYKT.katem). The story engine has already rolled the NPC's
// slupki array before the run starts (silnik.js losujSlupki, q_ukryte) and money is settled from THAT array, not from
// what the live drive produces (src/fabula/gra.js rozlicz(): `a.slupki`, same as v0.7's scripted npcPath) – forcing
// here only keeps the on-screen verdict badges from visibly contradicting the payout, it is not money-critical. A
// forced-dirty post is deterministic (100 %, confirmed by test); a forced-clean post is a best-effort bias, not a
// guarantee – the six-post technique is touch-sensitive by design (docs/wdrozenie-fabuly.md), so occasional cosmetic
// mismatches on a single post are expected and harmless. See docs/wdrozenie-fabuly.md "Beemka: fizyka NPC" for numbers.
export function createAutopilot(course, poziom, seed, { trace = false, forced = null } = {}) {
  const P = typeof poziom === 'string' ? POZIOMY[poziom] : poziom;
  const rng = losowanie(seed);
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
  // Timing jitter and steering noise both use the regime (base skill, or GWARANT for a forced-clean post) that will
  // actually apply at that post – not the run's base skill – so a forced-clean post embedded in a shaky run is not
  // dragged down by jitter/noise sized for the driver's usual skill.
  const jitter = course.posts.map((_, i) => gauss(rng) * (forced?.[i] === true ? GWARANT.rozrzut : P.rozrzut));
  const steerNoise = { v: 0 };
  let faza = 'jazda', timer = 0, k = 0; // phase machine per post: jazda → kopniak (handbrake) → drift → lapanie
  const log = [];

  function step({ x, z, velocity, speed, sideSlip }, dt = DT) {
    delayQ.push({ x, z, v: { ...velocity }, speed, slip: sideSlip });
    const kIn = Math.min(k, course.posts.length - 1);
    const wymagany = forced?.[kIn]; // true/false/undefined for the post we're approaching now
    const Pk = wymagany === true ? GWARANT : P;
    const seen = delayQ[Math.max(0, delayQ.length - 1 - Math.round(Pk.opoznienie / dt))];
    while (delayQ.length > 200) delayQ.shift();
    const { s, d } = course.local(seen.x, seen.z);
    const post = course.posts[kIn];
    if (k < course.posts.length && s > post.s + (Pk.lap ?? 1) && faza !== 'lapanie') ((faza = 'lapanie'), (timer = 0));
    const look = 8;
    const want = Math.atan2(lat(s + look) - d, look); // + = to the right
    const vt = Math.atan2(seen.v.x * course.r.x + seen.v.z * course.r.z, seen.v.x * course.f.x + seen.v.z * course.f.z);
    steerNoise.v += (gauss(rng) * Pk.blad - steerNoise.v) * 0.08;
    const cap = Pk.blad * 3 + 0.01; // clamp: noise left over from a rougher regime can't leak into a GWARANT post
    steerNoise.v = Math.max(-cap, Math.min(cap, steerNoise.v));
    const kmh = seen.speed * 3.6;
    let steer = -(want - vt) * 2.4, handbrake = 0, throttle = kmh < Pk.predkosc ? 0.9 : 0.3;
    timer += dt;
    if (faza === 'jazda' && k < course.posts.length && wymagany !== false && (post.s - s - jitter[k]) / Math.max(1, seen.speed) < (Pk.tKop ?? 0.6)) ((faza = 'kopniak'), (timer = 0));
    if (faza === 'kopniak') {
      handbrake = 1;
      steer = post.strona;
      throttle = 0.5;
      if (timer > 0.22) ((faza = 'drift'), (timer = 0));
    } else if (faza === 'drift') {
      steer = post.strona * (Pk.wkret ?? 0.35) - (want - vt) * 0.8;
      throttle = kmh < Pk.predkosc ? 0.62 : 0.5;
    } else if (faza === 'lapanie') {
      steer = -post.strona * (Pk.kontra ?? 0.6) - (want - vt) * 1.5;
      throttle = kmh < Pk.predkosc ? 0.8 : 0.5;
      if (seen.slip < 6 || timer > 0.6) ((faza = 'jazda'), k++, (timer = 0));
    }
    steer = Math.max(-1, Math.min(1, steer + steerNoise.v));
    throttle = Math.max(0, Math.min(1, throttle + gauss(rng) * Pk.gaz));
    if (trace) log.push(`${faza[0]}${k} s${s.toFixed(0)} d${d.toFixed(1)} v${(seen.speed * 3.6).toFixed(0)}`);
    return { throttle, steer, handbrake, brake: 0 };
  }
  return { step, log, get faza() { return faza; }, get k() { return k; } };
}
