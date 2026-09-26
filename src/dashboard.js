// Dashboard in the style of 70s/80s Eastern Bloc cars (drawn from scratch, no original artwork copied): two round
// analogue dials with needles (speedometer, rev counter), a battery gauge like an old fuel gauge, a row of warning
// lamps (charging, lights, engine, handbrake), a gear window and a drum counter for the points. Warm amber backlight.
// It is drawn on a small canvas at low resolution and scaled up without smoothing (image-rendering: pixelated), so every
// line, digit and needle is made of big square pixels like the rest of the game.
const W = 256;
const H = 100;
const AMBER = '#ffb347';
const AMBER_DIM = '#8a5a22';
const NEEDLE = '#ff4a1c';
const FACE = '#120c08';
const BEZEL = '#3a2a1c';

// 3×5 bitmap digits and the few letters the dials need
const GLYPHS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  E: '111100110100111', F: '111100110100100', P: '110101110100100', R: '110101110101101', N: '101111111111101',
  K: '101101110101101', M: '101111111101101', H: '101101111101101', '/': '001001010100100', x: '000101010101000',
  '-': '000000111000000', ' ': '000000000000000', '½': '100100011001011',
};

export function createDashboard(canvas) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const needles = { speed: 0, rpm: 0, battery: 1 };

  const px = (x, y, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  function text(str, x, y, c = AMBER, align = 'left') {
    const s = String(str);
    const w = s.length * 4 - 1;
    let ox = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
    ctx.fillStyle = c;
    for (const ch of s) {
      const g = GLYPHS[ch] ?? GLYPHS[' '];
      for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(ox + (i % 3), Math.round(y) + Math.floor(i / 3), 1, 1);
      ox += 4;
    }
  }
  // Bresenham line, `w` pixels thick
  function line(x0, y0, x1, y1, c, w = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    ctx.fillStyle = c;
    for (;;) {
      ctx.fillRect(x0 - (w >> 1), y0 - (w >> 1), w, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function disc(cx, cy, r, c) {
    ctx.fillStyle = c;
    for (let y = -r; y <= r; y++) {
      const hw = Math.floor(Math.sqrt(r * r - y * y));
      ctx.fillRect(cx - hw, cy + y, hw * 2 + 1, 1);
    }
  }
  // Angle on a dial: value 0..1 along an arc from a0 to a1 (radians, screen: 0 = right, + = clockwise)
  const at = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];

  // Round dial: ticks every `minor`, numbers every `major` (label = value / labelDiv), red zone from `red`
  function dial(cx, cy, r, max, minor, major, labelDiv, red, label) {
    disc(cx, cy, r + 2, BEZEL);
    disc(cx, cy, r, FACE);
    const a0 = (135 * Math.PI) / 180, sweep = (270 * Math.PI) / 180;
    for (let v = 0; v <= max + 1e-6; v += minor) {
      const a = a0 + (v / max) * sweep;
      const big = Math.abs(v / major - Math.round(v / major)) < 1e-6;
      const c = red !== null && v >= red ? '#ff3a2a' : AMBER;
      const [x0, y0] = at(cx, cy, r - (big ? 6 : 3), a);
      const [x1, y1] = at(cx, cy, r - 1, a);
      line(x0, y0, x1, y1, c);
      if (big) {
        const [tx, ty] = at(cx, cy, r - 13, a);
        text(Math.round(v / labelDiv), tx, ty - 2, c, 'center');
      }
    }
    text(label, cx, cy + 12, AMBER_DIM, 'center');
  }
  function needle(cx, cy, r, value, max) {
    const a = (135 * Math.PI) / 180 + Math.min(1.02, Math.max(0, value / max)) * (270 * Math.PI) / 180;
    const [x, y] = at(cx, cy, r, a);
    line(cx, cy, x, y, NEEDLE, 2);
    disc(cx, cy, 3, '#2a1d12');
    px(cx, cy, '#6a4a2a');
  }
  // Lamp: a small window with an icon, lit or dark
  function lamp(x, y, on, colour, icon) {
    ctx.fillStyle = BEZEL;
    ctx.fillRect(x - 1, y - 1, 15, 11);
    ctx.fillStyle = on ? colour : '#1c1510';
    ctx.fillRect(x, y, 13, 9);
    const ink = on ? '#1a0e05' : '#3a2c20';
    icon(x, y, ink);
  }
  const icons = {
    battery: (x, y, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x + 2, y + 3, 9, 1); // outline of the box
      ctx.fillRect(x + 2, y + 7, 9, 1);
      ctx.fillRect(x + 2, y + 3, 1, 5);
      ctx.fillRect(x + 10, y + 3, 1, 5);
      ctx.fillRect(x + 3, y + 2, 2, 1); // terminals
      ctx.fillRect(x + 8, y + 2, 2, 1);
      ctx.fillRect(x + 4, y + 5, 2, 1); // − and +
      ctx.fillRect(x + 7, y + 5, 3, 1);
      ctx.fillRect(x + 8, y + 4, 1, 3);
    },
    light: (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x + 2, y + 2, 3, 5); ctx.fillRect(x + 5, y + 3, 1, 3); for (let i = 0; i < 3; i++) ctx.fillRect(x + 7, y + 2 + i * 2, 4, 1); },
    engine: (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x + 3, y + 3, 7, 4); ctx.fillRect(x + 5, y + 2, 3, 1); ctx.fillRect(x + 2, y + 4, 1, 2); ctx.fillRect(x + 10, y + 4, 1, 2); },
    brake: (x, y, c) => { text('P', x + 5, y + 2, c); ctx.fillStyle = c; ctx.fillRect(x + 2, y + 2, 1, 5); ctx.fillRect(x + 10, y + 2, 1, 5); },
  };

  // s: { speedKmh, rpm, redRpm, gear, battery (0..100), charging, highBeam, lightsOn, engineWarn, handbrake, points }
  function draw(s, dt) {
    const k = 1 - Math.exp(-12 * dt); // needles swing, not jump
    needles.speed += (s.speedKmh - needles.speed) * k;
    needles.rpm += (s.rpm - needles.rpm) * k;
    needles.battery += (s.battery / 100 - needles.battery) * (1 - Math.exp(-4 * dt));
    ctx.clearRect(0, 0, W, H);
    // Panel
    ctx.fillStyle = '#0a0705';
    ctx.fillRect(4, 6, W - 8, H - 10);
    ctx.fillStyle = BEZEL;
    ctx.fillRect(4, 6, W - 8, 1);
    ctx.fillRect(4, H - 5, W - 8, 1);
    // Speedometer 0–160 km/h
    dial(52, 52, 44, 160, 10, 20, 1, null, 'KM/H');
    // Rev counter 0–7 × 1000, red from the redline
    const redK = Math.floor((s.redRpm ?? 6000) / 500) / 2;
    dial(204, 52, 44, 7, 0.5, 1, 1, redK, 'x1000');
    // Battery gauge (like an old fuel gauge): 0 – ½ – 1 over the top of the middle
    const bx = 128, by = 44, br = 22;
    disc(bx, by, br + 2, BEZEL);
    disc(bx, by, br, FACE);
    ctx.fillStyle = '#0a0705';
    ctx.fillRect(bx - br - 2, by + 4, (br + 2) * 2 + 1, br);
    const g0 = (200 * Math.PI) / 180, gs = (140 * Math.PI) / 180;
    for (let i = 0; i <= 8; i++) {
      const a = g0 + (i / 8) * gs;
      const [x0, y0] = at(bx, by, br - (i % 4 === 0 ? 6 : 3), a);
      const [x1, y1] = at(bx, by, br - 1, a);
      line(x0, y0, x1, y1, i <= 1 ? '#ff3a2a' : AMBER);
    }
    text('0', bx - br + 3, by - 12, '#ff3a2a');
    text('½', bx, by - br + 7, AMBER, 'center');
    text('1', bx + br - 6, by - 12, AMBER);
    const ga = g0 + Math.max(0, Math.min(1, needles.battery)) * gs;
    const [nx, ny] = at(bx, by, br - 3, ga);
    line(bx, by, nx, ny, NEEDLE, 2);
    disc(bx, by, 2, '#2a1d12');
    icons.battery(bx - 7, by - 1, AMBER_DIM);
    // Warning lamps
    const ly = 68;
    lamp(100, ly, s.charging, '#6dff7a', icons.battery);
    lamp(115, ly, s.lightsOn, s.highBeam ? '#4aa8ff' : '#6dff7a', icons.light);
    lamp(130, ly, s.engineWarn, '#ffb020', icons.engine);
    lamp(145, ly, s.handbrake, '#ff3a2a', icons.brake);
    // Gear window and the drum counter (points)
    ctx.fillStyle = BEZEL;
    ctx.fillRect(196, 70, 17, 11);
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(197, 71, 15, 9);
    text(s.gear < 0 ? 'R' : s.gear, 204.5, 73, '#1a0e05', 'center');
    const pts = String(Math.min(999999, Math.max(0, Math.round(s.points)))).padStart(6, '0');
    ctx.fillStyle = BEZEL;
    ctx.fillRect(30, 70, 45, 11);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i >= 4 ? '#e8dcc0' : '#1c1510';
      ctx.fillRect(31 + i * 7, 71, 6, 9);
      text(pts[i], 32.5 + i * 7, 73, i >= 4 ? '#1a0e05' : AMBER);
    }
    // Needles last
    needle(52, 52, 38, needles.speed, 160);
    needle(204, 52, 38, needles.rpm / 1000, 7);
  }

  return { draw };
}
