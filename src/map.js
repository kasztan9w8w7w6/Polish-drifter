import * as THREE from 'three';
import { loadGltf } from './gltf.js';
import { createGround } from './ground.js';
import { buildBlock, blockLayout, buildMast } from './blocks.js';

// The housing estate, built from a hand-made map file (src/maps/*.json: models, positions, turns): the ground (streets,
// sidewalks, lots, yards) is one pixel texture (ground.js), the blocks of flats are built in code (blocks.js), the rest
// comes from Kenney kits (CC0, see CREDITS.md): City Kit Roads (lamps, dumpsters), City Kit Commercial (pavilions,
// the shop, the market), City Kit Suburban (trees, fences), Car Kit (parked cars), Starter Kit City Builder (garages).
// Walls, cones and tyre stacks: track.js. The mission points (locker, delivery, shop pad) are in the same file.
//
// Collisions are as big as the objects really are where the car can touch them: each model's collider is the
// footprint of its geometry between BAND_LO and BAND_HI above the ground (the car's body height), so a tree
// collides with its trunk, not its crown, and an awning or a lamp arm above the car doesn't count.
const KENNEY = `${import.meta.env.BASE_URL}assets/kenney/`;
const BAND_LO = 0.1;
const BAND_HI = 2.2;
const DEG = Math.PI / 180;

// Lamps use decay 1 (not the physical 2): wide pools of light instead of bright dots
export const lights = { lamp: 22, lampRange: 30, sign: 1.4 };

export async function createMap(scene, physics, map) {
  const cache = new Map();
  const load = (path) => {
    if (!cache.has(path)) cache.set(path, loadGltf(`${KENNEY}${path}.gltf`).then((g) => g.scene).catch((e) => (console.warn('missing model', path, e), null)));
    return cache.get(path);
  };
  const occluders = []; // objects that go see-through when they hide the car
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();

  // Place a model standing on the ground at (x, z), turned by `yaw` (radians; its local +Z then points along
  // (sin yaw, cos yaw)). Size: `scale` (uniform), or `fit: [w, h, d]` (stretch to a footprint and height),
  // or `length` (uniform, longest side). `collide`: static collider from the model's footprint at body height,
  // hit like `surface` (physics.js SURFACES: how hard the car bounces off it).
  async function put(path, x, z, { yaw = 0, scale, fit, length, y = 0, collide = false, occlude = collide, tint, surface = 'concrete' } = {}) {
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
    m.updateMatrixWorld(true);
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.rotation.y = yaw;
    if (collide) {
      const fp = footprint(m, BAND_LO - y, BAND_HI - y) ?? box.clone().translate(m.position);
      const c = fp.getCenter(new THREE.Vector3());
      const cx = x + c.x * Math.cos(yaw) + c.z * Math.sin(yaw), cz = z - c.x * Math.sin(yaw) + c.z * Math.cos(yaw);
      const h = size.y;
      physics.addStaticBox({ x: cx, y: h / 2 + y, z: cz }, { x: (fp.max.x - fp.min.x) / 2, y: h / 2, z: (fp.max.z - fp.min.z) / 2 }, { rotation: yawQuat(yaw), surface });
    }
    holder.add(m);
    scene.add(holder);
    if (occlude) occluders.push(holder);
    return holder;
  }
  const jobs = [];
  const add = (...args) => jobs.push(put(...args));

  // --- Ground: streets, sidewalks, lots, yards (one pixel texture, ground.js) ---
  if (map.streets) createGround(scene, map);

  // --- Blocks of flats (wielka płyta, blocks.js): collider = footprint + the entrance steps ---
  const blinks = [];
  for (const b of map.blocks ?? []) {
    const far = b.collide === false;
    const { group, layout, blink } = buildBlock(b, { detail: far ? 0.5 : 1 });
    scene.add(group);
    if (blink) blinks.push(blink);
    if (far) continue;
    occluders.push(group);
    const f = layout.footprint;
    physics.addStaticBox({ x: f.x, y: layout.height / 2, z: f.z }, { x: f.hx, y: layout.height / 2, z: f.hz }, { rotation: yawQuat(f.yaw), surface: 'concrete' });
    for (const e of blockLayout(b).entrances) {
      // steps: 1.1 m out from the wall, the entrance point is 1.2 m out → the steps sit 0.65 m back from it
      const sx = e.x - Math.sin(f.yaw) * 0.65, sz = e.z - Math.cos(f.yaw) * 0.65;
      physics.addStaticBox({ x: sx, y: 0.18, z: sz }, { x: 1.2, y: 0.18, z: 0.55 }, { rotation: yawQuat(f.yaw), surface: 'concrete' });
    }
  }

  // --- Objects from the map file ---
  for (const o of map.objects) {
    const { count = 1, dx = 0, dz = 0 } = o.repeat ?? {};
    for (let i = 0; i < count; i++) {
      add(o.model, o.x + i * dx, o.z + i * dz, {
        yaw: (o.yaw ?? 0) * DEG,
        scale: o.scale,
        fit: o.fit,
        length: o.length,
        y: o.y ?? 0,
        collide: o.collide ?? true,
        occlude: o.occlude ?? false,
        surface: o.surface,
      });
    }
  }

  // --- Free-standing 5G masts (fiveg.js makes them felt): a tall lattice tower on a concrete base ---
  for (const m of map.masty ?? []) {
    const { group, blink } = buildMast(m.h ?? 26, 1.6);
    group.position.set(m.x, 0, m.z);
    scene.add(group);
    blinks.push(blink);
    physics.addStaticBox({ x: m.x, y: 0.6, z: m.z }, { x: 1.2, y: 0.6, z: 1.2 }, { surface: 'metal' });
  }

  // --- Glowing signs (Żappka, Supersam) ---
  const signs = (map.signs ?? []).map((sg) => {
    const m = shopSign(sg.text, sg.colors);
    m.position.set(...sg.at);
    m.rotation.y = (sg.yaw ?? 0) * DEG;
    scene.add(m);
    return m;
  });
  // --- Own-geometry props: benches, carpet-beating frames, sandbox, swing, bus stop ---
  for (const p of map.props ?? []) {
    const { group, half, surface } = prop(p.type, p.name);
    const yaw = (p.yaw ?? 0) * DEG;
    group.position.set(p.x, 0, p.z);
    group.rotation.y = yaw;
    scene.add(group);
    physics.addStaticBox({ x: p.x, y: half.y, z: p.z }, half, { rotation: yawQuat(yaw), surface });
  }

  // --- The all-night shop's light and save pad (the building is an object in the map) ---
  let pad = null;
  if (map.shop) {
    const shopLight = new THREE.PointLight(0x7cffb0, 12, 20, 1);
    shopLight.position.set(...map.shop.light);
    scene.add(shopLight);
    // The save spot in front of the entrance (main.js: stop on it → saved, the shop): a softly glowing, pulsing frame on the asphalt
    pad = safePad(map.shop.pad);
    scene.add(pad);
  }

  // --- Parcel locker (own geometry, fictional brand) ---
  if (map.locker) {
    const l = map.locker;
    const locker = parcelLocker(l.name);
    locker.position.set(l.x, 0, l.z);
    locker.rotation.y = l.yaw * DEG;
    scene.add(locker);
    physics.addStaticBox({ x: l.x, y: 1.1, z: l.z }, { x: LOCKER.w / 2, y: 1.1, z: LOCKER.d / 2 }, { rotation: yawQuat(l.yaw * DEG), surface: 'metal' });
  }

  // --- Fuel station (own geometry, in the style of an old CPN, fictional name): a canopy on posts with fluorescent
  // tubes, two pump islands, a kiosk. The car stops next to the pumps (map.points.stacja) and fills up (main.js).
  if (map.station) {
    const st = map.station;
    const g = new THREE.Group();
    g.position.set(st.x, 0, st.z);
    const concrete = new THREE.MeshStandardMaterial({ color: 0x8a8880, roughness: 0.95 });
    const white = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.8 });
    const red = new THREE.MeshStandardMaterial({ color: 0xa02a1e, roughness: 0.7 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.3, emissive: 0x3a4a30, emissiveIntensity: 0.6 });
    const tube = new THREE.MeshBasicMaterial({ color: 0xe8fff0 });
    const box = (w, h, d, m, x, y, z) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      g.add(b);
      return b;
    };
    box(20, 0.5, 10, white, 0, 4.75, 0); // canopy
    box(20.2, 0.6, 0.3, red, 0, 4.7, -5.1); // red fascia
    box(20.2, 0.6, 0.3, red, 0, 4.7, 5.1);
    for (const x of [-7, -3, 3, 7]) box(0.15, 0.08, 6, tube, x, 4.47, 0); // fluorescent tubes
    for (const ix of [-5, 5]) {
      box(4.4, 0.2, 1.2, concrete, ix, 0.1, 0); // island
      for (const px of [-1.1, 1.1]) {
        box(0.7, 1.7, 0.5, white, ix + px, 1.05, 0); // pump
        box(0.5, 0.35, 0.05, glass, ix + px, 1.45, -0.27);
        box(0.08, 0.5, 0.08, red, ix + px + 0.3, 1.2, -0.3); // nozzle
      }
      box(0.3, 4.3, 0.3, white, ix - 2, 2.35, 0); // posts
      box(0.3, 4.3, 0.3, white, ix + 2, 2.35, 0);
      physics.addStaticBox({ x: st.x + ix, y: 0.9, z: st.z }, { x: 2.2, y: 0.9, z: 0.6 }, { surface: 'metal' });
    }
    box(8, 3.2, 5, white, 15, 1.6, 4.5); // kiosk
    box(4, 1.4, 0.05, glass, 14, 1.7, 1.98);
    box(8.2, 0.5, 5.2, red, 15, 3.4, 4.5);
    physics.addStaticBox({ x: st.x + 15, y: 1.6, z: st.z + 4.5 }, { x: 4, y: 1.6, z: 2.5 }, { surface: 'concrete' });
    const sign = shopSign(st.name ?? 'KOMETA', ['#1a0606', '#ffd24a', '#ff6a3a']);
    sign.position.set(0, 5.6, -5.3);
    sign.rotation.y = Math.PI; // facing the main street (north)
    sign.scale.setScalar(0.75);
    g.add(sign);
    const back = sign.clone(); // (and on the other side: the diorama camera looks from the south)
    back.position.z = 5.3;
    back.rotation.y = 0;
    g.add(back);
    signs.push(sign, back);
    const light = new THREE.PointLight(0xe8fff0, 16, 22, 1);
    light.position.set(0, 4.2, 0);
    g.add(light);
    scene.add(g);
    occluders.push(g);
  }

  // --- Potholes (visual only) and painted parking bays ---
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x5a5a58, roughness: 1 });
  map.potholes.forEach(([x, z, r], i) => {
    const rim = new THREE.Mesh(blob(r * 1.25, i * 7 + 1), rimMat);
    const hole = new THREE.Mesh(blob(r, i * 7 + 3), holeMat);
    rim.position.set(x, 0.055, z);
    hole.position.set(x, 0.06, z);
    scene.add(rim, hole);
  });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xd8d8c8, roughness: 0.9 });
  for (const p of map.parking) scene.add(parkingLines(p, lineMat));

  // --- Street lamps (City Kit light-square: pole with an arm towards local −Z) ---
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  const bulbGeo = new THREE.BoxGeometry(0.6, 0.15, 0.35);
  const spots = [];
  const LAMP_H = 7;
  function lamp(x, z, yaw, double = false) {
    add(double ? 'roads/light-square-double' : 'roads/light-square', x, z, { scale: LAMP_H / 0.6, yaw, collide: true, occlude: true, surface: 'metal' });
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
  for (const [x, z, yaw, double] of map.lamps) lamp(x, z, yaw * DEG, double);

  await Promise.all(jobs);

  return {
    occluders,
    // time (s), charging: brighter and faster while the battery fills up
    update(time, charging = false) {
      for (const b of blinks) b.visible = time % 1.6 < 0.5; // the mast's red light
      if (!pad) return;
      const k = charging ? 0.75 + 0.25 * Math.sin(time * 9) : 0.45 + 0.2 * Math.sin(time * 2.2);
      pad.children.forEach((m) => (m.material.opacity = k * m.userData.alpha));
    },
    // Performance (touch devices): only every n-th street lamp keeps its light (the bulbs still glow)
    setLampShare(n) {
      spots.forEach((s, i) => (s.visible = i % n === 0));
    },
    applyLights() {
      for (const s of spots) {
        s.intensity = lights.lamp;
        s.distance = lights.lampRange;
      }
      for (const sg of signs) sg.material.color.setScalar(lights.sign);
    },
  };
}

// Bounding box (in the model's own frame) of its geometry between heights lo and hi: every triangle is clipped
// to that slab, so tall walls count with their full width and a crown or an awning above the slab doesn't count.
function footprint(model, lo, hi) {
  const out = new THREE.Box3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    const at = (i, v) => v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld);
    for (let i = 0; i < n; i += 3) {
      at(i, a);
      at(i + 1, b);
      at(i + 2, c);
      if (Math.max(a.y, b.y, c.y) < lo || Math.min(a.y, b.y, c.y) > hi) continue;
      for (const p of clipSlab([a.clone(), b.clone(), c.clone()], lo, hi)) out.expandByPoint(p);
    }
  });
  return out.isEmpty() ? null : out;
}

// Sutherland–Hodgman against y ≥ lo and y ≤ hi
function clipSlab(poly, lo, hi) {
  const clip = (pts, keep, edge) => {
    const res = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const pin = keep(p.y), qin = keep(q.y);
      if (pin) res.push(p);
      if (pin !== qin) res.push(p.clone().lerp(q, (edge - p.y) / (q.y - p.y)));
    }
    return res;
  };
  return clip(clip(poly, (y) => y >= lo, lo), (y) => y <= hi, hi);
}

// Small things built from boxes (no model needed): returns the group, the collider half extents and its surface
export function prop(type, name = '') {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const box = (w, h, d, x, y, z, m) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    g.add(b);
    return b;
  };
  const steel = mat(0x6e7478), paint = mat(0x3d6b4a), wood = mat(0x7a5634), red = mat(0x9c3a2a), yellow = mat(0xd8b23a);
  switch (type) {
    case 'lawka': // park bench: concrete legs, wooden slats
      for (const x of [-0.75, 0.75]) box(0.12, 0.45, 0.45, x, 0.22, 0, mat(0x8a8a86));
      box(1.8, 0.07, 0.45, 0, 0.47, 0, wood);
      box(1.8, 0.35, 0.06, 0, 0.75, -0.2, wood);
      return { group: g, half: { x: 0.9, y: 0.45, z: 0.3 }, surface: 'tree' };
    case 'trzepak': // carpet-beating frame: two posts, two bars
      for (const x of [-1.25, 1.25]) box(0.08, 1.6, 0.08, x, 0.8, 0, paint);
      box(2.6, 0.07, 0.07, 0, 1.55, 0, paint);
      box(2.6, 0.07, 0.07, 0, 1.05, 0, paint);
      return { group: g, half: { x: 1.3, y: 0.8, z: 0.08 }, surface: 'metal' };
    case 'piaskownica': // sandbox: wooden frame with sand
      box(3, 0.25, 3, 0, 0.12, 0, wood);
      box(2.7, 0.26, 2.7, 0, 0.13, 0, mat(0xc9b27a));
      return { group: g, half: { x: 1.5, y: 0.15, z: 1.5 }, surface: 'tree' };
    case 'hustawka': // swing: A-frame of pipes, two seats on chains
      for (const x of [-1.5, 1.5]) for (const z of [-0.7, 0.7]) {
        const leg = box(0.07, 2.4, 0.07, x, 1.15, z * 0.5, red);
        leg.rotation.x = z > 0 ? 0.3 : -0.3;
      }
      box(3.1, 0.08, 0.08, 0, 2.3, 0, red);
      for (const x of [-0.6, 0.6]) {
        for (const dx of [-0.2, 0.2]) box(0.02, 1.7, 0.02, x + dx, 1.4, 0, steel);
        box(0.5, 0.05, 0.22, x, 0.55, 0, yellow);
      }
      return { group: g, half: { x: 1.6, y: 1.2, z: 0.9 }, surface: 'metal' };
    case 'przystanek': { // bus shelter: roof, back and side glass, bench, sign pole
      const glass = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, transparent: true, opacity: 0.35, roughness: 0.2 });
      for (const x of [-1.9, 1.9]) for (const z of [-0.7, 0.7]) box(0.08, 2.4, 0.08, x, 1.2, z, steel);
      box(4.1, 0.1, 1.7, 0, 2.45, 0, steel);
      box(3.8, 1.9, 0.03, 0, 1.3, -0.7, glass);
      for (const x of [-1.9, 1.9]) box(0.03, 1.9, 1.3, x, 1.3, 0, glass);
      box(2.4, 0.07, 0.4, 0, 0.48, -0.45, wood);
      box(0.08, 2.8, 0.08, 2.4, 1.4, 0.8, steel);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ map: busStopSign(name), side: THREE.DoubleSide }));
      sign.position.set(2.4, 2.6, 0.8);
      g.add(sign);
      return { group: g, half: { x: 2.05, y: 1.25, z: 0.85 }, surface: 'metal' };
    }
    default:
      console.warn('unknown prop', type);
      return { group: g, half: { x: 0.5, y: 0.5, z: 0.5 }, surface: 'concrete' };
  }
}

function busStopSign(name) {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8c22a';
  ctx.fillRect(0, 0, 96, 64);
  ctx.fillStyle = '#1c5a2a';
  ctx.fillRect(4, 4, 88, 56);
  ctx.fillStyle = '#e8c22a';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('A', 48, 30);
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText(name.slice(0, 20), 48, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function yawQuat(yaw) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

// Irregular flat blob (pothole), deterministic per seed
function blob(r, seed) {
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const shape = new THREE.Shape();
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const k = r * (0.7 + rnd() * 0.5);
    i ? shape.lineTo(Math.cos(a) * k, Math.sin(a) * k * 0.8) : shape.moveTo(Math.cos(a) * k, Math.sin(a) * k * 0.8);
  }
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  return g;
}

// Painted lines: a row of bays (`bays` × `bayWidth`, `depth` deep, open towards local +Z) or a `frame` [w, d]
function parkingLines(p, mat) {
  const g = new THREE.Group();
  const W = 0.14;
  const line = (x, z, lx, lz) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    g.add(m);
  };
  if (p.frame) {
    const [w, d] = p.frame;
    line(0, -d / 2, w, W);
    line(0, d / 2, w, W);
    line(-w / 2, 0, W, d);
    line(w / 2, 0, W, d);
  } else {
    const w = p.bays * p.bayWidth;
    line(0, -p.depth / 2, w, W); // back line
    for (let i = 0; i <= p.bays; i++) line(-w / 2 + i * p.bayWidth, 0, W, p.depth);
  }
  g.position.set(p.x, 0, p.z);
  g.rotation.y = (p.yaw ?? 0) * DEG;
  return g;
}

// Parcel locker: a grey cabinet with a grid of doors and a screen, fictional brand on top
export const LOCKER = { w: 3.2, h: 2.2, d: 0.8 };
function parcelLocker(name) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 176;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8c9296';
  ctx.fillRect(0, 0, 256, 176);
  ctx.fillStyle = '#e0a020';
  ctx.fillRect(0, 0, 256, 26);
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 20);
  ctx.strokeStyle = '#4a4e52';
  ctx.lineWidth = 2;
  for (let col = 0; col < 6; col++) for (let row = 0; row < 4; row++) ctx.strokeRect(6 + col * 41, 32 + row * 35, 38, 32);
  ctx.fillStyle = '#6ad0ff';
  ctx.fillRect(95, 70, 30, 22); // screen
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const grey = new THREE.MeshStandardMaterial({ color: 0x8c9296, roughness: 0.7 });
  const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: 0x223038, emissiveMap: tex, emissiveIntensity: 0.4 });
  // Box faces: +X, −X, +Y, −Y, +Z (front), −Z
  const body = new THREE.Mesh(new THREE.BoxGeometry(LOCKER.w, LOCKER.h, LOCKER.d), [grey, grey, grey, grey, front, grey]);
  body.position.y = LOCKER.h / 2;
  const g = new THREE.Group();
  g.add(body);
  return g;
}

// Glowing pad: a filled rectangle plus a brighter border (unlit, additive, so the bloom picks it up)
function safePad({ x, z, w, d }) {
  const g = new THREE.Group();
  const mat = (alpha) => new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: alpha, blending: THREE.AdditiveBlending, depthWrite: false });
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(0.25));
  fill.userData.alpha = 0.25;
  g.add(fill);
  const B = 0.25;
  for (const [px, pz, lx, lz] of [[0, -d / 2, w, B], [0, d / 2, w, B], [-w / 2, 0, B, d], [w / 2, 0, B, d]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), mat(1));
    m.position.set(px, 0.001, pz);
    m.userData.alpha = 1;
    g.add(m);
  }
  g.children.forEach((m) => (m.rotation.x = -Math.PI / 2));
  g.position.set(x, 0.07, z);
  return g;
}

// Glowing shop sign: canvas texture on an unlit plane (bloom picks it up; colour kept ≤ 1.4 so it doesn't blow out)
function shopSign(text, [bg, frame, ink] = ['#062d14', '#ffe14a', '#9dff6a']) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = frame;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = ink;
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(lights.sign) });
  return new THREE.Mesh(new THREE.PlaneGeometry(8, 2), mat);
}
