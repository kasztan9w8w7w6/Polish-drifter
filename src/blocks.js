import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Blocks of flats from large concrete panels ("wielka płyta"), built in code from boxes with pixel textures painted on
// canvases (8 px per metre, nearest filtering) – instead of stretched Kenney buildings. From the map file (blocks):
//   { name, x, z, yaw (0 = entrances face south), klatki (stairwells), pietra (floors above the ground floor),
//     balkony (true: balconies on the back), kolor (szary / bez / blekitny / zolty), maszt (a 5G mast on the roof),
//     dlugosc / glebokosc (m, override: a tower block), seed }
// What you see: panels with dark seams, rows of windows (some lit, warm / cold / TV-blue light, curtains), a column of
// glass-block windows over each stairwell, the entrance with a door, a canopy and a lamp above it, a light pool on the
// pavement, balconies with coloured balustrades, lift machine rooms on the roof, and on one block the 5G mast with a
// blinking light. The collider is the block's footprint (plus the entrance steps).
export const BAY = 3.2; // m – one panel / window bay
export const LEVEL = 2.8; // m – one floor
const PLINTH = 0.6;
const PPM = 8; // texture pixels per metre

// Size and entrances of a block (pure: map tests and build-map.py use the same numbers)
export function blockLayout(b) {
  const klatki = b.klatki ?? 3;
  const length = b.dlugosc ?? klatki * 4 * BAY;
  const depth = b.glebokosc ?? 11.2;
  const levels = (b.pietra ?? 4) + 1;
  const height = PLINTH + levels * LEVEL + 0.6;
  const yaw = ((b.yaw ?? 0) * Math.PI) / 180;
  const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) }; // the entrance side
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) }; // local +x
  const step = length / klatki;
  const entrances = Array.from({ length: klatki }, (_, i) => {
    const lx = -length / 2 + step * (i + 0.5);
    const d = depth / 2 + 1.2; // on the pavement in front of the door
    return { x: b.x + right.x * lx + fwd.x * d, z: b.z + right.z * lx + fwd.z * d };
  });
  return { klatki, length, depth, levels, height, yaw, entrances, footprint: { x: b.x, z: b.z, hx: length / 2, hz: depth / 2, yaw } };
}

const COLOURS = {
  szary: [150, 148, 142],
  bez: [164, 152, 132],
  blekitny: [138, 148, 156],
  zolty: [170, 158, 118],
};
const LIGHTS = [[255, 206, 120], [255, 176, 96], [255, 226, 170], [214, 228, 255], [120, 150, 255]];
const RAILS = ['#7a3a2a', '#3a5a7a', '#4a6a3a', '#8a7a3a', '#6a6a6a'];

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (s) => [...String(s)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

// One facade (colour canvas + glow canvas). kind: front (entrances), back (balconies), end (gable)
function facade(L, spec, kind, width, rand, detail = 1) {
  const ppm = PPM * detail;
  const W = Math.max(8, Math.round(width * ppm)), H = Math.round(L.height * ppm);
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  };
  const col = make(), glow = make();
  const g = col.getContext('2d'), e = glow.getContext('2d');
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);
  const base = COLOURS[spec.kolor] ?? COLOURS.szary;
  const rgb = (c, k = 0) => `rgb(${c[0] + k},${c[1] + k},${c[2] + k})`;
  const Y = (m) => H - Math.round(m * ppm); // metres from the ground → canvas y
  const X = (m) => Math.round(m * ppm);
  const rect = (ctx, x, y, w, h, style) => ((ctx.fillStyle = style), ctx.fillRect(X(x), Y(y + h), Math.max(1, X(w)), Math.max(1, Math.round(h * ppm))));
  // Panels (a slightly different shade each, some stained), seams
  const bays = Math.max(1, Math.round(width / BAY));
  const bw = width / bays;
  for (let lv = 0; lv < L.levels; lv++) {
    for (let b = 0; b < bays; b++) {
      const k = Math.round((rand() - 0.5) * 10) - (rand() < 0.08 ? 12 : 0);
      rect(g, b * bw, PLINTH + lv * LEVEL, bw, LEVEL, rgb(base, k));
      if (rand() < 0.2) rect(g, b * bw + bw * 0.2, PLINTH + lv * LEVEL, bw * 0.15, LEVEL * 0.6, rgb(base, k - 10)); // rain streak
    }
  }
  rect(g, 0, 0, width, PLINTH, rgb(base, -45)); // plinth
  rect(g, 0, L.height - 0.6, width, 0.6, rgb(base, 12)); // roof parapet band
  g.fillStyle = rgb(base, -38);
  for (let b = 0; b <= bays; b++) g.fillRect(Math.min(W - 1, X(b * bw)), Y(L.height - 0.6), 1, Math.round((L.height - 0.6 - PLINTH) * ppm));
  for (let lv = 0; lv <= L.levels; lv++) g.fillRect(0, Y(PLINTH + lv * LEVEL), W, 1);

  // Windows
  const lit = spec.lit ?? 0.22;
  const win = (x, y, w, h, stair = false) => {
    rect(g, x - 0.08, y - 0.08, w + 0.16, h + 0.16, stair ? rgb(base, -20) : '#d8d4c8'); // frame
    const on = rand() < (stair ? 0.55 : lit);
    if (stair) {
      // glass blocks: a grid of small squares
      const c = on ? [200, 226, 190] : [52, 62, 66];
      for (let yy = 0; yy < h; yy += 0.25) for (let xx = 0; xx < w; xx += 0.25) rect(g, x + xx, y + yy, 0.2, 0.2, rgb(c, Math.round(rand() * 14 - 7)));
      if (on) rect(e, x, y, w, h, 'rgb(90,110,85)');
      return;
    }
    if (on) {
      const L2 = LIGHTS[Math.floor(rand() * LIGHTS.length)];
      rect(g, x, y, w, h, rgb(L2));
      rect(e, x, y, w, h, rgb(L2.map((v) => v * 0.9)));
      if (rand() < 0.6) {
        // curtains: two darker halves with a gap
        const cur = rgb(L2.map((v) => v * 0.55));
        rect(g, x, y, w * 0.32, h, cur);
        rect(g, x + w * 0.68, y, w * 0.32, h, cur);
        rect(e, x, y, w * 0.32, h, rgb(L2.map((v) => v * 0.3)));
        rect(e, x + w * 0.68, y, w * 0.32, h, rgb(L2.map((v) => v * 0.3)));
      }
    } else {
      rect(g, x, y, w, h, '#1c2230');
      rect(g, x + w * 0.1, y + h * 0.6, w * 0.15, h * 0.3, '#3a4458'); // a glint
    }
    rect(g, x + w / 2 - 0.04, y, 0.08, h, '#c8c4b8'); // mullion
  };
  const klatki = L.klatki;
  const stairX = (i) => (width / klatki) * (i + 0.5); // stairwell axis (front)
  for (let lv = 0; lv < L.levels; lv++) {
    const y0 = PLINTH + lv * LEVEL;
    if (kind === 'end') {
      // gable: mostly blank, a column of small windows (kitchens) in the middle
      if (width > 8 && rand() < 0.9) win(width / 2 - 0.4, y0 + 1.2, 0.8, 0.9);
      continue;
    }
    for (let b = 0; b < bays; b++) {
      const cx = b * bw + bw / 2;
      if (kind === 'front') {
        // skip the bays under a stairwell column
        const nearStair = Array.from({ length: klatki }, (_, i) => Math.abs(cx - stairX(i))).some((d) => d < bw * 0.6);
        if (nearStair) continue;
        win(cx - 0.75, y0 + 0.9, 1.5, 1.4);
      } else {
        // back: every other bay is a balcony (door + narrow window), the rest ordinary windows
        if (spec.balkony && lv > 0 && b % 2 === 0) {
          win(cx - 1.2, y0 + 0.15, 0.8, 2.1);
          win(cx - 0.2, y0 + 0.9, 1.2, 1.3);
        } else win(cx - 0.75, y0 + 0.9, 1.5, 1.4);
      }
    }
  }
  if (kind === 'front') {
    for (let i = 0; i < klatki; i++) {
      const sx = stairX(i);
      // stairwell column: glass blocks at half-floors, from the first landing up
      rect(g, sx - 0.9, PLINTH + LEVEL, 1.8, (L.levels - 1) * LEVEL, rgb(base, -8));
      for (let lv = 1; lv < L.levels; lv++) win(sx - 0.6, PLINTH + lv * LEVEL - 1.1 + LEVEL / 2, 1.2, 1.3, true);
      // entrance: door, the lit window above it, a house-number plate
      rect(g, sx - 0.8, 0.35, 1.6, 2.3, '#2a1e16');
      rect(g, sx - 0.7, 0.4, 0.65, 2.1, '#4a3424');
      rect(g, sx + 0.05, 0.4, 0.65, 2.1, '#4a3424');
      rect(g, sx - 0.6, 1.4, 0.4, 0.6, '#8aa0b0');
      rect(g, sx - 0.7, 2.75, 1.4, 0.35, '#ffd9a0');
      rect(e, sx - 0.7, 2.75, 1.4, 0.35, '#e8b870');
      rect(g, sx + 1.0, 2.3, 0.45, 0.3, '#2a4a8a');
      rect(g, sx + 1.08, 2.36, 0.29, 0.18, '#e8e8e8');
    }
  }
  return { col, glow };
}

const texOf = (canvas) => {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// The block as a THREE.Group (centred on x, z, turned by yaw); `detail` < 1 for far-away scenery
export function buildBlock(spec, { detail = 1 } = {}) {
  const L = blockLayout(spec);
  const rand = rng(spec.seed ?? seedOf(spec.name ?? `${spec.x},${spec.z}`));
  const group = new THREE.Group();
  group.position.set(spec.x, 0, spec.z);
  group.rotation.y = L.yaw;
  const mat = (f) => new THREE.MeshStandardMaterial({ map: texOf(f.col), emissive: 0xffffff, emissiveMap: texOf(f.glow), emissiveIntensity: 1, roughness: 0.95 });
  const front = facade(L, spec, 'front', L.length, rand, detail);
  const back = facade(L, spec, 'back', L.length, rand, detail);
  const endA = facade(L, spec, 'end', L.depth, rand, detail);
  const endB = facade(L, spec, 'end', L.depth, rand, detail);
  const roofCol = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 1 });
  // BoxGeometry faces: +x, −x, +y, −y, +z (front), −z (back)
  const body = new THREE.Mesh(new THREE.BoxGeometry(L.length, L.height, L.depth), [mat(endA), mat(endB), roofCol, roofCol, mat(front), mat(back)]);
  body.position.y = L.height / 2;
  group.add(body);

  // Details merged by material: canopies, steps, balconies, rails, roof boxes
  const parts = { concrete: [], dark: [], rail: [], bulb: [] };
  const box = (list, w, h, d, x, y, z) => list.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  const step = L.length / L.klatki;
  const zf = L.depth / 2;
  for (let i = 0; i < L.klatki; i++) {
    const x = -L.length / 2 + step * (i + 0.5);
    box(parts.concrete, 2.8, 0.14, 1.5, x, 3.05, zf + 0.75); // canopy
    box(parts.dark, 2.8, 0.06, 1.5, x, 2.95, zf + 0.75);
    box(parts.concrete, 2.4, 0.35, 1.1, x, 0.175, zf + 0.55); // steps
    box(parts.bulb, 0.3, 0.12, 0.2, x, 2.86, zf + 0.25); // lamp above the door
  }
  if (spec.balkony) {
    const bays = Math.max(1, Math.round(L.length / BAY));
    const bw = L.length / bays;
    for (let lv = 1; lv < L.levels; lv++) {
      const y = PLINTH + lv * LEVEL;
      for (let b = 0; b < bays; b += 2) {
        const x = -L.length / 2 + b * bw + bw / 2 - 0.2;
        box(parts.concrete, 2.9, 0.16, 1.2, x, y - 0.08, -zf - 0.6); // slab
        box(parts.rail, 2.9, 1.0, 0.08, x, y + 0.5, -zf - 1.16); // balustrade
        box(parts.rail, 0.08, 1.0, 1.2, x - 1.41, y + 0.5, -zf - 0.6);
        box(parts.rail, 0.08, 1.0, 1.2, x + 1.41, y + 0.5, -zf - 0.6);
      }
    }
  }
  if (L.levels > 6) for (let i = 0; i < L.klatki; i++) box(parts.dark, 3.2, 2.4, 4, -L.length / 2 + step * (i + 0.5), L.height + 1.2, 0); // lift machine rooms
  for (let k = 0; k < Math.max(2, L.klatki); k++) box(parts.dark, 0.08, 2.2, 0.08, -L.length / 2 + rand() * L.length, L.height + 1.1, (rand() - 0.5) * L.depth * 0.7); // aerials
  const railColour = RAILS[Math.floor(rand() * RAILS.length)];
  const mats = {
    concrete: new THREE.MeshStandardMaterial({ color: 0x8e8c86, roughness: 0.95 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.95 }),
    rail: new THREE.MeshStandardMaterial({ color: railColour, roughness: 0.9 }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffe0a0 }),
  };
  for (const [k, list] of Object.entries(parts)) if (list.length) group.add(new THREE.Mesh(mergeGeometries(list), mats[k]));

  // Light pools on the pavement in front of the entrances (additive decals: no real lights, they are many)
  if (detail >= 1) {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 16), new THREE.MeshBasicMaterial({ map: poolTexture(), color: 0xffc070, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.material.userData.pixel = true; // (keep it unlit: pixelizeScene leaves it alone)
    pool.rotation.x = -Math.PI / 2;
    for (let i = 0; i < L.klatki; i++) {
      const p = pool.clone();
      p.position.set(-L.length / 2 + step * (i + 0.5), 0.03, zf + 1.6);
      group.add(p);
    }
  }
  // The 5G mast: a lattice tower on the roof, dishes, a blinking red light
  let blink = null;
  if (spec.maszt) {
    const m = [];
    const H0 = L.height, h = 16;
    for (const [sx, sz] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) box(m, 0.14, h, 0.14, sx * (1 - 0.5), H0 + h / 2, sz * 0.5);
    for (let y = 1.5; y < h; y += 1.6) {
      box(m, 1.0, 0.08, 0.08, 0, H0 + y, -0.4);
      box(m, 1.0, 0.08, 0.08, 0, H0 + y, 0.4);
      box(m, 0.08, 0.08, 1.0, -0.4, H0 + y, 0);
      box(m, 0.08, 0.08, 1.0, 0.4, H0 + y, 0);
    }
    for (const [x, z, r] of [[0.9, 0, 0], [-0.9, 0, Math.PI], [0, 0.9, Math.PI / 2]]) {
      const panel = new THREE.BoxGeometry(0.25, 1.6, 0.6).rotateY(r).translate(x, H0 + h - 2, z);
      m.push(panel);
    }
    group.add(new THREE.Mesh(mergeGeometries(m), new THREE.MeshStandardMaterial({ color: 0x9a9a9e, roughness: 0.6 })));
    blink = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    blink.position.set(0, H0 + h + 0.3, 0);
    blink.material.userData.pixel = true;
    group.add(blink);
  }
  return { group, layout: L, blink };
}

let pool = null;
function poolTexture() {
  if (pool) return pool;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5) / 8;
      const a = Math.max(0, 1 - d);
      g.fillStyle = `rgba(255,255,255,${Math.round(a * a * 4) / 4 * 0.5})`; // stepped falloff: pixel-art light pool
      g.fillRect(x, y, 1, 1);
    }
  }
  pool = new THREE.CanvasTexture(c);
  pool.magFilter = pool.minFilter = THREE.NearestFilter;
  return pool;
}
