import * as THREE from 'three';

// Visual side of the car only. Physics lives in vehicle.js; this module just mirrors its state.
const WHEEL_RADIUS = 0.3;
export const headlightSettings = { intensity: 70, range: 50 };

export function createCarView(scene, wheelCount = 4) {
  const chassisMesh = buildChassisMesh();
  scene.add(chassisMesh);
  const wheelMeshes = Array.from({ length: wheelCount }, () => {
    const m = buildWheelMesh();
    scene.add(m);
    return m;
  });

  const body = chassisMesh.children[0];
  function sync(state) {
    chassisMesh.position.copy(state.position);
    chassisMesh.quaternion.copy(state.quaternion);
    body.rotation.set(state.bodyRoll ?? 0, 0, state.bodyPitch ?? 0); // visual lean only
    state.wheels.forEach((w, i) => {
      wheelMeshes[i].position.copy(w.position);
      wheelMeshes[i].quaternion.copy(w.quaternion);
    });
  }

  // Headlights: two spot lights on the bonnet, aimed a bit down the road
  const headlights = [0.6, -0.6].map((z) => {
    const l = new THREE.SpotLight(0xfff1d0, headlightSettings.intensity, headlightSettings.range, 0.38, 0.5, 1.2);
    l.position.set(2.1, 0.15, z);
    l.target.position.set(20, -0.9, z * 3);
    chassisMesh.add(l, l.target);
    return l;
  });
  function applyHeadlights() {
    for (const l of headlights) {
      l.intensity = headlightSettings.intensity;
      l.distance = headlightSettings.range;
    }
  }

  return { chassisMesh, wheelMeshes, sync, applyHeadlights };
}

// Boxy 80s Polish sedan silhouette built from primitives (placeholder for a GLTF model).
function buildChassisMesh() {
  const root = new THREE.Group();
  const g = new THREE.Group(); // leaning body inside the root that follows the physics
  root.add(g);
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
  return root;
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
