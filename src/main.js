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
import { applyCar, carDrivetrain } from './cars.js';
import { driveSettings } from './engine.js';
import { createEconomy, economySettings } from './economy.js';
import { createFiveG, fivegSettings, mastsOf } from './fiveg.js';
import { createNarrator, narratorSettings } from './narrator.js';
import { createMission, formatTime } from './mission.js';
import { createMarkers } from './marker.js';
import kampania from './story/kampania.json';
import teksty from './story/teksty.json';
import postacie from './story/postacie.json';
import { createCampaign } from './campaign.js';
import { createPeople } from './npc.js';
import { createDialogueUI } from './dialogueui.js';
import { createPanel } from './panel.js';
import { createRival } from './rival.js';
import { createRoute, createRace } from './race.js';
import { createCrowd } from './crowd.js';
import { clean } from './typewriter.js';
import { isTouchDevice } from './touchstate.js';
import { createTouchControls, touchSettings } from './touch.js';
import { loadSettings, saveSettings, pixelSizeFor, loadProgress, saveProgress, keyLabel } from './settings.js';
import { createDashboard } from './dashboard.js';
import { createMenu } from './menu.js';
import { createTurntable } from './turntable.js';
import { features } from './config.js';
import fabMapa from './fabula/mapa.json';
import fabPostacie from './fabula/postacie.json';
import { createSwiat, przygotujMape } from './fabula/swiat.js';
import { createFabula, fabulaSettings } from './fabula/gra.js';
import { slupkiSettings } from './fabula/slupki.js';
import { radioSettings } from './fabula/radio.js';

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

const { composer, bloom, apply: applyPixel, setCamera, setGlitch } = createPixelComposer(renderer, scene, dioCam);
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
// Engines (src/engines/*.json) and the car's real powertrain (engine.js: torque curve, gears, drag – v0.6c)
const ENGINES = Object.fromEntries(Object.values(import.meta.glob('./engines/*.json', { eager: true, import: 'default' })).map((e) => [e.id, e]));
const drivetrain = carDrivetrain(profile, ENGINES);
if (presets[settings.difficulty]) applyPreset(settings.difficulty);
applyCar(tuning, profile);

// ---------- Physics ----------
await initPhysics();
const physics = createPhysics();
const map = features.fabula ? przygotujMape(osiedle, fabMapa) : osiedle; // (the story's town: fabula/swiat.js)
const track = createTrack(scene, physics, map);
// ?spawn=x,z,yawDeg – start somewhere else (handy for screenshots and testing a spot)
const spawnArg = new URLSearchParams(location.search).get('spawn')?.split(',').map(Number);
const home = features.fabula ? fabMapa.start : map.points.spawn;
const [sx, sz, sh] = spawnArg?.length === 3 ? spawnArg : [home.x, home.z, home.heading];
const car = createVehicle(physics, { spawn: { x: sx, y: 1, z: sz }, spawnYaw: (sh * Math.PI) / 180, drivetrain });
const carView = await createCarView(scene, profile);
if (settings.paint && profile.look.paints[settings.paint]) {
  carLook.colour = settings.paint;
  carLook.paint = profile.look.paints[settings.paint];
  carView.applyLook();
}
const skids = createSkidMarks(scene);
const smoke = createSmoke(scene);
const district = await createMap(scene, physics, map);
// ---------- Story: missions in order (kampania.json), people (postacie.json + map npcs), conversations ----------
const MISSIONS = Object.fromEntries(Object.values(import.meta.glob('./missions/*.json', { eager: true, import: 'default' })).map((m) => [m.id, m]));
const DIALOGS = Object.fromEntries(Object.values(import.meta.glob('./story/dialogi/*.json', { eager: true, import: 'default' })).map((d) => [d.id, d]));
const PEOPLE = postacie.postacie;
const campaign = createCampaign(kampania, MISSIONS);
const people = createPeople(scene, physics, features.starePostacie ? map.npcs ?? [] : [], PEOPLE);
await people.ready;
// Mission targets: map points and the people's spots ("npc:seba"; kept up to date when someone moves)
const points = { ...map.points };
const syncPoint = (n) => (points[`npc:${n.id}`] = { x: n.root.position.x, z: n.root.position.z, r: 3.5, label: n.who.imie });
people.list.forEach(syncPoint);
// The neighbour's car: parked at the start of its race route until the race (rival.js, race.js)
const rivalSpec = Object.entries(PEOPLE).find(([, p]) => p.auto);
const rival = rivalSpec && features.wyscig ? await createRival(scene, physics, rivalSpec[1].auto) : null;
const parkRival = () => {
  const r = map.routes?.petla;
  if (!rival || !r) return;
  const route = createRoute(r);
  const p = route.at(-8), rx = -p.dz, rz = p.dx;
  rival.set(p.x + rx * 1.8, p.z + rz * 1.8, Math.atan2(-p.dz, p.dx));
};
parkRival();
// The story's world: the Park, Mirek's yard, the road out, the village, its people and cars (before pixelizeScene)
const swiat = features.fabula ? await createSwiat({ scene, physics, map, fab: fabMapa, postacie: fabPostacie.postacie }) : null;
pixelizeScene(scene);
const markers = createMarkers(scene); // (after pixelizeScene: unlit, keeps its own materials)
const occlusion = createOcclusion();
for (const o of district.occluders) occlusion.add(o);
const audio = createAudio();
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
    if (event === 'banked') banked(s);
  }
});
// A banked drift pays: cash during a mission (more in a show), respect when people saw it (economy.js)
let bankedTotal = 0;
function banked(s) {
  const pts = s.total - bankedTotal;
  bankedTotal = s.total;
  if (pts <= 0 || !features.kasaZaDrift) return;
  const pos = car.state.position;
  const nearPeople = people.list.some((n) => n.visible && Math.hypot(n.root.position.x - pos.x, n.root.position.z - pos.z) < economySettings.crowdRadius);
  const got = economy.drift(pts, { mission: mission.state.running, show: mission.state.step?.type === 'score', nearPeople });
  const bits = [got.kasa > 0 ? clean(teksty.zarobek).replace('{zl}', got.kasa.toFixed(2)) : '', got.szacun > 0 ? `+${Math.round(got.szacun)} ${teksty.hud.szacun}` : ''].filter(Boolean);
  if (got.levelUp) toast(clean(teksty.szacunWzrost).replace('{nazwa}', clean(economy.level().name)));
  else if (bits.length) toast(bits.join(' · '));
}
hud.best.textContent = scorer.state.best.toLocaleString('pl-PL');

// Short message in the middle of the screen (feedback for R / C / auto-unstick)
let toastTimer = 0;
function toast(text, big = false) {
  hud.toast.textContent = text;
  hud.toast.className = big ? 'on big' : 'on';
  toastTimer = 1.2;
}

// ---------- Fuel, cash, respect (economy.js); narrator and missions ----------
const hudBat = { goal: $('goal'), narrator: $('narrator'), fade: $('fade'), summary: $('summary'), talk: $('talk-hint'), wallet: $('wallet') };
const homeSave = { x: home.x, z: home.z, heading: home.heading };
let mdef = MISSIONS[campaign.first]; // the mission being played
const TANK = profile.real.tankL ?? 45;
const economy = createEconomy({ engine: ENGINES[profile.real.engine], tankL: TANK, fuel: (TANK * (mdef.start.paliwo ?? 50)) / 100, levels: teksty.szacun });
let save = { ...homeSave }; // where "Kontynuuj" puts the car (Żappka, a mission start)
let pushing = false; // empty tank: the player pushes the car
let pending = null; // the next mission, waiting for enough respect
const storyFlags = {}; // flags set in conversations (dialogue choices `set`), for later conditions
let offerTimer = 0;
const fiveg = features.maszty5g ? createFiveG(mastsOf(map)) : { update: () => ({ throttle: 1, lights: 1, noise: 0, crackle: 0, glitch: 0, say: false }) }; // 5G as atmosphere near the masts (fiveg.js)
const narrator = createNarrator();
if (!features.narrator) narrator.say = () => {}; // (projekt §5: no narrator)
let mission = createMission(mdef, points, teksty);
const dialogue = createDialogueUI({ people: PEOPLE, texts: teksty.rozmowa });
const choice = createPanel();
const crowd = createCrowd();
let talkResult = null; // { npc, dialog, result } for one frame after a conversation ends
let race = null; // the race in progress (race.js) and its step
let raceStep = null;
let raceRetry = 0; // s until a lost race is set up again
let lastCount = 0;
let freeRide = false; // every mission done
const lightsState = { high: false };
const score = () => scorer.state.total + scorer.state.current * scorer.state.combo;
const headingOf = (q) => {
  const f = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  return (Math.atan2(-f.z, f.x) * 180) / Math.PI;
};
function placeCar({ x, z, heading = 0 }) {
  car.reset({ x, y: 1, z }, ((heading ?? 0) * Math.PI) / 180); // (points without a heading face east)
  rig.reset();
}
function handleMission(events) {
  for (const e of events) {
    if (e.type === 'say') narrator.say(e.lines);
    if (e.type === 'step') {
      storeProgress();
      if (e.step.type === 'race') setupRace(e.step);
    }
    if (e.type === 'retry' && e.step.type === 'race') raceRetry = 3; // lost: set up again in a moment
    if (e.type === 'show-start') toast(clean(e.step.goal));
    if (e.type === 'complete') missionDone(e.summary);
  }
}
// "Kontynuuj": the mission, its step and the save point (with its battery) go to localStorage
function storeProgress() {
  if (mission.state.running) saveProgress({ mission: mdef.id, step: mission.state.index, save, flags: storyFlags, ...economy.snapshot() });
}
function useMission(id) {
  mdef = MISSIONS[id];
  mission = createMission(mdef, points, teksty);
  freeRide = false;
  endRace();
}
function continueGame() {
  const p = loadProgress();
  const r = campaign.resume(p);
  if (!p) return startMission();
  placeCar(p.save);
  save = { ...p.save };
  economy.restore(p);
  Object.assign(storyFlags, p.flags ?? {});
  narrator.clear();
  hudBat.summary.hidden = true;
  choice.close();
  if (!r.mission) return (freeRide = true), endRace();
  useMission(r.mission);
  handleMission(mission.resume(r.step, score()));
}
// id: which mission (default: the first); keepCar: go on from where the car is (the next mission after a summary);
// fresh: a new game (menu "Graj"): the tank at the mission's start level, no cash, no respect
function startMission(id = campaign.first, keepCar = false, fresh = false) {
  useMission(id);
  pending = null;
  const p = points[mdef.start.point];
  if (!keepCar) placeCar(p);
  save = keepCar ? { x: car.state.position.x, z: car.state.position.z, heading: headingOf(car.state.quaternion) } : { x: p.x, z: p.z, heading: p.heading ?? 0 };
  if (fresh) economy.restore({ fuel: (TANK * (mdef.start.paliwo ?? 50)) / 100, money: 0, respect: 0 });
  pushing = economy.state.empty;
  narrator.clear();
  hudBat.summary.hidden = true;
  choice.close();
  handleMission(mission.start(score()));
}
function missionDone(s) {
  const next = campaign.next(mdef.id);
  const got = economy.reward(s.reward ?? {});
  if (got.levelUp) toast(clean(teksty.szacunWzrost).replace('{nazwa}', clean(economy.level().name)));
  // "Kontynuuj" from now on starts the next mission (or free driving after the last one)
  saveProgress({ mission: next, step: 0, save, done: !next, ...economy.snapshot() });
  if (!next) narrator.say(kampania.koniec ?? []);
  const t = teksty.podsumowanie;
  const rw = s.reward ?? {};
  // (panel.js: buttons for touch, mouse, keyboard and pad; it stays until one is pressed)
  choice.show({
    title: `${clean(t.koniecMisji)}: ${s.title}`,
    rows: [[clean(t.czas), formatTime(s.time)], [clean(t.punkty), s.driftPoints.toLocaleString('pl-PL')], ...(rw.kasa || rw.szacun ? [[clean(t.nagroda ?? 'Nagroda'), `+${rw.kasa ?? 0} zł · +${rw.szacun ?? 0} ${teksty.hud.szacun}`]] : [])],
    buttons: [
      { label: clean(next ? t.dalej : t.wolnaJazda), action: nextMission },
      { label: clean(t.jeszczeRaz), action: () => startMission(mdef.id) },
    ],
  });
}
// Summary → "Dalej": the next mission from where the car stands – if there is enough respect for it (kampania.json
// wymagania); otherwise free driving until there is, then it is offered (a panel)
const needed = (id) => kampania.wymagania?.[id] ?? 0;
function nextMission() {
  if (!mission.state.complete) return false;
  const next = campaign.next(mdef.id);
  if (!next) freeRide = true;
  else if (economy.state.respect >= needed(next)) startMission(next, true);
  else {
    pending = next;
    freeRide = true;
    narrator.say(kampania.brakSzacunu ?? []);
  }
  return true;
}
function offerMission() {
  const m = MISSIONS[pending];
  choice.show({
    title: clean(kampania.nowaMisja ?? ''),
    text: clean(m.title),
    buttons: [
      { label: clean(teksty.podsumowanie.dalej), action: () => startMission(pending, true) },
      { label: clean(teksty.podsumowanie.pozniej ?? 'Później'), action: () => (offerTimer = 45) },
    ],
  });
}

// ---------- Fuel station, empty tank, Żappka (panels: touch, mouse, keyboard, pad) ----------
const zl = (v) => `${v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
let atStation = false, atShop = false, stuckTimer = 0, towTimer = 0;
function stationPanel() {
  const t = teksty.stacja;
  const fillL = Math.min(economy.space, economy.affordable);
  const buy = (l) => {
    const got = economy.buyFuel(l);
    if (got > 0) {
      toast(`+${got.toFixed(1)} l`);
      pushing = false;
      handleMission(mission.notify('stacja'));
      storeProgress();
    }
  };
  const forZl = (zlotys) => ({ label: t.zaKwote.replace('{zl}', zlotys), disabled: economy.litresFor(zlotys) <= 0 || economy.space <= 0 || economy.affordable < economy.litresFor(zlotys), action: () => buy(economy.litresFor(zlotys)) });
  choice.show({
    title: clean(t.nazwa),
    text: clean(economy.state.money < 0 ? t.naZeszyt : t.tekst),
    rows: [[t.wBaku, `${economy.state.fuel.toFixed(1)} / ${TANK} l`], [t.cena, `${zl(economySettings.fuelPrice)}/l`], [teksty.hud.kasa, zl(economy.state.money)]],
    buttons: [
      { label: `${t.doPelna} (${zl(economy.price(fillL))})`, disabled: fillL <= 0.05, action: () => buy(fillL) },
      forZl(20),
      forZl(50),
      { label: t.anuluj },
    ],
    cancel: 3,
  });
}
function emptyPanel() {
  const t = teksty.pusty;
  choice.show({
    title: clean(t.tytul),
    text: clean(economy.canTow ? t.tekst : t.brakKasy),
    buttons: [
      { label: t.pchaj, action: () => (pushing = true) },
      { label: t.kumpel.replace('{zl}', economySettings.towCost), disabled: !economy.canTow, action: tow },
    ],
    cancel: 0,
  });
}
function tow() {
  if (!economy.tow()) return;
  hudBat.fade.className = 'dark';
  hudBat.fade.style.opacity = 1;
  towTimer = 1.4; // the screen goes dark, the car turns up at the pump
  handleMission(mission.notify('holowanie'));
}
function shopPanel() {
  const t = teksty.zappka;
  choice.show({
    title: clean(t.tytul),
    text: `${clean(t.tekst)} ${clean(t.opisEnergetyka)}`,
    rows: [[teksty.hud.kasa, zl(economy.state.money)]],
    buttons: [
      { label: t.energetyk.replace('{zl}', economySettings.energyPrice), disabled: economy.state.money - economySettings.energyPrice < -economySettings.debtLimit, action: () => economy.buyEnergy() && toast(clean(t.wypity)) },
      { label: t.wyjdz },
    ],
    cancel: 1,
  });
}

// ---------- Conversations: stop next to someone, E / pad B / the touch button ----------
function startTalk() {
  if (dialogue.open || car.state.speed > 1.5) return;
  const n = people.near(car.state.position);
  if (!n) return;
  const id = (mission.state.running && mission.dialogFor(n.id)) || n.who.dialog;
  const def = DIALOGS[id];
  if (!def) return;
  input.enabled = false;
  touchControls?.releaseAll();
  dialogue.start(def, n.id, (res) => {
    input.enabled = !paused;
    talkResult = res;
    Object.assign(storyFlags, res.flags);
  }, { szacun: economy.state.respect, kasa: economy.state.money, flags: storyFlags }); // (conditions in the dialogue files)
}

// ---------- Race (race.js drives the rival; the mission checks won / lost) ----------
function setupRace(step) {
  const route = createRoute(map.routes[step.route]);
  race = createRace(route, { laps: step.laps ?? 2, countdown: 3 });
  raceStep = step;
  raceRetry = 0;
  lastCount = 0;
  // the grid: the rival on the right, the player on the left, 8 m before the line
  const p = route.at(-8), rx = -p.dz, rz = p.dx;
  const heading = Math.atan2(-p.dz, p.dx);
  placeCar({ x: p.x - rx * 1.8, z: p.z - rz * 1.8, heading: (heading * 180) / Math.PI });
  const r = race.rival.state;
  rival?.set(r.x, r.z, r.yaw);
  people.show(step.rival, false); // sitting in the car
}
function endRace() {
  race = null;
  raceStep = null;
  raceRetry = 0;
  for (const n of people.list) people.show(n.id, true);
  parkRival();
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
  driftAngleMax: [20, 60], realCounter: [0, 1], handbrakeSteer: [0, 1], liftSpeed: [5, 40], liftSteer: [0, 1], liftDrop: [0, 1], liftWindow: [0.05, 1], proThrottleNeutral: [0, 1], sideGripHigh: [1, 30], driftSideGrip: [1, 30], counterSteerVisual: [0, 1.5], proSpinAngle: [45, 120], proDangerAngle: [20, 90], proSpinDelay: [0.2, 3], dioPitch: [20, 80], dioYaw: [-180, 180], dioYawFollow: [0, 2], driftSpeedLoss: [0, 0.5], fovBase: [40, 90], fovFast: [40, 110], shakeSpeed: [0, 1],
};
const groups = {
  'Kula (Kenney)': ['mass', 'gravityScale', 'angularDamping', 'coastDamping', 'linearDamping'],
  'Silnik i hamulce': ['power', 'throttleResponse', 'reversePower', 'brakePower', 'handbrakeDrag', 'sideGrip', 'sideGripHigh', 'driftSideGrip'],
  Kierownica: ['steerRate', 'steerRateHigh', 'steerFullSpeed', 'turnSmoothing'],
  'Wejście w drift': ['driftMinSpeed', 'handbrakeSteer', 'liftSpeed', 'liftSteer', 'liftDrop', 'liftWindow', 'sharpSteer', 'sharpThrottle', 'sharpSpeed', 'sharpTime', 'driftExitDelay', 'transitionSteer'],
  'Kąt driftu': ['driftAngleBase', 'driftAngleSteer', 'driftAngleThrottle', 'driftAngleHandbrake', 'selfAlign', 'driftAngleLowSpeed', 'driftAngleMax', 'driftAngleRate', 'straightenRate', 'driftTurnRate', 'driftTurnSteer', 'driftSpeedLoss'],
  'Kontra (Pro: prawdziwa)': ['counterSteerVisual', 'realCounter', 'proGrow', 'proGrowThrottle', 'proThrottleNeutral', 'proGrowHandbrake', 'proSteer', 'proSteerInto', 'proDangerAngle', 'proSpinDelay', 'proSpinAngle', 'proSpinTime'],
  'Wygląd jazdy i kontakt': ['bodyRoll', 'bodyPitch', 'suspension', 'landingDamping', 'unstuckTime', 'crashMinSpeed', 'crashRebound', 'crashStun'],
  'Kamera Diorama': ['dioPitch', 'dioYaw', 'dioYawFollow', 'dioZoom', 'dioZoomFast', 'dioLead', 'dioFollow', 'shakeSpeed', 'shakeImpact', 'shakeWarning'],
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
const driveFolder = gui.addFolder('Napęd (realne dane)').close();
driveFolder.add(driveSettings, 'fun', 1, 3, 0.05).name('czynnik zabawy (przyspieszenie ×)');
driveFolder.add(driveSettings, 'shiftTime', 0.1, 1.2, 0.05).name('czas zmiany biegu (s)');
driveFolder.add(driveSettings, 'engineBrake', 0, 0.4, 0.01).name('hamowanie silnikiem');
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
snd.add(audioSettings, 'warning', 0, 2, 0.01).name('ostrzeżenie (rezerwa)');
snd.add(audioSettings, 'typing', 0, 2, 0.01).name('pisanie (narrator)');
snd.add(audioSettings, 'static', 0, 2, 0.01).name('szum 5G');
const g5f = gui.addFolder('5G (klimat)').close();
g5f.add(fivegSettings, 'radius', 5, 120, 1).name('zasięg masztu (m)');
g5f.add(fivegSettings, 'lights', 0, 1, 0.05).name('mruganie świateł');
g5f.add(fivegSettings, 'noise', 0, 1, 0.05).name('szum i trzaski');
g5f.add(fivegSettings, 'engine', 0, 1, 0.05).name('przerywanie silnika');
g5f.add(fivegSettings, 'image', 0, 1, 0.05).name('zakłócenia obrazu');
g5f.add(fivegSettings, 'comment', 5, 600, 5).name('narrator: co najmniej co (s)');
const bat = gui.addFolder('Paliwo, kasa, szacun i misja').close();
bat.add(economySettings, 'fuelScale', 1, 80, 1).name('paliwo: przyspieszenie spalania (×)');
bat.add(economySettings, 'driftFuel', 1, 3, 0.05).name('paliwo: drift pali (×)');
bat.add(economySettings, 'fuelPrice', 0.5, 20, 0.01).name('paliwo: cena (zł/l)');
bat.add(economySettings, 'reserve', 0, 0.5, 0.01).name('rezerwa (część baku)');
bat.add(economySettings, 'towCost', 0, 200, 1).name('holowanie (zł)');
bat.add(economySettings, 'debtLimit', 0, 200, 1).name('limit długu (zł)');
bat.add(economySettings, 'driftRate', 0, 0.1, 0.001).name('kasa za pkt driftu w misji (zł)');
bat.add(economySettings, 'showRate', 0, 0.2, 0.001).name('kasa za pkt driftu w pokazie (zł)');
bat.add(economySettings, 'respectRate', 0, 0.1, 0.001).name('szacun za pkt driftu przy ludziach');
bat.add(economySettings, 'respectMax', 0, 200, 1).name('szacun maks. za jeden drift');
bat.add(economySettings, 'crowdRadius', 5, 60, 1).name('„przy ludziach” (m)');
bat.add(economySettings, 'energyPrice', 0, 50, 0.5).name('energetyk: cena (zł)');
bat.add(economySettings, 'energyTime', 5, 300, 5).name('energetyk: czas (s)');
bat.add(economySettings, 'energyBoost', 1, 5, 0.1).name('energetyk: szacun (×)');
bat.add(economy.state, 'fuel', 0, TANK, 0.1).name('paliwo teraz (l)').listen();
bat.add(economy.state, 'money', -200, 1000, 1).name('kasa teraz (zł)').listen();
bat.add(economy.state, 'respect', 0, 1000, 1).name('szacun teraz').listen();
bat.add(narratorSettings, 'charsPerSec', 5, 120, 1).name('narrator: liter/s');
bat.add(narratorSettings, 'hold', 0.5, 10, 0.1).name('narrator: czas na ekranie (s)');
bat.add({ start: () => startMission(mdef.id) }, 'start').name('Misja od nowa (N)');
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
  mission: () => (fabula ? fabula.radioNext() : startMission(mdef.id)),
  confirm: () => {},
  talk: () => !choice.open && (fabula ? fabula.naprzod() : startTalk()),
  radio: () => fabula?.radioNext(),
  kartka: () => fabula && !fabula.ui.aktywne && fabula.kartka(),
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
// Garage: drag the car round with the mouse or a finger (turntable.js: inertia, the slow turn comes back when idle).
// The menu covers the screen, so the drag starts anywhere outside its buttons and sliders.
const turntable = createTurntable();
addEventListener('pointerdown', (e) => {
  if (!garage || e.target.closest?.('button, input, .m-paints')) return;
  turntable.grab(e.clientX, e.timeStamp / 1000);
  document.body.classList.add('grabbing');
});
addEventListener('pointermove', (e) => turntable.move(e.clientX, e.timeStamp / 1000));
for (const ev of ['pointerup', 'pointercancel']) {
  addEventListener(ev, (e) => {
    turntable.release(e.timeStamp / 1000);
    document.body.classList.remove('grabbing');
  });
}
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
  Object.assign(audioSettings, { volume: s.volume, engine: s.engine, skid: s.skid, impact: s.impact, warning: s.warning, typing: s.typing ?? 1 });
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}
const menu = createMenu({
  settings,
  paints: profile.look.paints,
  hooks: {
    play: () => (fabula ? fabula.nowaNoc() : startMission(campaign.first, false, true), setPaused(false)),
    continue: () => (fabula ? fabula.wczytaj() : continueGame(), setPaused(false)),
    hasProgress: () => (fabula ? fabula.hasSave() : !!loadProgress()),
    resume: () => setPaused(false),
    restart: () => (fabula ? fabula.nowaNoc() : startMission(mdef.id), setPaused(false)),
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
// ---------- The story (fabula/gra.js) ----------
const fabula = features.fabula
  ? createFabula({ swiat, fab: fabMapa, car, carView, economy, audio, rig, choice, toast: (t) => toast(t), drivetrain, tuning, sky: { scene, ambient, moon, night }, keys: settings.keys, keyLabel, onMenu: () => (setPaused(true), menu.openMain()) })
  : null;
if (fabula) {
  const sz = gui.addFolder('Fabuła (W nocy robota)').close();
  sz.add(fabulaSettings, 'zegarTempo', 0, 30, 0.5).name('zegar: tempo (×)');
  sz.add(fabulaSettings, 'sc0Limit', 10, 600, 5).name('sc. 0: jazda do telefonu (s)');
  sz.add(fabulaSettings, 'sc0Telefon', 1, 60, 1).name('sc. 0: telefon po beemce (s)');
  sz.add(fabulaSettings, 'kolysanie', 0, 1, 0.01).name('ładunek: ciągnie kierownicę');
  sz.add(fabulaSettings, 'tempoTestu', 1, 20, 1).name('przyspieszenie (testy)');
  sz.add(radioSettings, 'glosnosc', 0, 1, 0.01).name('radio: głośność');
  sz.add(radioSettings, 'sciszenie', 0, 1, 0.01).name('radio przy rozmowie');
  const sl = gui.addFolder('Słupki (6, próg 4 czyste)').close();
  sl.add(slupkiSettings, 'minKat', 5, 45, 1).name('czyste: kąt min. (°)');
  sl.add(slupkiSettings, 'okno', 2, 15, 0.5).name('czyste: okno (m)');
  sl.add(slupkiSettings, 'dotyk', 0, 1, 0.05).name('potrącenie: odległość (m)');
  sl.add(slupkiSettings, 'katZasieg', 1, 10, 0.5).name('kąt liczony ± (m)');
  sl.add(slupkiSettings, 'limitCzasu', 10, 120, 1).name('limit czasu (s)');
  if (new URLSearchParams(location.search).has('szybko')) fabulaSettings.tempoTestu = 8;
}
if (new URLSearchParams(location.search).has('debug')) window.agro = { fabula, fabulaSettings, rig, economy, points, fiveg, scorer, choice, get mission() { return mission; }, people, dialogue, get race() { return race; }, startMission, narrator, car, menu, settings, perf: () => perf, paused: () => paused, resume: () => setPaused(false), tt: () => turntable, carYaw: () => { const f = new THREE.Vector3(1, 0, 0).applyQuaternion(carView.root.quaternion); return Math.atan2(-f.z, f.x); } }; // for testing from the console
// ?plan – the whole map from straight above, lit like daytime (docs/mapa.md screenshot, checking the layout)
const PLAN = new URLSearchParams(location.search).has('plan');
if (PLAN) {
  const half = map.size / 2 + 8;
  const top = new THREE.OrthographicCamera(-half * (innerWidth / innerHeight), half * (innerWidth / innerHeight), half, -half, 1, 500);
  top.position.set(0, 200, 0);
  top.up.set(0, 0, -1); // north (−z) at the top of the image
  top.lookAt(0, 0, 0);
  scene.fog.near = 1e4;
  scene.fog.far = 2e4;
  ambient.intensity = 3;
  moon.intensity = 2.5;
  renderer.toneMappingExposure = 1.4;
  document.body.classList.add('plan');
  setCamera(top);
  const draw = () => {
    carView.sync(car.read());
    composer.render();
    requestAnimationFrame(draw);
  };
  draw();
  throw new Error('plan view'); // (stop here: no game loop, no menu)
}
// ?spawn=… or ?graj skips the menu (testing); otherwise the game starts in the main menu, the world paused behind it
if (spawnArg?.length === 3 || new URLSearchParams(location.search).has('graj')) fabula ? fabula.nowaNoc() : startMission(campaign.first, spawnArg?.length === 3);
else {
  setPaused(true);
  menu.openMain();
}
// ?paliwo=5 – start with that many litres (testing the reserve / an empty tank)
const fuelArg = new URLSearchParams(location.search).get('paliwo');
if (fuelArg !== null) economy.restore({ fuel: Number(fuelArg) });

// ---------- Loop ----------
const timer = new THREE.Timer();
let lastUnstuck = 0;
let lastSpins = 0;
let fabulaOut = { lock: false, cam: null, steer: 0 };

function tick(time) {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  fpsFrames++;
  if ((fpsTime += timer.getDelta()) >= 0.5) {
    perf.fps = Math.round(fpsFrames / fpsTime);
    fpsFrames = fpsTime = 0;
  }
  fit(); // (cheap when nothing changed)
  menu.update(); // pad in the menu
  choice.update(); // pad on the choice panel
  // Garage: the Polonez turns slowly under a bare bulb (or by hand), seen from a low camera
  if (garage) {
    const p = carView.root.position;
    carView.root.rotateY(turntable.update(dt));
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
  if (fabulaOut.lock) Object.assign(controls, { throttle: 0, steer: 0, handbrake: 0, brake: car.state.forwardSpeed > 0.3 ? 1 : 0 }); // (the story: the car stands)
  controls.steer = Math.max(-1, Math.min(1, controls.steer + fabulaOut.steer)); // (the rims sliding in the back)
  if (choice.open) Object.assign(controls, { throttle: 0, steer: 0, handbrake: 0, brake: car.state.forwardSpeed > 0.5 ? 1 : 0 }); // (a choice on screen: the car stops)
  if (race && race.countdown > 0) controls.throttle = 0; // no jump start
  const pushIt = economy.state.empty && pushing && controls.throttle > 0.1 && !choice.open;
  if (economy.state.empty) {
    // Empty tank: no engine (no throttle, no reverse), the car rolls to a stop; brakes and steering still work.
    // Pushing: the throttle pushes the car at walking pace (vehicle push()).
    controls.throttle = 0;
    if (car.state.forwardSpeed < 0.5) controls.brake = 0;
  }
  if (pushIt) car.push(1.2 * dt);
  // 5G: near a mast the engine misfires now and then (the throttle drops out for a moment)
  const g5 = fiveg.update(dt, car.state.position);
  controls.throttle *= g5.throttle;
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
  rig.rumble(state.spinWarning ?? 0); // drift balance zone: the camera shakes before a spin
  audio.hit(state.crash);
  scorer.update(dt, fwd, v, state.grounded);

  // Fuel (economy.js: burned from the real rpm and load), the reserve, an empty tank (the story burns by distance)
  if (!fabula) for (const e of economy.update(dt, { rpm: state.rpm, load: state.load, drifting: scorer.state.drifting, running: !economy.state.empty })) {
    handleMission(mission.notify(e));
    if (e === 'rezerwa') audio.beep();
    if (e === 'pusty') {
      scorer.crash();
      pushing = false;
      stuckTimer = 0;
      emptyPanel();
    }
  }
  // stuck with an empty tank (pushing, not at the station): offer the tow again after a while
  if (features.pchanie && economy.state.empty && !choice.open && !atStation && state.speed < 0.3) {
    if ((stuckTimer += dt) > 8) (stuckTimer = 0), emptyPanel();
  } else stuckTimer = 0;
  if (towTimer > 0 && (towTimer -= dt) <= 0) {
    placeCar(points.stacja);
    hudBat.fade.className = '';
  }
  hudBat.fade.style.opacity = Math.max(towTimer > 0 ? 1 : 0, Number(hudBat.fade.style.opacity || 0) - dt);
  // Station: stop next to a pump → the fuel panel (once per stop)
  const nearPoint = (p, r) => p && Math.hypot(state.position.x - p.x, state.position.z - p.z) < r;
  const stopped = state.speed < 1;
  if (!fabula && nearPoint(points.stacja, 4) && stopped && !choice.open && !dialogue.open) {
    if (!atStation) (atStation = true), stationPanel();
  } else if (!nearPoint(points.stacja, 6)) atStation = false;
  // Żappka: stop on the glowing pad → saved, and the shop
  const pad = map.shop.pad;
  const onPad = Math.abs(state.position.x - pad.x) < pad.w / 2 && Math.abs(state.position.z - pad.z) < pad.d / 2;
  if (features.sklep && onPad && stopped && !choice.open && !dialogue.open) {
    if (!atShop) {
      atShop = true;
      save = { x: pad.x, z: pad.z, heading: headingOf(state.quaternion) };
      storeProgress();
      if (!mission.state.running) saveProgress({ mission: pending ?? (freeRide ? null : mdef.id), step: 0, save, done: freeRide && !pending, ...economy.snapshot() });
      handleMission(mission.notify('zapis'));
      shopPanel();
    }
  } else if (!onPad) atShop = false;
  // Headlights: always on (the lamp and battery business is gone); an empty tank leaves only the parking lights
  carView.setLights((economy.state.empty ? 0.25 : 1) * g5.lights, 1, lightsState.high); // (5G: they flicker near a mast)
  audio.setStatic(g5.noise, g5.crackle);
  setGlitch(g5.glitch, timer.getElapsed());
  if (g5.say && !dialogue.open) narrator.say(teksty['5g'][Math.floor(Math.random() * teksty['5g'].length)]);
  district.update(timer.getElapsed(), onPad && stopped);
  // A mission waiting for respect: offered when there is enough
  if (pending && !choice.open && !dialogue.open && economy.state.respect >= needed(pending) && (offerTimer -= dt) <= 0) offerMission();

  // Race: the rival follows the route, countdown, laps
  let raceInfo = '';
  let target = null;
  let raceResult = null; // (kept for the mission even when the race is wound up in this same frame)
  if (race) {
    const st = race.update(dt, { x: state.position.x, z: state.position.z, speed: state.speed });
    raceResult = st.result;
    const r = race.rival.state;
    rival?.set(r.x, r.z, r.yaw, r.speed, dt);
    const w = teksty.wyscig;
    const c = race.countdown;
    if (c !== lastCount) toast(c > 0 ? w.odliczanie[w.odliczanie.length - c] ?? String(c) : clean(w.start), true);
    if (c === 0 && lastCount === 0 && st.lap === st.laps && !race.lastLap) (race.lastLap = true), toast(clean(w.ostatnie));
    lastCount = c;
    raceInfo = ` · ${w.okrazenie} ${st.lap}/${st.laps} · ${w.pozycja} ${st.position}/2 · ${Math.abs(Math.round(st.gap))} m ${st.gap >= 0 ? w.przewaga : w.strata}`;
    const ahead = race.route.at(st.playerTotal + 40);
    if (!st.result) target = { x: ahead.x, z: ahead.z, r: 3 };
    // won: the rival rolls to a stop past the line, the neighbour gets out next to his car (the talk at the finish)
    if (st.result === 'won' && r.speed < 0.3) {
      const n = people.get(raceStep.rival);
      if (n) {
        people.place(raceStep.rival, r.x + Math.sin(r.yaw) * 2.2, r.z + Math.cos(r.yaw) * 2.2, (r.yaw * 180) / Math.PI);
        people.show(raceStep.rival, true);
        syncPoint(n);
      }
      race = null;
      raceStep = null;
    }
  }
  if (raceRetry > 0 && (raceRetry -= dt) <= 0 && raceStep) setupRace(raceStep);

  // The story (fabula/gra.js), or the old missions
  if (fabula) {
    fabulaOut = fabula.update(dt, state, timer.getElapsed());
    target = fabula.target;
  }
  // Mission, target marker, narrator
  if (!fabula) handleMission(mission.update(dt, { x: state.position.x, z: state.position.z, speed: state.speed, money: economy.state.money, fuelPct: (100 * economy.state.fuel) / TANK, score: score(), talk: talkResult, race: raceResult }));
  talkResult = null;
  if (!fabula) target ??= mission.target();
  const dist = markers.update(timer.getElapsed(), target, state.position);
  const show = mission.state.show;
  const step = mission.state.step;
  const showInfo = show && step ? ` · ${Math.round(show.points).toLocaleString('pl-PL')}/${step.min.toLocaleString('pl-PL')} ${teksty.pokaz.punkty}${show.inside ? ` · ${teksty.pokaz.czas} ${Math.max(0, Math.ceil(step.time - show.clock))} s` : ''}` : '';
  hudBat.goal.innerHTML = mission.goal ? `Cel: ${mission.goal}${showInfo}${raceInfo}${target && !raceInfo ? ` <small>${Math.round(dist)} m</small>` : ''}` : '';
  // The lads by the drift lot react (crowd.js) – loud during the show
  const zone = step?.type === 'score' ? points[step.point] : points.lot;
  if (zone && !fabula) {
    const inZone = Math.hypot(state.position.x - zone.x, state.position.z - zone.z) < (zone.r ?? 20) + 4;
    const kind = crowd.update(dt, { inZone, drifting: scorer.state.drifting, angle: scorer.state.angle, speed: state.speed, crash: state.crash }, !!show);
    if (kind) {
      const lads = people.list.filter((n) => n.who.grupa === 'chlopaki' && n.visible && n.who.reakcje?.[kind]);
      const who = lads[Math.floor(Math.random() * lads.length)];
      if (who) {
        const lines = who.who.reakcje[kind];
        people.say(who.id, lines[Math.floor(Math.random() * lines.length)]);
        if (kind === 'dobrze') lads.forEach((n) => people.cheer(n.id));
      }
    }
  }
  // Talk prompt: stopped next to someone
  const near = !fabula && !dialogue.open && state.speed < 1.5 ? people.near(state.position) : null;
  const hint = near ? `<b>${keyLabel(settings.keys.talk?.[0] ?? 'KeyE')}</b> ${teksty.rozmowa.podpowiedz}: ${near.who.imie}` : '';
  if (hudBat.talk.innerHTML !== hint) hudBat.talk.innerHTML = hint;
  document.body.classList.toggle('can-talk', !!near);
  if (dialogue.update(dt)) audio.type();
  const nr = narrator.update(dt);
  if (nr.keys) audio.type(); // (one click per frame is enough even when two letters land in it)
  if (hudBat.narrator.textContent !== nr.text) hudBat.narrator.textContent = nr.text;
  hudBat.narrator.style.opacity = nr.opacity;

  // Dashboard: speed, virtual gear, rev counter
  // Rev counter, gear and engine sound from the real powertrain (engine.js through vehicle state)
  const { gear, rpm, load } = state;
  const rpmFrac = drivetrain ? Math.max(0, Math.min(1, (rpm - drivetrain.idleRpm) / (drivetrain.redRpm - drivetrain.idleRpm))) : load;
  audio.update(dt, state, rpmFrac, controls.throttle, !economy.state.empty); // (engine pitch from the real rpm)
  const blink = Math.floor(timer.getElapsed() * 3) % 2 === 0;
  dashboard.draw({
    speedKmh: state.speed * 3.6,
    rpm: economy.state.empty ? 0 : rpm, // empty tank: the engine is off
    redRpm: drivetrain?.redRpm ?? 6000,
    gear,
    fuel: (100 * economy.state.fuel) / TANK,
    reserve: economy.state.reserve && blink,
    lightsOn: true,
    highBeam: lightsState.high,
    engineWarn: economy.state.empty,
    handbrake: controls.handbrake > 0.5,
    points: score(),
  }, dt);
  // Cash and respect (pixel HUD under the record): "12,40 zł · Ziomek z klatki 72/150", ⚡ while the energy drink works
  const lv = economy.level();
  const wallet = `<b class="${economy.state.money < 0 ? 'debt' : ''}">${zl(economy.state.money)}</b> · ${clean(lv.name)} <small>${Math.floor(economy.state.respect)}${lv.next ? `/${lv.next}` : ''}</small>${economy.state.energy > 0 ? ` <i>⚡${Math.ceil(economy.state.energy)}</i>` : ''}${pending ? ` <small>· ${clean(MISSIONS[pending].title)}: ${needed(pending)}</small>` : ''}`;
  if (hudBat.wallet.innerHTML !== wallet) hudBat.wallet.innerHTML = wallet;
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
  const cam = rig.update(dt, fabulaOut.cam ?? state, { pixelsWide: Math.floor(innerWidth / px), pixelsHigh: Math.floor(innerHeight / px) });
  setCamera(cam);
  fill.position.copy(state.position).y += 5;
  occlusion.update(cam, state.position, state.quaternion);
  people.update(timer.getElapsed(), dt, state.position, cam, dialogue.npc);

  composer.render();
  requestAnimationFrame(tick);
}

// Canvas size = window size. Checked every frame, not only on 'resize': the page is built behind several awaits
// (physics, models, map), and a window or frame that changes size while it loads (maximised, the artifact frame
// settling, devtools) used to leave the canvas at its first size – the game squeezed into part of the screen.
let fitW = 0, fitH = 0;
function fit() {
  const w = innerWidth, h = innerHeight;
  if (w === fitW && h === fitH) return;
  fitW = w;
  fitH = h;
  chaseCam.aspect = w / h;
  chaseCam.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  applyPixelSize();
}
addEventListener('resize', fit);
fit();

tick();
