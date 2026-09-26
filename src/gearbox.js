// Virtual 5-speed gearbox for the HUD and engine sound only (the physics has no gears).
// Gear = speed band; rpm = position inside the band, plus a bit of flare on the throttle and in a drift.
const GEAR_TOP = [0, 6, 12, 18, 25, 33]; // m/s at the top of gears 1..5 (≈ 22, 43, 65, 90, 119 km/h)
export const IDLE_RPM = 900;
export const RED_RPM = 6500;

export function createGearbox() {
  let rpm = IDLE_RPM;
  let gear = 1;
  return {
    update(dt, { forwardSpeed, speed, driftFactor = 0 }, throttle) {
      const v = Math.abs(forwardSpeed);
      if (forwardSpeed < -0.5) gear = -1;
      else {
        gear = 1;
        while (gear < 5 && v > GEAR_TOP[gear] * 0.97) gear++;
      }
      const g = Math.max(1, gear);
      const lo = gear === 1 || gear === -1 ? 0 : GEAR_TOP[g - 1] * 0.55;
      const frac = Math.min(1, (v - lo) / (GEAR_TOP[g] - lo));
      let target = IDLE_RPM + (RED_RPM - IDLE_RPM) * Math.max(0, frac);
      target += throttle * 600 + driftFactor * 900 * Math.min(1, speed / 10); // rear wheels spinning in a drift
      rpm += (Math.min(RED_RPM + 300, target) - rpm) * (1 - Math.exp(-10 * dt));
      return { gear, rpm };
    },
  };
}
