import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BALL_RADIUS } from './vehicle.ts';

// Night-time housing-estate dressing around the lot: garages, pavilions, street lamps and the all-night
// shop "Żappka 24h". Models: Kenney Starter Kit City Builder (CC0), see CREDITS.md.
// Static obstacles get a collision shell BALL_RADIUS thicker than they look (same as track.js).
const BASE = `${import.meta.env.BASE_URL}assets/kenney/city/`;
const PAD = BALL_RADIUS;

// Lamps use decay 1 (not the physical 2): wide pools of light instead of bright dots
export const lights = { lamp: 22, lampRange: 30, sign: 1.4 };

export async function createDistrict(scene, physics) {
  const loader = new GLTFLoader();
  const load = (name) => loader.loadAsync(`${BASE}${name}.gltf`).then((g) => g.scene);
  const names = ['building-garage', 'building-small-a', 'building-small-b', 'building-small-c', 'building-small-d', 'grass-trees', 'grass-trees-tall'];
  const models = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await load(n).catch(() => null)])));

  // Place a model scaled to a footprint (sx × sz) and height sy, standing on the ground, rotated by yaw.
  const occluders = []; // objects that go see-through when they hide the car
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  function place(name, x, z, sx, sy, sz, yaw = 0, collide = true) {
    const src = models[name];
    if (collide) physics.addStaticBox({ x, y: sy / 2, z }, { x: sx / 2 + PAD, y: sy / 2, z: sz / 2 + PAD }, { rotation: yawQuat(yaw) });
    if (!src) return null; // model failed to load – the collider still keeps the layout honest
    const m = src.clone();
    box.setFromObject(m).getSize(size);
    m.scale.set(sx / size.x, sy / size.y, sz / size.z);
    box.setFromObject(m);
    m.position.set(x, -box.min.y, z);
    m.rotation.y = yaw;
    scene.add(m);
    if (collide) occluders.push(m);
    return m;
  }

  // Row of garages along the north wall ("blaszaki"/brick garages), doors facing the lot
  for (let i = 0; i < 12; i++) place('building-garage', -44 + i * 8, -73, 7.6, 2.8, 6);
  // Pavilions / small buildings along the south wall
  const pav = ['building-small-b', 'building-small-c', 'building-small-d'];
  for (let i = 0; i < 5; i++) place(pav[i % 3], -60 + i * 16, 72, 10, 4 + (i % 2) * 2, 8, Math.PI);
  // Some scruffy trees in the corners (no collision – they're behind the barriers)
  for (const [x, z] of [[-86, -86], [86, -84], [-84, 86], [88, 70], [-88, 30], [84, -40]]) place(Math.random() < 0.5 ? 'grass-trees' : 'grass-trees-tall', x, z, 8, 7, 8, Math.random() * 6, false);

  // Night shop on the east side, facing the lot (−X)
  place('building-small-a', 70, 26, 10, 4.5, 12);
  const sign = shopSign('Żappka 24h');
  sign.position.set(64.9, 3.4, 26);
  sign.rotation.y = -Math.PI / 2;
  scene.add(sign);
  const shopLight = new THREE.PointLight(0x7cffb0, 25, 18, 2);
  shopLight.position.set(62.5, 2.5, 26);
  scene.add(shopLight);

  // Street lamps: concrete post + sodium bulb + downward orange spot light
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5a5a58, roughness: 0.9 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff9a2e, emissiveIntensity: 1.2 });
  const postGeo = new THREE.CylinderGeometry(0.1, 0.16, 7, 6);
  const armGeo = new THREE.BoxGeometry(1.4, 0.12, 0.12);
  const bulbGeo = new THREE.BoxGeometry(0.5, 0.15, 0.3);
  const spots = [];
  for (const [x, z] of [[-40, -40], [40, -40], [-40, 40], [40, 40], [0, -62], [0, 62], [-62, 10], [58, 14], [60, -58], [-60, -60]]) {
    physics.addStaticCylinder({ x, y: 0, z }, 0.16 + PAD, 7);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, 3.5, z);
    const arm = new THREE.Mesh(armGeo, postMat);
    arm.position.set(x + 0.6, 6.9, z);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(x + 1.1, 6.78, z);
    const spot = new THREE.SpotLight(0xffa04a, lights.lamp, lights.lampRange, 1.1, 0.7, 1);
    spot.position.set(x + 1.1, 6.7, z);
    spot.target.position.set(x + 1.6, 0, z);
    scene.add(post, arm, bulb, spot, spot.target);
    occluders.push(post, arm);
    spots.push(spot);
  }

  return {
    occluders,
    applyLights() {
      for (const s of spots) {
        s.intensity = lights.lamp;
        s.distance = lights.lampRange;
      }
      sign.material.color.setScalar(lights.sign);
    },
  };
}

function yawQuat(yaw) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

// Glowing shop sign: canvas texture on an unlit plane (bloom picks it up; colour kept ≤ 1.4 so it doesn't blow out)
function shopSign(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#062d14';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#ffe14a';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = '#9dff6a';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color().setScalar(lights.sign) });
  return new THREE.Mesh(new THREE.PlaneGeometry(8, 2), mat);
}
