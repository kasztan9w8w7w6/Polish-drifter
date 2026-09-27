import * as THREE from 'three';

// The ground of the estate as ONE pixel texture (0.25 m per texel), painted from the map file instead of Kenney road
// tiles: streets with sidewalks (`streets`), asphalt of lots and parking (`areas`), paths across the yards (`paths`),
// grass everywhere else. Kerbs are drawn on the edge of the asphalt; lines only on the main street (centre dashes,
// edge lines, zebra crossings). Corners and junctions are rounded by a morphological closing of the road mask
// (dilate + erode with an exact distance transform), so every bend and T-junction gets a fillet on its own –
// nothing to rotate, nothing to get wrong.
//
// rasterize(map) is pure logic (tested in Node: what is road, what is yard); createGround() paints it for the game.
export const RES = 0.25; // m per texel
export const HALF = 128; // the texture covers −128..128 m
export const K = { trawa: 0, chodnik: 1, ulica: 2, glowna: 3, asfalt: 4, ziemia: 5, bruk: 6 };
const ROADS = new Set([K.ulica, K.glowna, K.asfalt]);
export const isAsphalt = (k) => ROADS.has(k);

export function rasterize(map) {
  const n = Math.round((2 * HALF) / RES);
  const cells = new Uint8Array(n * n); // K.trawa = 0
  const toI = (v) => Math.floor((v + HALF) / RES);
  const centre = (i) => -HALF + (i + 0.5) * RES;
  // Fill cells within `r` of the segment a–b (a capsule); `fn(idx, dist)` decides
  function capsule(a, b, r, fn) {
    const [ax, az] = a, [bx, bz] = b;
    const x0 = Math.max(0, toI(Math.min(ax, bx) - r)), x1 = Math.min(n - 1, toI(Math.max(ax, bx) + r));
    const z0 = Math.max(0, toI(Math.min(az, bz) - r)), z1 = Math.min(n - 1, toI(Math.max(az, bz) + r));
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
    for (let j = z0; j <= z1; j++) {
      const z = centre(j);
      for (let i = x0; i <= x1; i++) {
        const x = centre(i);
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
        const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
        if (d <= r) fn(j * n + i, d);
      }
    }
  }
  // Square-ended segment (streets end flat at the fence, not round)
  function band(a, b, r, fn) {
    const [ax, az] = a, [bx, bz] = b;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    capsule(a, b, r * 1.5, (idx, d) => {
      const x = centre(idx % n), z = centre(Math.floor(idx / n));
      const along = (x - ax) * ux + (z - az) * uz;
      const side = Math.abs(-(x - ax) * uz + (z - az) * ux);
      if (along >= -r && along <= len + r && side <= r) fn(idx, side, along, len);
    });
  }
  function rect([x1, z1, x2, z2], fn) {
    for (let j = Math.max(0, toI(Math.min(z1, z2))); j <= Math.min(n - 1, toI(Math.max(z1, z2)) - 1); j++)
      for (let i = Math.max(0, toI(Math.min(x1, x2))); i <= Math.min(n - 1, toI(Math.max(x1, x2)) - 1); i++) fn(j * n + i);
  }
  const segs = (s) => s.pts.slice(1).map((p, k) => [s.pts[k], p]);

  // 1. Road mask (streets + asphalt areas that are part of the network, e.g. driveways) → closed (rounded corners)
  const road = new Uint8Array(n * n);
  for (const s of map.streets ?? []) for (const [a, b] of segs(s)) band(a, b, s.width / 2, (i) => (road[i] = 1));
  for (const a of map.areas ?? []) if (a.kind === 'asfalt' && a.rect) rect(a.rect, (i) => (road[i] = 1));
  const R = map.cornerRadius ?? 4;
  const closed = close(road, n, R / RES);
  // 2. Sidewalks: along each street, `sidewalk` m from its edge
  for (const s of map.streets ?? []) {
    const w = s.sidewalk ?? 0;
    if (w > 0) for (const [a, b] of segs(s)) band(a, b, s.width / 2 + w, (i) => (cells[i] = K.chodnik));
  }
  // 3. Areas (asphalt lots, paving, dirt), in file order
  for (const a of map.areas ?? []) if (a.rect) rect(a.rect, (i) => (cells[i] = K[a.kind] ?? K.asfalt));
  // 4. Paths across the yards
  for (const p of map.paths ?? []) for (const [a, b] of segs(p)) capsule(a, b, (p.width ?? 2) / 2, (i) => (cells[i] = K[p.kind ?? 'chodnik']));
  // 5. Street asphalt (with the fillets from the closing); the main street keeps its own kind (lines)
  for (let i = 0; i < n * n; i++) if (closed[i] && !isAsphalt(cells[i])) cells[i] = K.ulica;
  for (const s of map.streets ?? []) if (s.kind === 'glowna') for (const [a, b] of segs(s)) band(a, b, s.width / 2, (i) => (cells[i] = K.glowna));

  return {
    n,
    cells,
    at(x, z) {
      const i = toI(x), j = toI(z);
      return i < 0 || j < 0 || i >= n || j >= n ? K.trawa : cells[j * n + i];
    },
  };
}

// Morphological closing of a binary mask with a disc of radius r (in cells): dilate then erode, both from an exact
// Euclidean distance transform (Felzenszwalb & Huttenlocher), so it stays fast on a 1024² grid.
function close(mask, n, r) {
  const r2 = r * r;
  const d1 = edt(mask, n, 1); // distance² to the nearest road cell
  const dil = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) dil[i] = d1[i] <= r2 ? 1 : 0;
  const d2 = edt(dil, n, 0); // distance² to the nearest cell outside the dilated road
  const out = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) out[i] = d2[i] > r2 ? 1 : mask[i];
  return out;
}
function edt(mask, n, target) {
  const INF = 1e20;
  const f = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) f[i] = mask[i] === target ? 0 : INF;
  const col = new Float64Array(n), out = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const pass = (get, set) => {
    for (let q = 0; q < n; q++) col[q] = get(q);
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s;
      do {
        const p = v[k];
        s = (col[q] + q * q - (col[p] + p * p)) / (2 * q - 2 * p);
      } while (s <= z[k] && --k >= 0);
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      out[q] = (q - v[k]) ** 2 + col[v[k]];
    }
    for (let q = 0; q < n; q++) set(q, out[q]);
  };
  for (let x = 0; x < n; x++) pass((q) => f[q * n + x], (q, val) => (f[q * n + x] = val));
  for (let y = 0; y < n; y++) pass((q) => f[y * n + q], (q, val) => (f[y * n + q] = val));
  return f;
}

// ---------- Painting (browser) ----------
const hash = (i, s = 0) => {
  let h = (i * 374761393 + s * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const PALETTE = {
  [K.trawa]: [[34, 48, 30], [30, 43, 27], [40, 54, 33], [27, 38, 25]],
  [K.chodnik]: [[92, 90, 86], [86, 84, 80], [98, 95, 90]],
  [K.ulica]: [[48, 48, 52], [44, 44, 48], [52, 52, 55]],
  [K.glowna]: [[46, 46, 50], [42, 42, 46], [50, 50, 53]],
  [K.asfalt]: [[54, 54, 57], [50, 50, 53], [58, 57, 60]],
  [K.ziemia]: [[70, 58, 42], [64, 52, 38], [76, 63, 46]],
  [K.bruk]: [[84, 72, 66], [76, 66, 60], [90, 78, 70]],
};

export function paintGround(map, raster = rasterize(map)) {
  const { n, cells } = raster;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(n, n);
  const px = img.data;
  const put = (i, [r, g, b]) => ((px[i * 4] = r), (px[i * 4 + 1] = g), (px[i * 4 + 2] = b), (px[i * 4 + 3] = 255));
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const idx = j * n + i;
      const k = cells[idx];
      const pal = PALETTE[k];
      let c = pal[Math.floor(hash(idx) * pal.length)];
      if (k === K.chodnik && (i % 4 === 0 || j % 4 === 0)) c = c.map((v) => v - 14); // 1 m slabs
      if (k === K.bruk && ((i + (j >> 1) * 2) % 2 === 0) !== (j % 2 === 0)) c = c.map((v) => v - 8);
      if (k === K.trawa && hash(idx, 7) > 0.97) c = [22, 32, 20]; // tufts
      if (isAsphalt(k) && hash(Math.floor(i / 6) + Math.floor(j / 6) * 999, 3) > 0.985) c = c.map((v) => v - 7); // patches
      // Kerb: asphalt next to something that isn't
      if (isAsphalt(k)) {
        const edge = [idx - 1, idx + 1, idx - n, idx + n].some((q) => q >= 0 && q < n * n && !isAsphalt(cells[q]));
        if (edge) c = [128, 126, 120];
      }
      put(idx, c);
    }
  }
  ctx.putImageData(img, 0, 0);
  // Lines on the main street: dashed centre line, edge lines, zebra crossings
  const toPx = (v) => (v + HALF) / RES;
  ctx.fillStyle = '#c8c4b0';
  for (const s of map.streets ?? []) {
    if (s.kind !== 'glowna') continue;
    for (let k = 1; k < s.pts.length; k++) {
      const [ax, az] = s.pts[k - 1], [bx, bz] = s.pts[k];
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      const junction = (x, z) => (map.streets ?? []).some((o) => o !== s && o.pts.some(([px2, pz2]) => Math.hypot(px2 - x, pz2 - z) < s.width / 2 + o.width / 2 + 2));
      for (let t = 0; t < len; t += 0.25) {
        const x = ax + ux * t, z = az + uz * t;
        if (junction(x, z)) continue;
        const dash = t % 6 < 3;
        for (const off of [0, s.width / 2 - 0.5, -(s.width / 2 - 0.5)]) {
          if (off === 0 && !dash) continue;
          ctx.fillRect(Math.floor(toPx(x - uz * off)), Math.floor(toPx(z + ux * off)), 1, 1);
        }
      }
    }
  }
  ctx.fillStyle = '#d8d4c4';
  for (const [x, z, alongX = true] of map.crossings ?? []) {
    const s = (map.streets ?? []).find((o) => o.kind === 'glowna');
    const w = s?.width ?? 10;
    for (let k = -2; k < 2; k++) {
      // stripes 0.5 m wide across the street, 4 m long band
      if (alongX) ctx.fillRect(Math.floor(toPx(x + k)), Math.floor(toPx(z - w / 2 + 0.5)), 2, Math.round((w - 1) / RES));
      else ctx.fillRect(Math.floor(toPx(x - w / 2 + 0.5)), Math.floor(toPx(z + k)), Math.round((w - 1) / RES), 2);
    }
  }
  return canvas;
}

export function createGround(scene, map) {
  const canvas = paintGround(map);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 2 * HALF), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.004;
  plane.receiveShadow = true;
  scene.add(plane);
  return plane;
}
