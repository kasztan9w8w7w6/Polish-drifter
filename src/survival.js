// Survival loop (pure logic, no three.js / DOM – tested in Node): the battery, the shop as a safe place, running flat.
//
// Battery 0–100 %: drains while the engine runs (more with speed and on high beams: without drifting it is flat after
// 60–90 s) and charges ONLY in a proper drift – above chargeMinAngle and chargeMinSpeed, in proportion to angle × speed,
// faster the longer the drift stays clean (streak). A hit breaks the streak and stops charging for hitCooldown.
// Design target: to get anywhere you need 2–3 good drifts every ~30 s. The headlights follow the battery.
// At 0 % the engine dies: the car rolls to a stop, the screen goes dark and the game restarts from the last save point.
// Stopping on the glowing pad in front of the shop charges it to 100 % and makes that the save point.

export const batterySettings = {
  start: 100, // % at a new game (a mission can set its own)
  drainIdle: 0.6, // %/s with the engine running
  drainDrive: 1.3, // %/s more at top speed (in proportion to speed): 54 km/h ≈ 1.25 %/s in all → flat after ~80 s
  drainHighBeam: 0.6, // %/s more with the high beams on
  chargeMinAngle: 20, // ° a drift has to be at least this deep to charge…
  chargeMinSpeed: 9, // …and this fast (m/s ≈ 32 km/h)
  chargeRate: 0.006, // %/s per (degree × m/s) of drift: 30° at 54 km/h ≈ 2.7 %/s at the start of a drift…
  streakTime: 3, // …growing over this many seconds of clean drifting…
  streakBonus: 1.5, // …up to (1 + this) × as fast (30° at 54 km/h ≈ 6.8 %/s)
  hitSpeed: 3, // m/s into an obstacle that counts as a hit: the streak is lost…
  hitCooldown: 2, // …and no charging for this many seconds
  shopCharge: 35, // %/s on the shop pad
  low: 20, // % below this the headlights flicker
  warn: 10, // % below this a warning beeps
  dyingTime: 2.5, // s from 0 % until the screen is dark
  darkTime: 2.5, // s of dark screen with the message before the restart
  respawnMin: 30, // % at least after a restart (so it doesn't run flat again straight away)
};

const STREAK_GRACE = 0.4; // s out of a good drift (e.g. a quick flick through zero) before the streak is lost

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
    driftCharge: 0, // %/s coming from the drift right now (HUD charge lamp)
    streak: 0, // s of clean good drifting
    cooldown: 0, // s left without charging after a hit
  };
  let savedThisVisit = false;
  let grace = 0;

  const inPad = (x, z) => pad && Math.abs(x - pad.x) <= pad.w / 2 && Math.abs(z - pad.z) <= pad.d / 2;

  // Is this a drift that charges? (angle between nose and velocity, degrees; speed m/s)
  const good = (angle, speed, grounded = true) => {
    const a = Math.abs(angle);
    return grounded && speed > s.chargeMinSpeed && a >= s.chargeMinAngle && a < 100;
  };
  // Drift charge rate (%/s) for an angle, speed and clean-streak length (s)
  function driftCharge(angle, speed, grounded = true, streak = 0) {
    if (!good(angle, speed, grounded)) return 0;
    return s.chargeRate * Math.abs(angle) * speed * (1 + s.streakBonus * Math.min(1, streak / s.streakTime));
  }

  // car: { x, z, heading, speed (m/s), topSpeed (m/s), angle (deg, nose vs velocity), grounded, highBeam, crash (m/s) }
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
        state.driftCharge = 0;
        state.streak = 0;
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
        // Clean-drift streak: grows in a good drift, lost after a short break or on a hit
        state.cooldown = Math.max(0, state.cooldown - dt);
        if ((car.crash ?? 0) > s.hitSpeed) {
          if (state.streak > 0 || state.driftCharge > 0) events.push('hit');
          state.streak = 0;
          state.cooldown = s.hitCooldown;
        }
        const ok = good(car.angle, car.speed, car.grounded ?? true) && state.cooldown <= 0;
        if (ok) {
          state.streak += dt;
          grace = 0;
        } else if ((grace += dt) > STREAK_GRACE) state.streak = 0;
        const charge = ok ? driftCharge(car.angle, car.speed, car.grounded ?? true, state.streak) : 0;
        state.driftCharge = charge;
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
    state.streak = state.cooldown = state.driftCharge = 0;
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
