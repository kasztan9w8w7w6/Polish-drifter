// The full-screen map (v0.8 part 6, src/fabula/mapaUI.js): no DOM canvas rendering to test, but the module can't be
// imported outside a browser (it touches `document` at module scope). This checks the pure geometry it relies on
// instead: the world→screen projection formula, reproduced here from mapaUI.js's `project()`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

function project(view, pan, zoomM, x, z) {
  const scale = view.h / (2 * zoomM);
  return { x: view.w / 2 + (x - pan.x) * scale, y: view.h / 2 + (z - pan.z) * scale };
}

test('mapa: the car (at the pan centre) always projects to the middle of the screen', () => {
  const view = { w: 800, h: 400 };
  for (const zoomM of [60, 260, 1400]) {
    const p = project(view, { x: 123, z: -456 }, zoomM, 123, -456);
    assert.ok(Math.abs(p.x - view.w / 2) < 1e-9 && Math.abs(p.y - view.h / 2) < 1e-9);
  }
});

test('mapa: a point one zoomM north (−z) of the pan centre lands at the top edge', () => {
  const view = { w: 800, h: 400 };
  const zoomM = 260;
  const p = project(view, { x: 0, z: 0 }, zoomM, 0, -zoomM);
  assert.ok(Math.abs(p.y - 0) < 1e-9, `top edge, got y=${p.y}`);
  const q = project(view, { x: 0, z: 0 }, zoomM, 0, zoomM);
  assert.ok(Math.abs(q.y - view.h) < 1e-9, `bottom edge, got y=${q.y}`);
});

test('mapa: panning moves the whole picture, zooming in spreads points further apart', () => {
  const view = { w: 800, h: 400 };
  const a = project(view, { x: 0, z: 0 }, 260, 50, 50);
  const b = project(view, { x: 100, z: 0 }, 260, 50, 50); // panned +100 in x: the point moves left on screen
  assert.ok(b.x < a.x);
  const near = project(view, { x: 0, z: 0 }, 60, 50, 0);
  const far = project(view, { x: 0, z: 0 }, 1400, 50, 0);
  assert.ok(Math.abs(near.x - view.w / 2) > Math.abs(far.x - view.w / 2), 'zoomed in (small zoomM) = more spread out');
});
