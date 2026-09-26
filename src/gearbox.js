// Virtual gearbox for the HUD and engine sound only (the physics has no gears).
// Gear = speed band; rpm = position inside the band, plus a bit of flare on the throttle and in a drift.
// Bands, idle and redline come from the car profile (cars.js gearsOf); the default is a 4-speed Polonez 1500.
const DEFAULT = { tops: [8, 13, 20.1, 30], idleRpm: 850, redRpm: 6000 };

export function createGearbox(gears = DEFAULT) {
  let rpm = gears.idleRpm;
  let gear = 1;
  const top = [0, ...gears.tops]; // m/s at the top of gears 1..n
  const n = gears.tops.length;
  return {
    gears,
    update(dt, { forwardSpeed, speed, driftFactor = 0 }, throttle) {
      const { idleRpm, redRpm } = gears;
      const v = Math.abs(forwardSpeed);
      if (forwardSpeed < -0.5) gear = -1;
      else {
        gear = 1;
        while (gear < n && v > top[gear] * 0.97) gear++;
      }
      const g = Math.max(1, gear);
      const lo = gear === 1 || gear === -1 ? 0 : top[g - 1] * 0.55;
      const frac = Math.min(1, (v - lo) / (top[g] - lo));
      let target = idleRpm + (redRpm - idleRpm) * Math.max(0, frac);
      target += throttle * 600 + driftFactor * 900 * Math.min(1, speed / 10); // rear wheels spinning in a drift
      rpm += (Math.min(redRpm + 300, target) - rpm) * (1 - Math.exp(-10 * dt));
      return { gear, rpm, load: Math.min(1, Math.max(0, (rpm - idleRpm) / (redRpm - idleRpm))) };
    },
  };
}
