import * as THREE from 'three';
import { loadGltf } from './gltf.js';

// Visual side of the car only. Physics lives in vehicle.ts; this module just mirrors its state.
// Model: "1993 FSO Polonez MR93 (LP)" by KrStolorz (Sketchfab, see CREDITS.md), converted by
// scripts/convert-assets.mjs (logo removed, fictional plate). The wheels are bones of the skinned body,
// so they spin and steer by rotating those bones. If the model can't be loaded, a primitive car is used.
const WHEEL_RADIUS = 0.3;
const RIDE_HEIGHT = 0.72; // car origin above the ground (vehicle.ts)
export const headlightSettings = { intensity: 30, range: 45 }; // decay 1: a long, even beam on the asphalt
export const carLook = { colour: '', paint: '#c9b48a' }; // colour = name from the profile's palette, paint = hex

// profile: car profile (src/cars/*.json) – model path, length, paint material and palette
export async function createCarView(scene, profile) {
  const look = profile.look;
  carLook.colour = look.defaultPaint;
  carLook.paint = look.paints[look.defaultPaint];
  const root = new THREE.Group(); // follows the physics pose
  const body = new THREE.Group(); // visual lean inside it
  root.add(body);
  scene.add(root);

  let wheels = []; // { bone, rest, up, axle, front } for the model, or meshes for the fallback
  let fallbackWheels = null;
  try {
    const gltf = await loadGltf(`${import.meta.env.BASE_URL}${look.model}`);
    wheels = fitCar(gltf.scene, body, look.length, look.frontYawDeg);
    if (new URLSearchParams(location.search).has('debugcar')) {
      root.updateMatrixWorld(true);
      console.log('wheels', JSON.stringify(wheels.map((w) => [w.bone.name, w.bone.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3))])));
      console.log('box', JSON.stringify(new THREE.Box3().setFromObject(body, true)));
    }
  } catch (err) {
    console.warn('Polonez model not loaded, using the primitive car', err);
    body.add(buildChassisMesh());
    fallbackWheels = Array.from({ length: 4 }, () => {
      const m = buildWheelMesh();
      scene.add(m);
      return m;
    });
  }

  const q = new THREE.Quaternion();
  function sync(state) {
    root.position.copy(state.position);
    root.quaternion.copy(state.quaternion);
    body.rotation.set(state.bodyRoll ?? 0, 0, state.bodyPitch ?? 0); // visual lean only
    if (fallbackWheels) {
      state.wheels.forEach((w, i) => {
        fallbackWheels[i].position.copy(w.position);
        fallbackWheels[i].quaternion.copy(w.quaternion);
      });
      return;
    }
    for (const w of wheels) {
      w.bone.quaternion.copy(w.rest);
      if (w.front) w.bone.quaternion.multiply(q.setFromAxisAngle(w.up, state.steerAngle));
      w.bone.quaternion.multiply(q.setFromAxisAngle(w.axle, -state.wheelSpin));
    }
  }

  // Headlights: two spot lights on the bonnet, aimed a bit down the road
  const headlights = [0.6, -0.6].map((z) => {
    const l = new THREE.SpotLight(0xfff1d0, headlightSettings.intensity, headlightSettings.range, 0.42, 0.45, 1);
    l.position.set(2.1, 0.0, z);
    l.target.position.set(20, -0.9, z * 3);
    root.add(l, l.target);
    return l;
  });
  // Brightness and reach 0..1 (main.js: full, or parking lights with an empty tank); high beams brighter and further
  const power = { brightness: 1, reach: 1, high: false };
  const lampMats = [];
  function applyHeadlights() {
    const k = power.high ? 1.6 : 1;
    for (const l of headlights) {
      l.intensity = headlightSettings.intensity * power.brightness * k;
      l.distance = headlightSettings.range * (0.2 + 0.8 * power.reach) * (power.high ? 1.5 : 1);
      l.angle = power.high ? 0.5 : 0.42;
    }
    // (collected on first use: pixelart.js swaps the materials for toon ones after the car is built)
    if (!lampMats.length) root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => m.name === 'Headlight' && lampMats.push(m)));
    for (const m of lampMats) m.emissiveIntensity = 2.5 * Math.max(0.05, power.brightness);
  }
  function setLights(brightness, reach, high) {
    Object.assign(power, { brightness, reach, high });
    applyHeadlights();
  }
  // (materials are swapped for toon ones later, so look the paint up by name)
  function applyLook() {
    root.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => m.name === look.paintMaterial && m.color.set(carLook.paint)));
  }
  applyLook();

  return { root, sync, applyHeadlights, setLights, applyLook, hasModel: !fallbackWheels };
}

// Scale the model to `length`, turn it so the headlights point along +X, stand it on the ground and
// find the wheel bones.
function fitCar(model, parent, length, frontYawDeg) {
  parent.add(model);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  // Front = where the headlight glass is, or a manual override (look.frontYawDeg in the car profile – e.g. a model
  // like the T3 bus with no "Headlight" material and nothing else to tell front from back) or +Z by default
  let headlight = null;
  model.traverse((o) => {
    if (o.isMesh && /headlight/i.test([].concat(o.material)[0]?.name ?? '')) headlight = o;
  });
  const front = headlight ? new THREE.Box3().setFromObject(headlight, true).getCenter(new THREE.Vector3()).sub(centre) : new THREE.Vector3(0, 0, 1);
  front.y = 0;
  const yaw = frontYawDeg != null ? -(frontYawDeg * Math.PI) / 180 : Math.atan2(-front.z, front.x); // rotate this much the other way to face +X
  const holder = new THREE.Group();
  parent.add(holder);
  holder.add(model);
  holder.rotation.y = -yaw;
  holder.scale.setScalar(length / Math.max(size.x, size.z));
  holder.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(holder, true);
  const c2 = fitted.getCenter(new THREE.Vector3());
  holder.position.set(-c2.x, -RIDE_HEIGHT - fitted.min.y, -c2.z);
  holder.updateMatrixWorld(true);

  // Materials: lights glow, glass tinted
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; // skinned bounds don't follow the bones
    for (const m of [].concat(o.material)) {
      if (m.name === 'Headlight') Object.assign(m, { emissive: new THREE.Color(0xfff4d8), emissiveIntensity: 2.5 });
      if (m.name === 'Tail_lights') Object.assign(m, { emissive: new THREE.Color(0xff2010), emissiveIntensity: 1.6 });
      if (m.name === 'Fog_lights' || m.name === 'Reverse_lights') m.color?.set(0x9a9a90);
      if (m.name === 'Glass') Object.assign(m, { opacity: 0.35, color: new THREE.Color(0x203040) });
    }
  });

  // Wheel bones (F_wheel.L, B_wheel.R, …) or, for a model with no armature (v0.8: the T3 bus, WFL/WFR/WBL/WBR are
  // plain transform nodes), the equivalent named nodes – rotation axes expressed in each one's own space either way
  const wheels = [];
  const parentInv = new THREE.Quaternion();
  const bodyQ = parent.getWorldQuaternion(new THREE.Quaternion());
  model.traverse((o) => {
    if (!/wheel/i.test(o.name) && !/^W[FB][LR]$/i.test(o.name)) return;
    o.parent.getWorldQuaternion(parentInv);
    const boneWorld = parentInv.clone().multiply(o.quaternion);
    const toLocal = boneWorld.clone().invert().multiply(bodyQ);
    wheels.push({
      bone: o,
      rest: o.quaternion.clone(),
      front: /^F_/i.test(o.name) || /^WF/i.test(o.name),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(toLocal).normalize(),
      axle: new THREE.Vector3(0, 0, 1).applyQuaternion(toLocal).normalize(),
    });
  });
  return wheels;
}

// Boxy 80s Polish sedan silhouette built from primitives (fallback if the model doesn't load).
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
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.28, 20), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }));
  tyre.rotation.x = Math.PI / 2; // cylinder axis Y -> axle Z
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS * 0.6, WHEEL_RADIUS * 0.6, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.3 }));
  rim.rotation.x = Math.PI / 2;
  g.add(tyre, rim);
  return g;
}
