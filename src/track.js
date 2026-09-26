import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// "Plac manewrowy": a big asphalt lot fenced by concrete barriers, with cones and tyre stacks.
const SIZE = 160;

export function createTrack(scene, world, groundMaterial, propMaterial) {
  const dynamic = []; // { body, mesh } pairs synced each frame

  // Ground
  // A thick static box rather than a rotated CANNON.Plane: the plane's AABB is computed
  // wrong after rotation, so vehicle raycasts miss it on half of the map.
  const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
  groundBody.addShape(new CANNON.Box(new CANNON.Vec3(SIZE * 1.5, 1, SIZE * 1.5)));
  groundBody.position.set(0, -1, 0);
  world.addBody(groundBody);

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
    const body = new CANNON.Body({ mass: 0, material: propMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(lx / 2, 0.6, lz / 2)));
    body.position.set(x, 0.6, z);
    world.addBody(body);
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
    const body = new CANNON.Body({ mass: 3, material: propMaterial });
    body.addShape(new CANNON.Cylinder(0.05, 0.25, 0.7, 8), new CANNON.Vec3(0, 0.35, 0));
    body.position.set(x, 0, z);
    body.allowSleep = true;
    world.addBody(body);
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
    const body = new CANNON.Body({ mass: 0, material: propMaterial });
    body.addShape(new CANNON.Cylinder(0.65, 0.65, 1.6, 12), new CANNON.Vec3(0, 0.8, 0));
    body.position.set(x, 0, z);
    world.addBody(body);
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(tyreGeo, tyreMat);
      m.position.set(x, 0.2 + k * 0.4, z);
      m.castShadow = true;
      scene.add(m);
    }
  }

  // Blocks of flats on the horizon – the essential Polish backdrop
  const blokMat = new THREE.MeshStandardMaterial({ map: blokTexture(), roughness: 0.9 });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = SIZE * 0.95 + (i % 3) * 15;
    const h = 20 + (i % 4) * 8;
    const m = new THREE.Mesh(new THREE.BoxGeometry(40, h, 12), blokMat);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    m.lookAt(0, h / 2, 0);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }

  return {
    groundBody,
    sync() {
      for (const { body, mesh } of dynamic) {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
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
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9c2b0';
  ctx.fillRect(0, 0, 256, 128);
  for (let y = 6; y < 128; y += 12) {
    for (let x = 4; x < 256; x += 12) {
      ctx.fillStyle = Math.random() < 0.25 ? '#ffd27a' : '#3b4450';
      ctx.fillRect(x, y, 7, 6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
