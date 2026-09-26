// Headless driving harness shared by the tests (no browser, no rendering).
import { initPhysics, createPhysics } from '../src/physics.js';
import { createVehicle } from '../src/vehicle.ts';
import { presets, DEFAULT_PRESET } from '../src/tuning.ts';

export async function createSim({ preset = DEFAULT_PRESET, walls = false, ramps = false, bumps = false, obstacles = false } = {}) {
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
  if (bumps) {
    // Washboard road along +X: 0.15 m high speed bumps every 4 m (like a badly patched estate road)
    for (let i = 0; i < 30; i++) physics.addStaticBox({ x: 20 + i * 4, y: 0, z: 0 }, { x: 0.4, y: 0.15, z: 6 });
  }
  if (obstacles) {
    // Things to crash into, padded like in the game (track.js/district.js add BALL_RADIUS around them):
    // tyre stacks, lamp posts, a narrow gap between two boxes, a low kerb block and a corner
    const PAD = 1;
    for (const [x, z] of [[8, 5], [-8, -6], [5, -10], [-12, 8]]) physics.addStaticCylinder({ x, y: 0, z }, 0.65 + PAD, 1.6);
    for (const [x, z] of [[0, 12], [12, -2], [-4, -14]]) physics.addStaticCylinder({ x, y: 0, z }, 0.16 + PAD, 7);
    physics.addStaticBox({ x: -14, y: 1.4, z: -2 }, { x: 1 + PAD, y: 1.4, z: 3 + PAD });
    physics.addStaticBox({ x: -14, y: 1.4, z: 7.9 }, { x: 1 + PAD, y: 1.4, z: 3 + PAD }); // 1.9 m gap < ball diameter
    physics.addStaticBox({ x: 14, y: 0.6, z: 10 }, { x: 3 + PAD, y: 0.6, z: 0.5 + PAD });
    physics.addStaticBox({ x: 16, y: 1.5, z: -14 }, { x: 0.5 + PAD, y: 1.5, z: 4 + PAD });
    physics.addStaticBox({ x: 12, y: 1.5, z: -17.5 }, { x: 4 + PAD, y: 1.5, z: 0.5 + PAD });
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
      const b = car.body.translation(), bv = car.body.linvel();
      const sample = { t: time, speed: s.speed * 3.6, slip: s.slipAngle, yaw: yawOf(s), upY: upY(s), x: s.position.x, y: s.position.y, z: s.position.z, drifting: s.drifting, impact: s.impact, ballY: b.y, ballVy: bv.y, grounded: s.grounded, unstuck: s.unstuck, inp };
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
