import { createTypewriter, clean } from './typewriter.js';

// Narrator: lines of text at the top of the screen, typed letter by letter like on a typewriter (typewriter.js: stops
// after commas and full stops, `keys` = letters typed this frame for the click sound), gone after a while.
// It never pauses the game. Logic only (tested in Node); main.js puts `text` into the #narrator element.

export const narratorSettings = { charsPerSec: 16, hold: 5.5, perChar: 0.06, fade: 0.8 };

export function createNarrator(settings = narratorSettings) {
  const s = settings;
  const queue = [];
  let line = null; // current line
  let t = 0; // time on the current line
  const state = { text: '', opacity: 0, busy: false, keys: 0 };
  const typer = createTypewriter({ charsPerSec: s.charsPerSec, comma: 4, stop: 8 });

  // How long a line stays after it is fully typed: longer lines stay longer
  const holdFor = (text) => s.hold + text.length * s.perChar;

  function say(lines) {
    for (const l of [].concat(lines)) if (l) queue.push(clean(l));
    if (!line) next();
  }
  function next() {
    line = queue.shift() ?? null;
    t = 0;
    typer.set(line ?? '');
  }
  // Skip the rest (a new mission, a restart)
  function clear() {
    queue.length = 0;
    line = null;
    state.text = '';
    state.opacity = 0;
    state.busy = false;
    state.keys = 0;
  }

  function update(dt) {
    state.keys = 0;
    if (!line) {
      state.busy = false;
      state.opacity = 0;
      return state;
    }
    t += dt;
    const typed = typer.update(dt);
    const end = typer.typeTime + holdFor(line);
    state.text = typed.text;
    state.keys = typed.keys;
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
