// Typewriter text (logic only, tested in Node), shared by the narrator and the dialogue window: letters appear one by
// one at `charsPerSec`, with short stops after commas and longer ones after full stops, like someone typing. Every
// newly typed letter that is not a space is reported (`keys`), so the caller can play a quiet click for it.
export const typeSettings = { charsPerSec: 16, comma: 4, stop: 8 };

const PAUSE_COMMA = new Set([',', ';', ':', '–', '—']);
const PAUSE_STOP = new Set(['.', '!', '?', '…']);

export function createTypewriter(settings = typeSettings) {
  let text = '';
  let times = []; // time at which letter i appears
  let t = 0;
  let shown = 0;

  function set(str) {
    text = str ?? '';
    t = 0;
    shown = 0;
    times = [];
    let at = 0;
    for (let i = 0; i < text.length; i++) {
      times.push(at);
      const c = text[i];
      const next = text[i + 1];
      // a stop only at the end of a word (not inside "3.5" or "...")
      const end = next === undefined || next === ' ';
      const k = end && PAUSE_STOP.has(c) ? settings.stop : end && PAUSE_COMMA.has(c) ? settings.comma : c === ' ' ? 0.7 : 1;
      at += k / settings.charsPerSec;
    }
    times.push(at); // (end of typing)
  }

  // → { text: what is visible now, keys: letters typed this frame (no spaces) }
  function update(dt) {
    t += dt;
    let keys = 0;
    while (shown < text.length && times[shown] <= t) {
      if (text[shown].trim()) keys++;
      shown++;
    }
    return { text: text.slice(0, shown), keys };
  }

  return {
    set,
    update,
    // show everything at once (a key pressed while it is still typing)
    finish() {
      shown = text.length;
      t = Math.max(t, times[text.length] ?? 0);
    },
    get done() {
      return shown >= text.length;
    },
    get typeTime() {
      return times[text.length] ?? 0;
    },
    get time() {
      return t;
    },
  };
}
