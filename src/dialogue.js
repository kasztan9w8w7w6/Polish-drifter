import { createTypewriter, typeSettings, clean } from './typewriter.js';

// Conversations (logic only, tested in Node). A dialogue is a data file (src/story/dialogi/*.json): nodes with who
// speaks and what they say, typed like the narrator (typewriter.js). A node goes on to `next`, offers `choices`
// (each with its own `next`, optional `set` flags and `end` result) or ends the talk (`end`: the result the mission
// checks, e.g. "zgoda"). No next / choices / end = the talk ends with result "koniec".
//
//   { "id": "…", "start": "a", "nodes": { "a": { "who": "seba", "text": "…", "next": "b" },
//     "b": { "who": "gracz", "text": "…", "choices": [ { "text": "…", "next": "c" }, { "text": "…", "end": "odmowa" } ] } } }
export function createDialogue(def, settings = typeSettings) {
  const typer = createTypewriter(settings);
  const flags = {};
  const state = { node: null, id: null, text: '', choices: null, selected: 0, over: false, result: null };

  function go(id) {
    const node = def.nodes?.[id];
    if (!node) return finish('koniec');
    state.id = id;
    state.node = node;
    state.choices = null;
    state.selected = 0;
    typer.set(node.text ?? '');
    return [];
  }
  function finish(result) {
    state.over = true;
    state.result = result;
    state.node = null;
    state.choices = null;
    return [{ type: 'end', result, flags: { ...flags } }];
  }
  // the text is fully typed: show the choices, if any
  const settle = () => {
    if (typer.done && state.node?.choices && !state.choices) state.choices = state.node.choices.map((c) => clean(c.text));
  };

  // E / Enter / tap: finish typing, or go on (with the selected choice)
  function advance() {
    if (state.over || !state.node) return [];
    if (!typer.done) {
      typer.finish();
      state.text = clean(state.node.text);
      settle();
      return [];
    }
    if (state.node.choices) return choose(state.selected);
    if (state.node.end) return finish(state.node.end);
    if (state.node.next) return go(state.node.next);
    return finish('koniec');
  }
  function choose(i) {
    const c = state.node?.choices?.[i];
    if (!c || !typer.done) return [];
    Object.assign(flags, c.set ?? {});
    if (c.end) return finish(c.end);
    return go(c.next);
  }
  function select(delta) {
    if (!state.choices) return;
    const n = state.choices.length;
    state.selected = (state.selected + delta + n) % n;
  }
  // → letters typed this frame (click sounds)
  function update(dt) {
    if (state.over || !state.node) return 0;
    const r = typer.update(dt);
    state.text = r.text;
    settle();
    return r.keys;
  }

  go(def.start ?? Object.keys(def.nodes ?? {})[0]);
  return { def, state, flags, advance, choose, select, update, get who() { return state.node?.who ?? null; } };
}
