import { createTypewriter } from '../typewriter.js';
import { portrait } from '../npc.js';

// The story's screen (DOM): no narrator (projekt §5) – lines of the characters, the player's choices and flat technical
// text (hour, cash, place). Where a line shows depends on the scene's mode (silnik.js `tryb`):
//   postoj  – a window at the bottom with a pixel portrait; the car stands; E / Enter / Space / tap / pad A or B = on
//   jazda   – a strip at the bottom while driving (the passenger talks); goes on by itself, E / Enter / tap / pad B skip
//   telefon – an old phone at the side (a call); sms – the same phone, a text message
// Choices: 1–4, Tab / ↑ ↓ (only when the car stands) + E / Enter, tap, pad d-pad + A (standing) or B (driving).
// Also: the clock and the cash (brakuje do 889), the passenger, the rear-view mirror (a wheel rim in it while the rims
// ride on the back seat), the Zbychu's note (K / pad ↓ / button), the goal with the distance, the six-post counter, the
// crowd's bets, fades and the end screen (through panel.js).
export const uiSettings = { hold: 1.7, perChar: 0.045, ekran: 5 };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const zl = (v) => `${Math.round(v)} zł`;

export function createFabulaUI({ postacie = {}, kartka = [], cel = 889, keyLabel = (c) => c, keys = {} } = {}) {
  const root = document.createElement('div');
  root.id = 'fabula';
  root.innerHTML = `
    <div id="f-hud"><b class="f-zegar">23:35</b><span class="f-kasa"></span><span class="f-radio"></span><span class="f-pasazer" hidden><canvas width="24" height="24"></canvas><i></i></span></div>
    <div id="f-lusterko"><i class="f-droga"></i><i class="f-felga"></i></div>
    <div id="f-ekran"></div>
    <div id="f-cel"></div>
    <div id="f-slupki" hidden><b></b><span class="f-werdykt"></span><small></small></div>
    <div id="f-tablica" hidden></div>
    <div id="f-okno" hidden><canvas class="f-twarz" width="24" height="24"></canvas><div><b class="f-kto"></b><p class="f-tekst"></p><ol class="f-wybory"></ol><span class="f-dalej">▼</span></div></div>
    <div id="f-pasek" hidden><b class="f-kto"></b><p class="f-tekst"></p><ol class="f-wybory"></ol></div>
    <div id="f-telefon" hidden><header><span class="f-kto"></span><i class="f-sms">✉</i></header><div class="f-log"></div><ol class="f-wybory"></ol></div>
    <div id="f-kartka" hidden></div>
    <div id="f-fade"></div>`;
  document.body.appendChild(root);
  document.body.classList.add('fabula');
  const $ = (s) => root.querySelector(s);
  const hudEl = { zegar: $('.f-zegar'), kasa: $('.f-kasa'), radio: $('.f-radio'), pas: $('.f-pasazer'), pasTwarz: $('.f-pasazer canvas').getContext('2d'), pasTxt: $('.f-pasazer i') };
  const okno = { root: $('#f-okno'), twarz: $('#f-okno .f-twarz').getContext('2d'), kto: $('#f-okno .f-kto'), tekst: $('#f-okno .f-tekst'), wybory: $('#f-okno .f-wybory'), dalej: $('#f-okno .f-dalej') };
  const pasek = { root: $('#f-pasek'), kto: $('#f-pasek .f-kto'), tekst: $('#f-pasek .f-tekst'), wybory: $('#f-pasek .f-wybory') };
  const tel = { root: $('#f-telefon'), kto: $('#f-telefon .f-kto'), log: $('#f-telefon .f-log'), wybory: $('#f-telefon .f-wybory') };
  const ekranEl = $('#f-ekran'), celEl = $('#f-cel'), fadeEl = $('#f-fade'), kartkaEl = $('#f-kartka'), lusterko = $('#f-lusterko');
  const slupkiEl = { root: $('#f-slupki'), b: $('#f-slupki b'), w: $('#f-slupki .f-werdykt'), small: $('#f-slupki small') };
  const tablicaEl = $('#f-tablica');

  const tw = createTypewriter();
  const portraits = {};
  const face = (kto) => (portraits[kto] ??= portrait(postacie[kto]?.wyglad ?? postacie.GRACZ?.wyglad ?? {}));
  let cur = null; // { a: action, box, typing, hold, choices, sel }
  let pending = null; // an event for gra.js: { typ: 'dalej' } | { typ: 'wybor', i }
  let telefon = null; // { tryb, imie } while a call / text is open
  let telLog = [];
  const ekrany = [];

  function boxFor(tryb) {
    if (tryb === 'telefon' || tryb === 'sms') return 'telefon';
    return tryb === 'jazda' ? 'pasek' : 'okno';
  }
  function hideBoxes(except) {
    if (except !== 'okno') okno.root.hidden = true;
    if (except !== 'pasek') pasek.root.hidden = true;
    document.body.classList.toggle('f-rozmowa', except === 'okno');
  }
  function renderChoices(ol, list, sel, box) {
    ol.innerHTML = list.map((o, i) => `<li data-i="${i}" class="${i === sel ? 'on' : ''}${o.niema ? ' niema' : ''}"><small>${i + 1}</small> ${esc(o.tekst)}</li>`).join('');
    ol.dataset.box = box;
  }

  // Show an action from the story engine (kwestia / wybor); gra.js waits for the event from update()
  function pokaz(a) {
    pending = null;
    const box = boxFor(a.tryb);
    cur = { a, box, sel: 0, holdLeft: 0 };
    hideBoxes(box === 'telefon' ? null : box);
    if (box === 'telefon') {
      tel.root.hidden = false;
      tel.root.classList.toggle('sms', a.tryb === 'sms');
    }
    if (a.typ === 'kwestia') {
      tw.set(a.tekst);
      cur.holdLeft = uiSettings.hold + uiSettings.perChar * a.tekst.length;
      if (box === 'okno') {
        okno.root.hidden = false;
        okno.twarz.clearRect(0, 0, 24, 24);
        okno.twarz.drawImage(face(a.kto), 0, 0);
        okno.kto.textContent = a.imie;
        okno.tekst.textContent = '';
        okno.wybory.innerHTML = '';
        okno.root.classList.remove('gracz');
      } else if (box === 'pasek') {
        pasek.root.hidden = false;
        pasek.kto.textContent = a.imie;
        pasek.tekst.textContent = '';
        pasek.wybory.innerHTML = '';
      } else {
        telLog.push({ kto: a.kto === 'GRACZ' ? 'ty' : 'oni', tekst: '' });
        tel.wybory.innerHTML = '';
        drawTel();
      }
    } else if (a.typ === 'wybor') {
      tw.set('');
      if (box === 'okno') {
        okno.root.hidden = false;
        okno.twarz.clearRect(0, 0, 24, 24);
        okno.twarz.drawImage(face('GRACZ'), 0, 0);
        okno.kto.textContent = postacie.GRACZ?.imie ?? 'Ty';
        okno.tekst.textContent = '';
        okno.root.classList.add('gracz');
        renderChoices(okno.wybory, a.opcje, 0, 'okno');
      } else if (box === 'pasek') {
        pasek.root.hidden = false;
        pasek.kto.textContent = postacie.GRACZ?.imie ?? 'Ty';
        pasek.tekst.textContent = '';
        renderChoices(pasek.wybory, a.opcje, 0, 'pasek');
      } else renderChoices(tel.wybory, a.opcje, 0, 'telefon');
    }
    okno.dalej.hidden = true;
  }
  function drawTel() {
    tel.log.innerHTML = telLog.slice(-5).map((l) => `<p class="${l.kto}">${esc(l.tekst)}</p>`).join('');
  }
  function schowaj() {
    cur = null;
    hideBoxes(null);
  }
  // The player presses "on" (E, Enter, tap, pad): finish typing, then go on (or pick the highlighted answer)
  function naprzod() {
    if (!cur) return false;
    if (cur.a.typ === 'wybor') return wybierz(cur.sel);
    if (!tw.done) {
      tw.finish();
      return true;
    }
    pending = { typ: 'dalej' };
    return true;
  }
  function wybierz(i) {
    if (!cur || cur.a.typ !== 'wybor' || !cur.a.opcje[i]) return false;
    const o = cur.a.opcje[i];
    if (cur.box === 'telefon') {
      telLog.push({ kto: 'ty', tekst: o.tekst });
      tel.wybory.innerHTML = '';
      drawTel();
    }
    pending = { typ: 'wybor', i };
    return true;
  }
  function przesun(d) {
    if (!cur || cur.a.typ !== 'wybor') return;
    const n = cur.a.opcje.length;
    cur.sel = (cur.sel + d + n) % n;
    const ol = cur.box === 'okno' ? okno.wybory : cur.box === 'pasek' ? pasek.wybory : tel.wybory;
    [...ol.children].forEach((li, i) => li.classList.toggle('on', i === cur.sel));
  }

  // Touch / mouse
  for (const [el, box] of [[okno.root, 'okno'], [pasek.root, 'pasek'], [tel.root, 'telefon']]) {
    el.addEventListener('pointerdown', (e) => {
      if (!cur || cur.box !== box) return;
      e.preventDefault();
      const li = e.target.closest('li');
      if (li && cur.a.typ === 'wybor') wybierz(Number(li.dataset.i));
      else naprzod();
    });
  }
  // Keyboard (E comes through the game's "talk" action: gra.js → naprzod)
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.code;
    if (!cur) return;
    const stoi = cur.box === 'okno';
    if (k === 'Enter' || k === 'NumpadEnter' || (stoi && k === 'Space')) naprzod();
    else if (/^(Digit|Numpad)[1-4]$/.test(k) && cur.a.typ === 'wybor') wybierz(Number(k.at(-1)) - 1);
    else if (k === 'Tab' || (stoi && (k === 'ArrowDown' || k === 'KeyS'))) przesun(e.shiftKey ? -1 : 1);
    else if (stoi && (k === 'ArrowUp' || k === 'KeyW')) przesun(-1);
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  // Pad: A = on while standing (driving: A is the handbrake, B comes as the "talk" action), d-pad picks
  let prev = [];
  function pad() {
    const p = [...(navigator.getGamepads?.() ?? [])].find((x) => x?.connected);
    if (!p) return;
    const b = p.buttons.map((x) => x.pressed);
    const edge = (i) => b[i] && !prev[i];
    if (prev.length && cur) {
      if (edge(0) && cur.box === 'okno') naprzod();
      if (edge(12) || edge(14)) przesun(-1);
      if (edge(13) || edge(15)) przesun(1);
    }
    prev = b;
  }

  function kartkaToggle(on = kartkaEl.hidden) {
    kartkaEl.hidden = !on;
    if (on) {
      kartkaEl.innerHTML = `<h3>Zbychu</h3>${kartka.map((p) => `<p><span>${esc(p.pozycja)}</span><b>${p.kwota}</b></p>`).join('')}<p class="razem"><span>RAZEM</span><b>${cel} zł</b></p><p class="stan"><span>Kasa</span><b>${esc(hudState.kasa ?? '')}</b></p><p class="stan"><span>Brakuje</span><b>${esc(hudState.brak ?? '')}</b></p><small>${esc(keyLabel(keys.kartka ?? 'KeyK'))} / ↓ na padzie – schowaj</small>`;
    }
  }

  let hudState = {};
  function flash(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  return {
    pokaz,
    schowaj,
    naprzod,
    wybierz,
    get aktywne() {
      return !!cur;
    },
    get postoj() {
      return cur?.box === 'okno';
    },
    // Technical text (flat, like an official form); stays `czas` s
    ekran(tekst, czas = uiSettings.ekran) {
      if (telefon && !tel.root.hidden) {
        telLog.push({ kto: 'status', tekst });
        drawTel();
        return;
      }
      const p = document.createElement('p');
      p.textContent = `(${tekst})`;
      ekranEl.appendChild(p);
      ekrany.push({ p, t: czas });
      while (ekranEl.children.length > 4) ekranEl.firstChild.remove();
    },
    telefon(tryb, imie) {
      telefon = { tryb, imie };
      telLog = [];
      tel.root.hidden = false;
      tel.root.classList.toggle('sms', tryb === 'sms');
      tel.kto.textContent = tryb === 'sms' ? `${imie} · SMS` : imie;
      flash(tel.root, 'dzwoni');
      drawTel();
    },
    telefonZamknij() {
      telefon = null;
      tel.root.hidden = true;
      telLog = [];
    },
    get telefonOtwarty() {
      return !!telefon;
    },
    // every frame: clock, cash, radio, passenger, mirror
    hud({ zegar, kasa, radio, pasazer, spi, ladunek }) {
      const brak = Math.max(0, cel - kasa);
      const k = `Kasa ${zl(kasa)}${brak > 0 ? ` · brakuje ${zl(brak)}` : ' · jest 889'}`;
      hudState = { kasa: zl(kasa), brak: zl(brak) };
      if (hudEl.zegar.textContent !== zegar) hudEl.zegar.textContent = zegar;
      if (hudEl.kasa.textContent !== k) {
        hudEl.kasa.textContent = k;
        flash(hudEl.kasa, 'zmiana');
      }
      const r = radio ? `♪ ${radio.replace('_', ' ')}` : '';
      if (hudEl.radio.textContent !== r) hudEl.radio.textContent = r;
      const pas = pasazer ? `${postacie[pasazer]?.imie ?? pasazer}${spi ? ' · śpi' : ''}` : '';
      hudEl.pas.hidden = !pasazer;
      if (pasazer && hudEl.pasTxt.textContent !== pas) {
        hudEl.pasTxt.textContent = pas;
        hudEl.pasTwarz.clearRect(0, 0, 24, 24);
        hudEl.pasTwarz.drawImage(face(pasazer), 0, 0);
        hudEl.pas.classList.toggle('spi', !!spi);
      }
      lusterko.classList.toggle('felga', ladunek === 'FELGI');
    },
    cel(text) {
      if (celEl.textContent !== text) celEl.textContent = text;
    },
    // the six posts: counter, the last verdict, what "clean" means
    slupki(stan) {
      slupkiEl.root.hidden = !stan;
      if (!stan) return;
      slupkiEl.b.textContent = stan.naglowek;
      slupkiEl.small.textContent = stan.legenda ?? '';
    },
    werdykt(napis, czyste) {
      slupkiEl.w.textContent = napis;
      slupkiEl.w.className = `f-werdykt ${czyste ? 'ok' : 'zle'}`;
      flash(slupkiEl.w, 'pokaz');
    },
    tablica(wiersze) {
      tablicaEl.hidden = !wiersze;
      if (wiersze) tablicaEl.innerHTML = `<h4>Zakłady</h4>${wiersze.map(([a, b]) => `<p><span>${esc(a)}</span><b>${esc(b)}</b></p>`).join('')}`;
    },
    // 0..1 black
    fade(v) {
      fadeEl.style.opacity = v;
    },
    kartka: kartkaToggle,
    get kartkaOtwarta() {
      return !kartkaEl.hidden;
    },
    // → { typ: 'dalej' } / { typ: 'wybor', i } when the player (or the timer) finished the current line; keys = clicks
    update(dt) {
      pad();
      for (const e of ekrany) {
        if ((e.t -= dt) <= 0 && e.p.isConnected) e.p.classList.add('znika');
        if (e.t <= -1) e.p.remove();
      }
      let keysTyped = 0;
      if (cur?.a.typ === 'kwestia') {
        const r = tw.update(dt);
        keysTyped = r.keys;
        if (cur.box === 'okno') okno.tekst.textContent = r.text;
        else if (cur.box === 'pasek') pasek.tekst.textContent = r.text;
        else {
          telLog[telLog.length - 1].tekst = r.text;
          drawTel();
        }
        okno.dalej.hidden = !tw.done || cur.box !== 'okno';
        // driving and the phone: the line goes on by itself after a while
        if (tw.done && cur.box !== 'okno' && !pending && (cur.holdLeft -= dt) <= 0) pending = { typ: 'dalej' };
      }
      const ev = pending;
      pending = null;
      return { ev, keys: keysTyped };
    },
  };
}
