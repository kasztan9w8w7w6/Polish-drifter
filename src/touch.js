import nipplejs from 'nipplejs';
import { createTouchState } from './touchstate.js';

// Test touch controls (only on touch devices, touchstate.js isTouchDevice): left half – steering (nipplejs joystick
// that appears under the thumb, or ← / → buttons), right side – gas, brake/reverse and handbrake buttons. Every button
// uses pointer events, so several fingers work at once (gas + handbrake + steering). Small buttons at the top:
// full screen (and a try to lock landscape), pause, reset, camera.
export const touchSettings = { steering: 'joystick' }; // 'joystick' | 'przyciski'

export function createTouchControls({ actions = {} } = {}) {
  const state = createTouchState();
  const root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `
    <div id="t-stick"></div>
    <div id="t-arrows"><button data-b="left">◀</button><button data-b="right">▶</button></div>
    <div id="t-pedals">
      <button data-b="handbrake" class="hb">ręczny</button>
      <button data-b="brake" class="brake">hamulec<br><small>wsteczny</small></button>
      <button data-b="gas" class="gas">gaz</button>
    </div>
    <button id="t-talk" data-a="talk">rozmowa</button>
    <div id="t-top">
      <button data-a="fullscreen" title="Pełny ekran">⛶</button>
      <button data-a="pause" title="Pauza">❚❚</button>
      <button data-a="reset" title="Reset">R</button>
      <button data-a="camera" title="Kamera">C</button>
      <button data-a="lights" title="Długie światła">L</button>
      <button data-a="gui" title="Panel">G</button>
    </div>`;
  document.body.appendChild(root);

  // Hold buttons: a finger that presses a button keeps it until it lifts (or is cancelled)
  for (const el of root.querySelectorAll('[data-b]')) {
    const b = el.dataset.b;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      state.press(b, e.pointerId);
      el.classList.add('on');
    });
    const up = (e) => {
      state.release(b, e.pointerId);
      if (!state.isDown(b)) el.classList.remove('on');
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }
  // One-shot buttons
  for (const el of root.querySelectorAll('[data-a]')) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const a = el.dataset.a;
      if (a === 'fullscreen') fullscreenLandscape();
      else actions[a]?.();
    });
  }
  root.addEventListener('contextmenu', (e) => e.preventDefault()); // long press would open a menu

  // Joystick (nipplejs): appears where the thumb lands in the left zone, only sideways
  const zone = root.querySelector('#t-stick');
  const SIZE = 130;
  const stick = nipplejs.create({ zone, mode: 'dynamic', size: SIZE, lockX: true, color: { front: '#ffdf4acc', back: '#ffffff30' }, restOpacity: 0.6 });
  stick.on('move', (e) => {
    const d = e.data; // (nipplejs 1.x: one event object, data inside)
    const x = Math.cos(d.angle.radian) * Math.min(d.distance, SIZE / 2);
    state.setStick(-x / (SIZE / 2)); // + = left
  });
  stick.on('end', () => state.setStick(null));

  function applySettings() {
    root.classList.toggle('arrows', touchSettings.steering === 'przyciski');
    if (touchSettings.steering !== 'joystick') state.setStick(null);
  }
  applySettings();

  return {
    read: (dt) => state.read(dt),
    releaseAll() {
      state.releaseAll();
      root.querySelectorAll('.on').forEach((el) => el.classList.remove('on'));
    },
    applySettings,
  };
}

// Full screen, then landscape lock where the browser allows it (Android Chrome). iPhone Safari has neither for pages:
// there the "turn the phone" board (CSS, portrait) does the job.
export async function fullscreenLandscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    else await document.exitFullscreen?.();
  } catch {}
  try {
    await screen.orientation?.lock?.('landscape');
  } catch {}
}
