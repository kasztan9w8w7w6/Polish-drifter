// Survival loop (pure logic, no three.js / DOM – tested in Node): the battery, the shop as a safe place, running flat.
//
// Battery 0–100 %: drains slowly while the engine runs (more with speed and on high beams) and charges ONLY in a drift,
// in proportion to angle × speed – the same thing the drift points count (drift.js). The headlights follow it.
// At 0 % the engine dies: the car rolls to a stop, the screen goes dark and the game restarts from the last save point.
// Stopping on the glowing pad in front of the shop charges it to 100 % and makes that the save point.

export const batterySettings = {
  start: 100, // % at a new game (a mission can set its own)
  drainIdle: 0.12, // %/s with the engine running
  drainDrive: 0.5, // %/s more at top speed (in proportion to speed)
  drainHighBeam: 0.4, // %/s more with the high beams on
  chargeRate: 0.01, // %/s per (degree × m/s) of drift: 30° at 54 km/h ≈ 4.5 %/s
  shopCharge: 35, // %/s on the shop pad
  low: 20, // % below this the headlights flicker
  warn: 10, // % below this a warning beeps
  dyingTime: 2.5, // s from 0 % until the screen is dark
  darkTime: 2.5, // s of dark screen with the message before the restart
  respawnMin: 30, // % at least after a restart (so it doesn't run flat again straight away)
};

// Drift that counts (same thresholds as drift.js): angle between nose and velocity 12–100°, above 6 m/s, on the ground
const MIN_SPEED = 6;
const MIN_ANGLE = 12;

export function createSurvival({ settings = batterySettings, pad = null, save = { x: 0, z: 0, heading: 0 }, level = settings.start } = {}) {
  const s = settings;
  const state = {
    level, // %
    phase: 'drive', // drive → dying (engine off, rolling) → dark (message) → drive (after respawn)
    phaseTime: 0,
    onPad: false,
    charging: false,
    save: { ...save, level }, // where and with how much battery a restart puts you
    deaths: 0,
    warn: false, // beeping
  };
  let savedThisVisit = false;

  const inPad = (x, z) => pad && Math.abs(x - pad.x) <= pad.w / 2 && Math.abs(z - pad.z) <= pad.d / 2;

  // Drift charge rate (%/s) for an angle (degrees) and speed (m/s)
  function driftCharge(angle, speed, grounded = true) {
    const a = Math.abs(angle);
    return grounded && speed > MIN_SPEED && a > MIN_ANGLE && a < 100 ? s.chargeRate * a * speed : 0;
  }

  // car: { x, z, heading, speed (m/s), topSpeed (m/s), angle (deg, nose vs velocity), grounded, highBeam }
  // Returns a list of events: 'low' / 'warn' (crossing the thresholds downwards), 'dead', 'dark', 'respawn',
  // 'shop' (stopped on the pad), 'saved', 'full'.
  function update(dt, car) {
    const events = [];
    const before = state.level;
    state.phaseTime += dt;
    if (state.phase === 'drive') {
      state.onPad = !!inPad(car.x, car.z);
      state.charging = state.onPad && car.speed < 1;
      if (state.charging) {
        if (!savedThisVisit) events.push('shop');
        state.level = Math.min(100, state.level + s.shopCharge * dt);
        if (state.level >= 100 && !savedThisVisit) {
          savedThisVisit = true;
          state.save = { x: pad.x, z: pad.z, heading: car.heading, level: 100 };
          events.push('full', 'saved');
        }
      } else {
        if (!state.onPad) savedThisVisit = false;
        const drain = s.drainIdle + s.drainDrive * Math.min(1, car.speed / (car.topSpeed || 30)) + (car.highBeam ? s.drainHighBeam : 0);
        const charge = driftCharge(car.angle, car.speed, car.grounded ?? true);
        state.level = Math.max(0, Math.min(100, state.level + (charge - drain) * dt));
      }
      if (before >= s.low && state.level < s.low) events.push('low');
      if (before >= s.warn && state.level < s.warn) events.push('warn');
      if (state.level <= 0) {
        state.phase = 'dying';
        state.phaseTime = 0;
        state.deaths++;
        events.push('dead');
      }
    } else if (state.phase === 'dying' && state.phaseTime > s.dyingTime) {
      state.phase = 'dark';
      state.phaseTime = 0;
      events.push('dark');
    } else if (state.phase === 'dark' && state.phaseTime > s.darkTime) {
      respawn();
      events.push('respawn');
    }
    state.warn = state.phase === 'drive' && state.level < s.warn;
    return events;
  }

  function respawn() {
    state.phase = 'drive';
    state.phaseTime = 0;
    state.level = Math.max(state.save.level, s.respawnMin);
    savedThisVisit = false;
  }

  return {
    state,
    update,
    driftCharge,
    respawn,
    get engineOn() {
      return state.phase === 'drive';
    },
    // Start again somewhere (a mission start): this is the save point until the shop
    restart(save, level = s.start) {
      state.level = level;
      state.save = { ...save, level };
      state.phase = 'drive';
      state.phaseTime = 0;
      savedThisVisit = false;
    },
  };
}

// Headlight strength for a battery level: 0..1 multipliers for brightness and reach. Below `low` the light flickers
// (random short dips; rnd = Math.random in the game, a seeded one in tests).
export function headlightLevel(level, settings = batterySettings, rnd = Math.random) {
  if (level <= 0) return { brightness: 0, reach: 0 };
  const k = level / 100;
  let brightness = 0.25 + 0.75 * k;
  const reach = 0.35 + 0.65 * k;
  if (level < settings.low) {
    const depth = 1 - level / settings.low; // flickers more the flatter it is
    if (rnd() < 0.08 + 0.25 * depth) brightness *= 0.15 + 0.5 * rnd();
  }
  return { brightness, reach };
}
