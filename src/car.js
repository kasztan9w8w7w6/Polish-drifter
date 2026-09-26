import * as THREE from 'three';

// Visual side of the car only. Physics lives in vehicle.js; this module just mirrors its state.
const WHEEL_RADIUS = 0.3;

export function createCarView(scene, wheelCount = 4) {
  const chassisMesh = buildChassisMesh();
  scene.add(chassisMesh);
  const wheelMeshes = Array.from({ length: wheelCount }, () => {
    const m = buildWheelMesh();
    scene.add(m);
    return m;
  });

  function sync(state) {
    chassisMesh.position.copy(state.position);
    chassisMesh.quaternion.copy(state.quaternion);
    state.wheels.forEach((w, i) => {
      wheelMeshes[i].position.copy(w.position);
      wheelMeshes[i].quaternion.copy(w.quaternion);
    });
  }

  return { chassisMesh, wheelMeshes, sync };
}

// Boxy 80s Polish sedan silhouette built from primitives (placeholder for a GLTF model).
function buildChassisMesh() {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xc8102e, metalness: 0.4, roughness: 0.35 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.3, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.9, roughness: 0.1 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 3 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1100, emissiveIntensity: 2 });

  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(4.3, 0.32, 1.68), white, 0, -0.14, 0); // lower half white
  add(new THREE.BoxGeometry(4.3, 0.32, 1.68), paint, 0, 0.18, 0); // upper half red
  add(new THREE.BoxGeometry(2.1, 0.5, 1.54), paint, -0.3, 0.58, 0);
  add(new THREE.BoxGeometry(2.15, 0.36, 1.56), glass, -0.3, 0.58, 0);
  for (const z of [0.6, -0.6]) {
    add(new THREE.BoxGeometry(0.05, 0.18, 0.4), lamp, 2.16, 0.14, z);
    add(new THREE.BoxGeometry(0.05, 0.16, 0.45), tail, -2.16, 0.18, z);
  }
  return g;
}

function buildWheelMesh() {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.28, 20),
    new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
  );
  tyre.rotation.x = Math.PI / 2; // cylinder axis Y -> axle Z
  tyre.castShadow = true;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_RADIUS * 0.6, WHEEL_RADIUS * 0.6, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.3 }),
  );
  rim.rotation.x = Math.PI / 2;
  g.add(tyre, rim);
  return g;
}
