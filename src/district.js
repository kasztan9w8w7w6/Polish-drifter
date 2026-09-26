import * as THREE from 'three';
import { loadGltf } from './gltf.js';
import { BALL_RADIUS } from './vehicle.ts';

// The housing estate around and inside the lot, built from Kenney kits (CC0, see CREDITS.md):
//   City Kit Roads (streets, lamps, dumpsters, road works), City Kit Commercial (blocks, pavilions, the shop),
//   City Kit Suburban (trees, fences), Car Kit (parked cars), Starter Kit City Builder (garages).
// The lot is 160 × 160 m, walls at ±80 (track.js). Inside: a street loop at ±60 with lamps, parked cars,
// garages (north), pavilions (south) and the all-night shop "Żappka 24h" (east). Outside: blocks of flats.
// Static obstacles get a collision shell BALL_RADIUS thicker than they look (same as track.js).
const KENNEY = `${import.meta.env.BASE_URL}assets/kenney/`;
const PAD = BALL_RADIUS;
const LOOP = 60; // street loop centre line (m from the middle)
const TILE = 10; // m per road tile

// Lamps use decay 1 (not the physical 2): wide pools of light instead of bright dots
export const lights = { lamp: 22, lampRange: 30, sign: 1.4 };

export async function createDistrict(scene, physics) {
  const cache = new Map();
  const load = (path) => {
    if (!cache.has(path)) cache.set(path, loadGltf(`${KENNEY}${path}.gltf`).then((g) => g.scene).catch((e) => (console.warn('missing model', path, e), null)));
    return cache.get(path);
  };
  const occluders = []; // objects that go see-through when they hide the car
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();

  // Place a model standing on the ground at (x, z), turned by `yaw` (its local +Z then points along
  // (sin yaw, cos yaw)). Size: `scale` (uniform), or `fit: [w, h, d]` (stretch to a footprint and height),
  // or `length` (uniform, longest side). `collide`: add a static box collider around it.
  async function put(path, x, z, { yaw = 0, scale, fit, length, y = 0, collide = false, occlude = collide, tint } = {}) {
    const src = await load(path);
    if (!src) return null;
    if (tint && !src.userData.tinted) {
      src.traverse((o) => o.isMesh && [].concat(o.material).forEach((mat) => mat.color.multiplyScalar(tint)));
      src.userData.tinted = true;
    }
    const m = src.clone();
    box.setFromObject(m).getSize(size);
    if (fit) m.scale.set(fit[0] / size.x, fit[1] / size.y, fit[2] / size.z);
    else if (length) m.scale.setScalar(length / Math.max(size.x, size.z));
    else m.scale.setScalar(scale ?? 1);
    m.updateMatrixWorld(true);
    box.setFromObject(m).getSize(size);
    box.getCenter(centre);
    m.position.set(-centre.x, y - box.min.y, -centre.z); // footprint centred on the holder's origin
    const holder = new THREE.Group();
    holder.add(m);
    holder.position.set(x, 0, z);
    holder.rotation.y = yaw;
    scene.add(holder);
    if (collide) {
      physics.addStaticBox({ x, y: size.y / 2 + y, z }, { x: size.x / 2 + PAD, y: size.y / 2, z: size.z / 2 + PAD }, { rotation: yawQuat(yaw) });
    }
    if (occlude) occluders.push(holder);
    return holder;
  }
  const faceCentre = (x, z) => Math.atan2(-x, -z); // yaw that turns local +Z towards the middle of the lot
  const jobs = [];
  const add = (...args) => jobs.push(put(...args));

  // --- Street loop (flat road tiles on the asphalt; 4 cm kerbs, no collision) ---
  const road = { fit: [TILE, 0.04, TILE], y: 0.005, tint: 0.6 }; // darker, so the tiles sit in the asphalt
  for (let t = -LOOP + TILE; t <= LOOP - TILE; t += TILE) {
    add('roads/road-straight', t, -LOOP, { ...road }); // the tile's road runs along local X
    add('roads/road-straight', t, LOOP, { ...road });
    add('roads/road-straight', -LOOP, t, { ...road, yaw: Math.PI / 2 });
    add('roads/road-straight', LOOP, t, { ...road, yaw: Math.PI / 2 });
  }
  // (the bend tile joins its +X and −Z sides)
  for (const [x, z, yaw] of [[-LOOP, -LOOP, -Math.PI / 2], [LOOP, -LOOP, Math.PI], [LOOP, LOOP, Math.PI / 2], [-LOOP, LOOP, 0]]) add('roads/road-bend', x, z, { ...road, yaw });

  // --- Garages along the north wall (doors facing the lot) + two dumpsters and a fence ---
  for (let i = 0; i < 12; i++) add('city/building-garage', -44 + i * 8, -73, { fit: [7.6, 2.8, 6], collide: true });
  add('roads/dumpster', -54, -71, { scale: 6, yaw: Math.PI / 2, collide: true });
  add('roads/dumpster', -58, -71, { scale: 6, yaw: Math.PI / 2, collide: true });
  for (const x of [52, 60, 68]) add('suburban/fence-1x3', x, -76, { length: 8, collide: true });

  // --- Pavilions / small shops along the south wall, facing the lot ---
  const pav = ['commercial/building-a', 'commercial/building-b', 'commercial/building-c', 'commercial/building-d', 'commercial/building-a'];
  pav.forEach((p, i) => add(p, -50 + i * 20, 73, { length: 9, yaw: Math.PI, collide: true }));

  // --- The all-night shop on the east side ---
  add('commercial/building-h', 72, 26, { length: 12, yaw: -Math.PI / 2, collide: true });
  add('commercial/detail-awning-wide', 65.2, 26, { length: 7, yaw: -Math.PI / 2 });
  const sign = shopSign('Żappka 24h');
  sign.position.set(64.9, 4.2, 26);
  sign.rotation.y = -Math.PI / 2;
  scene.add(sign);
  const shopLight = new THREE.PointLight(0x7cffb0, 12, 20, 1);
  shopLight.position.set(62.5, 3, 26);
  scene.add(shopLight);
  add('roads/dumpster', 70, 38, { scale: 6, yaw: -Math.PI / 2, collide: true });

  // --- Parked cars (Car Kit; local +Z = front) ---
  const cars = ['cars/sedan', 'cars/hatchback-sports', 'cars/suv', 'cars/sedan', 'cars/van'];
  cars.forEach((c, i) => add(c, -44 + i * 3.4, 46, { length: c.endsWith('van') ? 4.8 : 4.3, yaw: 0, collide: true })); // perpendicular row
  add('cars/van', -20, -67.5, { length: 4.8, yaw: Math.PI / 2, collide: true }); // parallel by the garages
  add('cars/delivery', 18, -67.5, { length: 5.2, yaw: -Math.PI / 2, collide: true });
  add('cars/taxi', 63, 14, { length: 4.3, yaw: 0, collide: true }); // waiting by the shop

  // --- Road works around a pothole in the middle (knock-proof barriers) ---
  for (const [x, z, yaw] of [[18, 8, 0], [22, 8, 0], [16, 10, Math.PI / 2], [24, 10, Math.PI / 2]]) add('roads/construction-barrier', x, z, { length: 2, yaw, collide: true });
  add('roads/construction-cone', 20, 12, { length: 0.8 });
  add('roads/road-sign-warning', 14, 6, { scale: 8, yaw: Math.PI / 4, collide: true });

  // --- Trees in the lot corners, blocks of flats and poles outside the walls ---
  for (const [x, z] of [[-72, -72], [72, 70], [-72, 72]]) add('suburban/tree-large', x, z, { scale: 10, collide: true });
  for (const [x, z] of [[-88, 20], [86, -30], [-90, -50], [30, 90], [-30, -92], [92, 60]]) add(Math.random() < 0.5 ? 'suburban/tree-large' : 'suburban/tree-small', x, z, { scale: 10 });
  const blocks = ['commercial/building-skyscraper-a', 'commercial/building-f', 'commercial/building-skyscraper-b', 'commercial/building-j', 'commercial/building-skyscraper-d', 'commercial/building-k', 'commercial/building-skyscraper-e', 'commercial/building-l', 'commercial/building-n'];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    const r = 105 + (i % 3) * 10;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    add(blocks[i % blocks.length], x, z, { scale: 11, yaw: faceCentre(x, z) });
  }
  for (let t = -70; t <= 70; t += 35) add('roads/electricity-pole', t, 88, { scale: 12 });

  // --- Street lamps (City Kit light-square: pole with an arm towards local −Z) ---
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  const bulbGeo = new THREE.BoxGeometry(0.6, 0.15, 0.35);
  const spots = [];
  const LAMP_H = 7;
  function lamp(x, z, yaw, double = false) {
    add(double ? 'roads/light-square-double' : 'roads/light-square', x, z, { fit: undefined, scale: LAMP_H / 0.6, yaw, occlude: true });
    physics.addStaticCylinder({ x, y: 0, z }, 0.2 + PAD, LAMP_H);
    for (const side of double ? [-1, 1] : [-1]) {
      const reach = 2.2; // arm length at this scale
      const hx = x + Math.sin(yaw) * side * reach, hz = z + Math.cos(yaw) * side * reach;
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(hx, LAMP_H - 0.35, hz);
      bulb.rotation.y = yaw;
      const spot = new THREE.SpotLight(0xffa04a, lights.lamp, lights.lampRange, 1.1, 0.7, 1);
      spot.position.set(hx, LAMP_H - 0.4, hz);
      spot.target.position.set(hx + Math.sin(yaw) * side * 1.5, 0, hz + Math.cos(yaw) * side * 1.5);
      scene.add(bulb, spot, spot.target);
      spots.push(spot);
    }
  }
  const EDGE = LOOP + TILE / 2 + 1.5;
  for (const t of [-45, -15, 15, 45]) {
    lamp(t, -EDGE, Math.PI); // north side, arm over the street (+Z)
    lamp(t, EDGE, 0); // south side, arm towards −Z
    lamp(EDGE, t, Math.PI / 2); // east side, arm towards −X
    lamp(-EDGE, t, -Math.PI / 2); // west side, arm towards +X
  }
  for (const [x, z] of [[-30, 5], [30, -5], [0, -38]]) lamp(x, z, 0, true);

  await Promise.all(jobs);

  return {
    occluders,
    applyLights() {
      for (const s of spots) {
        s.intensity = lights.lamp;
        s.distance = lights.lampRange;
      }
      sign.material.color.setScalar(lights.sign);
    },
  };
}

function yawQuat(yaw) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

// Glowing shop sign: canvas texture on an unlit plane (bloom picks it up; colour kept ≤ 1.4 so it doesn't blow out)
function shopSign(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#062d14';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#ffe14a';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = '#9dff6a';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(lights.sign) });
  return new THREE.Mesh(new THREE.PlaneGeometry(8, 2), mat);
}
