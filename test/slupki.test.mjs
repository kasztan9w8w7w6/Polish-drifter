// The six-post run (src/fabula/slupki.js): verdicts on made-up tracks, the NPC animation shows the result it was given,
// and the difficulty – an autopilot of three skill levels on the real car (Normalny): the target from plan-mvp §10.6
// is an average player making ≥ 4 clean entries in 50–60 % of tries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCourse, createRun, npcPath, slupkiSettings, distToBody } from '../src/fabula/slupki.js';
import { seria } from './autopilot.mjs';

// drive a straight-ish track through the course: at each post (d, angle) given; heading along the course
function jedz(course, perPost, s = slupkiSettings) {
  const run = createRun(course, s);
  const ev = [];
  const h = (course.heading * Math.PI) / 180;
  for (let along = -15; along < course.length + 5; along += 0.4) {
    // nearest post decides the lateral offset and the angle
    const k = course.posts.reduce((b, q) => (Math.abs(q.s - along) < Math.abs(course.posts[b].s - along) ? q.k : b), 0);
    const [d, kat] = perPost[k];
    const w = course.world(along, d);
    ev.push(...run.update(0.03, { x: w.x, z: w.z, yaw: h, sideSlip: kat }));
  }
  return { run, ev };
}

test('słupki: czyste = właściwa strona, w oknie, w poślizgu ≥ minKat, bez dotknięcia', () => {
  const c = createCourse({ x: 0, z: 0, heading: 0 });
  const good = c.posts.map((p) => [p.strona * 4, 30]);
  assert.equal(jedz(c, good).run.state.czyste, 6);
  const bad = [...good];
  bad[0] = [-4, 30]; // wrong side
  bad[1] = [c.posts[1].strona * 4, 8]; // no slide
  bad[2] = [c.posts[2].strona * 12, 30]; // too far
  bad[3] = [c.posts[3].strona * 0.9, 30]; // body over the post
  const r = jedz(c, bad).run.state;
  assert.deepEqual(r.wyniki.map((w) => w.werdykt), ['strona', 'katem', 'daleko', 'dotyk', 'czyste', 'czyste']);
  assert.equal(r.czyste, 2);
});

test('słupki: odległość od karoserii (prostokąt 4,3 × 1,7 m)', () => {
  assert.equal(distToBody(0, 0, 0, 0, 0), 0);
  assert.ok(Math.abs(distToBody(0, 2, 0, 0, 0) - 1.15) < 1e-9); // beside: 2 − 0.85
  assert.ok(Math.abs(distToBody(3, 0, 0, 0, 0) - 0.85) < 1e-9); // ahead: 3 − 2.15
});

test('słupki: animacja przejazdu NPC pokazuje dokładnie wylosowany wynik', () => {
  const c = createCourse({ x: 60, z: -60, heading: -90 });
  for (const slupki of [[true, true, true, true, true, true], [true, false, true, false, true, false], [false, false, false, true, true, false]]) {
    const path = npcPath(c, slupki);
    const run = createRun(c);
    let t = 0;
    while (t < path.duration && !run.state.done) {
      const p = path.at(t);
      run.update(0.05, { x: p.x, z: p.z, yaw: p.yaw, sideSlip: p.slip });
      t += 0.05;
    }
    assert.deepEqual(run.state.wyniki.map((w) => w.czyste), slupki, JSON.stringify(run.state.wyniki));
  }
});

test('słupki: trudność – autopilot (dobry ≥ 90 %, średni 50–60 % ± szum, słaby ≤ 20 % prób z ≥ 4 czystymi)', async () => {
  const wyniki = {};
  for (const lvl of ['dobry', 'sredni', 'slaby']) wyniki[lvl] = await seria(lvl, 60);
  console.log('słupki', JSON.stringify(Object.fromEntries(Object.entries(wyniki).map(([k, v]) => [k, `${Math.round(v.udzial * 100)}% (śr. ${v.srednio.toFixed(2)})`]))));
  assert.ok(wyniki.dobry.udzial >= 0.9, 'dobry');
  assert.ok(wyniki.sredni.udzial >= 0.45 && wyniki.sredni.udzial <= 0.65, `średni ${wyniki.sredni.udzial}`);
  assert.ok(wyniki.slaby.udzial <= 0.2, 'słaby');
});
