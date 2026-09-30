import * as THREE from 'three';
import { loadGltf } from '../gltf.js';
import { prop } from '../map.js';
import { createPeople, figure } from '../npc.js';
import { createCourse } from './slupki.js';

// The world of "W nocy robota" (greybox, docs/wdrozenie-fabuly.md §2), built on top of the estate from
// src/fabula/mapa.json: the Park on the old lot (tanks, lorries, the kombi, the BMW, roller skaters, six posts), Mirek's
// yard by the garages, traffic lights and a flyover in town, the closed road east (towards the lagoon), the road out
// west (forest and meadows, potholes, the bus stop in the field with Kamil's car on hazards) and the village (a yard
// with a lamp, a henhouse, a house with a TV). Plain boxes and Kenney models (CC0) for now – the graphics come later.
const DEG = Math.PI / 180;
const BASE = import.meta.env?.BASE_URL ?? '/';

// The estate map as the story needs it (a copy): no 5G masts, the shop's sign without a real brand, a gap in the west
// fence for the road out, no decoration blocks on that road, no parked cars where the six-post run starts, no old NPCs
export function przygotujMape(osiedle, fab) {
  const m = structuredClone(osiedle);
  m.signs = m.signs.map((s) => ({ ...s, text: fab.szyldy?.[s.text] ?? s.text }));
  m.blocks = m.blocks.map((b) => ({ ...b, maszt: false })).filter((b) => !(b.collide === false && b.x < -100 && b.z > -15 && b.z < 115));
  m.masty = [];
  m.npcs = [];
  const gap = fab.wylotowka.os[0][1];
  m.walls = m.walls.flatMap((w) => {
    if (w[0] !== -100 || w[3] < 100) return [w];
    const top = w[1] - w[3] / 2, bottom = w[1] + w[3] / 2;
    return [[-100, (top + gap - 9) / 2, 1, gap - 9 - top], [-100, (gap + 9 + bottom) / 2, 1, bottom - gap - 9]];
  });
  m.objects = m.objects.filter((o) => !(o.x > 40 && o.x < 100 && o.z < -60));
  return m;
}

export async function createSwiat({ scene, physics, map, fab, postacie }) {
  const cache = new Map();
  const model = (path) => {
    if (!cache.has(path)) cache.set(path, loadGltf(`${BASE}assets/kenney/${path}.gltf`).then((g) => g.scene).catch(() => null));
    return cache.get(path);
  };
  const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...extra });
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
  const box = (parent, w, h, d, x, y, z, m) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    parent.add(b);
    return b;
  };
  const solid = (x, z, hx, hy, hz, yaw = 0, surface = 'concrete') =>
    physics.addStaticBox({ x, y: hy, z }, { x: hx, y: hy, z: hz }, { rotation: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, surface });

  // ---------- Cars (Kenney Car Kit): parked scenery and the NPC cars that drive the posts ----------
  async function auto(spec) {
    const root = new THREE.Group();
    scene.add(root);
    const len = spec.length ?? 4.4;
    const src = await model(spec.model);
    if (src) {
      const m = src.clone();
      if (spec.tint && spec.tint !== 1) {
        m.traverse((o) => {
          if (!o.isMesh) return;
          o.material = [].concat(o.material).map((q) => {
            const c = q.clone();
            c.color?.multiplyScalar(spec.tint);
            return c;
          });
          if (o.material.length === 1) o.material = o.material[0];
        });
      }
      const b = new THREE.Box3().setFromObject(m);
      const size = b.getSize(new THREE.Vector3());
      m.scale.setScalar(len / Math.max(size.x, size.z));
      b.setFromObject(m);
      m.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      root.add(m);
    } else box(root, 1.8, 1.4, len, 0, 0.7, 0, mat(0x6a6a70));
    // tail-lights (dim) and headlight glass
    const tail = glow(0x5a0a08);
    for (const s of [-0.62, 0.62]) box(root, 0.3, 0.12, 0.05, s, 0.75, -len / 2 - 0.02, tail);
    const a = { root, spec, hazard: null, trunk: null };
    if (spec.awaryjne) {
      const m = glow(0x2a1400);
      a.hazard = { m, light: new THREE.PointLight(0xff9a1a, 0, 14, 1) };
      for (const [x, z] of [[-0.8, len / 2], [0.8, len / 2], [-0.8, -len / 2], [0.8, -len / 2]]) box(root, 0.22, 0.14, 0.12, x, 0.72, z, m);
      a.hazard.light.position.set(0, 1.4, 0);
      root.add(a.hazard.light);
    }
    if (spec.bagaznik) {
      // Mirek's kombi: the boot light that is always on (sc. 1, 2, 8 – nobody knows why)
      a.trunk = new THREE.PointLight(0xfff0c0, 6, 6, 1);
      a.trunk.position.set(0, 1.1, -len / 2 + 0.4);
      box(root, 0.5, 0.08, 0.2, 0, 1.25, -len / 2 + 0.3, glow(0xfff4d0));
      root.add(a.trunk);
    }
    a.collider = spec.collide !== false ? physics.addMovableBox({ x: 0.9, y: 0.75, z: len / 2 }, { surface: 'car' }) : null;
    a.set = (x, z, heading) => {
      root.position.set(x, 0, z);
      root.rotation.y = heading + Math.PI / 2;
      a.collider?.set(x, z, root.rotation.y);
    };
    a.show = (on) => {
      root.visible = on;
      a.collider?.enabled(on);
    };
    a.set(spec.x, spec.z, (spec.heading ?? 0) * DEG);
    return a;
  }
  const auta = {};
  await Promise.all(Object.entries(fab.auta).map(async ([id, s]) => (auta[id] = await auto(s))));

  // ---------- The Park: tanks behind the fence, the six posts, the start line ----------
  for (const [x, z, r] of fab.zbiorniki) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 12, 20), mat(0xb8bcc0));
    t.position.set(x, 6, z);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r, 2, 20), mat(0x9ea2a6));
    top.position.set(x, 13, z);
    scene.add(t, top);
  }
  const course = createCourse(fab.slupki);
  const slupki = [];
  const red = mat(0xc02a1a), white = mat(0xeeeeea), chalk = new THREE.MeshBasicMaterial({ color: 0xd8d8c8, transparent: true, opacity: 0.55 });
  for (const p of course.posts) {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) box(g, 0.22, 0.3, 0.22, 0, 0.15 + i * 0.3, 0, i % 2 ? white : red);
    box(g, 0.5, 0.06, 0.5, 0, 0.03, 0, mat(0x333333));
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    // a chalk arc on the side the car must pass (course right = +d)
    const side = course.world(p.s, p.strona * 3.6);
    const arc = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.0, 20, 1, -Math.PI / 3, (Math.PI * 2) / 3), chalk);
    arc.rotation.x = -Math.PI / 2;
    arc.rotation.z = Math.atan2(-(side.z - p.z), side.x - p.x);
    arc.position.set(p.x, 0.04, p.z);
    scene.add(arc);
    slupki.push({ g, wobble: 0 });
  }
  const line = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.5), chalk);
  line.rotation.x = -Math.PI / 2;
  line.rotation.z = (fab.slupki.heading + 90) * DEG;
  line.position.set(course.start.x, 0.04, course.start.z);
  scene.add(line);

  // ---------- Town: Mirek's yard (a shelter, generators, a washing machine, a dentist's chair, the four rims) ----------
  const yard = new THREE.Group();
  const [wx, wz] = fab.podworkoMirka.wiata;
  yard.position.set(wx, 0, wz);
  const steel = mat(0x6a7078), roof = mat(0x4a4e52);
  for (const [x, z] of [[-4, -2.2], [4, -2.2], [-4, 2.2], [4, 2.2]]) box(yard, 0.15, 3, 0.15, x, 1.5, z, steel);
  box(yard, 8.6, 0.12, 5, 0, 3.05, 0, roof);
  box(yard, 1.2, 0.9, 0.8, -2.8, 0.45, -1.2, mat(0xd8b02a));
  box(yard, 1.1, 0.8, 0.7, -1.4, 0.4, -1.4, mat(0xc8a02a));
  const pralka = box(yard, 0.65, 0.85, 0.6, 0.4, 0.43, -1.3, mat(0xe8e8e4));
  box(pralka, 0.36, 0.36, 0.02, 0, 0.05, 0.31, mat(0x3a4a5a));
  box(yard, 0.7, 0.5, 0.7, 2.2, 0.25, -1.1, mat(0x2a3a4a));
  box(yard, 0.7, 0.9, 0.12, 2.2, 0.85, -1.45, mat(0x2a3a4a));
  scene.add(yard);
  solid(wx, wz - 1.3, 4.2, 0.8, 0.8);
  const felgaGeo = new THREE.TorusGeometry(0.33, 0.12, 8, 16);
  const rimMat = mat(0x9aa0a6), tyreMat = mat(0x151515);
  function felga() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(felgaGeo, tyreMat));
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 12), rimMat);
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
    return g;
  }
  const [fx, fz] = fab.podworkoMirka.felgi;
  const felgiNaPodworku = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const f = felga();
    f.position.set(fx + i * 0.32, 0.45, fz);
    f.rotation.set(0, Math.PI / 2, 0.25);
    felgiNaPodworku.add(f);
  }
  scene.add(felgiNaPodworku);

  // Traffic lights on the main crossroads (they change for nobody)
  const sygnaly = [];
  for (const [x, z, yaw] of fab.sygnalizacja) {
    const g = new THREE.Group();
    box(g, 0.14, 3.2, 0.14, 0, 1.6, 0, steel);
    box(g, 0.4, 1.1, 0.3, 0, 3.5, 0, mat(0x1a1a1a));
    const lamps = [0xff2a1a, 0xffb01a, 0x2aff6a].map((c, i) => {
      const l = box(g, 0.24, 0.24, 0.05, 0, 3.85 - i * 0.34, 0.16, new THREE.MeshBasicMaterial({ color: 0x111111 }));
      l.userData.on = c;
      return l;
    });
    g.position.set(x, 0, z);
    g.rotation.y = yaw * DEG;
    scene.add(g);
    solid(x, z, 0.12, 1.6, 0.12, 0, 'metal');
    sygnaly.push(lamps);
  }
  // The flyover over the main street by the west exit
  {
    const w = fab.wiadukt;
    const g = new THREE.Group();
    box(g, 9, 0.9, w.dlugosc, 0, w.wysokosc, 0, mat(0x8a8a86));
    for (const s of [-1, 1]) box(g, 0.2, 0.9, w.dlugosc, s * 4.4, w.wysokosc + 0.9, 0, mat(0x6a6a66));
    for (const s of [-1, 1]) box(g, 7, w.wysokosc, 1.4, 0, w.wysokosc / 2, s * (w.dlugosc / 2 - 1), mat(0x7a7a76));
    g.position.set(w.x, 0, w.z);
    scene.add(g);
    for (const s of [-1, 1]) solid(w.x, w.z + s * (w.dlugosc / 2 - 1), 3.5, w.wysokosc / 2, 0.7);
  }
  // The road east is closed: a barrier and a crossed-out sign ("a direction you can't drive in")
  {
    const z = fab.zamknieta;
    const g = new THREE.Group();
    for (let i = -3; i <= 3; i++) box(g, 0.25, 0.9, 1.4, 0, 0.45, i * 1.5, i % 2 ? red : white);
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 48;
    const x = c.getContext('2d');
    x.fillStyle = '#e8e8e0';
    x.fillRect(0, 0, 128, 48);
    x.fillStyle = '#111';
    x.font = 'bold 12px monospace';
    x.textAlign = 'center';
    x.fillText(z.napis, 64, 20);
    x.fillText('DROGA ZAMKNIĘTA', 64, 38);
    x.strokeStyle = '#c02a1a';
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(4, 4);
    x.lineTo(124, 44);
    x.stroke();
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: t }));
    sign.position.set(-0.2, 2.2, 0);
    sign.rotation.y = -Math.PI / 2;
    box(g, 0.1, 2.6, 0.1, 0, 1.3, 1.3, steel);
    g.add(sign);
    g.position.set(z.x, 0, z.z);
    scene.add(g);
    solid(z.x, z.z, 0.2, 0.5, 5.3);
  }

  // ---------- The road out (wylotówka): a ribbon of old asphalt, roadside posts, forest, meadows, potholes ----------
  const W = fab.wylotowka;
  const [xMin] = [W.korytarz[2]];
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(-xMin - 280, W.korytarz[1] - W.korytarz[0] + 120), mat(0x131c11));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((xMin - 290) / 2 - 5, -0.01, (W.korytarz[0] + W.korytarz[1]) / 2);
  scene.add(ground);
  physics.addStaticBox({ x: (xMin - 280) / 2, y: -1, z: 50 }, { x: (-xMin - 280) / 2 + 10, y: 1, z: 150 }, { friction: 0.8 });
  // invisible edges of the world along the corridor (fields beyond, in the fog)
  const len = -xMin - 100;
  solid(-100 - len / 2, W.korytarz[0], len / 2, 1.5, 0.5);
  solid(-100 - len / 2, W.korytarz[1], len / 2, 1.5, 0.5);
  solid(xMin, 50, 0.5, 1.5, 60);
  const curve = new THREE.CatmullRomCurve3(W.os.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const N = Math.ceil(curve.getLength() / 4);
  const pts = curve.getSpacedPoints(N);
  const pos = [], uv = [], idx = [];
  const half = W.szerokosc / 2;
  let along = 0;
  const probki = []; // centre line samples { x, z, tx, tz, s }
  for (let i = 0; i <= N; i++) {
    const p = pts[i], q = pts[Math.min(N, i + 1)], o = pts[Math.max(0, i - 1)];
    const tx = q.x - o.x, tz = q.z - o.z, tl = Math.hypot(tx, tz) || 1;
    const nx = -tz / tl, nz = tx / tl;
    if (i) along += p.distanceTo(pts[i - 1]);
    probki.push({ x: p.x, z: p.z, tx: tx / tl, tz: tz / tl, s: along });
    pos.push(p.x + nx * half, 0.03, p.z + nz * half, p.x - nx * half, 0.03, p.z - nz * half);
    uv.push(0, along / 8, 1, along / 8);
    if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  roadGeo.setIndex(idx);
  roadGeo.computeVertexNormals();
  const road = new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ map: asfaltWiejski(), roughness: 0.95, side: THREE.DoubleSide }));
  scene.add(road);
  const dlugoscDrogi = along;
  // seeded randomness, so the road is the same every night
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const naDrodze = (s) => probki[Math.min(probki.length - 1, Math.max(0, Math.round((s / dlugoscDrogi) * (probki.length - 1))))];
  // potholes: dark patches; driving over one shakes the car (gra.js)
  const dziury = [];
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x0d0d0f });
  for (let i = 0; i < W.dziury; i++) {
    const s = 60 + rnd() * (dlugoscDrogi - 120);
    const c = naDrodze(s);
    const off = (rnd() - 0.5) * (W.szerokosc - 2);
    const r = 0.5 + rnd() * 0.7;
    const x = c.x - c.tz * off, z = c.z + c.tx * off;
    const h = new THREE.Mesh(new THREE.CircleGeometry(r, 7), holeMat);
    h.rotation.x = -Math.PI / 2;
    h.scale.set(1, 0.6 + rnd() * 0.5, 1);
    h.position.set(x, 0.045, z);
    scene.add(h);
    dziury.push({ x, z, r });
  }
  // roadside posts every 50 m, both sides
  const postGeo = new THREE.BoxGeometry(0.14, 1, 0.14);
  const posts = new THREE.InstancedMesh(postGeo, mat(0xe0e0d8), Math.ceil(dlugoscDrogi / 50) * 2 + 2);
  const bandGeo = new THREE.BoxGeometry(0.16, 0.18, 0.16);
  const bands = new THREE.InstancedMesh(bandGeo, glow(0x111111), posts.count);
  const mtx = new THREE.Matrix4();
  let n = 0;
  for (let s = 20; s < dlugoscDrogi; s += 50) {
    const c = naDrodze(s);
    for (const side of [-1, 1]) {
      const d = side * (half + 1.2);
      mtx.makeTranslation(c.x - c.tz * d, 0.5, c.z + c.tx * d);
      posts.setMatrixAt(n, mtx);
      mtx.makeTranslation(c.x - c.tz * d, 0.8, c.z + c.tx * d);
      bands.setMatrixAt(n++, mtx);
    }
  }
  posts.count = bands.count = n;
  scene.add(posts, bands);
  // forest stretches (trees both sides; the near ones collide) and lone trees on the meadows
  const trees = [];
  const inLas = (x) => W.las.some(([a, b]) => x <= a && x >= b);
  for (let s = 30; s < dlugoscDrogi - 60; s += 3.2) {
    const c = naDrodze(s);
    for (const side of [-1, 1]) {
      const las = inLas(c.x);
      if (!las && rnd() > 0.04) continue;
      const d = side * (half + 5 + rnd() * (las ? 38 : 30));
      const x = c.x - c.tz * d + (rnd() - 0.5) * 3, z = c.z + c.tx * d;
      if (z < W.korytarz[0] + 2 || z > W.korytarz[1] - 2) continue;
      trees.push({ x, z, h: 5 + rnd() * 6, near: Math.abs(d) < half + 14 });
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 1, 5);
  const crownGeo = new THREE.ConeGeometry(1, 1, 6);
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x3a2a1c), trees.length);
  const crowns = new THREE.InstancedMesh(crownGeo, mat(0x1e3a1e), trees.length);
  const sc = new THREE.Vector3(), qt = new THREE.Quaternion(), ps = new THREE.Vector3();
  trees.forEach((t, i) => {
    trunks.setMatrixAt(i, mtx.compose(ps.set(t.x, t.h * 0.2, t.z), qt, sc.set(1, t.h * 0.4, 1)));
    crowns.setMatrixAt(i, mtx.compose(ps.set(t.x, t.h * 0.62, t.z), qt, sc.set(t.h * 0.28, t.h * 0.8, t.h * 0.28)));
    if (t.near) physics.addStaticCylinder({ x: t.x, y: 0, z: t.z }, 0.3, 3, { surface: 'tree' });
  });
  scene.add(trunks, crowns);

  // The bus stop in the field (sc. 4, 9)
  {
    const p = fab.przystanekWPolu;
    const pr = prop('przystanek', p.nazwa);
    pr.group.position.set(p.x, 0, p.z);
    pr.group.rotation.y = p.yaw * DEG;
    scene.add(pr.group);
    solid(p.x, p.z, pr.half.x, pr.half.y, pr.half.z, p.yaw * DEG, pr.surface);
  }

  // ---------- The village: a dirt yard with one lamp, a henhouse, a house with a TV, a fence, a dog ----------
  const wies = fab.wies;
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(50, 42), mat(0x3a3024));
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(wies.x - 10, 0.02, wies.z + 4);
  scene.add(dirt);
  const [lx, lz] = wies.lampa;
  box(scene, 0.16, 6, 0.16, lx, 3, lz, steel);
  box(scene, 1.2, 0.1, 0.12, lx + 0.6, 6, lz, steel);
  const bulb = box(scene, 0.4, 0.14, 0.3, lx + 1.1, 5.9, lz, glow(0xffc070));
  const lampLight = new THREE.PointLight(0xffb060, 20, 24, 1);
  lampLight.position.set(lx + 1.1, 5.6, lz);
  scene.add(lampLight);
  solid(lx, lz, 0.1, 3, 0.1, 0, 'metal');
  const [kx, kz] = wies.kurnik;
  const kurnik = new THREE.Group();
  box(kurnik, 4, 2.2, 3, 0, 1.1, 0, mat(0x6a5a42));
  const kr = box(kurnik, 4.4, 0.12, 3.6, 0, 2.5, 0, mat(0x3a3430));
  kr.rotation.x = 0.18;
  box(kurnik, 0.8, 1.2, 0.05, 1, 0.6, 1.53, mat(0x2a2218));
  kurnik.position.set(kx, 0, kz);
  scene.add(kurnik);
  solid(kx, kz, 2, 1.1, 1.5);
  const [hx, hz] = wies.dom;
  const dom = new THREE.Group();
  box(dom, 9, 4, 7, 0, 2, 0, mat(0x8a8272));
  const r1 = box(dom, 9.4, 0.2, 4.4, 0, 5, -1.7, mat(0x5a2a22));
  r1.rotation.x = 0.6;
  const r2 = box(dom, 9.4, 0.2, 4.4, 0, 5, 1.7, mat(0x5a2a22));
  r2.rotation.x = -0.6;
  const tvGlass = new THREE.MeshBasicMaterial({ color: 0x223355 });
  box(dom, 1.4, 1, 0.05, -2, 2.2, -3.53, tvGlass);
  box(dom, 1.4, 1, 0.05, 2, 2.2, -3.53, glow(0x0a0a0c));
  box(dom, 1, 2, 0.05, 0, 1, -3.53, mat(0x3a2a1a));
  dom.position.set(hx, 0, hz);
  scene.add(dom);
  solid(hx, hz, 4.5, 2, 3.5);
  const tv = new THREE.PointLight(0x6a8aff, 3, 10, 1);
  tv.position.set(hx - 2, 2.2, hz - 4.5);
  scene.add(tv);
  // fence with a gate (gap) towards the road
  const pick = new THREE.BoxGeometry(0.1, 1.2, 0.05);
  const fence = [];
  const P = wies.plot;
  for (let i = 0; i < P.length; i++) {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length];
    const L = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t < L; t += 0.35) {
      const x = ax + ((bx - ax) * t) / L, z = az + ((bz - az) * t) / L;
      if (x > wies.x + 6 && Math.abs(z - wies.z) < 7) continue; // the gate where the road comes in
      fence.push([x, z, Math.atan2(bx - ax, bz - az)]);
    }
  }
  const picks = new THREE.InstancedMesh(pick, mat(0x5a4a34), fence.length);
  fence.forEach(([x, z, a], i) => picks.setMatrixAt(i, mtx.compose(ps.set(x, 0.6, z), qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI / 2), sc.set(1, 1, 1))));
  scene.add(picks);
  const dog = new THREE.Group();
  box(dog, 0.35, 0.3, 0.8, 0, 0.3, 0, mat(0x4a3a2a));
  box(dog, 0.28, 0.26, 0.3, 0, 0.45, 0.5, mat(0x4a3a2a));
  dog.position.set(hx + 5, 0, hz - 5);
  scene.add(dog);
  // the rim rolling crooked (scene FELGA_BICIE) and the row of rims by the henhouse
  const rzadek = new THREE.Group();
  const felgiPrzyKurniku = [];
  for (let i = 0; i < 4; i++) {
    const f = felga();
    f.position.set(kx - 1.2 + i * 0.75, 0.45, kz + 2.2);
    f.rotation.y = Math.PI / 2;
    f.visible = false;
    rzadek.add(f);
    felgiPrzyKurniku.push(f);
  }
  scene.add(rzadek);

  // ---------- In the car: the rims (three in the boot, one on the back seat) and Kamil ----------
  const wAucie = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const f = felga();
    f.position.set(-1.65, -0.05 + i * 0.05, -0.35 + i * 0.35);
    f.rotation.x = Math.PI / 2;
    wAucie.add(f);
  }
  const naKanapie = felga();
  naKanapie.position.set(-0.75, 0.15, 0.3);
  naKanapie.rotation.y = Math.PI / 2;
  wAucie.add(naKanapie);
  wAucie.visible = false;
  const kamilFig = figure(postacie.KAMIL?.wyglad ?? {});
  const kamil = new THREE.Group();
  kamil.add(kamilFig.group);
  for (const leg of kamilFig.legs) leg.rotation.x = -Math.PI / 2;
  kamilFig.group.position.set(0, -0.45, 0);
  kamil.scale.setScalar(0.92);
  kamil.position.set(-0.15, -0.35, 0.38);
  kamil.rotation.y = Math.PI / 2; // facing +X (forward)
  kamil.visible = false;

  // ---------- People (plan §7) ----------
  const people = createPeople(scene, physics, fab.postacie.map((p) => ({ id: p.id, x: p.x, z: p.z, yaw: p.yaw })), postacie);
  await people.ready;
  const kiedy = Object.fromEntries(fab.postacie.map((p) => [p.id, p]));

  // ---------- NPC run animation (the BMW at night, Zdzichu's bus in the morning) ----------
  let bieg = null; // { auto, path, t, lead: { x, z, h }, leadT }

  return {
    course,
    slupki,
    dziury,
    auta,
    people,
    dlugoscDrogi,
    felgiNaPodworku,
    felgiPrzyKurniku,
    kamil,
    wAucie,
    lampLight,
    // things riding in the player's car (carView.root)
    wsadz(root) {
      root.add(wAucie, kamil);
    },
    // start a run: the car drives from where it stands to the start and then along the path (slupki.js npcPath)
    przejazdNPC(a, path) {
      bieg = { auto: a, path, t: -1.8, from: { x: a.root.position.x, z: a.root.position.z } };
    },
    get bieg() {
      return bieg;
    },
    // every frame: who is where and what is lit (ctx: { scena, zegar (minutes), pasazer, spi, ladunek, time })
    update(dt, ctx) {
      const { scena, zegar, time } = ctx;
      const noc = scena < 11;
      const rano = scena === 11 && zegar >= 30 * 60 + 12; // 06:12 (minutes past the night's midnight)
      const show = (id, on) => {
        const n = people.get(id);
        if (n && n.visible !== on) people.show(id, on);
      };
      for (const [id, p] of Object.entries(kiedy)) {
        let on = true;
        if (p.kiedy === 'noc') on = noc;
        if (p.kiedy === 'rano') on = rano;
        if (p.kiedy === 'przystanek') on = scena <= 4 && ctx.pasazer !== 'KAMIL';
        if (p.kiedy === 'odbiorca') on = (scena === 6 && zegar >= 28 * 60 + 5) || scena === 7;
        if (id === 'KAMIL' && scena === 7) on = true; // at the gate, asking about the dog
        show(id, on);
        if (on && p.krazy) {
          const k = p.krazy, a = time * k.v + (k.faza ?? 0);
          people.place(id, k.x + Math.cos(a) * k.r, k.z + Math.sin(a) * k.r, (-a * 180) / Math.PI);
        }
      }
      if (scena === 7) people.place('KAMIL', fab.wies.plot[0][0] - 6, fab.wies.z - 10, 0);
      // cars: the night crowd leaves before dawn, the bus comes with the morning shift
      auta.kombi.show(noc);
      if (!bieg || bieg.auto !== auta.bmw) auta.bmw.show(noc);
      auta.bus.show(rano);
      // Kamil's car on hazards from the moment it stopped (00:18); weaker by morning
      const h = auta.kamila.hazard;
      const blink = scena >= 3 && time % 1.1 < 0.55;
      const sila = scena >= 8 ? 0.45 : 1;
      h.m.color.setHex(blink ? (scena >= 8 ? 0xb06010 : 0xffa020) : 0x2a1400);
      h.light.intensity = blink ? 10 * sila : 0;
      // the village lamp goes out when the receiver walks home (end of sc. 7)
      lampLight.intensity = scena >= 8 ? 0 : 20;
      bulb.material.color.setHex(scena >= 8 ? 0x2a2418 : 0xffc070);
      tv.intensity = 2 + 2.5 * Math.abs(Math.sin(time * 7.3) * Math.sin(time * 2.1 + 1));
      tvGlass.color.setRGB(0.15 + tv.intensity * 0.06, 0.2 + tv.intensity * 0.06, 0.35 + tv.intensity * 0.08);
      // traffic lights: red 5 s, green 5 s, amber 2 s
      const c = time % 12;
      const which = c < 5 ? 0 : c < 10 ? 2 : 1;
      sygnaly.forEach((lamps, j) => {
        const w = j % 2 ? [2, 1, 0][which] : which; // (the crossing direction: green while the other is red)
        lamps.forEach((l, i) => l.material.color.setHex(i === w ? l.userData.on : 0x111111));
      });
      // in the car
      wAucie.visible = ctx.ladunek === 'FELGI';
      kamil.visible = ctx.pasazer === 'KAMIL' && scena !== 7;
      kamilFig.head.rotation.z = ctx.spi ? 0.5 : 0;
      felgiNaPodworku.visible = scena < 2 || (scena === 2 && ctx.ladunek !== 'FELGI');
      // posts knocked: they wobble
      for (const p of slupki) {
        p.wobble = Math.max(0, p.wobble - dt);
        p.g.rotation.z = Math.sin(p.wobble * 20) * p.wobble * 0.5;
      }
      // the NPC run
      let camState = null;
      if (bieg) {
        bieg.t += dt;
        const p0 = bieg.path.at(0);
        let x, z, yaw, speed = 11;
        if (bieg.t < 0) {
          // lead-in: from where it stood to the start of the path
          const k = 1 + bieg.t / 1.8;
          x = bieg.from.x + (p0.x - bieg.from.x) * k;
          z = bieg.from.z + (p0.z - bieg.from.z) * k;
          yaw = Math.atan2(-(p0.z - bieg.from.z), p0.x - bieg.from.x);
          speed = Math.hypot(p0.x - bieg.from.x, p0.z - bieg.from.z) / 1.8;
        } else {
          const p = bieg.path.at(bieg.t);
          ({ x, z, yaw } = p);
        }
        bieg.auto.show(true);
        bieg.auto.set(x, z, yaw);
        bieg.pos = { x, z, yaw, speed };
        if (bieg.t >= bieg.path.duration) {
          // back to its place (not left in the Park's gate)
          const sp = bieg.auto.spec;
          bieg.auto.set(sp.x, sp.z, (sp.heading ?? 0) * DEG);
          bieg = null;
        }
      }
      return camState;
    },
    wobble(k) {
      if (slupki[k]) slupki[k].wobble = 1.2;
    },
  };
}

// Country asphalt: grey with patches, cracks and faded edges (no lines)
function asfaltWiejski() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#34343a';
  x.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 1400; i++) {
    const v = 38 + Math.random() * 30;
    x.fillStyle = `rgb(${v},${v},${v + 3})`;
    x.fillRect(Math.random() * 64, Math.random() * 128, 1, 1);
  }
  for (let i = 0; i < 5; i++) {
    x.fillStyle = Math.random() < 0.5 ? '#2a2a2e' : '#3e3e42';
    x.fillRect(4 + Math.random() * 40, Math.random() * 110, 6 + Math.random() * 16, 4 + Math.random() * 14);
  }
  x.fillStyle = '#4a4a44';
  x.fillRect(1, 0, 2, 128);
  x.fillRect(61, 0, 2, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
