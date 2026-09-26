// Diorama camera: pixel-grid alignment (no shimmering) and the basic framing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, PerspectiveCamera, Quaternion, Vector3, Fog } from 'three';
import { createCameraRig } from '../src/camera.ts';
import { tuning } from '../src/tuning.ts';

const view = { pixelsWide: 240, pixelsHigh: 135 };
const car = (x, z, vx = 0, vz = 0) => ({ position: new Vector3(x, 0.72, z), quaternion: new Quaternion(), velocity: new Vector3(vx, 0, vz), speed: Math.hypot(vx, vz), forwardSpeed: vx });

// Screen position of a world point in low-res pixels
function toPixels(cam, p) {
  const v = p.clone().project(cam);
  return { x: ((v.x + 1) / 2) * view.pixelsWide, y: ((1 - v.y) / 2) * view.pixelsHigh };
}

test('diorama: świat trzyma się siatki pikseli przy ruchu kamery (brak migotania)', (t) => {
  const probe = [new Vector3(3.3, 0, -7.1)];
  let moved = 0, first = null;
  // Across frames: the sub-pixel phase of a fixed world point must stay the same
  const phases = [];
  const dio2 = new OrthographicCamera();
  const rig2 = createCameraRig(new PerspectiveCamera(), dio2, new Fog(0, 100, 45), { ...tuning, dioFollow: 3 });
  for (let i = 0; i < 300; i++) {
    const cam = rig2.update(1 / 60, car(i * 0.113, -i * 0.07, 7, -4), view);
    cam.updateMatrixWorld();
    const q = toPixels(cam, probe[0]);
    first ??= q;
    moved = Math.max(moved, Math.hypot(q.x - first.x, q.y - first.y));
    phases.push([q.x - Math.round(q.x), q.y - Math.round(q.y)]);
  }
  const spread = (k) => Math.max(...phases.slice(-60).map((p) => p[k])) - Math.min(...phases.slice(-60).map((p) => p[k]));
  t.diagnostic(`kamera przesunęła się o ${moved.toFixed(1)} px; rozrzut fazy podpikselowej punktu świata (ostatnie 60 klatek): x ${spread(0).toFixed(4)}, y ${spread(1).toFixed(4)} px`);
  assert.ok(moved > 10, 'kamera się ruszała');
  assert.ok(spread(0) < 0.02 && spread(1) < 0.02, 'punkt świata trafia zawsze w ten sam podpiksel');
});

test('diorama: kamera ~45° w dół, wyprzedza auto w kierunku jazdy, oddala się z prędkością', (t) => {
  const dio = new OrthographicCamera();
  const rig = createCameraRig(new PerspectiveCamera(), dio, null, tuning);
  let cam;
  for (let i = 0; i < 300; i++) cam = rig.update(1 / 60, car(0, 0), view);
  const dir = new Vector3();
  cam.getWorldDirection(dir);
  const pitch = (Math.asin(-dir.y) * 180) / Math.PI;
  const slowH = cam.top - cam.bottom;
  for (let i = 0; i < 400; i++) cam = rig.update(1 / 60, car(i * 0.5, 0, 30, 0), view);
  const fastH = cam.top - cam.bottom;
  // Where does the view centre land relative to the car? (lead along +X)
  const centre = cam.position.clone().addScaledVector(cam.getWorldDirection(dir), 100);
  const lead = centre.x - 399 * 0.5;
  t.diagnostic(`nachylenie ${pitch.toFixed(1)}°, wysokość kadru stoi ${slowH.toFixed(1)} m → 108 km/h ${fastH.toFixed(1)} m, wyprzedzenie ${lead.toFixed(1)} m`);
  assert.ok(pitch > 40 && pitch < 50);
  assert.ok(fastH > slowH * 1.2, 'oddala się przy prędkości');
  assert.ok(lead > 2, 'patrzy przed auto');
  assert.equal(rig.nextMode(), 'Za autem');
  assert.equal(rig.nextMode(), 'Diorama');
});
