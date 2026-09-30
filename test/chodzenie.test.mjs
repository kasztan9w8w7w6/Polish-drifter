// v0.8 cz. 2/9: the walk cycle fix in src/npc.js (part of the "ludzie lewitują" fix, docs/wdrozenie-fabuly.md §8).
// figure()/animate() don't touch `document`, so they run fine in Node (createPeople() does, but isn't needed here).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { figure, animate } from '../src/npc.js';

function npc(speed) {
  const fig = figure({});
  return { fig, who: { idle: 'stoi' }, root: { position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 } }, cheer: 0, speed };
}

test('chodzenie: nogi stoją nieruchomo bez ruchu (prędkość 0)', () => {
  const n = npc(0);
  animate(n, 3.7, 1 / 60, { x: 0, z: 0 }, false);
  for (const { thigh, shin } of n.fig.legs) {
    assert.equal(thigh.rotation.x, 0);
    assert.equal(shin.rotation.x, 0);
  }
});

test('chodzenie: nogi się poruszają w ruchu, na przemian (lewa i prawa w przeciwfazie)', () => {
  const n = npc(1.2); // m/s, chód
  let sawThigh = false, sawKnee = false, everDiffered = false;
  for (let i = 0; i < 60; i++) {
    animate(n, i / 20, 1 / 20, { x: 0, z: 0 }, false);
    const [l, r] = n.fig.legs;
    if (l.thigh.rotation.x !== 0 || r.thigh.rotation.x !== 0) sawThigh = true;
    if (l.shin.rotation.x !== 0 || r.shin.rotation.x !== 0) sawKnee = true;
    if (Math.abs(l.thigh.rotation.x - r.thigh.rotation.x) > 0.05) everDiffered = true;
  }
  assert.ok(sawThigh, 'biodro się rusza');
  assert.ok(sawKnee, 'kolano się zgina');
  assert.ok(everDiffered, 'lewa i prawa noga nie poruszają się identycznie (przeciwfaza)');
});

test('chodzenie: amplituda biodra rośnie z prędkością (do granicy), nie zależy od prędkości powyżej niej', () => {
  const sample = (speed) => {
    const n = npc(speed);
    let maxAbs = 0;
    for (let i = 0; i < 40; i++) {
      animate(n, i / 20, 1 / 20, { x: 0, z: 0 }, false);
      maxAbs = Math.max(maxAbs, Math.abs(n.fig.legs[0].thigh.rotation.x));
    }
    return maxAbs;
  };
  const slow = sample(0.3), fast = sample(1.3), capped = sample(5);
  assert.ok(fast > slow, 'szybszy chód = większa amplituda biodra');
  assert.ok(Math.abs(fast - capped) < 0.05, 'amplituda nie rośnie bez końca powyżej progu prędkości');
});
