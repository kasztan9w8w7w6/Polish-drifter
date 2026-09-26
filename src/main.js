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
import { createMap, lights } from './map.js';
import osiedle from './maps/osiedle.json';
import { createPixelComposer, installRadialFog, pixelizeScene, pixelArt } from './pixelart.js';
import { createOcclusion, occlusionSettings } from './occlusion.js';
import { headlightSettings, carLook } from './car.js';
import { createAudio, audioSettings } from './audio.js';
import { createGearbox } from './gearbox.js';
import { applyCar, gearsOf } from './cars.js';
import { createSurvival, headlightLevel, batterySettings } from './survival.js';
import { createNarrator, narratorSettings } from './narrator.js';
import { createMission, formatTime } from './mission.js';
import { createMarkers } from './marker.js';
import paczka from './missions/paczka.json';
import { isTouchDevice } from './touchstate.js';
import { createTouchControls, touchSettings } from './touch.js';
import { loadSettings, saveSettings, pixelSizeFor, loadProgress, saveProgress } from './settings.js';
import { createDashboard } from './dashboard.js';
import { createMenu } from './menu.js';

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

// ---------- Player settings (menu, localStorage) and the car profile (src/cars/*.json: adding a car = a new file) ----------
const settings = loadSettings();
const CARS = Object.fromEntries(Object.values(import.meta.glob('./cars/*.json', { eager: true, import: 'default' })).map((p) => [p.id, p]));
const profile = CARS.polonez ?? Object.values(CARS)[0];
if (presets[settings.difficulty]) applyPreset(settings.difficulty);
applyCar(tuning, profile);

// ---------- Physics ----------
await initPhysics();
const physics = createPhysics();
const map = osiedle;
const track = createTrack(scene, physics, map);
// ?spawn=x,z,yawDeg – start somewhere else (handy for screenshots and testing a spot)
const spawnArg = new URLSearchParams(location.search).get('spawn')?.split(',').map(Number);
const home = map.points.spawn;
const [sx, sz, sh] = spawnArg?.length === 3 ? spawnArg : [home.x, home.z, home.heading];
const car = createVehicle(physics, { spawn: { x: sx, y: 1, z: sz }, spawnYaw: (sh * Math.PI) / 180 });
const carView = await createCarView(scene, profile);
if (settings.paint && profile.look.paints[settings.paint]) {
  carLook.colour = settings.paint;
  carLook.paint = profile.look.paints[settings.paint];
  carView.applyLook();
}
const skids = createSkidMarks(scene);
const smoke = createSmoke(scene);
const district = await createMap(scene, physics, map);
pixelizeScene(scene);
const markers = createMarkers(scene); // (after pixelizeScene: unlit, keeps its own materials)
const occlusion = createOcclusion();
for (const o of district.occluders) occlusion.add(o);
const audio = createAudio();
const gearbox = createGearbox(gearsOf(profile));
// Browsers only allow sound after a user gesture
for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, () => audio.start(), { once: true });

// ---------- HUD / scoring ----------
const $ = (id) => document.getElementById(id);
const hud = { toast: $('toast'), telemetry: $('telemetry'), drift: $('drift'), points: $('drift-points'), combo: $('drift-combo'), best: $('best') };
const dashboard = createDashboard($('dashboard')); // Eastern Bloc dials (dashboard.js)
let hudFlashTimer = 0;
const scorer = createDriftScorer((event, s) => {
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

// ---------- Survival: battery, shop, running flat (survival.js); narrator and mission 1 ----------
const hudBat = { goal: $('goal'), narrator: $('narrator'), fade: $('fade'), summary: $('summary') };
const homeSave = { x: home.x, z: home.z, heading: home.heading };
const survival = createSurvival({ pad: map.shop.pad, save: homeSave, level: paczka.start.battery });
const narrator = createNarrator();
const mission = createMission(paczka, map.points);
const lightsState = { high: false };
let beepTimer = 0;
let summaryTimer = 0;
const score = () => scorer.state.total + scorer.state.current * scorer.state.combo;
const headingOf = (q) => {
  const f = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  return (Math.atan2(-f.z, f.x) * 180) / Math.PI;
};
function placeCar({ x, z, heading }) {
  car.reset({ x, y: 1, z }, (heading * Math.PI) / 180);
  rig.reset();
}
function handleMission(events) {
  for (const e of events) {
    if (e.type === 'say') narrator.say(e.lines);
    if (e.type === 'step') storeProgress();
    if (e.type === 'complete') showSummary(e.summary);
  }
}
// "Kontynuuj": the mission step and the save point (with its battery) go to localStorage
function storeProgress() {
  if (mission.state.running) saveProgress({ mission: paczka.id, step: mission.state.index, save: survival.state.save });
}
function continueGame() {
  const p = loadProgress();
  if (!p) return startMission();
  placeCar(p.save);
  survival.restart(p.save, Math.max(p.save.level ?? 0, batterySettings.respawnMin));
  narrator.clear();
  hudBat.summary.hidden = true;
  handleMission(mission.resume(p.step, score()));
}
function startMission(keepCar = false) {
  const p = map.points[paczka.start.point];
  if (!keepCar) placeCar(p);
  survival.restart({ x: p.x, z: p.z, heading: p.heading }, paczka.start.battery);
  narrator.clear();
  hudBat.summary.hidden = true;
  handleMission(mission.start(score()));
}
function showSummary(s) {
  hudBat.summary.innerHTML = `<h2>Misja zakończona: ${s.title}</h2><p><span>Czas</span><b>${formatTime(s.time)}</b></p>
    <p><span>Punkty za drift</span><b>${s.driftPoints.toLocaleString('pl-PL')}</b></p><small>Enter: dalej · N: jeszcze raz</small>`;
  hudBat.summary.hidden = false;
  summaryTimer = 15;
}

const CRASH_SPEED = 4; // m/s (≈ 14 km/h) straight into an obstacle counts as a crash (ends the drift combo)

// ---------- Tuning panel (lil-gui, key G / pad Start) ----------
const gui = new GUI({ title: 'Tuning (G)' });
const panel = { preset: presets[settings.difficulty] ? settings.difficulty : DEFAULT_PRESET, export: exportTuning, import: () => showJson('', true) };
gui.add(panel, 'preset', Object.keys(presets)).name('Preset').onChange((name) => {
  applyPreset(name);
  applyCar(tuning, profile); // the preset sets the driving feel, the car its mass and power
  car.applyParams();
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
});
gui.add(panel, 'export').name('Eksport ustawień (JSON)');
gui.add(panel, 'import').name('Wczytaj JSON');
const RANGES = {
  mass: [300, 3000], gravityScale: [0.5, 3], sharpSteer: [0.5, 1.01], sharpThrottle: [0, 1], transitionSteer: [0.3, 1.01], driftAngleLowSpeed: [0.2, 1],
  driftAngleMax: [20, 60], realCounter: [0, 1], handbrakeSteer: [0, 1], liftSpeed: [5, 40], liftSteer: [0, 1], liftDrop: [0, 1], liftWindow: [0.05, 1], proThrottleNeutral: [0, 1], sideGripHigh: [1, 30], driftSideGrip: [1, 30], counterSteerVisual: [0, 1.5], proSpinAngle: [45, 120], dioPitch: [20, 80], dioYaw: [-180, 180], dioYawFollow: [0, 2], driftSpeedLoss: [0, 0.5], fovBase: [40, 90], fovFast: [40, 110], shakeSpeed: [0, 1],
};
const groups = {
  'Kula (Kenney)': ['mass', 'gravityScale', 'angularDamping', 'coastDamping', 'linearDamping'],
  'Silnik i hamulce': ['power', 'throttleResponse', 'reversePower', 'brakePower', 'handbrakeDrag', 'sideGrip', 'sideGripHigh', 'driftSideGrip'],
  Kierownica: ['steerRate', 'steerRateHigh', 'steerFullSpeed', 'turnSmoothing'],
  'Wejście w drift': ['driftMinSpeed', 'handbrakeSteer', 'liftSpeed', 'liftSteer', 'liftDrop', 'liftWindow', 'sharpSteer', 'sharpThrottle', 'sharpSpeed', 'sharpTime', 'driftExitDelay', 'transitionSteer'],
  'Kąt driftu': ['driftAngleBase', 'driftAngleSteer', 'driftAngleThrottle', 'driftAngleHandbrake', 'selfAlign', 'driftAngleLowSpeed', 'driftAngleMax', 'driftAngleRate', 'straightenRate', 'driftTurnRate', 'driftTurnSteer', 'driftSpeedLoss'],
  'Kontra (Pro: prawdziwa)': ['counterSteerVisual', 'realCounter', 'proGrow', 'proGrowThrottle', 'proThrottleNeutral', 'proGrowHandbrake', 'proSteer', 'proSteerInto', 'proSpinAngle', 'proSpinTime'],
  'Wygląd jazdy i kontakt': ['bodyRoll', 'bodyPitch', 'suspension', 'landingDamping', 'unstuckTime', 'crashMinSpeed', 'crashRebound', 'crashStun'],
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
const carFolder = gui.addFolder(`Auto: ${profile.name}`).close();
carFolder.add(carLook, 'colour', Object.keys(profile.look.paints)).name('lakier (epoka)').onChange((name) => {
  carLook.paint = profile.look.paints[name];
  carView.applyLook();
  paintPicker.updateDisplay();
});
const paintPicker = carFolder.addColor(carLook, 'paint').name('lakier (dowolny)').onChange(() => carView.applyLook());
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
snd.add(audioSettings, 'warning', 0, 2, 0.01).name('ostrzeżenie baterii');
const bat = gui.addFolder('Bateria i misja').close();
bat.add(batterySettings, 'drainIdle', 0, 1, 0.01).name('rozładowanie: silnik (%/s)');
bat.add(batterySettings, 'drainDrive', 0, 3, 0.05).name('rozładowanie: jazda, maks. (%/s)');
bat.add(batterySettings, 'drainHighBeam', 0, 3, 0.05).name('rozładowanie: długie (%/s)');
bat.add(batterySettings, 'chargeMinAngle', 0, 60, 1).name('ładowanie: min. kąt (°)');
bat.add(batterySettings, 'chargeMinSpeed', 0, 25, 0.5).name('ładowanie: min. prędkość (m/s)');
bat.add(batterySettings, 'chargeRate', 0, 0.05, 0.001).name('ładowanie driftem (%/s na °·m/s)');
bat.add(batterySettings, 'streakTime', 0.5, 10, 0.1).name('seria: czas do pełnej premii (s)');
bat.add(batterySettings, 'streakBonus', 0, 5, 0.1).name('seria: premia (×)');
bat.add(batterySettings, 'hitSpeed', 0, 15, 0.5).name('uderzenie od (m/s)');
bat.add(batterySettings, 'hitCooldown', 0, 10, 0.1).name('po uderzeniu bez ładowania (s)');
bat.add(batterySettings, 'shopCharge', 1, 100, 1).name('ładowanie w sklepie (%/s)');
bat.add(batterySettings, 'low', 0, 50, 1).name('miganie świateł poniżej (%)');
bat.add(batterySettings, 'warn', 0, 50, 1).name('ostrzeżenie poniżej (%)');
bat.add(batterySettings, 'dyingTime', 0.5, 6, 0.1).name('gaśnięcie (s)');
bat.add(batterySettings, 'darkTime', 0.5, 6, 0.1).name('ciemny ekran (s)');
bat.add(batterySettings, 'respawnMin', 0, 100, 1).name('min. bateria po restarcie (%)');
bat.add(survival.state, 'level', 0, 100, 1).name('bateria teraz (%)').listen();
bat.add(narratorSettings, 'charsPerSec', 5, 120, 1).name('narrator: liter/s');
bat.add(narratorSettings, 'hold', 0.5, 10, 0.1).name('narrator: czas na ekranie (s)');
bat.add({ start: () => startMission() }, 'start').name('Misja 1 od nowa (N)');
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

const TOUCH = isTouchDevice(window); // by capabilities (coarse pointer / touch without hover), not by user agent
document.body.classList.toggle('touch', TOUCH);
const actions = {
  pause: () => {
    if (menu.open) return; // (the menu handles Esc / Start itself: back)
    setPaused(true);
    menu.openPause();
  },
  reset: () => {
    car.reset();
    rig.reset();
    toast('Reset');
  },
  camera: () => toast(`Kamera: ${rig.nextMode()}`),
  gui: () => gui.show(gui._hidden),
  debug: () => (debugLines.visible = !debugLines.visible),
  lights: () => {
    lightsState.high = !lightsState.high;
    toast(lightsState.high ? 'Długie światła (bateria szybciej schodzi)' : 'Krótkie światła');
  },
  mission: () => startMission(),
  confirm: () => (hudBat.summary.hidden = true),
};
const input = createInput(actions, () => settings.keys);
const touchControls = TOUCH ? createTouchControls({ actions }) : null;
if (touchControls) input.addSource(touchControls.read);

// ---------- Pause (app in the background, Esc / P, Start on the pad, ❚❚ on touch) and the portrait board ----------
let paused = false;
function setPaused(on) {
  paused = on;
  input.enabled = !on;
  touchControls?.releaseAll();
  audio.mute(on);
  document.body.classList.toggle('paused', on);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !paused) actions.pause(); // the pause menu is waiting when you come back
});
const portrait = matchMedia('(orientation: portrait)');
portrait.addEventListener?.('change', () => touchControls?.releaseAll());

// ---------- Performance: lower settings on touch devices, FPS counter in the panel ----------
const perf = { quality: settings.quality ?? (TOUCH ? 'niska' : 'wysoka'), fps: 0 };
// Game pixel size from the screen height (settings: Drobne / Średnie / Grube ≈ 540 / 360 / 240 game pixels tall)
function applyPixelSize() {
  pixelArt.pixelSize = pixelSizeFor(innerHeight, settings.pixels);
  applyPixel();
}
function applyQuality() {
  const low = perf.quality === 'niska';
  applyPixelSize();
  bloom.enabled = !low;
  district.setLampShare(low ? 2 : 1); // half the street-lamp lights
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}
applyQuality();
const perfFolder = gui.addFolder('Wydajność');
perfFolder.add(perf, 'fps').name('FPS').listen().disable();
perfFolder.add(perf, 'quality', ['wysoka', 'niska']).name('jakość').onChange(applyQuality);
if (touchControls) perfFolder.add(touchSettings, 'steering', ['joystick', 'przyciski']).name('skręt (dotyk)').onChange(() => touchControls.applySettings());
let fpsFrames = 0, fpsTime = 0;

// ---------- Menu (menu.js): main, garage, settings, pause ----------
let garage = false;
const garageLight = new THREE.PointLight(0xffd9a0, 0, 16, 1); // a bare bulb over the car in the garage view
scene.add(garageLight);
function applySettings(s) {
  if (presets[s.difficulty] && panel.preset !== s.difficulty) {
    panel.preset = s.difficulty;
    applyPreset(s.difficulty);
    applyCar(tuning, profile);
    car.applyParams();
  }
  night.exposure = s.exposure;
  applyNight();
  perf.quality = s.quality ?? (TOUCH ? 'niska' : 'wysoka');
  applyQuality();
  Object.assign(audioSettings, { volume: s.volume, engine: s.engine, skid: s.skid, impact: s.impact, warning: s.warning });
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}
const menu = createMenu({
  settings,
  paints: profile.look.paints,
  hooks: {
    play: () => (startMission(), setPaused(false)),
    continue: () => (continueGame(), setPaused(false)),
    hasProgress: () => !!loadProgress(),
    resume: () => setPaused(false),
    restart: () => (startMission(), setPaused(false)),
    toMenu: () => (storeProgress(), setPaused(true)),
    garage: (open) => {
      garage = open;
      garageLight.intensity = open ? 28 : 0;
      if (open) {
        placeCar(map.points.garage ?? home); // in front of the garages
        carView.sync(car.read());
      } else {
        applyNight(); // (fog distance back from the close-up)
        chaseCam.clearViewOffset();
      }
    },
    paint: (name) => {
      carLook.colour = name;
      carLook.paint = profile.look.paints[name];
      carView.applyLook();
    },
    apply: applySettings,
    captureKey: (cb) => input.captureKey(cb),
  },
});
applySettings(settings);
if (new URLSearchParams(location.search).has('debug')) window.agro = { survival, mission, narrator, car, menu, settings, perf: () => perf, paused: () => paused }; // for testing from the console
// ?spawn=… or ?graj skips the menu (testing); otherwise the game starts in the main menu, the world paused behind it
if (spawnArg?.length === 3 || new URLSearchParams(location.search).has('graj')) startMission(spawnArg?.length === 3);
else {
  setPaused(true);
  menu.openMain();
}
// ?bat=5 – start with that much battery (testing the flicker / running flat)
const batArg = Number(new URLSearchParams(location.search).get('bat'));
if (batArg > 0) survival.restart(survival.state.save, batArg);

// ---------- Loop ----------
const timer = new THREE.Timer();
let lastUnstuck = 0;
let lastSpins = 0;

function tick(time) {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  fpsFrames++;
  if ((fpsTime += timer.getDelta()) >= 0.5) {
    perf.fps = Math.round(fpsFrames / fpsTime);
    fpsFrames = fpsTime = 0;
  }
  menu.update(); // pad in the menu
  // Garage: the Polonez turns slowly under a bare bulb, seen from a low camera
  if (garage) {
    const p = carView.root.position;
    carView.root.rotateY(dt * 0.5);
    const a = timer.getElapsed() * 0.05;
    chaseCam.fov = 45;
    chaseCam.position.set(p.x + Math.cos(a) * 7.5, p.y + 1.6, p.z + Math.sin(a) * 7.5);
    chaseCam.lookAt(p.x, p.y - 0.1, p.z);
    chaseCam.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.22, 0, innerWidth, innerHeight); // car right of the menu
    garageLight.position.set(p.x + 1.5, p.y + 3.5, p.z + 1);
    setCamera(chaseCam);
    scene.fog.near = 7.5; // (radial fog centred this far along the view: on the car, pixelart.js)
    scene.fog.far = 45;
    composer.render();
    requestAnimationFrame(tick);
    return;
  }
  // Paused, or a phone held upright (the "turn the phone" board is showing): the world stands still
  if (paused || (TOUCH && portrait.matches)) {
    composer.render();
    requestAnimationFrame(tick);
    return;
  }
  const controls = input.read(dt);
  if (!survival.engineOn) {
    // Battery flat: no engine (no throttle, no reverse), the car just rolls to a stop; brakes and steering still work
    controls.throttle = 0;
    if (car.state.forwardSpeed < 0.5) controls.brake = 0;
  }
  physics.step(dt, (h) => car.update(controls, h), () => car.afterStep());
  const state = car.read();
  carView.sync(state);
  track.sync();
  if (debugLines.visible) updateDebugLines();

  // Auto-reset if it falls off the world (the sphere can't end up on its roof)
  if (state.position.y < -5) car.reset();
  if (state.unstuck !== lastUnstuck) toast('Wypchnięto z przeszkody');
  lastUnstuck = state.unstuck;
  if (state.spins !== lastSpins) {
    toast('Obrót!'); // Pro: over-rotated drift
    scorer.crash();
  }
  lastSpins = state.spins;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) hud.toast.className = '';

  // Drift scoring
  const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(state.quaternion);
  const v = state.velocity;
  if (state.crash > CRASH_SPEED) scorer.crash();
  rig.hit(state.crash);
  audio.hit(state.crash);
  scorer.update(dt, fwd, v, state.grounded);

  // Battery (charges from the same drift the points count), shop, running flat
  const topSpeed = tuning.power / tuning.angularDamping;
  const heading = headingOf(state.quaternion);
  const drifted = scorer.state.drifting ? scorer.state.angle : 0;
  for (const e of survival.update(dt, { x: state.position.x, z: state.position.z, heading, speed: state.speed, topSpeed, angle: drifted, grounded: state.grounded, highBeam: lightsState.high, crash: state.crash })) {
    handleMission(mission.notify(e));
    if (e === 'saved') {
      toast('Żappka: bateria 100%, zapisano');
      storeProgress();
    }
    if (e === 'hit') toast('Uderzenie – seria ładowania przerwana');
    if (e === 'dead') scorer.crash();
    if (e === 'respawn') {
      placeCar(survival.state.save);
      hudBat.fade.className = '';
    }
    if (e === 'dark') hudBat.fade.className = 'dark';
  }
  const sv = survival.state;
  const fadeTo = sv.phase === 'dying' ? Math.min(1, sv.phaseTime / batterySettings.dyingTime) : sv.phase === 'dark' ? 1 : 0;
  const fadeNow = Number(hudBat.fade.style.opacity || 0);
  hudBat.fade.style.opacity = fadeTo >= fadeNow ? fadeTo : Math.max(fadeTo, fadeNow - dt); // fades back in 1 s after a restart
  // Headlights follow the battery; after it runs flat they die out
  const hl = headlightLevel(sv.level, batterySettings);
  const dying = sv.phase === 'drive' ? 1 : sv.phase === 'dying' ? Math.max(0, 1 - sv.phaseTime / 0.8) : 0;
  carView.setLights(hl.brightness * dying, hl.reach, lightsState.high);
  if (sv.warn && (beepTimer -= dt) <= 0) {
    audio.beep();
    beepTimer = 1.2;
  }
  district.update(timer.getElapsed(), sv.charging);

  // Mission, target marker, narrator
  handleMission(mission.update(dt, { x: state.position.x, z: state.position.z, speed: state.speed, battery: sv.level, score: score() }));
  const target = mission.target();
  const dist = markers.update(timer.getElapsed(), target, state.position);
  hudBat.goal.innerHTML = mission.goal ? `Cel: ${mission.goal}${target ? ` <small>${Math.round(dist)} m</small>` : ''}` : '';
  const nr = narrator.update(dt);
  if (hudBat.narrator.textContent !== nr.text) hudBat.narrator.textContent = nr.text;
  hudBat.narrator.style.opacity = nr.opacity;
  if (summaryTimer > 0 && (summaryTimer -= dt) <= 0) hudBat.summary.hidden = true;

  // Dashboard: speed, virtual gear, rev counter
  const { gear, rpm, load } = gearbox.update(dt, state, controls.throttle);
  audio.update(dt, state, load, controls.throttle, survival.engineOn);
  const blink = Math.floor(timer.getElapsed() * 3) % 2 === 0;
  dashboard.draw({
    speedKmh: state.speed * 3.6,
    rpm: survival.engineOn ? rpm : 0, // battery flat: the engine is off
    redRpm: gearbox.gears.redRpm,
    gear,
    battery: sv.level,
    charging: sv.driftCharge > 0 || sv.charging,
    lightsOn: sv.level > 0,
    highBeam: lightsState.high,
    engineWarn: !survival.engineOn || (sv.level < batterySettings.warn && blink),
    handbrake: controls.handbrake > 0.5,
    points: score(),
  }, dt);
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
  applyPixelSize();
});

tick();
