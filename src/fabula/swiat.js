import * as THREE from 'three';
import { loadGltf } from '../gltf.js';
import { prop } from '../map.js';
import { createPeople, figure } from '../npc.js';
import { createCourse } from './slupki.js';
import { createVehicle } from '../vehicle.ts';
import { createCarView } from '../car.js';
import { applyCar, carDrivetrain } from '../cars.js';
import { presets } from '../tuning.ts';
import { createAutopilot } from '../npcAutopilot.js';
import { EntityManager, Vehicle, FollowPathBehavior, Path, Vector3 as YVector3 } from 'yuka';
import { createNoise2D } from 'simplex-noise';
import bmwE34 from '../cars/bmw-e34.json';
import vwT3 from '../cars/vw-t3.json';

const ENGINES = Object.fromEntries(Object.values(import.meta.glob('../engines/*.json', { eager: true, import: 'default' })).map((e) => [e.id, e]));
const NPC_PROFIL = { NOC_BMW: { profile: bmwE34, poziom: 'dobry' }, RANO_BUS: { profile: vwT3, poziom: 'slaby' } }; // plan-mvp: bus Zdzicha = słaby kierowca

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

export async function createSwiat({ scene, physics, map, fab, postacie, npcVehicles = [] }) {
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

  // ---------- NPC runs: real vehicle.ts + engine.js (v0.8), same physics and drift as the player (docs/gotowce.md).
  // One view + one createVehicle() per NPC car, built once and reused for every run; only visible while driving.
  const npcAuto = {};
  for (const [id, { profile, poziom }] of Object.entries(NPC_PROFIL)) {
    const view = await createCarView(scene, profile);
    view.root.visible = false;
    const tuning = applyCar({ ...presets.Normalny }, profile);
    const drivetrain = carDrivetrain(profile, ENGINES);
    npcAuto[id] = { view, tuning, drivetrain, poziom, vehicle: null, entry: null, auto: null };
  }

  // ---------- The Park: rectangular water tanks (docs/referencje/park – ulica Magazynowa runs past a row of open
  // water basins, not tall cylindrical silos as before), the six posts, the start line ----------
  const water = mat(0x0d2a30, { roughness: 0.15, metalness: 0.3 });
  const concrete = mat(0x9a9a92);
  for (const [x, z, r] of fab.zbiorniki) {
    box(scene, r * 2.4, 1.1, r * 2.2, x, 0.55, z, concrete); // the basin's concrete rim, water sunk inside it
    box(scene, r * 2.1, 0.05, r * 1.9, x, 1.08, z, water);
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
  // worn concrete slabs under the run itself (docs/referencje/park: patches, cracks, stains), a hair above the
  // estate's own asphalt so it doesn't z-fight
  {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(course.length + 30, 16), new THREE.MeshStandardMaterial({ map: plytyParku(), roughness: 0.95 }));
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = (fab.slupki.heading * Math.PI) / 180;
    const mid = course.world(course.length / 2, 0);
    patch.position.set(mid.x, 0.018, mid.z);
    scene.add(patch);
  }
  // a wall of stacked tyres past the last post (the "zawrotka" – the run-off at the end): dynamic Rapier bodies
  // that scatter if the car hits them and are stood back up at the start of every run (przejazdNPC/graczRun)
  const tireWall = [];
  let tyreInst = null;
  {
    const wallAt = course.world(course.length + 5, 0);
    const wallYaw = ((fab.slupki.heading + 90) * Math.PI) / 180;
    const rowDir = { x: Math.cos(wallYaw), z: -Math.sin(wallYaw) }; // along the wall, across the road
    for (let col = -3; col <= 3; col++) {
      for (let row = 0; row < 3; row++) {
        const x = wallAt.x + rowDir.x * col * 0.7, z = wallAt.z + rowDir.z * col * 0.7;
        tireWall.push(physics.addDynamicCylinder({ x, y: 0.28 + row * 0.5, z }, 0.35, 0.45, 9));
      }
    }
    tyreInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.35, 0.45, 14), mat(0x151515), tireWall.length);
    tyreInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(tyreInst);
  }
  const tyreQ = new THREE.Quaternion(), tyreScale = new THREE.Vector3(1, 1, 1), tyrePos = new THREE.Vector3(), tyreMtx = new THREE.Matrix4();
  function syncTyres() {
    tireWall.forEach((b, i) => {
      const p = b.position(), q = b.quaternion();
      tyrePos.set(p.x, p.y, p.z);
      tyreQ.set(q.x, q.y, q.z, q.w);
      tyreInst.setMatrixAt(i, tyreMtx.compose(tyrePos, tyreQ, tyreScale));
    });
    tyreInst.instanceMatrix.needsUpdate = true;
  }
  syncTyres();
  function resetTireWall() {
    for (const b of tireWall) b.reset();
    syncTyres();
  }

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
  const groundGeo = new THREE.PlaneGeometry(-xMin - 280, W.korytarz[1] - W.korytarz[0] + 120, 90, 24);
  // gentle rolling hills, visual only: the physical ground stays the flat box below (physics.addStaticBox), and the
  // corridor's middle 70 m (where the road actually winds) is left flat so nothing bulges up through the ribbon –
  // v0.8 part 4, docs/gotowce.md (simplex-noise instead of hand-rolled noise)
  const noise2D = createNoise2D(() => 0.42);
  const midZ = (W.korytarz[0] + W.korytarz[1]) / 2;
  {
    const p = groundGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i), lz = p.getY(i); // plane-local (rotated to X/Z on the mesh)
      const worldZ = lz + midZ;
      const taper = Math.max(0, (Math.abs(worldZ - midZ) - 35) / 30);
      if (taper <= 0) continue;
      p.setZ(i, noise2D(lx * 0.006, lz * 0.006) * 1.8 * Math.min(1, taper));
    }
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, mat(0x131c11));
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

  // Roadside landmarks (v0.8 part 4, docs/referencje/drogi/): power line poles the whole way, one culvert under
  // the road and one wayside shrine near the village – greybox shapes, no new assets.
  {
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 7, 6);
    const armGeo = new THREE.BoxGeometry(1.6, 0.1, 0.1);
    const poleCount = Math.ceil(dlugoscDrogi / 55);
    const poles = new THREE.InstancedMesh(poleGeo, mat(0x5a4a3a), poleCount);
    const arms = new THREE.InstancedMesh(armGeo, mat(0x3a3028), poleCount);
    const wireGeo = new THREE.BoxGeometry(1, 0.03, 0.03);
    const wires = new THREE.InstancedMesh(wireGeo, glow(0x1a1a1a), poleCount);
    let pn = 0;
    let prevPole = null;
    for (let s = 15; s < dlugoscDrogi; s += 55) {
      const c = naDrodze(s);
      const d = half + 3 + (inLas(c.x) ? 8 : 0); // just outside the ditch, or past the treeline in the forest
      const x = c.x - c.tz * d, z = c.z + c.tx * d;
      poles.setMatrixAt(pn, mtx.compose(ps.set(x, 3.5, z), qt, sc.set(1, 1, 1)));
      arms.setMatrixAt(pn, mtx.compose(ps.set(x, 6.7, z), qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(c.tx, c.tz)), sc.set(1, 1, 1)));
      if (prevPole) {
        const mx = (x + prevPole.x) / 2, mz = (z + prevPole.z) / 2, len = Math.hypot(x - prevPole.x, z - prevPole.z);
        wires.setMatrixAt(pn - 1, mtx.compose(ps.set(mx, 6.55, mz), qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(x - prevPole.x, z - prevPole.z)), sc.set(len, 1, 1)));
      }
      prevPole = { x, z };
      pn++;
    }
    poles.count = arms.count = pn;
    wires.count = Math.max(0, pn - 1);
    scene.add(poles, arms, wires);
  }
  {
    // a small concrete culvert where the road crosses a roadside ditch: a pipe under the road, axis across it
    // (along the road's normal), with a low headwall poking out of the ditch on each side
    const cp = naDrodze(dlugoscDrogi * 0.42);
    const nx = -cp.tz, nz = cp.tx; // road normal (unit)
    const span = W.szerokosc + 1.6;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, span, 10, 1, true), mat(0x6a6a64, { side: THREE.DoubleSide }));
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0, nz));
    pipe.position.set(cp.x, -0.35, cp.z);
    scene.add(pipe);
    for (const side of [-1, 1]) box(scene, 1.4, 0.7, 0.2, cp.x + nx * (span / 2) * side, -0.1, cp.z + nz * (span / 2) * side, mat(0x8a8a82));
  }
  {
    // a wayside shrine/cross near the village (a whitewashed post with a small pitched roof, a cross on top)
    const kp = naDrodze(dlugoscDrogi * 0.88);
    const kx = kp.x - kp.tz * (half + 4), kz = kp.z + kp.tx * (half + 4);
    const white = mat(0xe8e0cc);
    box(scene, 0.3, 2.2, 0.3, kx, 1.1, kz, white);
    box(scene, 0.55, 0.5, 0.5, kx, 2.35, kz, mat(0x5a3a2a));
    box(scene, 0.08, 0.6, 0.08, kx, 2.9, kz, white);
    box(scene, 0.42, 0.08, 0.08, kx, 3.15, kz, white);
  }

  {
    // a gravel turn-off into a field (a short stub, just wide enough to read as a driveway, no gate)
    const gp = naDrodze(dlugoscDrogi * 0.63);
    const gside = 1;
    const gx = gp.x - gp.tz * (half + 4) * gside, gz = gp.z + gp.tx * (half + 4) * gside;
    const gravel = new THREE.Mesh(new THREE.PlaneGeometry(8, 5.5), mat(0x8a8168));
    gravel.rotation.x = -Math.PI / 2;
    gravel.rotation.z = Math.atan2(gp.tx, gp.tz);
    gravel.position.set(gx, 0.02, gz);
    scene.add(gravel);
  }

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
  for (const leg of kamilFig.legs) (leg.thigh.rotation.x = -Math.PI / 2), (leg.shin.rotation.x = Math.PI / 2.3);
  kamilFig.group.position.set(0, -0.45, 0);
  kamil.scale.setScalar(0.92);
  kamil.position.set(-0.15, -0.35, 0.38);
  kamil.rotation.y = Math.PI / 2; // facing +X (forward)
  kamil.visible = false;

  // ---------- People (plan §7) ----------
  const people = createPeople(scene, physics, fab.postacie.map((p) => ({ id: p.id, x: p.x, z: p.z, yaw: p.yaw })), postacie);
  await people.ready;
  const kiedy = Object.fromEntries(fab.postacie.map((p) => [p.id, p]));

  // Roller skaters go round the rink on a yuka path (v0.8, docs/gotowce.md) instead of hand-rolled circle maths –
  // same shape (a lap of the same radius at the same speed), but steered by a real seek/follow behaviour.
  const yukaManager = new EntityManager();
  const yukaVehicles = {};
  for (const p of fab.postacie) {
    if (!p.krazy) continue;
    const k = p.krazy;
    const path = new Path();
    path.loop = true;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + (k.faza ?? 0);
      path.add(new YVector3(k.x + Math.cos(a) * k.r, 0, k.z + Math.sin(a) * k.r));
    }
    const v = new Vehicle();
    v.maxSpeed = k.r * k.v; // same tangential speed as the old krazy formula
    v.position.set(p.x, 0, p.z);
    v.steering.add(new FollowPathBehavior(path, k.r * 0.15));
    yukaManager.add(v);
    yukaVehicles[p.id] = v;
  }

  // ---------- NPC run (the BMW at night, Zdzichu's bus in the morning): v0.8, a real vehicle.ts car driven by
  // npcAutopilot.js, not a scripted path. The story engine has already rolled which posts are clean (silnik.js
  // losujSlupki) and money is settled from that roll (gra.js rozlicz(): `a.slupki`), so `forced` here is only a
  // best-effort steer towards matching it on screen – see src/npcAutopilot.js and docs/wdrozenie-fabuly.md.
  let bieg = null; // { id, npc: npcAuto[id] }
  const ID_TO_AUTA = { NOC_BMW: 'bmw', RANO_BUS: 'bus' };

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
    resetTireWall,
    // start a run: forced = a.slupki (already rolled by the story engine), seed = a run-specific RNG seed
    przejazdNPC(id, forced, seed = 1) {
      resetTireWall();
      const npc = npcAuto[id];
      const spawnYaw = (course.heading * Math.PI) / 180;
      const p0 = course.world(-20, 2.5);
      npc.vehicle = createVehicle(physics, { tuning: npc.tuning, drivetrain: npc.drivetrain, spawn: { x: p0.x, y: 1, z: p0.z }, spawnYaw });
      npc.entry = { vehicle: npc.vehicle, ctrl: { throttle: 0, steer: 0, handbrake: 0, brake: 0 } };
      npcVehicles.push(npc.entry);
      npc.autopilot = createAutopilot(course, npc.poziom, seed, { forced });
      npc.view.root.visible = true;
      bieg = { id, npc };
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
      yukaManager.update(dt);
      syncTyres();
      for (const [id, p] of Object.entries(kiedy)) {
        let on = true;
        if (p.kiedy === 'noc') on = noc;
        if (p.kiedy === 'rano') on = rano;
        if (p.kiedy === 'przystanek') on = scena <= 4 && ctx.pasazer !== 'KAMIL';
        if (p.kiedy === 'odbiorca') on = (scena === 6 && zegar >= 28 * 60 + 5) || scena === 7;
        if (id === 'KAMIL' && scena === 7) on = true; // at the gate, asking about the dog
        show(id, on);
        const yv = yukaVehicles[id];
        if (on && yv) {
          const yaw = yv.velocity.squaredLength() > 0.001 ? (Math.atan2(-yv.velocity.z, yv.velocity.x) * 180) / Math.PI : 0;
          people.place(id, yv.position.x, yv.position.z, yaw);
        }
      }
      if (scena === 7) people.place('KAMIL', fab.wies.plot[0][0] - 6, fab.wies.z - 10, 0);
      // cars: the night crowd leaves before dawn, the bus comes with the morning shift
      auta.kombi.show(noc);
      auta.bmw.show(noc && bieg?.id !== 'NOC_BMW');
      auta.bus.show(rano && bieg?.id !== 'RANO_BUS');
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
      // the NPC run: drive the real vehicle.ts car with npcAutopilot.js (physics.step() in main.js calls
      // npc.entry.vehicle.update(npc.entry.ctrl, h) every sub-step through npcVehicles; here we only read the
      // result and decide the next ctrl for the sub-step after this one)
      let camState = null;
      if (bieg) {
        const { npc } = bieg;
        const s = npc.vehicle.read();
        Object.assign(npc.entry.ctrl, npc.autopilot.step({ x: s.position.x, z: s.position.z, velocity: s.velocity, speed: s.speed, sideSlip: s.sideSlip }, dt));
        npc.view.sync(s);
        const q = s.quaternion;
        const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
        bieg.pos = { x: s.position.x, z: s.position.z, yaw: Math.atan2(-fz, fx), sideSlip: s.sideSlip };
        const { s: along } = course.local(s.position.x, s.position.z);
        if (along > course.length + 15) {
          npcVehicles.splice(npcVehicles.indexOf(npc.entry), 1);
          npc.view.root.visible = false;
          npc.vehicle = npc.entry = npc.autopilot = null;
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

// Worn concrete slabs at the Park's six-post run (docs/referencje/park): square plates with joint lines, patched
// repairs, oil stains and cracks – a rundown industrial yard, not fresh asphalt.
function plytyParku() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#6a6a62';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) {
    const v = 92 + Math.random() * 24;
    x.fillStyle = `rgba(${v},${v},${v - 6},${0.5 + Math.random() * 0.4})`;
    x.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  x.strokeStyle = '#3a3a34';
  x.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke();
  }
  for (let i = 0; i < 6; i++) { // dark oil stains
    x.fillStyle = `rgba(20,18,16,${0.25 + Math.random() * 0.3})`;
    x.beginPath();
    x.ellipse(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 10, 4 + Math.random() * 7, Math.random() * Math.PI, 0, Math.PI * 2);
    x.fill();
  }
  for (let i = 0; i < 4; i++) { // patched repairs (a lighter, cruder rectangle)
    x.fillStyle = '#7a766c';
    x.fillRect(Math.random() * 100, Math.random() * 100, 10 + Math.random() * 18, 8 + Math.random() * 14);
  }
  x.strokeStyle = 'rgba(30,28,26,0.6)';
  x.lineWidth = 1;
  for (let i = 0; i < 5; i++) { // cracks
    x.beginPath();
    let px = Math.random() * 128, py = Math.random() * 128;
    x.moveTo(px, py);
    for (let k = 0; k < 4; k++) { px += (Math.random() - 0.5) * 24; py += (Math.random() - 0.5) * 24; x.lineTo(px, py); }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(6, 1.4);
  return t;
}
