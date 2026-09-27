import { createDrivetrain, driveSettings } from './engine.js';

// Car profiles: one JSON file per car in src/cars/ (engine, mass, drive, gears, top speed, paints, model).
// The game reads the profile instead of constants: the real powertrain (engine.js) its engine, gears, tyres and drag from
// `real`, the arcade handling its mass and speed reference from `arcade`, the car view its model and paints.
// Adding a car = a new JSON file; engines are separate files (src/engines/*.json, for swaps later).
//
// `arcade.topSpeedKmh` is only the handling's speed reference now (steering and side grip fade towards it, vehicle.ts:
// power / angularDamping) – kept at 108 km/h so the handling stays as it was; the real top speed comes from the powertrain.

// Sets the profile's mass, power and reverse on a tuning object (after a preset, which only sets the driving feel).
export function applyCar(tuning, profile) {
  const a = profile.arcade;
  tuning.mass = a.massKg;
  tuning.power = (a.topSpeedKmh / 3.6) * tuning.angularDamping; // sphere r = 1 m: top speed (m/s) = power / damping
  tuning.reversePower = a.reverseFraction ?? tuning.reversePower;
  // Front-wheel drive can't kick the tail out on the throttle: power oversteer only with rear-wheel drive
  if (profile.real.drive === 'FWD') tuning.sharpSteer = 1.01;
  return tuning;
}

// The real powertrain of a car (engine.js): its profile + one of its engines (src/engines/*.json, by id; the profile's
// own by default). An engine can bring its own final drive (the Rover 1.4 had a shorter one).
export function carDrivetrain(profile, engines, engineId = profile.real.engine, settings = driveSettings) {
  const engine = engines[engineId];
  if (!engine) return null;
  return createDrivetrain({ ...profile.real, finalDrive: engine.finalDrive ?? profile.real.finalDrive }, engine, settings);
}

export function paintsOf(profile) {
  return profile.look.paints;
}
