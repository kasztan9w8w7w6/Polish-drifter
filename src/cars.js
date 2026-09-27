// Car profiles: one JSON file per car in src/cars/ (engine, mass, drive, gears, top speed, paints, model).
// The game reads the profile instead of constants: the arcade physics gets its mass and power from it, the
// virtual gearbox its gears and rpm, the car view its model and paint. Adding a car = a new JSON file.
//
// Real numbers live in `real` (for reference and the gearbox); `arcade` holds what the game drives with, scaled so
// the arcade handling stays the same (top speed ≈ power / angularDamping, vehicle.ts).

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

// Virtual gearbox bands from the real ratios: gear g tops out where the top gear would be at the same rpm,
// scaled to the arcade top speed (m/s).
export function gearsOf(profile) {
  const r = profile.real.gearRatios;
  const top = profile.arcade.topSpeedKmh / 3.6;
  const last = r[r.length - 1];
  return {
    tops: r.map((ratio) => (top * last) / ratio),
    idleRpm: profile.real.idleRpm,
    redRpm: profile.real.redlineRpm,
  };
}

export function paintsOf(profile) {
  return profile.look.paints;
}
