// All vehicle parameters in one place. Every field is exposed in lil-gui (key G).
// Units: forces in N, speeds in m/s, angles in degrees unless noted.

const base = {
  // Engine / brakes
  engineForce: 2400, // per rear wheel
  maxSpeed: 45, // engine force fades to 0 here (~160 km/h)
  reverseForce: 1200,
  brakeForce: 30, // Rapier brake impulse per wheel per step
  handbrakeBrake: 4, // rear-wheel brake from the handbrake – low, so a pull doesn't kill speed

  // Steering: max angle fades from low-speed to high-speed value; rate-limited (radians)
  steerMaxLow: 0.62,
  steerMaxHigh: 0.2,
  steerFadeSpeed: 30,
  steerRate: 2.6, // rad/s towards a bigger angle
  steerReturnRate: 4.5, // rad/s back towards centre

  // Grip (frictionSlip = max tyre force, sideStiffness = lateral stiffness)
  frontGrip: 1.3, // ≈ max lateral g
  rearGrip: 1.25,
  frontSideStiffness: 1.0,
  rearSideStiffness: 1.0,
  rearGripDrift: 0.5, // rear frictionSlip at full drift
  rearSideStiffnessDrift: 0.3, // rear side stiffness at full drift
  gripBlendIn: 8, // 1/s how fast grip drops (smooth, not a step)
  gripBlendOut: 2.5, // 1/s how fast grip comes back

  // What triggers / sustains rear grip loss (0..1 each)
  handbrakeLoss: 0.85,
  powerOversteer: 0.5, // throttle × steer in a corner
  driftSustain: 0.85, // throttle while already sliding keeps the rear loose

  // Assists
  counterSteerAssist: 0.7, // 0..1, front wheels follow the direction of travel
  counterSteerLimit: 0.7, // max front angle towards the outside, as a multiple of the slip angle
  driftAngleMin: 15,
  driftAngleMax: 45,
  angleHold: 40, // yaw correction strength above driftAngleMax
  handbrakeKick: 0.8, // rad/s² extra yaw when pulling the handbrake with steering
  driftAngleControl: 60, // how firmly the slip angle follows the steering-chosen target while drifting
  driftAngleDamping: 7.5, // damps fast changes of the slip angle (anti-wobble)
  driftSteerAuthority: 0.4, // share of player steering on the front wheels during a drift
  speedKeep: 0.85, // 0..1, share of speed loss cancelled while drifting
  uprightAssist: 8, // roll/pitch stabiliser strength

  // Chassis
  mass: 1100,
  comHeight: -0.45, // centre of mass relative to chassis centre (negative = lower)
  yawInertiaScale: 1,
  suspensionStiffness: 35,
  suspensionCompression: 4.4,
  suspensionRelaxation: 2.3,
  suspensionRestLength: 0.3,
  maxSuspensionTravel: 0.25,
};

export const presets = {
  Przyczepny: {
    ...base,
    handbrakeLoss: 0.9, // a handbrake turn still works…
    handbrakeKick: 0.4,
    powerOversteer: 0.1,
    driftSustain: 0.15, // …but the rear hooks up again quickly
    rearGripDrift: 0.6,
    rearSideStiffnessDrift: 0.45,
    counterSteerAssist: 0.3,
    counterSteerLimit: 1.2,
    speedKeep: 0.2,
    driftAngleControl: 0,
    driftAngleDamping: 0,
    driftSteerAuthority: 1,
  },

  'Drift łatwy': { ...base },
  'Drift pro': {
    ...base,
    counterSteerAssist: 0.45,
    counterSteerLimit: 0.9,
    angleHold: 25,
    driftAngleControl: 20,
    driftAngleDamping: 3,
    driftSteerAuthority: 0.7,
    handbrakeKick: 0.4,
    speedKeep: 0.65,
    driftAngleMax: 55,
    gripBlendIn: 10,
    steerRate: 3.5,
  },
};

export const DEFAULT_PRESET = 'Drift łatwy';
export const tuning = { ...presets[DEFAULT_PRESET] };

export function applyPreset(name) {
  Object.assign(tuning, presets[name]);
}
