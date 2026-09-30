// Player settings (menu → Ustawienia), kept in localStorage. Logic only (tested in Node): every read and write is in
// try/catch, so the game works the same without storage (private window, blocked site data).
const KEY = 'agro-settings';
const PROGRESS = 'agro-progress';

// Game pixel size from the screen: about this many game pixels from top to bottom. Rounding alone can give two levels
// the same size (at 900 px: 540 → 2, 360 → 3, 270 → 3; a small window: all 1), so every coarser level is at least
// one screen pixel bigger than the finer one – the three always look different.
export const PIXEL_LINES = { Drobne: 540, Średnie: 360, Grube: 270 };
export function pixelSizeFor(screenHeight, detail = 'Średnie') {
  let size = 0;
  for (const [name, lines] of Object.entries(PIXEL_LINES)) {
    size = Math.max(size + 1, Math.round(screenHeight / lines));
    if (name === detail) return size;
  }
  return pixelSizeFor(screenHeight, 'Średnie');
}

// Keyboard bindings: action → key codes (KeyboardEvent.code); the first one is shown and changed in the menu
export const DEFAULT_KEYS = {
  gas: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
  reset: ['KeyR'],
  camera: ['KeyC'],
  lights: ['KeyL'],
  talk: ['KeyE'],
  radio: ['KeyQ'],
  kartka: ['KeyK'],
  pause: ['Escape', 'KeyP'],
};
export const KEY_NAMES = { gas: 'Gaz', brake: 'Hamulec / wsteczny', left: 'Skręt w lewo', right: 'Skręt w prawo', handbrake: 'Ręczny', reset: 'Reset auta', camera: 'Kamera', lights: 'Długie światła', talk: 'Rozmowa / dalej', radio: 'Radio: następna stacja', kartka: 'Kartka od Zbycha', pause: 'Pauza / menu' };

export function defaultSettings() {
  return {
    difficulty: 'Normalny', // Łatwy / Normalny / Pro
    pixels: 'Średnie',
    exposure: 1.1,
    quality: null, // null = automatic (lower on touch devices)
    volume: 0.7,
    engine: 1,
    skid: 1,
    impact: 1,
    warning: 1,
    typing: 1, // narrator / dialogue typewriter clicks
    paint: null, // colour name from the car profile's palette (null = the profile's default)
    keys: structuredClone(DEFAULT_KEYS),
  };
}

function storage(win) {
  try {
    return win.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSettings(win = globalThis) {
  const s = defaultSettings();
  try {
    const saved = JSON.parse(storage(win)?.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      for (const k of Object.keys(s)) {
        if (k === 'keys' || saved[k] === undefined) continue;
        if (s[k] === null || typeof saved[k] === typeof s[k]) s[k] = saved[k]; // (null defaults take a string)
      }
      for (const [a, codes] of Object.entries(saved.keys ?? {})) if (s.keys[a] && Array.isArray(codes) && codes.every((c) => typeof c === 'string')) s.keys[a] = codes;
    }
  } catch {}
  return s;
}

export function saveSettings(s, win = globalThis) {
  try {
    const st = storage(win);
    if (!st) return false;
    st.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

// Rebind: `code` becomes the first key of `action`; taken away from any other action that used it
export function rebind(keys, action, code) {
  for (const [a, codes] of Object.entries(keys)) keys[a] = codes.filter((c) => c !== code);
  keys[action] = [code, ...keys[action].filter((c) => c !== code)].slice(0, 2);
  return keys;
}

// Game progress for "Kontynuuj": mission, step and the save point
export function loadProgress(win = globalThis) {
  try {
    const p = JSON.parse(storage(win)?.getItem(PROGRESS) ?? 'null');
    return p && typeof p.mission === 'string' && p.save ? p : null;
  } catch {
    return null;
  }
}
export function saveProgress(p, win = globalThis) {
  try {
    storage(win)?.setItem(PROGRESS, JSON.stringify(p));
  } catch {}
}

// "KeyW" → "W", "ArrowUp" → "↑", "Space" → "Spacja"
export function keyLabel(code) {
  const special = { Space: 'Spacja', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'L Shift', ShiftRight: 'P Shift', ControlLeft: 'L Ctrl', ControlRight: 'P Ctrl', Enter: 'Enter', Tab: 'Tab', Backspace: '⌫' };
  if (special[code]) return special[code];
  if (code?.startsWith('Key')) return code.slice(3);
  if (code?.startsWith('Digit')) return code.slice(5);
  if (code?.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code ?? '?';
}
