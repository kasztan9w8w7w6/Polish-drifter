// Keyboard + gamepad (Gamepad API, "standard" mapping) merged into one analog control state:
// { throttle 0..1, brake 0..1, steer -1..1 (+ = left), handbrake 0..1 }.
// Keyboard keys are digital, so their values ramp smoothly (Unity-style sensitivity/gravity)
// instead of jumping 0 → 1; gamepad triggers and stick are used as-is (with a stick deadzone).

const KEY_RAMP_UP = 5; // units per second
const KEY_RAMP_DOWN = 8;
const STEER_DEADZONE = 0.12;

// Gamepad buttons (standard mapping): 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 9 Start
const PAD_ACTIONS = { 3: 'reset', 2: 'camera', 9: 'gui' };
const KEY_ACTIONS = { KeyR: 'reset', KeyC: 'camera', KeyG: 'gui', KeyF: 'debug' };

export function createInput(actions = {}) {
  const down = new Set();
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; // typing in lil-gui
    const action = KEY_ACTIONS[e.code];
    if (!down.has(e.code) && action) actions[action]?.();
    down.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => down.clear());

  const any = (...codes) => codes.some((c) => down.has(c));
  const keys = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  const ramp = (value, target, dt) => {
    const rate = Math.abs(target) > Math.abs(value) && Math.sign(target) !== -Math.sign(value) ? KEY_RAMP_UP : KEY_RAMP_DOWN;
    return value + Math.max(-rate * dt, Math.min(rate * dt, target - value));
  };
  let padButtons = [];
  let padConnected = false;

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
    read(dt) {
      keys.throttle = ramp(keys.throttle, any('KeyW', 'ArrowUp') ? 1 : 0, dt);
      keys.brake = ramp(keys.brake, any('KeyS', 'ArrowDown') ? 1 : 0, dt);
      keys.steer = ramp(keys.steer, (any('KeyA', 'ArrowLeft') ? 1 : 0) - (any('KeyD', 'ArrowRight') ? 1 : 0), dt);
      keys.handbrake = any('Space') ? 1 : 0; // handbrake stays instant – it's a yank, not a pedal
      const pad = readPad();
      if (!pad) return { ...keys };
      // Whichever device gives the bigger value wins, so both can be used at once
      const pick = (a, b) => (Math.abs(a) >= Math.abs(b) ? a : b);
      return {
        throttle: Math.max(keys.throttle, pad.throttle),
        brake: Math.max(keys.brake, pad.brake),
        steer: pick(keys.steer, pad.steer),
        handbrake: Math.max(keys.handbrake, pad.handbrake),
      };
    },
  };
}
