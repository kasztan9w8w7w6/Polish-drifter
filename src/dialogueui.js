import { createDialogue } from './dialogue.js';
import { portrait } from './npc.js';

// Dialogue window at the bottom of the screen: pixel portrait, name, text typed like the narrator (dialogue.js,
// typewriter.js), choices. Keyboard: E / Enter / Space = on (finishes the typing first), ↑ ↓ or 1–4 pick an answer.
// Pad: A or B = on, d-pad ↑ ↓ = pick. Touch / mouse: tap the window = on, tap an answer = pick it.
// people: postacie.json characters; texts: teksty.json → rozmowa (the player's name, the "on" hint)
export function createDialogueUI({ people, texts = {} }) {
  const root = document.createElement('div');
  root.id = 'dialogue';
  root.hidden = true;
  root.innerHTML = `<canvas class="d-face" width="24" height="24"></canvas>
    <div class="d-main"><b class="d-name"></b><p class="d-text"></p><ol class="d-choices"></ol><span class="d-more">▼ ${texts.dalej ?? 'dalej'}</span></div>`;
  document.body.appendChild(root);
  const face = root.querySelector('.d-face').getContext('2d');
  const $name = root.querySelector('.d-name'), $text = root.querySelector('.d-text'), $choices = root.querySelector('.d-choices'), $more = root.querySelector('.d-more');
  const portraits = {};
  let d = null, npc = null, onEnd = null, shownChoices = null, lastWho = null;

  function speaker(who) {
    if (who === 'gracz') return { name: texts.gracz ?? 'Ty', look: { skora: '#e0b08a', gora: '#3a3a3a', wlosy: '#3a2616', czapka: 'kaptur', czapkaKolor: '#2a2a30' } };
    const p = people[who] ?? {};
    return { name: p.imie ?? who, look: p.wyglad };
  }
  function drawFace(who) {
    if (who === lastWho) return;
    lastWho = who;
    portraits[who] ??= portrait(speaker(who).look);
    face.clearRect(0, 0, 24, 24);
    face.drawImage(portraits[who], 0, 0);
    root.classList.toggle('player', who === 'gracz');
  }
  function render() {
    const s = d.state;
    if (!s.node) return;
    drawFace(d.who);
    $name.textContent = speaker(d.who).name;
    if ($text.textContent !== s.text) $text.textContent = s.text;
    if (s.choices !== shownChoices) {
      shownChoices = s.choices;
      $choices.innerHTML = '';
      (s.choices ?? []).forEach((c, i) => {
        const li = document.createElement('li');
        li.textContent = c;
        li.dataset.i = i;
        $choices.appendChild(li);
      });
    }
    [...$choices.children].forEach((li, i) => li.classList.toggle('on', i === s.selected));
    const typing = s.text.length < (s.node.text ?? '').replace(/^PLACEHOLDER:\s*/, '').length;
    $more.hidden = typing || !!s.choices;
  }
  function handle(events) {
    const end = events.find((e) => e.type === 'end');
    if (end) {
      const cb = onEnd, who = npc, def = d.def;
      close();
      cb?.({ npc: who, dialog: def.id, result: end.result, flags: end.flags });
    } else render();
  }
  function close() {
    root.hidden = true;
    document.body.classList.remove('talking');
    d = null;
    npc = null;
    lastWho = null;
    shownChoices = null;
  }
  const on = () => d && handle(d.advance());

  root.addEventListener('pointerdown', (e) => {
    if (!d) return;
    e.preventDefault();
    const li = e.target.closest('li');
    if (li && d.state.choices) handle(d.choose(Number(li.dataset.i)));
    else on();
  });
  addEventListener('keydown', (e) => {
    if (!d || e.repeat) return;
    const k = e.code;
    if (k === 'KeyE' || k === 'Enter' || k === 'Space' || k === 'NumpadEnter') on();
    else if (k === 'ArrowUp' || k === 'KeyW') (d.select(-1), render());
    else if (k === 'ArrowDown' || k === 'KeyS') (d.select(1), render());
    else if (/^(Digit|Numpad)[1-4]$/.test(k) && d.state.choices) handle(d.choose(Number(k.at(-1)) - 1));
    else return;
    e.preventDefault();
    e.stopImmediatePropagation(); // (the game doesn't see keys used by the dialogue)
  }, true);

  let prev = [];
  function pad() {
    const p = [...(navigator.getGamepads?.() ?? [])].find((x) => x?.connected);
    if (!p) return;
    const b = p.buttons.map((x) => x.pressed);
    const edge = (i) => b[i] && !prev[i];
    if (prev.length) {
      if (edge(0) || edge(1)) on();
      else if (edge(12)) (d.select(-1), render());
      else if (edge(13)) (d.select(1), render());
    }
    prev = b;
  }

  return {
    // def: dialogue file, id: who is being talked to, cb({ npc, dialog, result, flags }) when it ends
    start(def, id, cb) {
      d = createDialogue(def);
      npc = id;
      onEnd = cb;
      root.hidden = false;
      document.body.classList.add('talking');
      prev = [...(navigator.getGamepads?.() ?? [])].find((x) => x?.connected)?.buttons.map((x) => x.pressed) ?? []; // (the button that opened it doesn't skip a line)
      render();
    },
    // → letters typed this frame (click sounds)
    update(dt) {
      if (!d) return 0;
      pad();
      if (!d) return 0;
      const keys = d.update(dt);
      render();
      return keys;
    },
    close,
    get open() {
      return !!d;
    },
    get npc() {
      return npc;
    },
  };
}
