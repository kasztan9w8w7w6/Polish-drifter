// The six-post run on the Park (plan-mvp §4: "6 słupków, liczy się liczba czystych wejść 0–6, linia zakładu ≥ 4").
// Logic only (tested in Node, also by the autopilot in test/slupki.test.mjs). A course is a straight line of posts; the
// car weaves between them like a slalom, passing each post on the side it is told (alternating).
//
// A CLEAN entry (czyste wejście) – checked when the car crosses the post's line (perpendicular to the course):
//   1. the right side: the car's centre is on the post's side (strona) and within `okno` m of it;
//   2. sideways: the drift angle (vehicle state.sideSlip) is at least `minKat` degrees somewhere within ±`kątZasieg` m of
//      the line (a pendulum drift has its biggest angle just before or after the post);
//   3. no touch: the car's body (4.3 × 1.7 m box) never came closer than `dotyk` m to the post;
//   4. in order: every post counts once; one crossed the wrong way or missed counts as not clean.
// Verdicts shown on screen: CZYSTE · BEZ POŚLIZGU · POTRĄCONY · ZŁA STRONA · ZA DALEKO.
export const slupkiSettings = {
  odstep: 22, // m between posts (autopilot calibration: test/slupki.test.mjs)
  rozbieg: 10, // m from the start line to the first post
  minKat: 19, // ° drift angle for a clean entry
  katZasieg: 5, // m before / after the post line where the angle counts
  okno: 7.5, // m: how far from the post the car may pass
  dotyk: 0.1, // m: closer than this (body to post) = the post is touched
  limitCzasu: 40, // s for the whole run
  wyjazd: 25, // m off the course sideways = the run is over (the rest don't count)
};

export const WERDYKT = { czyste: 'CZYSTE', katem: 'BEZ POŚLIZGU', dotyk: 'POTRĄCONY', strona: 'ZŁA STRONA', daleko: 'ZA DALEKO' };
const HALF_L = 2.15, HALF_W = 0.85;

// start: { x, z } of the start line, heading in degrees (map convention: 0 = east, 90 = north), n posts
export function createCourse({ x, z, heading = 90, n = 6, odstep = slupkiSettings.odstep, pierwsza = 1, rozbieg = slupkiSettings.rozbieg }) {
  const h = (heading * Math.PI) / 180;
  const f = { x: Math.cos(h), z: -Math.sin(h) }; // forward
  const r = { x: -f.z, z: f.x }; // right (seen from above)
  const posts = Array.from({ length: n }, (_, k) => {
    const s = rozbieg + k * odstep;
    return { k, s, x: x + f.x * s, z: z + f.z * s, strona: k % 2 === 0 ? pierwsza : -pierwsza };
  });
  const end = rozbieg + (n - 1) * odstep + 15;
  return {
    start: { x, z },
    meta: { x: x + f.x * end, z: z + f.z * end },
    heading,
    f,
    r,
    posts,
    length: end,
    // course coordinates: s along, d to the right
    local: (px, pz) => ({ s: (px - x) * f.x + (pz - z) * f.z, d: (px - x) * r.x + (pz - z) * r.z }),
    world: (s, d) => ({ x: x + f.x * s + r.x * d, z: z + f.z * s + r.z * d }),
  };
}

// Distance from a point to the car's body box (centre cx, cz, heading yaw: forward = (cos yaw, −sin yaw))
export function distToBody(px, pz, cx, cz, yaw) {
  const fx = Math.cos(yaw), fz = -Math.sin(yaw);
  const dx = px - cx, dz = pz - cz;
  const a = dx * fx + dz * fz; // along the car
  const b = dx * -fz + dz * fx; // across
  const ea = Math.max(0, Math.abs(a) - HALF_L), eb = Math.max(0, Math.abs(b) - HALF_W);
  return Math.hypot(ea, eb);
}

export function createRun(course, s = slupkiSettings) {
  const st = {
    time: 0,
    next: 0, // index of the post to be crossed next
    wyniki: [], // per post: { czyste, werdykt }
    czyste: 0,
    done: false,
    started: false,
    maxKat: 0, // biggest angle near the next post
    minDyst: Infinity, // closest the body came to the next post
    lastS: null,
  };
  function verdict(post, d) {
    if (st.minDyst < s.dotyk) return 'dotyk';
    if (Math.sign(d) !== post.strona) return 'strona';
    if (Math.abs(d) > s.okno) return 'daleko';
    if (st.maxKat < s.minKat) return 'katem';
    return 'czyste';
  }
  function settle(post, werdykt, d = null) {
    const czyste = werdykt === 'czyste';
    st.wyniki.push({ k: post.k, czyste, werdykt, kat: Math.round(st.maxKat), d: d === null ? null : Math.round(d * 10) / 10, dyst: Math.round(st.minDyst * 100) / 100 });
    if (czyste) st.czyste++;
    st.next++;
    st.maxKat = 0;
    st.minDyst = Infinity;
    if (st.next >= course.posts.length) st.done = true;
    return { typ: 'slupek', k: post.k, czyste, werdykt, napis: WERDYKT[werdykt] };
  }
  return {
    state: st,
    // car: { x, z, yaw (radians, map heading), sideSlip (degrees) }, dt → events [{ typ: 'start' | 'slupek' | 'koniec', … }]
    update(dt, car) {
      const ev = [];
      if (st.done) return ev;
      const { s: along, d } = course.local(car.x, car.z);
      if (!st.started) {
        // the run starts at the start line (crossing it forwards)
        if (st.lastS !== null && st.lastS < 0 && along >= 0) {
          st.started = true;
          ev.push({ typ: 'start' });
        }
        st.lastS = along;
        return ev;
      }
      st.time += dt;
      const post = course.posts[st.next];
      // near the next post: the biggest angle and the closest touch count
      if (Math.abs(along - post.s) <= s.katZasieg) st.maxKat = Math.max(st.maxKat, car.sideSlip ?? 0);
      if (Math.abs(along - post.s) <= 4) st.minDyst = Math.min(st.minDyst, distToBody(post.x, post.z, car.x, car.z, car.yaw));
      if (st.lastS < post.s && along >= post.s) {
        ev.push(settle(post, verdict(post, d), d));
      }
      // left the course, out of time
      if (!st.done && (Math.abs(d) > s.wyjazd || st.time > s.limitCzasu || along < -10)) {
        while (!st.done) ev.push(settle(course.posts[st.next], 'daleko'));
      }
      st.lastS = along;
      if (st.done) ev.push({ typ: 'koniec', czyste: st.czyste, slupki: st.wyniki.map((w) => w.czyste) });
      return ev;
    },
  };
}

// An NPC run for the animation: the path of a car weaving through the posts; for a post that should NOT be clean
// the car goes wide or straight (visibly no slide) – the result comes from the story engine (q_ukryte), this only shows it.
// → sample(t) = { x, z, yaw, slip } for t in 0..duration
export function npcPath(course, slupki, { speed = 11, amp = 3.2 } = {}) {
  const pts = [];
  const step = 0.5;
  const sEnd = course.length;
  const side = (k) => course.posts[k].strona;
  // lateral target at each post: its side × amp (a dirty post: too far out, or straight through without swing)
  const lat = (k) => (slupki[k] ? side(k) * amp : side(k) * (k % 2 ? 9.5 : 0.9));
  for (let s = -3; s <= sEnd; s += step) {
    let d;
    const p = course.posts;
    if (s <= p[0].s) d = lat(0) * Math.max(0, (s + 3) / (p[0].s + 3));
    else if (s >= p[p.length - 1].s) d = lat(p.length - 1) * Math.max(0, 1 - (s - p[p.length - 1].s) / 15);
    else {
      const k = p.findIndex((q, i) => i + 1 < p.length && s >= q.s && s < p[i + 1].s);
      const u = (s - p[k].s) / (p[k + 1].s - p[k].s);
      const e = (1 - Math.cos(Math.PI * u)) / 2;
      d = lat(k) * (1 - e) + lat(k + 1) * e;
    }
    pts.push({ s, d });
  }
  const samples = [];
  let t = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const w = course.world(pts[i].s, pts[i].d);
    const travel = Math.atan2(b.d - a.d, b.s - a.s); // angle of the path to the course axis (right = +)
    // near a clean post the body swings out of the path (a drift): up to ~35°
    const near = course.posts.reduce((m, q) => Math.min(m, Math.abs(q.s - pts[i].s)), Infinity);
    const kq = course.posts.find((q) => Math.abs(q.s - pts[i].s) === near);
    const slip = kq && slupki[kq.k] ? 35 * Math.max(0, 1 - near / 7) * -kq.strona : 0;
    const yaw = (course.heading * Math.PI) / 180 - travel + (slip * Math.PI) / 180;
    samples.push({ t, x: w.x, z: w.z, yaw, slip: Math.abs(slip) });
    t += step / speed;
  }
  return {
    duration: t,
    samples,
    at(time) {
      const i = Math.min(samples.length - 1, Math.max(0, Math.floor(time / (step / speed))));
      return samples[i];
    },
  };
}
