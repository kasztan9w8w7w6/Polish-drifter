// Narrator: lines of text at the top of the screen, typed letter by letter, gone after a few seconds.
// It never pauses the game. Logic only (tested in Node); main.js puts `text` into the #narrator element.

export const narratorSettings = { charsPerSec: 38, hold: 3.2, perChar: 0.035, fade: 0.6 };

export function createNarrator(settings = narratorSettings) {
  const s = settings;
  const queue = [];
  let line = null; // current line
  let t = 0; // time on the current line
  const state = { text: '', opacity: 0, busy: false };

  // How long a line stays after it is fully typed: longer lines stay longer
  const holdFor = (text) => s.hold + text.length * s.perChar;

  function say(lines) {
    for (const l of [].concat(lines)) if (l) queue.push(l);
    if (!line) next();
  }
  function next() {
    line = queue.shift() ?? null;
    t = 0;
  }
  // Skip the rest (a new mission, a restart)
  function clear() {
    queue.length = 0;
    line = null;
    state.text = '';
    state.opacity = 0;
    state.busy = false;
  }

  function update(dt) {
    if (!line) {
      state.busy = false;
      state.opacity = 0;
      return state;
    }
    t += dt;
    const typed = Math.min(line.length, Math.floor(t * s.charsPerSec));
    const typeTime = line.length / s.charsPerSec;
    const end = typeTime + holdFor(line);
    state.text = line.slice(0, typed);
    state.opacity = t < end ? 1 : Math.max(0, 1 - (t - end) / s.fade);
    state.busy = true;
    if (t >= end + s.fade) next();
    return state;
  }

  return {
    state,
    say,
    clear,
    update,
    get idle() {
      return !line && queue.length === 0;
    },
  };
}
