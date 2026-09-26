// Keyboard + gamepad (Gamepad API) merged into one analog control state:
// { throttle 0..1, brake 0..1, steer -1..1 (+ = left), handbrake 0..1 }.
// Keyboard keys are digital, so their values ramp smoothly (Unity-style sensitivity/gravity)
// instead of jumping 0 → 1; gamepad triggers and stick are used as-is (proportional, with a stick deadzone).

// units per second: steering 0 → 1 in 0.4 s, back to centre in 0.25 s; pedals a bit quicker
export const KEY_RAMP = { steerUp: 2.5, steerDown: 4, pedalUp: 4, pedalDown: 6 };
const STEER_DEADZONE = 0.12;

// Gamepad buttons (standard mapping): 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 9 Start
const PAD_ACTIONS = { 3: 'reset', 2: 'camera', 9: 'gui', 12: 'lights', 8: 'mission' }; // 12 d-pad up, 8 Back
// Actions match the physical key (e.code) and, as a fallback, the character (e.key) – some remote
// desktops / virtual keyboards send an empty `code`.
const KEY_ACTIONS = { KeyR: 'reset', KeyC: 'camera', KeyG: 'gui', KeyF: 'debug', KeyL: 'lights', KeyN: 'mission', Enter: 'confirm', KeyP: 'pause', Escape: 'pause' };
const CHAR_ACTIONS = { r: 'reset', c: 'camera', g: 'gui', f: 'debug', l: 'lights', n: 'mission', enter: 'confirm', p: 'pause' };

// Move `value` towards `target` at `up` units/s when pushing further out, `down` when returning or reversing
export function rampValue(value, target, dt, up, down) {
  const rate = Math.abs(target) > Math.abs(value) && Math.sign(target) !== -Math.sign(value) ? up : down;
  return value + Math.max(-rate * dt, Math.min(rate * dt, target - value));
}

export function createInput(actions = {}) {
  const down = new Set();
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; // typing in lil-gui
    const action = KEY_ACTIONS[e.code] ?? CHAR_ACTIONS[e.key?.toLowerCase()];
    // e.repeat instead of "was it already down": a keyup lost to a focus change can't block the key any more
    if (action && !e.repeat) actions[action]?.();
    down.add(e.code || e.key);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => down.delete(e.code || e.key));
  addEventListener('blur', () => down.clear());
  document.addEventListener('visibilitychange', () => down.clear());

  const any = (...codes) => codes.some((c) => down.has(c));
  const keys = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  const ramp = (value, target, dt, up, down) => rampValue(value, target, dt, up, down);
  let padButtons = [];
  let padConnected = false;
  const sources = []; // more controls read every frame (touch.js), merged like the pad
  let enabled = true;

  function readPad() {
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
    padConnected = !!pad;
    if (!pad) return null;
    const pressed = pad.buttons.map((b) => b.pressed);
    for (const [i, action] of Object.entries(PAD_ACTIONS)) if (pressed[i] && !padButtons[i]) actions[action]?.();
    padButtons = pressed;
    const x = pad.axes[0] ?? 0;
    const stick = Math.abs(x) < STEER_DEADZONE ? 0 : Math.sign(x) * (Math.abs(x) - STEER_DEADZONE) / (1 - STEER_DEADZONE);
    return {
      throttle: pad.buttons[7]?.value ?? 0,
      brake: pad.buttons[6]?.value ?? 0,
      steer: -stick,
      handbrake: Math.max(pad.buttons[0]?.value ?? 0, pad.buttons[5]?.value ?? 0),
    };
  }

  return {
    get gamepadConnected() {
      return padConnected;
    },
    // Another control source: read(dt) → { throttle, brake, steer, handbrake }
    addSource(read) {
      sources.push(read);
    },
    // Paused: everything reads as released (keys held while the app went away don't stick)
    set enabled(on) {
      enabled = on;
      if (!on) down.clear();
    },
    read(dt) {
      keys.throttle = ramp(keys.throttle, any('KeyW', 'ArrowUp', 'w') ? 1 : 0, dt, KEY_RAMP.pedalUp, KEY_RAMP.pedalDown);
      keys.brake = ramp(keys.brake, any('KeyS', 'ArrowDown', 's') ? 1 : 0, dt, KEY_RAMP.pedalUp, KEY_RAMP.pedalDown);
      keys.steer = ramp(keys.steer, (any('KeyA', 'ArrowLeft', 'a') ? 1 : 0) - (any('KeyD', 'ArrowRight', 'd') ? 1 : 0), dt, KEY_RAMP.steerUp, KEY_RAMP.steerDown);
      keys.handbrake = any('Space', ' ') ? 1 : 0; // handbrake stays instant – it's a yank, not a pedal
      const pad = readPad();
      const all = [pad, ...sources.map((r) => r(dt))].filter(Boolean);
      if (!enabled) return { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
      // Whichever device gives the bigger value wins, so both can be used at once
      const pick = (a, b) => (Math.abs(a) >= Math.abs(b) ? a : b);
      const out = { ...keys };
      for (const o of all) {
        out.throttle = Math.max(out.throttle, o.throttle);
        out.brake = Math.max(out.brake, o.brake);
        out.steer = pick(out.steer, o.steer);
        out.handbrake = Math.max(out.handbrake, o.handbrake);
      }
      return out;
    },
  };
}
