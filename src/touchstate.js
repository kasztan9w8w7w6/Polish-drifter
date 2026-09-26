// Touch controls – the logic without DOM (tested in Node): device detection by capabilities and the button state.
import { rampValue, KEY_RAMP } from './input.js';

// A touch device by what it can do, never by the user agent: a coarse primary pointer (finger), or touch points
// with no hover at all. `?touch=1` / `?touch=0` in the address forces it (testing on a desktop).
export function isTouchDevice(win = globalThis) {
  const force = new URLSearchParams(win.location?.search ?? '').get('touch');
  if (force === '1' || force === '0') return force === '1';
  const mq = (q) => !!win.matchMedia?.(q).matches;
  return mq('(pointer: coarse)') || ((win.navigator?.maxTouchPoints ?? 0) > 0 && mq('(hover: none)'));
}

// Button state for several fingers at once: every button remembers which pointers hold it (a button stays pressed
// while any finger is on it). Pedal and steering buttons ramp like keyboard keys (input.js KEY_RAMP); the joystick
// gives its analog value straight through.
export function createTouchState() {
  const held = { gas: new Set(), brake: new Set(), handbrake: new Set(), left: new Set(), right: new Set() };
  const out = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  let stick = null; // −1..1 (+ = left) while the joystick is held, else null

  return {
    press(button, pointerId) {
      held[button].add(pointerId);
    },
    release(button, pointerId) {
      held[button].delete(pointerId);
    },
    // A finger that went away (pointercancel, app in the background): let go of everything it held
    releasePointer(pointerId) {
      for (const set of Object.values(held)) set.delete(pointerId);
    },
    releaseAll() {
      for (const set of Object.values(held)) set.clear();
      stick = null;
    },
    setStick(value) {
      stick = value;
    },
    isDown: (button) => held[button].size > 0,
    read(dt) {
      const on = (b) => (held[b].size > 0 ? 1 : 0);
      out.throttle = rampValue(out.throttle, on('gas'), dt, KEY_RAMP.pedalUp, KEY_RAMP.pedalDown);
      out.brake = rampValue(out.brake, on('brake'), dt, KEY_RAMP.pedalUp, KEY_RAMP.pedalDown);
      out.handbrake = on('handbrake');
      if (stick !== null) out.steer = stick;
      else out.steer = rampValue(out.steer, on('left') - on('right'), dt, KEY_RAMP.steerUp, KEY_RAMP.steerDown);
      return { ...out };
    },
  };
}
