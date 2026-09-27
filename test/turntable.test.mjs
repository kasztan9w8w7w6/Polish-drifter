import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTurntable, turntableSettings as S } from '../src/turntable.js';

const fmt = (n, d = 2) => Number(n).toFixed(d);
const spin = (tt, sec) => { let a = 0; for (let i = 0; i < sec * 60; i++) a += tt.update(1 / 60); return a; };

test('garaż: auto-obrót, przeciąganie, bezwładność, powrót auto-obrotu', (t) => {
  const tt = createTurntable();
  const auto = spin(tt, 1);
  // Drag 300 px to the right in 0.3 s, let go straight away (a flick)
  tt.grab(100, 10);
  let dragged = 0;
  for (let i = 1; i <= 18; i++) {
    tt.move(100 + (300 * i) / 18, 10 + i / 60);
    dragged += tt.update(1 / 60);
  }
  tt.release(10 + 18 / 60);
  const flick = tt.speed;
  const coast = spin(tt, 1.5);
  const slowed = tt.speed;
  spin(tt, 3);
  const back = tt.speed;
  // Hold still, then lift: no flick
  tt.grab(0, 20);
  tt.move(50, 20.1);
  tt.update(0.1);
  tt.release(20.6);
  const held = tt.speed;
  t.diagnostic(`auto ${fmt(auto)} rad/s; przeciągnięcie 300 px → ${fmt(dragged)} rad; rzut ${fmt(flick)} rad/s, po 1,5 s ${fmt(slowed)} rad/s (dalszy obrót ${fmt(coast)} rad); po chwili bezczynności ${fmt(back)} rad/s; przytrzymanie i puszczenie ${fmt(held)} rad/s`);
  assert.ok(Math.abs(auto - S.auto) < 0.01);
  assert.ok(Math.abs(dragged - 300 * S.sensitivity) < 1e-6, 'obrót = przeciągnięcie');
  assert.ok(flick > 5, 'rzut zostawia prędkość');
  assert.ok(coast > 1 && slowed < flick / 5, 'bezwładność wygasa');
  assert.ok(Math.abs(back - S.auto) < 0.05, 'auto-obrót wraca');
  assert.equal(held, 0);
});
