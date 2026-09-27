// Mobile test controls: detection by capabilities, several fingers at once, keyboard-like ramps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTouchDevice, createTouchState } from '../src/touchstate.js';

const DT = 1 / 60;
const fmt = (n, d = 2) => Number(n).toFixed(d);
const device = ({ coarse = false, hover = true, points = 0, search = '', ua = '' }) => ({
  location: { search },
  navigator: { maxTouchPoints: points, userAgent: ua },
  matchMedia: (q) => ({ matches: q === '(pointer: coarse)' ? coarse : q === '(hover: none)' ? !hover : false }),
});

test('dotyk: wykrywany po możliwościach, nie po user-agencie', (t) => {
  const cases = {
    'komputer z myszą': [device({}), false],
    'laptop z ekranem dotykowym (mysz główna)': [device({ points: 10 }), false],
    'telefon (palec)': [device({ coarse: true, hover: false, points: 5 }), true],
    'tablet bez hover': [device({ points: 5, hover: false }), true],
    'komputer udający iPhone w user-agencie': [device({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }), false],
    'wymuszone ?touch=1': [device({ search: '?touch=1' }), true],
    'wymuszone ?touch=0 na telefonie': [device({ coarse: true, hover: false, points: 5, search: '?touch=0' }), false],
  };
  for (const [name, [win, want]] of Object.entries(cases)) assert.equal(isTouchDevice(win), want, name);
  t.diagnostic(`${Object.keys(cases).length} przypadków zgodnych`);
});

test('dotyk: kilka palców naraz (gaz + ręczny + skręt), przyciski narastają jak klawiatura', (t) => {
  const s = createTouchState();
  s.press('gas', 1);
  s.press('handbrake', 2);
  s.press('left', 3);
  let tGas = null, tSteer = null, v;
  for (let i = 1; i <= 60; i++) {
    v = s.read(DT);
    if (tGas === null && v.throttle >= 1) tGas = i * DT;
    if (tSteer === null && v.steer >= 1) tSteer = i * DT;
  }
  t.diagnostic(`gaz 0→1 w ${fmt(tGas)} s, skręt 0→1 w ${fmt(tSteer)} s, ręczny od razu, wszystko naraz: ${JSON.stringify(v)}`);
  assert.deepEqual(v, { throttle: 1, brake: 0, steer: 1, handbrake: 1 });
  assert.ok(tSteer > 0.3 && tSteer < 0.5, 'skręt narasta jak na klawiaturze');
  // Two fingers on the gas: lifting one keeps it pressed
  s.press('gas', 4);
  s.release('gas', 1);
  assert.equal(s.isDown('gas'), true);
  // A cancelled finger lets go of what it held
  s.releasePointer(2);
  s.releasePointer(4);
  s.release('left', 3);
  for (let i = 0; i < 60; i++) v = s.read(DT);
  assert.deepEqual(v, { throttle: 0, brake: 0, steer: 0, handbrake: 0 });
});

test('dotyk: joystick daje skręt analogowo, po puszczeniu wraca do przycisków', () => {
  const s = createTouchState();
  s.setStick(-0.4);
  assert.equal(s.read(DT).steer, -0.4);
  s.setStick(null);
  let v;
  for (let i = 0; i < 30; i++) v = s.read(DT);
  assert.equal(v.steer, 0);
  s.press('gas', 1);
  s.setStick(0.8);
  s.releaseAll();
  for (let i = 0; i < 60; i++) v = s.read(DT);
  assert.deepEqual(v, { throttle: 0, brake: 0, steer: 0, handbrake: 0 }, 'aplikacja w tle: wszystko puszczone');
});
