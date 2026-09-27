// Powertrain from real data (logic only, tested in Node): the hybrid model of docs/fizyka-aut.md. The DRIVE is real –
// torque curve, gears, final drive, efficiency, wheel radius, air drag and rolling resistance, so the top speed and
// the acceleration come out of physics – while HANDLING and DRIFT stay the arcade sphere of vehicle.ts.
//
//   engine rpm   = wheel speed (v / r) × gear × final drive × 60 / 2π   (never below idle; in 1st the clutch slips up to launchRpm)
//   drive force  = torque(rpm) × throttle × gear × final drive × efficiency / r
//   resistance   = ½ ρ Cd A v²  +  Crr m g  (+ engine braking with the throttle closed)
//   acceleration = (drive − resistance) × fun / (m × δ),  δ = 1.04 + 0.0025 (gear × final drive)² – the rotating masses
//                  (wheels, shafts, flywheel) that also have to be spun up: ~1.6 in 1st, ~1.06 in 5th (Wong, Theory of Ground Vehicles)
// `fun` (driveSettings.fun, lil-gui) scales ALL longitudinal forces, i.e. it is a lighter "effective mass": the car
// picks up speed fun× quicker, the top speed stays real (drive = resistance there whatever the mass), and the
// proportions between cars and engines stay real. fun = 1 → the real car (calibration test).
export const driveSettings = {
  fun: 1.7, // acceleration multiplier (1 = real)
  shiftTime: 0.6, // s without drive during a gear change (a manual box and a real driver)
  engineBrake: 0.12, // closed-throttle engine torque, as a fraction of peak torque (towards the redline)
};
const RHO = 1.225; // kg/m³ air
const G = 9.81;

// Tyre size "185/70 R13" → rolling radius (m): half the diameter, 3 % less for the load on it
export function tyreRadius(size) {
  const m = /(\d+)\/(\d+)\s*R\s*(\d+)/i.exec(size ?? '');
  if (!m) return 0.29;
  const [, w, ratio, rim] = m.map(Number);
  return ((rim * 25.4 + 2 * w * (ratio / 100)) / 2000) * 0.97;
}

// Torque curve (rpm → Nm) from the data sheet: peak torque at torqueRpm, peak power at powerRpm, the redline.
// A few points: idle ~60 % of peak torque, rising to the peak, falling to the power peak (T = P / ω), then faster.
export function torqueCurve(e) {
  const tMax = e.torqueNm;
  const tAtPower = (e.powerKw * 1000) / ((e.powerRpm * 2 * Math.PI) / 60);
  const pts = [
    [e.idleRpm, tMax * 0.62],
    [(e.idleRpm + e.torqueRpm) / 2, tMax * 0.88],
    [e.torqueRpm, tMax],
    [e.powerRpm, Math.min(tMax, tAtPower)],
    [e.redlineRpm, Math.min(tMax, tAtPower) * 0.82],
  ];
  if (e.curve) return e.curve; // (an engine file can give its own points)
  return pts.sort((a, b) => a[0] - b[0]);
}
export function torqueAt(curve, rpm) {
  if (rpm <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [r1, t1] = curve[i];
    if (rpm <= r1) {
      const [r0, t0] = curve[i - 1];
      return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
    }
  }
  return curve[curve.length - 1][1];
}

// car: profile.real (mass, gears, final drive, tyres, drag), engine: an engine file (src/engines/*.json)
export function createDrivetrain(car, engine, settings = driveSettings) {
  const r = tyreRadius(car.tyres);
  const gears = car.gearRatios;
  const fd = car.finalDrive;
  const eff = car.efficiency ?? 0.88;
  const cda = (car.cd ?? 0.42) * (car.frontalArea ?? 1.95);
  const crr = car.crr ?? 0.014;
  const mass = car.massKg + (car.driverKg ?? 75);
  const curve = torqueCurve(engine);
  const tPeak = Math.max(...curve.map((p) => p[1]));
  const rpmPerMs = (ratio) => (ratio * fd * 60) / (2 * Math.PI * r); // engine rpm per 1 m/s of wheel speed
  // Upshift where the next gear pulls harder than this one (the most acceleration), but never past the redline
  const upAt = gears.map((g, i) => {
    if (i === gears.length - 1) return Infinity;
    for (let rpm = engine.torqueRpm; rpm < engine.redlineRpm; rpm += 50) {
      const v = rpm / rpmPerMs(g);
      const next = v * rpmPerMs(gears[i + 1]);
      if (torqueAt(curve, next) * gears[i + 1] >= torqueAt(curve, rpm) * g) return rpm;
    }
    return engine.redlineRpm - 100;
  });
  const st = { gear: 1, rpm: engine.idleRpm, shift: 0, force: 0, load: 0, reverse: false };

  function resistance(v) {
    return 0.5 * RHO * cda * v * Math.abs(v) + (Math.abs(v) > 0.05 ? Math.sign(v) * crr * mass * G : 0);
  }
  // Top speed in top gear (drive = resistance), searched numerically
  function topSpeed() {
    let best = 0;
    for (let v = 5; v < 90; v += 0.05) {
      const rpm = v * rpmPerMs(gears[gears.length - 1]);
      if (rpm > engine.redlineRpm) break;
      const f = (torqueAt(curve, rpm) * gears[gears.length - 1] * fd * eff) / r;
      if (f > resistance(v)) best = v;
    }
    return best;
  }

  // dt s, v = forward speed (m/s, − backwards), throttle 0..1, reverse 0..1 (reverse gear, backwards)
  // → { accel (m/s² along the car), rpm, gear (−1 reverse), load 0..1 }
  function update(dt, v, throttle, reverse = 0) {
    st.reverse = reverse > 0.02 && v < 0.5;
    const ratio = st.reverse ? car.reverseRatio : gears[st.gear - 1];
    const speed = Math.abs(v);
    // rpm from the wheels; at low speed in 1st / reverse the clutch slips (the engine stays up at launchRpm)
    let rpm = speed * rpmPerMs(ratio);
    const pedal = st.reverse ? reverse : throttle;
    if (st.gear === 1 || st.reverse) rpm = Math.max(rpm, engine.idleRpm + pedal * ((engine.launchRpm ?? engine.torqueRpm) - engine.idleRpm));
    rpm = Math.max(engine.idleRpm, rpm);
    // automatic gearbox (forwards). A gear that can't be right for this speed at all (over the redline, e.g. after a
    // reset or a hit) is replaced at once by the right one; ordinary shifts take shiftTime.
    if (!st.reverse && speed * rpmPerMs(gears[st.gear - 1]) > engine.redlineRpm) {
      while (st.gear < gears.length && speed * rpmPerMs(gears[st.gear - 1]) > upAt[st.gear - 1]) st.gear++;
      rpm = Math.max(engine.idleRpm, speed * rpmPerMs(gears[st.gear - 1]));
    }
    if (!st.reverse && st.shift <= 0) {
      if (st.gear < gears.length && rpm > upAt[st.gear - 1] && throttle > 0.1) (st.gear++, (st.shift = settings.shiftTime));
      else if (st.gear > 1 && speed * rpmPerMs(gears[st.gear - 2]) < upAt[st.gear - 2] * 0.62) st.gear--;
    }
    st.shift -= dt;
    let drive = 0;
    const limiter = rpm >= engine.redlineRpm;
    if (st.shift <= 0 && !limiter) drive = (torqueAt(curve, rpm) * pedal * ratio * fd * eff) / r;
    if (pedal < 0.05 && speed > 1) drive -= ((settings.engineBrake * tPeak * Math.min(1, rpm / engine.redlineRpm)) * ratio * fd) / r; // engine braking
    const dir = st.reverse ? -1 : 1;
    const force = dir * drive - resistance(v);
    st.rpm += (Math.min(engine.redlineRpm + 150, rpm) - st.rpm) * (1 - Math.exp(-14 * dt));
    st.force = force;
    st.load = Math.max(0, Math.min(1, (torqueAt(curve, st.rpm) * pedal) / tPeak));
    const delta = 1.04 + 0.0025 * (ratio * fd) ** 2; // rotating masses
    return { accel: (force * settings.fun) / (mass * delta), rpm: st.rpm, gear: st.reverse ? -1 : st.gear, load: st.load };
  }

  return {
    state: st,
    update,
    curve,
    radius: r,
    mass,
    upAt,
    topSpeed,
    resistance,
    reset() {
      Object.assign(st, { gear: 1, rpm: engine.idleRpm, shift: 0, force: 0, reverse: false });
    },
    get idleRpm() {
      return engine.idleRpm;
    },
    get redRpm() {
      return engine.redlineRpm;
    },
  };
}
