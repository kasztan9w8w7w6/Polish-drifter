// Street tiles from the map's road segments (pure logic: used by map.js and the map tests in Node).

// Road tiles for a street network: segments [[x1, z1], [x2, z2]] along the axes on a ROAD_TILE grid. Each cell gets
// the tile whose openings match its neighbours. Kenney tiles at yaw 0: straight open E–W, bend open E and N,
// T-junction ("intersection") open E, W and S, crossroad open everywhere. A yaw turns a local direction (x, z) into
// (x cos + z sin, −x sin + z cos). `crossings`: cells that get a zebra crossing (straight cells only).
export const ROAD_TILE = 10;
const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const TILES = [
  ['roads/road-crossroad', ['N', 'E', 'S', 'W']],
  ['roads/road-intersection', ['E', 'W', 'S']],
  ['roads/road-straight', ['E', 'W']],
  ['roads/road-bend', ['E', 'N']],
];
export function roadTiles(segments, crossings = []) {
  const cells = new Map();
  const key = (x, z) => `${x},${z}`;
  const cell = (x, z) => cells.get(key(x, z)) ?? (cells.set(key(x, z), { x, z, open: new Set() }), cells.get(key(x, z)));
  for (const [[x1, z1], [x2, z2]] of segments) {
    const n = Math.round(Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1)) / ROAD_TILE);
    const sx = Math.sign(x2 - x1), sz = Math.sign(z2 - z1);
    for (let i = 0; i <= n; i++) {
      const c = cell(x1 + sx * i * ROAD_TILE, z1 + sz * i * ROAD_TILE);
      if (i > 0) c.open.add(sx > 0 ? 'W' : sx < 0 ? 'E' : sz > 0 ? 'N' : 'S');
      if (i < n) c.open.add(sx > 0 ? 'E' : sx < 0 ? 'W' : sz > 0 ? 'S' : 'N');
    }
  }
  const zebra = new Set(crossings.map(([x, z]) => key(x, z)));
  const turn = ([x, z], k) => {
    const a = (k * Math.PI) / 2, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
    const v = [x * c + z * s, -x * s + z * c];
    return Object.keys(DIRS).find((d) => DIRS[d][0] === v[0] && DIRS[d][1] === v[1]);
  };
  const out = [];
  for (const c of cells.values()) {
    let open = [...c.open];
    if (open.length === 1) open = open[0] === 'E' || open[0] === 'W' ? ['E', 'W'] : ['N', 'S']; // dead end: straight
    for (const [model, local] of TILES) {
      if (local.length !== open.length) continue;
      const k = [0, 1, 2, 3].find((k) => local.every((d) => open.includes(turn(DIRS[d], k))));
      if (k === undefined) continue;
      const straight = model === 'roads/road-straight';
      out.push({ model: straight && zebra.has(key(c.x, c.z)) ? 'roads/road-crossing' : model, x: c.x, z: c.z, yaw: (k * Math.PI) / 2, open });
      break;
    }
  }
  return out;
}
