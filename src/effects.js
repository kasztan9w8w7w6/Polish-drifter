import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

// Skid marks: one InstancedMesh used as a ring buffer of small dark quads.
export function createSkidMarks(scene, max = 4000) {
  const geo = new THREE.PlaneGeometry(1, 0.22);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);

  let next = 0;
  const last = new Map(); // wheel index -> last contact point

  return {
    add(wheel, point) {
      const prev = last.get(wheel);
      last.set(wheel, point.clone());
      if (!prev) return;
      const d = point.distanceTo(prev);
      if (d < 0.05 || d > 2) return;
      const mid = prev.clone().add(point).multiplyScalar(0.5);
      mid.y = 0.02;
      _q.setFromAxisAngle(_up, Math.atan2(-(point.z - prev.z), point.x - prev.x));
      _s.set(d, 1, 1);
      mesh.setMatrixAt(next, _m.compose(mid, _q, _s));
      next = (next + 1) % max;
      mesh.count = Math.max(mesh.count, next === 0 ? max : next);
      mesh.instanceMatrix.needsUpdate = true;
    },
    lift(wheel) {
      last.delete(wheel);
    },
  };
}

// Tyre smoke: a pool of billboard sprites with a soft radial texture.
export function createSmoke(scene, max = 300) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);

  const pool = [];
  for (let i = 0; i < max; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xdddddd, transparent: true, depthWrite: false }));
    s.visible = false;
    scene.add(s);
    pool.push({ sprite: s, life: 0, vel: new THREE.Vector3() });
  }
  let next = 0;

  return {
    emit(pos, intensity = 1) {
      const p = pool[next];
      next = (next + 1) % max;
      p.life = 1;
      p.sprite.visible = true;
      p.sprite.position.copy(pos);
      p.sprite.position.y += 0.2;
      p.vel.set((Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5);
      p.intensity = intensity;
    },
    update(dt) {
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt * 0.6;
        if (p.life <= 0) {
          p.sprite.visible = false;
          continue;
        }
        p.sprite.position.addScaledVector(p.vel, dt);
        const size = 1 + (1 - p.life) * 5;
        p.sprite.scale.set(size, size, 1);
        p.sprite.material.opacity = p.life * 0.45 * p.intensity;
      }
    },
  };
}
