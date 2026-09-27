import { createTypewriter, typeSettings, clean } from './typewriter.js';

// Conversations (logic only, tested in Node). A dialogue is a data file (src/story/dialogi/*.json): nodes with who
// speaks and what they say, typed like the narrator (typewriter.js). A node goes on to `next`, offers `choices`
// (each with its own `next`, optional `set` flags and `end` result) or ends the talk (`end`: the result the mission
// checks, e.g. "zgoda"). No next / choices / end = the talk ends with result "koniec".
//
//   { "id": "…", "start": "a", "nodes": { "a": { "who": "seba", "text": "…", "next": "b" },
//     "b": { "who": "gracz", "text": "…", "choices": [ { "text": "…", "next": "c" }, { "text": "…", "end": "odmowa" } ] } } }
//
// Conditions (v0.6d): what people say can depend on the player's respect, cash or flags from earlier talks.
//   a node's "alt": [ { "if": { "szacun": 150 }, "text": "…" } ] – the first alternative whose condition holds replaces `text`
//   a choice's "if": { … } – the answer is only offered when it holds
//   a node's "if" + "else": the node is skipped (→ "else" node) when the condition doesn't hold
//   conditions: { "szacun": n } respect ≥ n, { "kasa": n } cash ≥ n, { "flaga": "name" } a flag set earlier (all must hold)
// ctx: { szacun, kasa, flags } – the game's state when the talk starts
export function when(cond, ctx = {}) {
  if (!cond) return true;
  if (cond.szacun !== undefined && (ctx.szacun ?? 0) < cond.szacun) return false;
  if (cond.kasa !== undefined && (ctx.kasa ?? 0) < cond.kasa) return false;
  if (cond.flaga !== undefined && !(ctx.flags ?? {})[cond.flaga]) return false;
  if (cond.nie !== undefined && when(cond.nie, ctx)) return false;
  return true;
}

export function createDialogue(def, settings = typeSettings, ctx = {}) {
  const typer = createTypewriter(settings);
  const flags = {};
  const state = { node: null, id: null, text: '', choices: null, selected: 0, over: false, result: null };

  function go(id, depth = 0) {
    let node = def.nodes?.[id];
    if (!node) return finish('koniec');
    if (node.if && !when(node.if, { ...ctx, flags: { ...ctx.flags, ...flags } })) return depth < 20 && node.else ? go(node.else, depth + 1) : finish('koniec');
    // the text for this player: the first alternative that holds
    const alt = (node.alt ?? []).find((a) => when(a.if, { ...ctx, flags: { ...ctx.flags, ...flags } }));
    if (alt) node = { ...node, text: alt.text };
    const choices = node.choices?.filter((c) => when(c.if, { ...ctx, flags: { ...ctx.flags, ...flags } }));
    if (node.choices) node = { ...node, choices };
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
