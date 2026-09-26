import * as THREE from 'three';
import GUI from 'lil-gui';
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';

import { initPhysics, createPhysics } from './physics.js';
import { createVehicle } from './vehicle.ts';
import { tuning, presets, applyPreset, DEFAULT_PRESET } from './tuning.ts';
import { createCameraRig } from './camera.ts';
import { createCarView } from './car.js';
import { createTrack } from './track.js';
import { createSkidMarks, createSmoke } from './effects.js';
import { createInput } from './input.js';
import { createDriftScorer } from './drift.js';
import { createDistrict, lights } from './district.js';
import { createPixelComposer, installRadialFog, pixelizeScene, pixelArt } from './pixelart.js';
import { createOcclusion, occlusionSettings } from './occlusion.js';
import { headlightSettings, carLook } from './car.js';
import { createAudio, audioSettings } from './audio.js';
import { createGearbox, RED_RPM } from './gearbox.js';

// ---------- Renderer / scene: night on the estate ----------
installRadialFog(); // before any material compiles
const renderer = new THREE.WebGLRenderer({ antialias: false }); // pixel art: no AA, the pixel pass does the rest
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping; // keeps colours flat (ACES darkened the mid-tones)
document.body.appendChild(renderer.domElement);

// The darkness comes from the fog (black beyond `visibility` around the car), not from dim lights:
// near the car everything is lit enough to read.
const NIGHT = 0x020203;
const night = { visibility: 45, exposure: 1.1, ambient: 0.9, moon: 0.8, carLight: 14 };
const scene = new THREE.Scene();
scene.background = new THREE.Color(NIGHT);
scene.fog = new THREE.Fog(NIGHT, 100, night.visibility); // radial fog, see pixelart.js
const chaseCam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 400);
const dioCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 300);

const ambient = new THREE.HemisphereLight(0x7c86a4, 0x2a2622, night.ambient);
const moon = new THREE.DirectionalLight(0x9aa8d8, night.moon); // gives the toon shading its direction
moon.position.set(-30, 80, 45);
scene.add(ambient, moon, moon.target);
// Soft light riding above the car so it always reads (placed in the loop)
const fill = new THREE.PointLight(0xc8d4ff, night.carLight, 14, 1);
scene.add(fill, chaseCam, dioCam);

const { composer, bloom, apply: applyPixel, setCamera } = createPixelComposer(renderer, scene, dioCam);
function applyNight() {
  scene.fog.far = night.visibility;
  renderer.toneMappingExposure = night.exposure;
  ambient.intensity = night.ambient;
  moon.intensity = night.moon;
  fill.intensity = night.carLight;
}
applyNight();

// ---------- Physics ----------
await initPhysics();
const physics = createPhysics();
const track = createTrack(scene, physics);
// ?spawn=x,z,yawDeg – start somewhere else (handy for screenshots and testing a spot)
const spawnArg = new URLSearchParams(location.search).get('spawn')?.split(',').map(Number);
const car = createVehicle(physics, spawnArg?.length === 3 ? { spawn: { x: spawnArg[0], y: 1, z: spawnArg[1] }, spawnYaw: (spawnArg[2] * Math.PI) / 180 } : {});
const carView = await createCarView(scene);
const skids = createSkidMarks(scene);
const smoke = createSmoke(scene);
const district = await createDistrict(scene, physics);
pixelizeScene(scene);
const occlusion = createOcclusion();
for (const o of district.occluders) occlusion.add(o);
const audio = createAudio();
const gearbox = createGearbox();
// Browsers only allow sound after a user gesture
for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, () => audio.start(), { once: true });

// ---------- HUD / scoring ----------
const $ = (id) => document.getElementById(id);
const hud = { toast: $('toast'), telemetry: $('telemetry'), speed: $('speed'), gear: $('gear'), tach: $('tach'), rpm: $('rpm'), drift: $('drift'), points: $('drift-points'), combo: $('drift-combo'), score: $('score'), best: $('best') };
const TACH_SEGMENTS = 20;
hud.tach.innerHTML = '<i></i>'.repeat(TACH_SEGMENTS);
const tachCells = [...hud.tach.children];
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

// Short message in the middle of the screen (feedback for R / C / auto-unstick)
let toastTimer = 0;
function toast(text) {
  hud.toast.textContent = text;
  hud.toast.className = 'on';
  toastTimer = 1.2;
}

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
  mass: [300, 3000], gravityScale: [0.5, 3], sharpSteer: [0.5, 1.01], sharpThrottle: [0, 1], transitionSteer: [0.3, 1.01], driftAngleLowSpeed: [0.2, 1],
  driftAngleMax: [20, 60], dioPitch: [20, 80], dioYaw: [-180, 180], dioYawFollow: [0, 2], driftSpeedLoss: [0, 0.5], fovBase: [40, 90], fovFast: [40, 110], shakeSpeed: [0, 1],
};
const groups = {
  'Kula (Kenney)': ['mass', 'gravityScale', 'angularDamping', 'coastDamping', 'linearDamping'],
  'Silnik i hamulce': ['power', 'throttleResponse', 'reversePower', 'brakePower', 'handbrakeDrag', 'sideGrip'],
  Kierownica: ['steerRate', 'steerRateHigh', 'steerFullSpeed', 'turnSmoothing'],
  'Wejście w drift': ['driftMinSpeed', 'sharpSteer', 'sharpThrottle', 'sharpSpeed', 'sharpTime', 'driftExitDelay', 'transitionSteer'],
  'Kąt driftu': ['driftAngleBase', 'driftAngleSteer', 'driftAngleThrottle', 'driftAngleHandbrake', 'selfAlign', 'driftAngleLowSpeed', 'driftAngleMax', 'driftAngleRate', 'straightenRate', 'driftTurnRate', 'driftTurnSteer', 'driftSpeedLoss'],
  'Wygląd jazdy i kontakt': ['bodyRoll', 'bodyPitch', 'suspension', 'landingDamping', 'unstuckTime'],
  'Kamera Diorama': ['dioPitch', 'dioYaw', 'dioYawFollow', 'dioZoom', 'dioZoomFast', 'dioLead', 'dioFollow', 'shakeSpeed', 'shakeImpact'],
  'Kamera Za autem': ['camDistance', 'camDistanceFast', 'camHeight', 'camFollow', 'camYawFollow', 'camLead', 'fovBase', 'fovFast'],
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
const gfx = gui.addFolder('Grafika (noc, pixel-art)').close();
gfx.add(pixelArt, 'pixelSize', 1, 8, 1).name('rozmiar piksela').onChange(applyPixel);
gfx.add(pixelArt, 'edges', 0, 1.5, 0.05).name('obrysy (normalne)').onChange(applyPixel);
gfx.add(pixelArt, 'depthEdges', 0, 1.5, 0.05).name('obrysy (głębia)').onChange(applyPixel);
gfx.add(pixelArt, 'steps', 2, 8, 1).name('stopnie jasności').onChange(applyPixel);
gfx.add(pixelArt, 'posterize', 0, 1, 0.05).name('siła stopni na obrazie').onChange(applyPixel);
gfx.add(pixelArt, 'dither', 0, 1, 0.05).name('dithering').onChange(applyPixel);
gfx.add(pixelArt, 'snap', 0, 480, 10).name('drżenie PS1 (0 = off)').onChange(applyPixel);
gfx.add(night, 'exposure', 0.3, 3, 0.05).name('ekspozycja').onChange(applyNight);
gfx.add(night, 'visibility', 15, 150, 1).name('mgła: widoczność (m)').onChange(applyNight);
gfx.add(night, 'ambient', 0, 3, 0.05).name('światło otoczenia').onChange(applyNight);
gfx.add(night, 'moon', 0, 3, 0.05).name('księżyc').onChange(applyNight);
gfx.add(night, 'carLight', 0, 30, 0.5).name('światło przy aucie').onChange(applyNight);
gfx.addColor(carLook, 'paint').name('lakier Poloneza').onChange(() => carView.applyLook());
gfx.add(headlightSettings, 'intensity', 0, 200, 1).name('reflektory').onChange(() => carView.applyHeadlights());
gfx.add(headlightSettings, 'range', 10, 120, 1).name('zasięg reflektorów').onChange(() => carView.applyHeadlights());
gfx.add(lights, 'lamp', 0, 200, 1).name('latarnie').onChange(() => district.applyLights());
gfx.add(lights, 'lampRange', 5, 60, 1).name('zasięg latarni').onChange(() => district.applyLights());
gfx.add(lights, 'sign', 0.2, 3, 0.05).name('jasność szyldu').onChange(() => district.applyLights());
gfx.add(bloom, 'strength', 0, 2, 0.01).name('bloom');
gfx.add(bloom, 'threshold', 0, 1.5, 0.01).name('próg bloomu');
gfx.add(occlusionSettings, 'opacity', 0, 1, 0.05).name('przezroczystość zasłaniających').onChange(() => occlusion.applySettings());
const snd = gui.addFolder('Dźwięk').close();
snd.add(audioSettings, 'volume', 0, 1, 0.01).name('głośność');
snd.add(audioSettings, 'engine', 0, 2, 0.01).name('silnik');
snd.add(audioSettings, 'skid', 0, 2, 0.01).name('pisk opon');
snd.add(audioSettings, 'impact', 0, 2, 0.01).name('uderzenia');
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
const rig = createCameraRig(chaseCam, dioCam, scene.fog);

const input = createInput({
  reset: () => {
    car.reset();
    rig.reset();
    toast('Reset');
  },
  camera: () => toast(`Kamera: ${rig.nextMode()}`),
  gui: () => gui.show(gui._hidden),
  debug: () => (debugLines.visible = !debugLines.visible),
});

// ---------- Loop ----------
const timer = new THREE.Timer();
let lastUnstuck = 0;

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
  if (state.unstuck !== lastUnstuck) toast('Wypchnięto z przeszkody');
  lastUnstuck = state.unstuck;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) hud.toast.className = '';

  // Drift scoring
  const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(state.quaternion);
  const v = state.velocity;
  if (state.impact > CRASH_FORCE) scorer.crash();
  rig.hit(state.impact);
  audio.hit(state.impact);
  scorer.update(dt, fwd, v, state.grounded);

  // Dashboard: speed, virtual gear, rev counter
  const { gear, rpm } = gearbox.update(dt, state, controls.throttle);
  audio.update(dt, state, rpm, controls.throttle);
  hud.speed.textContent = Math.round(state.speed * 3.6);
  hud.gear.textContent = gear < 0 ? 'R' : gear;
  hud.rpm.textContent = Math.round(rpm / 100) * 100;
  const lit = Math.round((rpm / RED_RPM) * TACH_SEGMENTS);
  tachCells.forEach((c, i) => (c.className = i < lit ? (i >= TACH_SEGMENTS - 3 ? 'on red' : 'on') : ''));
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

  const px = Math.max(1, Math.round(pixelArt.pixelSize));
  const cam = rig.update(dt, state, { pixelsWide: Math.floor(innerWidth / px), pixelsHigh: Math.floor(innerHeight / px) });
  setCamera(cam);
  fill.position.copy(state.position).y += 5;
  occlusion.update(cam, state.position, state.quaternion);

  composer.render();
  requestAnimationFrame(tick);
}

addEventListener('resize', () => {
  chaseCam.aspect = innerWidth / innerHeight;
  chaseCam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  applyPixel();
});

tick();
