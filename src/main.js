import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';
import GUI from 'lil-gui';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createCar, tuning } from './car.js';
import { createTrack } from './track.js';
import { createSkidMarks, createSmoke } from './effects.js';
import { createInput } from './input.js';
import { createDriftScorer } from './drift.js';

// ---------- Renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb8c4d0, 120, 400);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 2000);

// Sky shader from three/addons, low sun for a golden-hour look
const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(78), THREE.MathUtils.degToRad(200));
sky.material.uniforms.turbidity.value = 6;
sky.material.uniforms.rayleigh.value = 1.5;
sky.material.uniforms.sunPosition.value.copy(sunDir);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(sky).texture;
scene.environmentIntensity = 0.35; // the HDR sky is very bright

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x404030, 0.6));
const sun = new THREE.DirectionalLight(0xffe2b8, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// Post-processing: high threshold so only emissive lamps bloom, not sunlit paint
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.4, 2.5);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- Physics ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
const groundMat = new CANNON.Material('ground');
const carMat = new CANNON.Material('car');
const propMat = new CANNON.Material('prop');
world.addContactMaterial(new CANNON.ContactMaterial(groundMat, carMat, { friction: 0.05, restitution: 0 }));
world.addContactMaterial(new CANNON.ContactMaterial(carMat, propMat, { friction: 0.2, restitution: 0.2 }));
world.addContactMaterial(new CANNON.ContactMaterial(groundMat, propMat, { friction: 0.6, restitution: 0.1 }));

const track = createTrack(scene, world, groundMat, propMat);
const car = createCar(scene, world, carMat);
const skids = createSkidMarks(scene);
const smoke = createSmoke(scene);

let physicsDebug = null;

// ---------- HUD / scoring ----------
const $ = (id) => document.getElementById(id);
const hud = { speed: $('speed'), drift: $('drift'), points: $('drift-points'), combo: $('drift-combo'), score: $('score'), best: $('best') };
let hudFlashTimer = 0;
const scorer = createDriftScorer((event, s) => {
  hud.score.textContent = s.total.toLocaleString('pl-PL');
  hud.best.textContent = s.best.toLocaleString('pl-PL');
  if (event === 'drifting') {
    hud.drift.className = '';
    hud.points.textContent = Math.round(s.current).toLocaleString('pl-PL');
    hud.combo.textContent = s.combo > 1 ? `x${s.combo.toFixed(1)}` : '';
  } else {
    hud.drift.className = event;
    hudFlashTimer = 1.2;
  }
});
hud.best.textContent = scorer.state.best.toLocaleString('pl-PL');

car.chassisBody.addEventListener('collide', (e) => {
  if (e.body === track.groundBody) return;
  if (Math.abs(e.contact.getImpactVelocityAlongNormal()) > 4) scorer.crash();
});

// ---------- Input / camera modes ----------
const cameraModes = [
  { offset: new THREE.Vector3(-7, 2.8, 0), look: new THREE.Vector3(2, 0.8, 0), lerp: 5 },
  { offset: new THREE.Vector3(-12, 6, 0), look: new THREE.Vector3(3, 0, 0), lerp: 3 },
  { offset: new THREE.Vector3(0.3, 1.2, 0), look: new THREE.Vector3(10, 0.9, 0), lerp: 30 },
];
let camMode = 0;

const gui = new GUI({ title: 'Tuning' });
gui.add(tuning, 'engineForce', 500, 6000, 50);
gui.add(tuning, 'brakeForce', 5, 150, 1);
gui.add(tuning, 'maxSteer', 0.2, 1, 0.01);
gui.add(tuning, 'steerSpeed', 1, 10, 0.1);
gui.add(tuning, 'frontGrip', 0.5, 6, 0.05);
gui.add(tuning, 'rearGrip', 0.3, 6, 0.05);
gui.add(tuning, 'handbrakeGrip', 0.1, 3, 0.05);
gui.add(tuning, 'handbrakeForce', 0, 150, 1);
gui.add(bloom, 'strength', 0, 2, 0.01).name('bloom');
gui.hide();

const input = createInput({
  KeyR: () => car.reset(),
  KeyC: () => (camMode = (camMode + 1) % cameraModes.length),
  KeyG: () => gui.show(gui._hidden),
  KeyF: () => {
    if (!physicsDebug) {
      const meshes = [];
      physicsDebug = CannonDebugger(scene, world, { color: 0x00ff00, onInit: (_b, mesh) => meshes.push(mesh) });
      physicsDebug.meshes = meshes;
      physicsDebug.visible = true;
    } else {
      // cannon-es-debugger has no dispose(); just toggle its meshes
      physicsDebug.visible = !physicsDebug.visible;
      for (const m of physicsDebug.meshes) m.visible = physicsDebug.visible;
    }
  },
});

// ---------- Loop ----------
const timer = new THREE.Timer();
const tmp = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const lookSmoothed = new THREE.Vector3();

function tick(time) {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  const controls = input.read();
  car.applyInput(controls, dt);
  world.fixedStep(1 / 60, dt);
  car.sync();
  track.sync();
  if (physicsDebug?.visible) physicsDebug.update();

  // Auto-reset if flipped or fell off
  const up = tmp.set(0, 1, 0).applyQuaternion(car.chassisMesh.quaternion);
  if (car.chassisBody.position.y < -5 || (up.y < 0.1 && car.chassisBody.velocity.length() < 1)) car.reset();

  // Drift scoring
  const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(car.chassisMesh.quaternion);
  const v = car.chassisBody.velocity;
  const grounded = car.vehicle.wheelInfos.some((w) => w.isInContact);
  scorer.update(dt, fwd, v, grounded);
  hud.speed.innerHTML = `${Math.round(Math.hypot(v.x, v.z) * 3.6)} <small>km/h</small>`;
  if (hudFlashTimer > 0 && (hudFlashTimer -= dt) <= 0) {
    hud.points.textContent = '';
    hud.combo.textContent = '';
    hud.drift.className = '';
  }

  // Tyre smoke + skid marks when wheels slide
  car.vehicle.wheelInfos.forEach((w, i) => {
    const sliding = w.isInContact && (w.skidInfo < 0.7 || (car.isRear(i) && controls.handbrake)) && v.length() > 3;
    if (sliding) {
      const p = tmp.copy(w.raycastResult.hitPointWorld);
      skids.add(i, p.clone());
      if (car.isRear(i) && Math.random() < 0.6) smoke.emit(p, Math.min(1, v.length() / 15));
    } else skids.lift(i);
  });
  smoke.update(dt);

  // Chase camera
  const mode = cameraModes[camMode];
  // Use yaw only, so the camera doesn't roll with the body
  const yaw = Math.atan2(-fwd.z, fwd.x);
  const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camTarget.copy(mode.offset).applyQuaternion(yawQ).add(car.chassisMesh.position);
  lookTarget.copy(mode.look).applyQuaternion(yawQ).add(car.chassisMesh.position);
  const k = 1 - Math.exp(-mode.lerp * dt);
  camera.position.lerp(camTarget, k);
  lookSmoothed.lerp(lookTarget, k);
  camera.lookAt(lookSmoothed);

  // Keep the shadow frustum around the car
  sun.position.copy(car.chassisMesh.position).addScaledVector(sunDir, 80);
  sun.target.position.copy(car.chassisMesh.position);

  composer.render();
  requestAnimationFrame(tick);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

camera.position.set(-10, 5, 0);
tick();
