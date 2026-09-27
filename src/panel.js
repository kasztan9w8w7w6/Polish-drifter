// A choice panel in the middle of the screen (mission summary, fuel station, the shop, an empty tank): a title, a few
// rows / a line of text, and big buttons. Works the same with every device, so nothing needs a keyboard:
//   touch / mouse – tap a button;  keyboard – ← → ↑ ↓ / Tab pick, Enter / E / Space press, 1–9 press that one, Esc = cancel;
//   pad – d-pad / stick pick, A (or B on a panel without cancel) press, B = cancel.
// It stays until a button is pressed (no timer: on a phone there is nothing else to press).
export function createPanel() {
  const root = document.createElement('div');
  root.id = 'panel';
  root.hidden = true;
  document.body.appendChild(root);
  let spec = null;
  let sel = 0;
  let prev = [];
  let stickHeld = false;

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function render() {
    root.innerHTML = `<div class="p-box">
      ${spec.title ? `<h2>${esc(spec.title)}</h2>` : ''}
      ${spec.text ? `<p class="p-text">${esc(spec.text)}</p>` : ''}
      ${(spec.rows ?? []).map(([k, v]) => `<p class="p-row"><span>${esc(k)}</span><b>${esc(v)}</b></p>`).join('')}
      <nav>${spec.buttons.map((b, i) => `<button data-i="${i}" class="${i === sel ? 'on' : ''}" ${b.disabled ? 'disabled' : ''}>${esc(b.label)}</button>`).join('')}</nav>
    </div>`;
  }
  function press(i) {
    const b = spec?.buttons[i];
    if (!b || b.disabled) return;
    const s = spec;
    close();
    b.action?.();
    s.onClose?.();
  }
  function move(d) {
    const n = spec.buttons.length;
    for (let k = 1; k <= n; k++) {
      const i = (sel + d * k + n * 10) % n;
      if (!spec.buttons[i].disabled) {
        sel = i;
        break;
      }
    }
    root.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === sel));
  }
  function close() {
    spec = null;
    root.hidden = true;
    document.body.classList.remove('panel-open');
  }
  const cancel = () => spec && (spec.cancel !== undefined ? press(spec.cancel) : null);

  // (pointerdown, not click: a finger lifted after a drag still counts, and it reacts at once)
  root.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button');
    if (!b || !spec) return;
    e.preventDefault();
    press(Number(b.dataset.i));
  });
  addEventListener('keydown', (e) => {
    if (!spec || e.repeat) return;
    const k = e.code;
    if (k === 'ArrowLeft' || k === 'ArrowUp' || (k === 'Tab' && e.shiftKey)) move(-1);
    else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'Tab') move(1);
    else if (k === 'Enter' || k === 'NumpadEnter' || k === 'KeyE' || k === 'Space') press(sel);
    else if (/^(Digit|Numpad)[1-9]$/.test(k)) press(Number(k.at(-1)) - 1);
    else if (k === 'Escape' || k === 'Backspace') cancel();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation(); // (the game doesn't see keys used by the panel)
  }, true);

  return {
    // { title, text, rows: [[label, value]], buttons: [{ label, action, disabled }], cancel: index, selected, onClose }
    show(s) {
      spec = s;
      sel = s.selected ?? Math.max(0, s.buttons.findIndex((b) => !b.disabled));
      root.hidden = false;
      document.body.classList.add('panel-open');
      // the pad button that opened it must not press the first button right away
      prev = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected)?.buttons.map((b) => b.pressed) ?? [];
      render();
    },
    close,
    // pad (call every frame)
    update() {
      if (!spec) return;
      const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
      if (!pad) return;
      const b = pad.buttons.map((x) => x.pressed);
      const edge = (i) => b[i] && !prev[i];
      const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
      const stick = Math.abs(ax) > 0.6 ? Math.sign(ax) : Math.abs(ay) > 0.6 ? Math.sign(ay) : 0;
      if (edge(14) || edge(12) || (stick < 0 && !stickHeld)) move(-1);
      else if (edge(15) || edge(13) || (stick > 0 && !stickHeld)) move(1);
      stickHeld = stick !== 0;
      if (edge(0)) press(sel);
      else if (edge(1)) spec.cancel !== undefined ? cancel() : press(sel);
      prev = b;
    },
    get open() {
      return !!spec;
    },
  };
}
