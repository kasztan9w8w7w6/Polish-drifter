// The full-screen map (M / touch button / pad L3, part 6): a flat schematic drawn on a 2D canvas, not a second 3D
// camera. docs/gotowce.md picked the three.js webgl_multiple_views pattern (a real ortho camera) for this, but a
// canvas map is much lower risk without a way to see the result in this session (no interaction with
// RenderPixelatedPass, no camera-swap edge cases) and is just as testable – the projection math below is pure
// functions, checked in test/mapa.test.mjs. World → canvas is a simple flat (x,z) → (x,y) projection, pan and zoom
// only, north (−z) up.
export function createMapaUI(fab) {
  const root = document.createElement('div');
  root.id = 'f-mapa';
  root.hidden = true;
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'f-mapa-zamknij';
  closeBtn.textContent = '✕';
  root.appendChild(closeBtn);
  document.body.appendChild(root);
  const g = canvas.getContext('2d');

  let open = false;
  let pan = { x: 0, z: 0 }; // world centre of the view
  let zoomM = 260; // half-height of the view, in metres
  const MIN_ZOOM = 60, MAX_ZOOM = 1400;

  // Zone labels (approximate centres) and the closed road – v0.8 part 6
  const strefy = [
    { nazwa: 'PARK', x: 100, z: -10 },
    { nazwa: 'MIASTO', x: -20, z: 40 },
    { nazwa: 'WYLOTÓWKA', x: -1300, z: 55 },
    { nazwa: 'WIEŚ', x: fab.wies.x, z: fab.wies.z },
  ];

  function project(view, x, z) {
    const scale = view.h / (2 * zoomM);
    return { x: view.w / 2 + (x - pan.x) * scale, y: view.h / 2 + (z - pan.z) * scale };
  }
  function fit() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
  addEventListener('resize', fit);
  fit();

  // ---------- input: drag/wheel (mouse+touch), keyboard, pad ----------
  let dragging = null;
  canvas.addEventListener('pointerdown', (e) => (dragging = { x: e.clientX, y: e.clientY, px: pan.x, pz: pan.z }));
  addEventListener('pointermove', (e) => {
    if (!dragging || !open) return;
    const scale = canvas.height / (2 * zoomM);
    pan.x = dragging.px - (e.clientX - dragging.x) / scale;
    pan.z = dragging.pz - (e.clientY - dragging.y) / scale;
  });
  addEventListener('pointerup', () => (dragging = null));
  canvas.addEventListener('wheel', (e) => {
    if (!open) return;
    e.preventDefault();
    zoomM = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomM * (e.deltaY > 0 ? 1.15 : 1 / 1.15)));
  }, { passive: false });
  closeBtn.addEventListener('click', () => toggle(false));

  return {
    get open() {
      return open;
    },
    root,
    // toggle(force?): open/close; on open it centres on the car
    toggle(force, carPos) {
      open = force ?? !open;
      root.hidden = !open;
      if (open && carPos) (pan.x = carPos.x), (pan.z = carPos.z);
    },
    pan(dx, dz, dt) {
      pan.x += dx * zoomM * 0.9 * dt;
      pan.z += dz * zoomM * 0.9 * dt;
    },
    zoom(dz, dt) {
      zoomM = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomM * (1 + dz * dt)));
    },
    // draw one frame: carPos {x,z}, carYaw (rad, map convention: 0 = +x, ccw), target ({x,z,r}|null), path: [{x,z},…]
    render({ carPos, carYaw, target, path }) {
      if (!open) return;
      const view = { w: canvas.width, h: canvas.height };
      g.fillStyle = '#14140f';
      g.fillRect(0, 0, view.w, view.h);
      // the road (wylotówka + Park course), one polyline
      g.strokeStyle = '#8a8a80';
      g.lineWidth = Math.max(2, zoomM < 300 ? 7 : 3);
      g.beginPath();
      path.forEach((p, i) => {
        const s = project(view, p.x, p.z);
        i ? g.lineTo(s.x, s.y) : g.moveTo(s.x, s.y);
      });
      g.stroke();
      // the closed road east
      {
        const s = project(view, fab.zamknieta.x, fab.zamknieta.z);
        g.strokeStyle = '#e04a3a';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(s.x - 9, s.y - 9);
        g.lineTo(s.x + 9, s.y + 9);
        g.moveTo(s.x + 9, s.y - 9);
        g.lineTo(s.x - 9, s.y + 9);
        g.stroke();
      }
      // zone names
      g.fillStyle = '#ffe8a0';
      g.font = `${Math.max(11, Math.min(20, view.h / 32))}px Silkscreen, monospace`;
      g.textAlign = 'center';
      for (const s of strefy) {
        const p = project(view, s.x, s.z);
        if (p.x > -60 && p.x < view.w + 60 && p.y > -30 && p.y < view.h + 30) g.fillText(s.nazwa, p.x, p.y);
      }
      // the scene's target
      if (target) {
        const p = project(view, target.x, target.z);
        g.strokeStyle = '#ffd24a';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(p.x, p.y, 10, 0, Math.PI * 2);
        g.stroke();
      }
      // the player, an arrow pointing along carYaw (map: 0 = east/+x, ccw, matching course.heading's convention)
      {
        const p = project(view, carPos.x, carPos.z);
        g.save();
        g.translate(p.x, p.y);
        g.rotate(-carYaw + Math.PI / 2);
        g.fillStyle = '#6bd0ff';
        g.beginPath();
        g.moveTo(0, -11);
        g.lineTo(7, 9);
        g.lineTo(0, 4);
        g.lineTo(-7, 9);
        g.closePath();
        g.fill();
        g.restore();
      }
    },
  };
}
