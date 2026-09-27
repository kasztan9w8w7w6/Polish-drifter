import * as THREE from 'three';
import { loadGltf } from './gltf.js';

// The neighbour's car in the race (race.js moves it along the route): a Kenney Car Kit model (CC0) 4.3 m long with
// spinning wheels, head- and tail-lights, and an obstacle box the player can bump into (physics.addMovableBox).
// Before the race it stands parked where the map puts it; after the finish it stays where it stopped.
const LENGTH = 4.3;

export async function createRival(scene, physics, model, { base = import.meta.env?.BASE_URL ?? '/' } = {}) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const wheels = [];
  try {
    const g = await loadGltf(`${base}assets/kenney/${model}.gltf`);
    const m = g.scene;
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    m.scale.setScalar(LENGTH / Math.max(size.x, size.z));
    box.setFromObject(m);
    m.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    m.traverse((o) => o.name?.startsWith('wheel') && wheels.push(o));
    root.add(m);
  } catch (e) {
    console.warn('auto przeciwnika', model, e);
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, LENGTH), new THREE.MeshStandardMaterial({ color: 0x8a2a2a })));
  }
  // Lights: two headlight spots forward (+Z of the model) and red tail-lights
  const head = new THREE.SpotLight(0xfff0c8, 40, 30, 0.6, 0.6, 1);
  head.position.set(0, 0.8, LENGTH / 2);
  head.target.position.set(0, 0, LENGTH / 2 + 10);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff4d0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  for (const side of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.05), lampMat);
    l.position.set(side, 0.62, LENGTH / 2 + 0.02);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), tailMat);
    t.position.set(side, 0.7, -LENGTH / 2 - 0.02);
    root.add(l, t);
  }
  root.add(head, head.target);
  const collider = physics.addMovableBox({ x: 0.85, y: 0.7, z: LENGTH / 2 }, { surface: 'car' });
  collider.enabled(false);
  let roll = 0;

  return {
    root,
    // heading: like the player's car (radians, +X forwards, CCW from above); speed m/s for the wheels
    set(x, z, heading, speed = 0, dt = 0) {
      root.visible = true;
      root.position.set(x, 0, z);
      root.rotation.y = heading + Math.PI / 2; // the model faces +Z
      collider.enabled(true);
      collider.set(x, z, root.rotation.y);
      roll += (speed * dt) / 0.35;
      for (const w of wheels) w.rotation.x = roll;
    },
    hide() {
      root.visible = false;
      collider.enabled(false);
    },
  };
}
