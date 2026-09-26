import * as THREE from 'three';
import { BALL_RADIUS } from './vehicle.ts';

// "Plac manewrowy": a big asphalt lot fenced by concrete barriers, with cones and tyre stacks.
const SIZE = 160;
// The car's physics body is a sphere (radius 1 m) but the car is 4.3 m long, so static obstacles get
// a collision shell this much thicker than they look – the bonnet stops right at the visible surface.
const PAD = BALL_RADIUS;

export function createTrack(scene, physics) {
  const dynamic = []; // { body, mesh } pairs synced each frame

  // Ground
  physics.addStaticBox({ x: 0, y: -1, z: 0 }, { x: SIZE * 1.5, y: 1, z: SIZE * 1.5 }, { friction: 0.8 });

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(SIZE * 3, SIZE * 3),
    new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Concrete barriers around the lot (static)
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9a9a95, roughness: 0.9 });
  const half = SIZE / 2;
  const wall = (x, z, lx, lz) => {
    physics.addStaticBox({ x, y: 0.6, z }, { x: lx / 2 + PAD, y: 0.6, z: lz / 2 + PAD });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(lx, 1.2, lz), concrete);
    mesh.position.set(x, 0.6, z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  };
  wall(0, half, SIZE, 1);
  wall(0, -half, SIZE, 1);
  wall(half, 0, 1, SIZE);
  wall(-half, 0, 1, SIZE);

  // Traffic cones (dynamic, knockable)
  const coneGeo = new THREE.ConeGeometry(0.25, 0.7, 12);
  coneGeo.translate(0, 0.35, 0);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff5a00, roughness: 0.6 });
  const addCone = (x, z) => {
    const body = physics.addDynamicCone({ x, y: 0, z }, 0.25, 0.7, 3);
    const mesh = new THREE.Mesh(coneGeo, coneMat);
    mesh.castShadow = true;
    scene.add(mesh);
    dynamic.push({ body, mesh });
  };
  // Figure-eight markers + a slalom line
  for (const cx of [-25, 25]) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) addCone(cx + Math.cos(a) * 6, 30 + Math.sin(a) * 6);
  }
  for (let i = 0; i < 8; i++) addCone(-35 + i * 10, -20);

  // Tyre stacks (static obstacles)
  const tyreGeo = new THREE.TorusGeometry(0.45, 0.2, 8, 16);
  tyreGeo.rotateX(Math.PI / 2);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
  for (const [x, z] of [[0, 50], [50, 0], [-50, -10], [30, -50], [-40, 55]]) {
    physics.addStaticCylinder({ x, y: 0, z }, 0.65 + PAD, 1.6);
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(tyreGeo, tyreMat);
      m.position.set(x, 0.2 + k * 0.4, z);
      m.castShadow = true;
      scene.add(m);
    }
  }

  // Blocks of flats on the horizon – the essential Polish backdrop
  // At night only the lit windows show through the fog (emissive map = lit windows only)
  const [blokMap, blokLit] = blokTexture();
  const blokMat = new THREE.MeshStandardMaterial({ map: blokMap, emissiveMap: blokLit, emissive: 0xffc070, emissiveIntensity: 0.9, roughness: 0.9 });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = SIZE * 0.68 + (i % 3) * 12;
    const h = 20 + (i % 4) * 8;
    const m = new THREE.Mesh(new THREE.BoxGeometry(40, h, 12), blokMat);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    m.lookAt(0, h / 2, 0);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }

  return {
    sync() {
      for (const { body, mesh } of dynamic) {
        mesh.position.copy(body.position());
        mesh.quaternion.copy(body.quaternion());
      }
    },
  };
}

function asphaltTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a3a3c';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 20000; i++) {
    const v = 40 + Math.random() * 40;
    ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // Painted parking-lot lines
  ctx.strokeStyle = '#d8d8c8';
  ctx.lineWidth = 6;
  ctx.setLineDash([40, 30]);
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function blokTexture() {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    return [c, c.getContext('2d')];
  };
  const [c, ctx] = make();
  const [cl, lit] = make();
  ctx.fillStyle = '#8f8a7e';
  ctx.fillRect(0, 0, 256, 128);
  lit.fillStyle = '#000';
  lit.fillRect(0, 0, 256, 128);
  for (let y = 6; y < 128; y += 12) {
    for (let x = 4; x < 256; x += 12) {
      const on = Math.random() < 0.18;
      ctx.fillStyle = on ? '#ffd27a' : '#2b323b';
      ctx.fillRect(x, y, 7, 6);
      if (on) {
        lit.fillStyle = Math.random() < 0.2 ? '#9ab8ff' : '#ffd27a'; // the odd TV-blue window
        lit.fillRect(x, y, 7, 6);
      }
    }
  }
  return [c, cl].map((canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}
