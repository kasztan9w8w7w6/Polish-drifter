// Node-side copy of the map's collision layout (no browser, no textures): reads the Kenney .gltf files directly,
// places each model like map.js put() does and computes the same body-height footprint. Used by map.test.mjs.
import fs from 'node:fs';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';

const ROOT = new URL('../public/assets/kenney/', import.meta.url);
const BAND_LO = 0.1, BAND_HI = 2.2;
const DEG = Math.PI / 180;
const cache = new Map();

// All triangles of a .gltf model in its own frame (flat array of Vector3 triples)
export function triangles(path) {
  if (cache.has(path)) return cache.get(path);
  const g = JSON.parse(fs.readFileSync(new URL(`${path}.gltf`, ROOT)));
  const buffers = g.buffers.map((b) => Buffer.from(b.uri.split(',')[1], 'base64'));
  const read = (ai) => {
    const a = g.accessors[ai], v = g.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const bytes = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType];
    const stride = v.byteStride ?? n * bytes;
    const buf = buffers[v.buffer], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out = [];
    for (let i = 0; i < a.count; i++) {
      const row = [];
      for (let k = 0; k < n; k++) {
        const o = off + i * stride + k * bytes;
        row.push(a.componentType === 5126 ? buf.readFloatLE(o) : a.componentType === 5125 ? buf.readUInt32LE(o) : a.componentType === 5123 ? buf.readUInt16LE(o) : buf.readUInt8(o));
      }
      out.push(n === 1 ? row[0] : row);
    }
    return out;
  };
  const tris = [];
  const visit = (ni, parent) => {
    const n = g.nodes[ni];
    const m = new Matrix4();
    if (n.matrix) m.fromArray(n.matrix);
    else m.compose(new Vector3(...(n.translation ?? [0, 0, 0])), new Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new Vector3(...(n.scale ?? [1, 1, 1])));
    const w = parent.clone().multiply(m);
    if (n.mesh !== undefined) {
      for (const p of g.meshes[n.mesh].primitives) {
        const pos = read(p.attributes.POSITION).map((v) => new Vector3(...v).applyMatrix4(w));
        const idx = p.indices !== undefined ? read(p.indices) : pos.map((_, i) => i);
        for (let i = 0; i < idx.length; i += 3) tris.push([pos[idx[i]], pos[idx[i + 1]], pos[idx[i + 2]]]);
      }
    }
    for (const c of n.children ?? []) visit(c, w);
  };
  for (const r of g.scenes[g.scene ?? 0].nodes) visit(r, new Matrix4());
  cache.set(path, tris);
  return tris;
}

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

// Oriented footprint box of one placed model: { cx, cz, hx, hz, yaw, h }
export function place(path, x, z, { yaw = 0, scale, fit, length } = {}) {
  const tris = triangles(path);
  const raw = new Box3();
  for (const t of tris) for (const p of t) raw.expandByPoint(p);
  const size = raw.getSize(new Vector3());
  const s = fit ? new Vector3(fit[0] / size.x, fit[1] / size.y, fit[2] / size.z) : new Vector3().setScalar(length ? length / Math.max(size.x, size.z) : scale ?? 1);
  const scaled = new Box3(raw.min.clone().multiply(s), raw.max.clone().multiply(s));
  const c = scaled.getCenter(new Vector3());
  const off = new Vector3(-c.x, -scaled.min.y, -c.z);
  const fp = new Box3();
  for (const t of tris) {
    const q = t.map((p) => p.clone().multiply(s).add(off));
    if (Math.max(q[0].y, q[1].y, q[2].y) < BAND_LO || Math.min(q[0].y, q[1].y, q[2].y) > BAND_HI) continue;
    for (const p of clipSlab(q, BAND_LO, BAND_HI)) fp.expandByPoint(p);
  }
  const f = fp.isEmpty() ? scaled.clone().translate(off) : fp;
  const fc = f.getCenter(new Vector3());
  return {
    path,
    cx: x + fc.x * Math.cos(yaw) + fc.z * Math.sin(yaw),
    cz: z - fc.x * Math.sin(yaw) + fc.z * Math.cos(yaw),
    hx: (f.max.x - f.min.x) / 2,
    hz: (f.max.z - f.min.z) / 2,
    yaw,
    h: scaled.max.y - scaled.min.y,
    full: { x: (scaled.max.x - scaled.min.x) / 2, z: (scaled.max.z - scaled.min.z) / 2 },
  };
}

// Every collider of a map: models (incl. lamps), the locker, walls, tyre stacks
export function colliders(map) {
  const out = [];
  for (const o of map.objects) {
    if (o.collide === false) continue;
    const { count = 1, dx = 0, dz = 0 } = o.repeat ?? {};
    for (let i = 0; i < count; i++) out.push({ ...place(o.model, o.x + i * dx, o.z + i * dz, { yaw: (o.yaw ?? 0) * DEG, scale: o.scale, fit: o.fit, length: o.length }), name: o.name ?? o.model });
  }
  for (const [x, z, yaw, double] of map.lamps) out.push({ ...place(double ? 'roads/light-square-double' : 'roads/light-square', x, z, { yaw: yaw * DEG, scale: 7 / 0.6 }), name: 'lamp' });
  if (map.locker) out.push({ path: 'locker', name: 'locker', cx: map.locker.x, cz: map.locker.z, hx: 1.6, hz: 0.4, yaw: map.locker.yaw * DEG, h: 2.2 });
  for (const [x, z, lx, lz] of map.walls) out.push({ path: 'wall', name: 'wall', cx: x, cz: z, hx: lx / 2, hz: lz / 2, yaw: 0, h: 1.2 });
  out.push(...propColliders(map));
  for (const [x, z] of map.tyres) out.push({ path: 'tyres', name: 'tyres', cx: x, cz: z, hx: 0.65, hz: 0.65, yaw: 0, h: 1.6 });
  return out;
}

// Does a box (centre, half extents, yaw) overlap any collider? (separating axis test on the ground plane)
export function overlaps(list, box) {
  const axes = (b) => [[Math.cos(b.yaw), -Math.sin(b.yaw)], [Math.sin(b.yaw), Math.cos(b.yaw)]];
  const corners = (b) => {
    const [[ax, az], [bx, bz]] = axes(b);
    return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => [b.cx + ax * b.hx * i + bx * b.hz * j, b.cz + az * b.hx * i + bz * b.hz * j]);
  };
  return list.filter((c) => {
    const ca = corners(c), cb = corners(box);
    for (const [ux, uz] of [...axes(c), ...axes(box)]) {
      const pa = ca.map(([x, z]) => x * ux + z * uz), pb = cb.map(([x, z]) => x * ux + z * uz);
      if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
    }
    return true;
  });
}

// Own-geometry props (map.js prop()): collider half extents, same numbers as there
const PROP_HALF = { lawka: [0.9, 0.3], trzepak: [1.3, 0.08], piaskownica: [1.5, 1.5], hustawka: [1.6, 0.9], przystanek: [2.05, 0.85] };
export function propColliders(map) {
  return (map.props ?? []).map((p) => ({ path: p.type, name: p.type, cx: p.x, cz: p.z, hx: PROP_HALF[p.type][0], hz: PROP_HALF[p.type][1], yaw: ((p.yaw ?? 0) * Math.PI) / 180, h: 1 }));
}
