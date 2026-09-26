// Headless driving harness shared by the tests (no browser, no rendering).
import { initPhysics, createPhysics } from '../src/physics.js';
import { createVehicle } from '../src/vehicle.ts';
import { presets } from '../src/tuning.ts';
import { applyCar } from '../src/cars.js';
import polonez from '../src/cars/polonez.json' with { type: 'json' };

// (preset: the older scenario tests describe the assisted Łatwy model; Normalny/Pro tests pass their preset)
export async function createSim({ preset = 'Łatwy', car: profile = polonez, walls = false, ramps = false, bumps = false, obstacles = false } = {}) {
  await initPhysics();
  const physics = createPhysics();
  physics.addStaticBox({ x: 0, y: -1, z: 0 }, { x: 5000, y: 1, z: 5000 }, { friction: 0.8 });
  if (walls) {
    // A 40 m square pen of concrete barriers around the origin
    for (const [x, z, hx, hz] of [[0, 20, 20, 0.5], [0, -20, 20, 0.5], [20, 0, 0.5, 20], [-20, 0, 0.5, 20]]) {
      physics.addStaticBox({ x, y: 0.6, z }, { x: hx, y: 0.6, z: hz }, { surface: 'concrete' });
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
    // Things to crash into, as big as they look (like in the game): tyre stacks, lamp posts, a gap between two
    // boxes narrower than the car, a low kerb block and a corner
    const o = { surface: 'concrete' };
    for (const [x, z] of [[8, 5], [-8, -6], [5, -10], [-12, 8]]) physics.addStaticCylinder({ x, y: 0, z }, 0.65, 1.6, { surface: 'tyres' });
    for (const [x, z] of [[0, 12], [12, -2], [-4, -14]]) physics.addStaticCylinder({ x, y: 0, z }, 0.16, 7);
    physics.addStaticBox({ x: -14, y: 1.4, z: -2 }, { x: 1, y: 1.4, z: 3 }, o);
    physics.addStaticBox({ x: -14, y: 1.4, z: 5.4 }, { x: 1, y: 1.4, z: 3 }, o); // 1.4 m gap < car width
    physics.addStaticBox({ x: 14, y: 0.6, z: 10 }, { x: 3, y: 0.6, z: 0.5 }, o);
    physics.addStaticBox({ x: 16, y: 1.5, z: -14 }, { x: 0.5, y: 1.5, z: 4 }, o);
    physics.addStaticBox({ x: 12, y: 1.5, z: -17.5 }, { x: 4, y: 1.5, z: 0.5 }, o);
  }
  const tuning = applyCar({ ...presets[preset] }, profile);
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
