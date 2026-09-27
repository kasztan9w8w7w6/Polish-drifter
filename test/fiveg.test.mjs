// v0.6e: 5G as atmosphere – effects only near a mast, stronger closer, each with its own strength, narrator not too often
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFiveG, mastsOf, fivegSettings as S } from '../src/fiveg.js';
import map from '../src/maps/osiedle.json' with { type: 'json' };

function seeded(seed = 7) {
  let a = seed;
  return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function sample(masts, pos, seconds = 30, settings = S) {
  const f = createFiveG(masts, settings, seeded());
  let dips = 0, misfires = 0, glitch = 0, says = 0, prevL = 1, prevT = 1;
  for (let t = 0; t < seconds; t += 1 / 60) {
    const o = f.update(1 / 60, pos);
    if (o.lights < 1 && prevL === 1) dips++;
    if (o.throttle < 1 && prevT === 1) misfires++;
    glitch = Math.max(glitch, o.glitch);
    if (o.say) says++;
    prevL = o.lights;
    prevT = o.throttle;
  }
  return { dips, misfires, glitch, says, level: createFiveG(masts, settings, seeded()).update(0, pos).level };
}

test('5G: maszty na mapie, efekty tylko w promieniu, silniejsze bliżej, bez nich daleko', (t) => {
  const masts = mastsOf(map);
  const m = masts[0];
  const at = sample(masts, { x: m.x + 5, z: m.z }), mid = sample(masts, { x: m.x + 22, z: m.z }), far = sample(masts, { x: m.x + 60, z: m.z + 60 });
  t.diagnostic(`masztów: ${masts.length} (${masts.map((q) => `${q.x},${q.z}`).join(' · ')}); 30 s przy maszcie: siła ${at.level.toFixed(2)}, mrugnięć świateł ${at.dips}, przerw silnika ${at.misfires}, zakłócenia do ${at.glitch.toFixed(2)}; 22 m: siła ${mid.level.toFixed(2)}, mrugnięć ${mid.dips}, przerw ${mid.misfires}; daleko: ${far.dips}/${far.misfires}/${far.glitch}`);
  assert.ok(masts.length >= 2 && masts.length <= 4, 'maszt na Bloku 1 i 1–2 inne');
  assert.ok(at.level > mid.level && mid.level > 0 && far.level === 0);
  assert.ok(at.dips > mid.dips && at.misfires >= mid.misfires && at.glitch > mid.glitch);
  assert.ok(at.dips > 5 && at.misfires > 2, 'przy maszcie wyraźnie');
  assert.deepEqual([far.dips, far.misfires, far.glitch], [0, 0, 0], 'daleko nic');
});

test('5G: siła efektów z ustawień (0 = wyłączone), narrator nie częściej niż co `comment` s', (t) => {
  const masts = [{ x: 0, z: 0 }];
  const off = { ...S, lights: 0, engine: 0, noise: 0, image: 0 };
  const f = createFiveG(masts, off, seeded());
  let changed = false;
  for (let i = 0; i < 1800; i++) {
    const o = f.update(1 / 60, { x: 3, z: 0 });
    if (o.lights < 1 || o.throttle < 1 || o.noise > 0 || o.glitch > 0) changed = true;
  }
  // narrator: drive in and out every 10 s for 3 minutes
  const g = createFiveG(masts, S, seeded());
  let says = 0;
  for (let t = 0; t < 180; t += 1 / 60) if (g.update(1 / 60, { x: t % 20 < 10 ? 5 : 80, z: 0 }).say) says++;
  t.diagnostic(`wszystko na 0: ${changed ? 'coś działa' : 'bez efektów'}; 18 wjazdów w 3 min → komentarzy narratora: ${says} (co najmniej ${S.comment} s przerwy)`);
  assert.equal(changed, false);
  assert.ok(says >= 2 && says <= Math.ceil(180 / S.comment) + 1);
});
