// Headless driving harness shared by the tests (no browser, no rendering).
import { initPhysics, createPhysics } from '../src/physics.js';
import { createVehicle } from '../src/vehicle.ts';
import { presets, DEFAULT_PRESET } from '../src/tuning.ts';

export async function createSim({ preset = DEFAULT_PRESET, walls = false, ramps = false } = {}) {
  await initPhysics();
  const physics = createPhysics();
  physics.addStaticBox({ x: 0, y: -1, z: 0 }, { x: 5000, y: 1, z: 5000 }, { friction: 0.8 });
  if (walls) {
    // A 40 m square pen of concrete barriers around the origin
    for (const [x, z, hx, hz] of [[0, 20, 20, 0.5], [0, -20, 20, 0.5], [20, 0, 0.5, 20], [-20, 0, 0.5, 20]]) {
      physics.addStaticBox({ x, y: 0.6, z }, { x: hx, y: 0.6, z: hz });
    }
  }
  if (ramps) {
    // Kerbs and a jump ramp across the +X axis (tilted boxes), to check the model follows the ground
    const tilt = (deg, axis) => { const a = (deg * Math.PI) / 360; return axis === 'z' ? { x: 0, y: 0, z: Math.sin(a), w: Math.cos(a) } : { x: Math.sin(a), y: 0, z: 0, w: Math.cos(a) }; };
    physics.addStaticBox({ x: 30, y: 0, z: 0 }, { x: 6, y: 0.8, z: 8 }, { rotation: tilt(12, 'z') });
    physics.addStaticBox({ x: 60, y: -0.2, z: 3 }, { x: 10, y: 0.5, z: 3 }, { rotation: tilt(10, 'x') });
  }
  const tuning = { ...presets[preset] };
  const car = createVehicle(physics, { tuning });
  let time = 0;
  const log = [];

  // Drive for `seconds` with `input` (object or function of (state, t)); sample every step
  function run(seconds, input, onSample) {
    const end = time + seconds;
    while (time < end - 1e-9) {
      const inp = typeof input === 'function' ? input(car.state, time) : input;
      physics.step(1 / 60, (h) => car.update({ throttle: 0, brake: 0, steer: 0, handbrake: 0, ...inp }, h), () => car.afterStep());
      time += 1 / 60;
      const s = car.read();
      const sample = { t: time, speed: s.speed * 3.6, slip: s.slipAngle, yaw: yawOf(s), upY: upY(s), x: s.position.x, y: s.position.y, z: s.position.z, drifting: s.drifting, impact: s.impact };
      log.push(sample);
      onSample?.(sample, s);
    }
    return car.read();
  }
  return { physics, car, tuning, run, log, get time() { return time; } };
}

export function yawOf(s) {
  const q = s.quaternion;
  // heading of the +X axis, CCW from above, degrees
  const fx = 1 - 2 * (q.y * q.y + q.z * q.z);
  const fz = 2 * (q.x * q.z - q.w * q.y);
  return (Math.atan2(-fz, fx) * 180) / Math.PI;
}
export function upY(s) {
  const q = s.quaternion;
  return 1 - 2 * (q.x * q.x + q.z * q.z);
}
