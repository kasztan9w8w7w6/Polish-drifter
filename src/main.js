import * as THREE from 'three';
import GUI from 'lil-gui';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { initPhysics, createPhysics } from './physics.js';
import { createVehicle } from './vehicle.ts';
import { tuning, presets, applyPreset, DEFAULT_PRESET } from './tuning.ts';
import { createCameraRig } from './camera.ts';
import { createCarView } from './car.js';
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
renderer.toneMappingExposure = 0.5;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb8c4d0, 120, 400);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 2000);

// Sky shader from three/addons. Sun at 25° elevation with a small halo, so it doesn't glare into the chase camera.
const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(65), THREE.MathUtils.degToRad(200));
sky.material.uniforms.turbidity.value = 6;
sky.material.uniforms.rayleigh.value = 1.5;
sky.material.uniforms.mieCoefficient.value = 0.002; // smaller, dimmer sun halo
sky.material.uniforms.sunPosition.value.copy(sunDir);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(sky).texture;
scene.environmentIntensity = 0.25; // the HDR sky is very bright

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
await initPhysics();
const physics = createPhysics();
const track = createTrack(scene, physics);
const car = createVehicle(physics);
const carView = createCarView(scene);
const skids = createSkidMarks(scene);
const smoke = createSmoke(scene);

// ---------- HUD / scoring ----------
const $ = (id) => document.getElementById(id);
const hud = { telemetry: $('telemetry'), speed: $('speed'), drift: $('drift'), points: $('drift-points'), combo: $('drift-combo'), score: $('score'), best: $('best') };
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

const CRASH_FORCE = 300000; // N – sphere contact force counted as a crash (measured in Node: 10 km/h = 79 kN, 25 km/h = 463 kN)

// ---------- Tuning panel (lil-gui, key G / pad Start) ----------
const gui = new GUI({ title: 'Tuning (G)' });
const panel = { preset: DEFAULT_PRESET, export: exportTuning, import: () => showJson('', true) };
gui.add(panel, 'preset', Object.keys(presets)).name('Preset').onChange((name) => {
  applyPreset(name);
  car.applyParams();
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
});
gui.add(panel, 'export').name('Eksport ustawień (JSON)');
gui.add(panel, 'import').name('Wczytaj JSON');
const RANGES = {
  mass: [300, 3000], gravityScale: [0.5, 3], sharpSteer: [0.5, 1.01], transitionSteer: [0.3, 1.01],
  driftAngleMax: [20, 60], driftSpeedLoss: [0, 0.5], fovBase: [40, 90], fovFast: [40, 110], shakeSpeed: [0, 1],
};
const groups = {
  'Kula (Kenney)': ['mass', 'gravityScale', 'angularDamping', 'coastDamping', 'linearDamping'],
  'Silnik i hamulce': ['power', 'throttleResponse', 'reversePower', 'brakePower', 'handbrakeDrag', 'sideGrip'],
  Kierownica: ['steerRate', 'steerRateHigh', 'steerFullSpeed', 'turnSmoothing'],
  'Wejście w drift': ['driftMinSpeed', 'sharpSteer', 'sharpSpeed', 'driftExitDelay', 'transitionSteer'],
  'Kąt driftu': ['driftAngleBase', 'driftAngleSteer', 'driftAngleThrottle', 'driftAngleHandbrake', 'driftAngleMax', 'driftAngleRate', 'straightenRate', 'driftTurnRate', 'driftTurnSteer', 'driftSpeedLoss'],
  'Wygląd jazdy': ['bodyRoll', 'bodyPitch'],
  Kamera: ['camDistance', 'camDistanceFast', 'camHeight', 'camFollow', 'camYawFollow', 'camLead', 'fovBase', 'fovFast', 'shakeSpeed', 'shakeImpact'],
};
for (const [title, keys] of Object.entries(groups)) {
  const folder = gui.addFolder(title).close();
  for (const key of keys) {
    const v = presets[DEFAULT_PRESET][key];
    const [min, max] = RANGES[key] ?? (v < 0 ? [v * 3, 0] : [0, Math.max(v * 3, 1)]);
    const c = folder.add(tuning, key, min, max);
    if (title === 'Kula (Kenney)') c.onChange(() => car.applyParams());
  }
}
const debugFolder = gui.addFolder('Grafika').close();
debugFolder.add(bloom, 'strength', 0, 2, 0.01).name('bloom');
gui.hide();

function exportTuning() {
  const json = JSON.stringify({ preset: panel.preset, ...tuning }, null, 2);
  navigator.clipboard?.writeText(json).catch(() => {});
  console.log(json);
  showJson(json, false);
}

// Small overlay with a textarea: shows exported JSON, or takes pasted JSON to load
function showJson(text, editable) {
  document.getElementById('json-box')?.remove();
  const box = document.createElement('div');
  box.id = 'json-box';
  box.innerHTML = `<p>${editable ? 'Wklej JSON z ustawieniami:' : 'Skopiowano do schowka (jeśli przeglądarka pozwoliła). Możesz też zaznaczyć tekst:'}</p>
    <textarea spellcheck="false"></textarea><div><button data-a="ok">${editable ? 'Wczytaj' : 'Zamknij'}</button>${editable ? '<button data-a="close">Anuluj</button>' : ''}</div>`;
  const area = box.querySelector('textarea');
  area.value = text;
  box.addEventListener('click', (e) => {
    const a = e.target.dataset?.a;
    if (a === 'ok' && editable) {
      try {
        const data = JSON.parse(area.value);
        for (const k of Object.keys(tuning)) if (typeof data[k] === 'number') tuning[k] = data[k];
        car.applyParams();
        gui.controllersRecursive().forEach((c) => c.updateDisplay());
      } catch (err) {
        area.value = `Błędny JSON: ${err.message}\n\n${area.value}`;
        return;
      }
    }
    if (a) box.remove();
  });
  document.body.appendChild(box);
  area.focus();
  area.select();
}

// ---------- Physics debug view (Rapier's debugRender, key F) ----------
const debugLines = new THREE.LineSegments(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }),
);
debugLines.frustumCulled = false;
debugLines.renderOrder = 999;
debugLines.visible = false;
scene.add(debugLines);
function updateDebugLines() {
  const { vertices, colors } = physics.debugLines();
  debugLines.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  debugLines.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
}

// ---------- Input / camera ----------
const rig = createCameraRig(camera);

const input = createInput({
  reset: () => {
    car.reset();
    rig.reset();
  },
  camera: () => rig.nextMode(),
  gui: () => gui.show(gui._hidden),
  debug: () => (debugLines.visible = !debugLines.visible),
});

// ---------- Loop ----------
const timer = new THREE.Timer();

function tick(time) {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  const controls = input.read(dt);
  physics.step(dt, (h) => car.update(controls, h), () => car.afterStep());
  const state = car.read();
  carView.sync(state);
  track.sync();
  if (debugLines.visible) updateDebugLines();

  // Auto-reset if it falls off the world (the sphere can't end up on its roof)
  if (state.position.y < -5) car.reset();

  // Drift scoring
  const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(state.quaternion);
  const v = state.velocity;
  if (state.impact > CRASH_FORCE) scorer.crash();
  rig.hit(state.impact);
  scorer.update(dt, fwd, v, state.grounded);
  hud.speed.innerHTML = `${Math.round(state.speed * 3.6)} <small>km/h</small>`;
  hud.telemetry.textContent = `kąt ${Math.round(Math.abs(state.slipAngle))}° · ${panel.preset}${input.gamepadConnected ? ' · pad' : ''}`;
  if (hudFlashTimer > 0 && (hudFlashTimer -= dt) <= 0) {
    hud.points.textContent = '';
    hud.combo.textContent = '';
    hud.drift.className = '';
  }

  // Tyre smoke + skid marks when wheels slide
  state.wheels.forEach((w, i) => {
    if (w.sliding) {
      skids.add(i, w.point.clone());
      if (w.rear && Math.random() < 0.6) smoke.emit(w.point, Math.min(1, state.speed / 15));
    } else skids.lift(i);
  });
  smoke.update(dt);

  rig.update(dt, state);

  // Keep the shadow frustum around the car
  sun.position.copy(state.position).addScaledVector(sunDir, 80);
  sun.target.position.copy(state.position);

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
