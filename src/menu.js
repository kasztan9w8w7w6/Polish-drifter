import { KEY_NAMES, keyLabel, rebind, DEFAULT_KEYS, saveSettings } from './settings.js';

// Menus in the game's own style (pixel font, black, amber, a bit of fog): main menu, garage, settings, pause.
// Plain DOM buttons, so the mouse, touch, Tab/arrows + Enter and the pad (d-pad + A, B = back) all work.
// Everything the player changes is written to the settings object and saved (settings.js, localStorage).
//
// hooks: { play, continue, hasProgress, resume, restart, toMenu, garage(open), paint(name), apply(settings), captureKey(cb) }
export function createMenu({ settings, paints, hooks }) {
  const root = document.createElement('div');
  root.id = 'menu';
  root.hidden = true;
  document.body.appendChild(root);
  const stack = []; // screens, the last one is shown
  let from = 'main'; // settings opened from the main menu or from the pause menu

  const save = () => saveSettings(settings);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const screens = {
    main: () => `
      <div class="m-title"><h1>Agro Drifter</h1><p>Osiedle Kosmonautów · 3:00 w nocy · mgła</p></div>
      <nav>
        <button data-go="play">Graj</button>
        <button data-go="continue" ${hooks.hasProgress() ? '' : 'disabled'}>Kontynuuj</button>
        <button data-go="garage">Garaż</button>
        <button data-go="settings">Ustawienia</button>
      </nav>
      <p class="m-foot">Klawiatura, pad albo dotyk · Esc / Start = pauza</p>`,
    pause: () => `
      <div class="m-title"><h1>Pauza</h1><p>Maszt buczy. Silnik stygnie.</p></div>
      <nav>
        <button data-go="resume">Wznów</button>
        <button data-go="restart">Restart misji</button>
        <button data-go="settings">Ustawienia</button>
        <button data-go="toMenu">Wyjście do menu</button>
      </nav>`,
    garage: () => `
      <div class="m-title small"><h1>Garaż</h1><p>Polonez 1500 · lakier z epoki</p></div>
      <div class="m-paints">${Object.entries(paints)
        .map(([name, hex]) => `<button data-paint="${esc(name)}" class="${name === settings.paint ? 'on' : ''}"><i style="background:${hex}"></i>${esc(name)}</button>`)
        .join('')}</div>
      <nav class="row"><button data-go="back">Wróć</button></nav>`,
    settings: () => `
      <div class="m-title small"><h1>Ustawienia</h1></div>
      <div class="m-tabs"><button data-tab="gfx">Grafika</button><button data-tab="snd">Dźwięk</button><button data-tab="ctl">Sterowanie</button></div>
      <div class="m-panel" data-panel="gfx">
        ${choice('Piksele', 'pixels', ['Drobne', 'Średnie', 'Grube'])}
        ${slider('Ekspozycja', 'exposure', 0.5, 2, 0.05)}
        ${choice('Jakość', 'quality', ['auto', 'wysoka', 'niska'])}
      </div>
      <div class="m-panel" data-panel="snd">
        ${slider('Głośność', 'volume', 0, 1, 0.01)}
        ${slider('Silnik', 'engine', 0, 2, 0.01)}
        ${slider('Pisk opon', 'skid', 0, 2, 0.01)}
        ${slider('Uderzenia', 'impact', 0, 2, 0.01)}
        ${slider('Ostrzeżenie baterii', 'warning', 0, 2, 0.01)}
        ${slider('Pisanie (narrator, rozmowy)', 'typing', 0, 2, 0.01)}
      </div>
      <div class="m-panel" data-panel="ctl">
        ${choice('Jazda', 'difficulty', ['Łatwy', 'Normalny', 'Pro'])}
        <p class="m-hint">Łatwy: drift z asystą. Normalny: kontrą i gazem pilnujesz kąta. Pro: jeszcze mniej wybacza.</p>
        <div class="m-keys">${Object.keys(DEFAULT_KEYS)
          .map((a) => `<div><span>${KEY_NAMES[a]}</span><button data-key="${a}">${esc(settings.keys[a].map(keyLabel).join(' / '))}</button></div>`)
          .join('')}</div>
        <p class="m-hint">Pad: RT gaz · LT hamulec · lewa gałka skręt · A / RB ręczny · Y reset · X kamera · ↑ długie · Start pauza</p>
        <nav class="row"><button data-go="defaultKeys">Domyślne klawisze</button></nav>
      </div>
      <nav class="row"><button data-go="back">Wróć</button></nav>`,
  };
  function choice(label, key, options) {
    const cur = settings[key] ?? 'auto';
    return `<div class="m-row"><span>${label}</span><div class="m-choice">${options
      .map((o) => `<button data-set="${key}" data-val="${o}" class="${o === cur ? 'on' : ''}">${o}</button>`)
      .join('')}</div></div>`;
  }
  function slider(label, key, min, max, step) {
    return `<div class="m-row"><span>${label}</span><input type="range" data-set="${key}" min="${min}" max="${max}" step="${step}" value="${settings[key]}"></div>`;
  }

  let tab = 'gfx';
  function render() {
    const name = stack.at(-1);
    root.className = `m-${name}`;
    root.innerHTML = `<div class="m-box">${screens[name]()}</div>`;
    if (name === 'settings') showTab(tab);
    root.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
  }
  function showTab(t) {
    tab = t;
    root.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== t));
    root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  }
  function open(name) {
    stack.length = 0;
    stack.push(name);
    root.hidden = false;
    render();
  }
  function push(name) {
    stack.push(name);
    render();
  }
  function back() {
    if (stack.at(-1) === 'garage') hooks.garage(false);
    if (stack.length > 1) {
      stack.pop();
      render();
    } else if (stack[0] === 'pause') {
      close();
      hooks.resume();
    }
  }
  function close() {
    stack.length = 0;
    root.hidden = true;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const go = b.dataset.go;
    if (go === 'play') (close(), hooks.play());
    else if (go === 'continue') (close(), hooks.continue());
    else if (go === 'resume') (close(), hooks.resume());
    else if (go === 'restart') (close(), hooks.restart());
    else if (go === 'toMenu') (hooks.toMenu(), open('main'));
    else if (go === 'garage') (hooks.garage(true), push('garage'));
    else if (go === 'settings') ((from = stack.at(-1)), push('settings'));
    else if (go === 'back') back();
    else if (go === 'defaultKeys') {
      settings.keys = structuredClone(DEFAULT_KEYS);
      hooks.apply(settings);
      save();
      render();
    } else if (b.dataset.tab) showTab(b.dataset.tab);
    else if (b.dataset.paint) {
      settings.paint = b.dataset.paint;
      hooks.paint(settings.paint);
      save();
      root.querySelectorAll('[data-paint]').forEach((x) => x.classList.toggle('on', x === b));
    } else if (b.dataset.set) {
      settings[b.dataset.set] = b.dataset.val === 'auto' ? null : b.dataset.val;
      hooks.apply(settings);
      save();
      b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    } else if (b.dataset.key) {
      const action = b.dataset.key;
      b.textContent = 'naciśnij klawisz…';
      b.classList.add('on');
      hooks.captureKey((code) => {
        if (code !== 'Escape' || action === 'pause') rebind(settings.keys, action, code);
        hooks.apply(settings);
        save();
        render();
        showTab('ctl');
      });
    }
  });
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset?.set) {
      settings[el.dataset.set] = Number(el.value);
      hooks.apply(settings);
    }
  });
  root.addEventListener('change', () => save());
  // Keyboard: arrows move between buttons, Esc/Backspace goes back (Enter/Space press the focused button natively)
  addEventListener('keydown', (e) => {
    if (root.hidden) return;
    const items = [...root.querySelectorAll('button:not([disabled]), input')].filter((x) => x.offsetParent);
    const i = items.indexOf(document.activeElement);
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.code === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.code === 'Escape' || e.code === 'Backspace') {
      if (document.activeElement?.textContent === 'naciśnij klawisz…') return;
      e.preventDefault();
      e.stopPropagation();
      back();
    }
  }, true);

  // Pad in the menu: d-pad / stick up-down, A presses, B goes back
  let prev = [];
  let stickHeld = false;
  function update() {
    if (root.hidden) return;
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
    if (!pad) return;
    const b = pad.buttons.map((x) => x.pressed);
    const edge = (n) => b[n] && !prev[n];
    const y = pad.axes[1] ?? 0;
    const stick = Math.abs(y) > 0.6 ? Math.sign(y) : 0;
    const items = [...root.querySelectorAll('button:not([disabled])')].filter((x) => x.offsetParent);
    const i = items.indexOf(document.activeElement);
    const move = edge(13) || (stick > 0 && !stickHeld) ? 1 : edge(12) || (stick < 0 && !stickHeld) ? -1 : 0;
    stickHeld = stick !== 0;
    if (move) items[(i + move + items.length) % items.length]?.focus();
    if (edge(0)) document.activeElement?.click?.();
    if (edge(1) || edge(9)) back();
    prev = b;
  }

  return {
    openMain: () => open('main'),
    openPause: () => open('pause'),
    close,
    back,
    update,
    get open() {
      return !root.hidden;
    },
    get screen() {
      return stack.at(-1) ?? null;
    },
  };
}
