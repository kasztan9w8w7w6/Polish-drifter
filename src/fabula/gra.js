import * as THREE from 'three';
import dane from '../../docs/fabula/dane-mvp.json';
import inscenizacja from './inscenizacja.json';
import slownik from './slownik.json';
import postacieFab from './postacie.json';
import { createStory, minutyNaCzas, wyplata } from './silnik.js';
import { createFabulaUI, uiSettings } from './ui.js';
import { createRadio } from './radio.js';
import { createRun, npcPath, slupkiSettings, WERDYKT } from './slupki.js';

// The night of "W nocy robota" in the game: the story engine (silnik.js) hands one action at a time, this glue shows
// it (ui.js), moves the world (swiat.js), waits for the player where the staging says so (inscenizacja.json gates),
// runs the ⚙ commands' world part (bets, runs, cargo, passenger, radio, phone, time jumps, the scene with the rim) and
// keeps the clock, the cash, the fuel and the save. docs/wdrozenie-fabuly.md.
export const fabulaSettings = {
  zegarTempo: 3, // game minutes pass this many times faster than real time while driving
  sc0Limit: inscenizacja.sceny[0].bramy[0].limit, // s of free driving on the Park before Mirek calls (no kombi)
  sc0Telefon: inscenizacja.sceny[0].bramy[1].sekundy, // s after the BMW's run before the phone rings
  ekranPauza: 1.1, // s each technical text holds the story before the next line
  ladunekKg: 70,
  kolysanie: 0.18, // how much the load sliding in the back pulls the steering
  paliwoStart: 3, // l – "on the reserve since Tuesday"
  paliwoDno: 0.4, // l – never empty in the MVP (no pushing)
  trasaM: 6800, // m of the whole night's drive in the game (fuel scaled to the plan's 70 km)
  tempoTestu: 1, // × every story timer (tests: ?szybko)
};
const SAVE = 'pd-noc';
const DAWN = { od: 30 * 60 + 4, do: 30 * 60 + 40 }; // 06:04 → 06:40 (minutes counted past the night's midnight)
const zl = (v) => `${Math.round(v)} zł`;

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// ctx: { swiat, car, carView, economy, audio, rig, choice (panel.js), toast, markers, drivetrain, tuning, sky: { scene,
// ambient, moon, night }, keys, keyLabel, onKoniec }
export function createFabula(ctx) {
  const { swiat, car, economy, audio, choice, toast, drivetrain, tuning, sky } = ctx;
  const fab = ctx.fab;
  const postacie = postacieFab.postacie;
  const wymus = {}; // forced run results (tests): { NOC_BMW: 6, RANO_BUS: 2, RANO_GRACZ: 4 }
  let story = null;
  const ui = createFabulaUI({ postacie, kartka: dane.ekonomia.kartka_zbycha, cel: dane.ekonomia.cel, keyLabel: ctx.keyLabel, keys: ctx.keys });
  const radio = createRadio();
  const course = swiat.course;
  const punkty = fab.punkty;
  swiat.wsadz(ctx.carView.root);

  let zegar = 0; // minutes (silnik.js czasNaMinuty)
  let act = null; // runtime of the current action
  let shown = null; // the action object last entered
  let lastPos = null;
  let fade = 0, fadeTarget = 0;
  let telClose = 0;
  let koniec = false;
  let cargoOn = false;
  let sway = 0, swayV = 0, lastLat = 0;
  const holes = new Map();
  let lastCheckpoint = null;
  let stats = { maxCzyste: null };
  let running = false;

  function nowaNoc() {
    story = createStory(dane, { inscenizacja, slownik: slownik.nazwy, postacie, wymus });
    economy.restore({ fuel: fabulaSettings.paliwoStart, money: dane.ekonomia.kasa_start });
    placeCar(fab.start);
    reset();
    story.start();
    zegar = story.state.zegar;
    running = true;
  }
  function reset() {
    act = null;
    shown = null;
    koniec = false;
    ui.schowaj();
    ui.telefonZamknij();
    ui.tablica(null);
    ui.slupki(null);
    choice.close();
    radio.wygas(false);
    lastCheckpoint = null;
  }
  function placeCar(p) {
    car.reset({ x: p.x, y: 1, z: p.z }, ((p.heading ?? 0) * Math.PI) / 180);
    ctx.rig.reset();
    lastPos = null;
  }
  // "Kontynuuj": the start of the saved scene
  function wczytaj() {
    let s = null;
    try {
      s = JSON.parse(storage()?.getItem(SAVE) ?? 'null');
    } catch {}
    if (!s?.cp) return nowaNoc();
    story = createStory(dane, { inscenizacja, slownik: slownik.nazwy, postacie, wymus });
    reset();
    economy.restore({ fuel: s.fuel ?? fabulaSettings.paliwoStart, money: s.cp.kasa });
    placeCar(s.car ?? fab.start);
    story.restore(s.cp);
    zegar = story.state.zegar;
    running = true;
  }
  function zapisz(state) {
    const q = state.quaternion;
    const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
    try {
      storage()?.setItem(SAVE, JSON.stringify({ cp: story.checkpoint, car: { x: state.position.x, z: state.position.z, heading: (Math.atan2(-fz, fx) * 180) / Math.PI }, fuel: economy.state.fuel }));
    } catch {}
  }
  const hasSave = () => {
    try {
      return !!JSON.parse(storage()?.getItem(SAVE) ?? 'null')?.cp;
    } catch {
      return false;
    }
  };

  const trybSceny = () => (story.state.lista === 'sceny' ? inscenizacja.sceny[story.state.scena]?.tryb : inscenizacja.zakonczenia.tryb) ?? 'postoj';
  const dist = (p, pos) => Math.hypot(p.x - pos.x, p.z - pos.z);

  // ---------- entering a new action ----------
  function enter(a, state) {
    act = { a, t: 0 };
    if (a.typ === 'brama') {
      act.from = { x: state.position.x, z: state.position.z };
      act.moved = 0;
      return;
    }
    if (a.typ === 'ekran') {
      const skok = a.godzina != null && story.state.lista === 'sceny' && a.godzina - zegar > 5 && !ui.telefonOtwarty;
      act.wait = fabulaSettings.ekranPauza;
      if (skok) {
        // a scene that starts later than the clock: a short fade, like a time jump
        act.skok = a.godzina;
        act.wait += 1.2;
        fadeTarget = 1;
      } else ui.ekran(a.tekst);
      if (a.godzina != null && !skok) zegar = Math.max(zegar, a.godzina);
      return;
    }
    if (a.typ === 'kwestia' || a.typ === 'wybor') {
      ui.pokaz(a);
      return;
    }
    if (a.typ === 'dzwiek') {
      if (/do końca utworu/.test(a.tekst)) radio.wygas(true);
      act.wait = 0;
      return;
    }
    if (a.typ === 'koniec') {
      finish();
      return;
    }
    // ⚙ commands
    const p = a.polecenie;
    act.wait = 0;
    if (p === 'skok_czasu') {
      fadeTarget = 1;
      act.skok = a.godzina;
      act.wait = 2.2;
    } else if (p === 'telefon') {
      ui.schowaj();
      ui.telefon(a.tryb, a.imie);
      audio.beep?.();
      act.wait = a.tryb === 'sms' ? 0.8 : 1.4;
    } else if (p === 'zaklad') tablicaZakladu(a);
    else if (p === 'przejazd') startPrzejazd(a);
    else if (p === 'tlum') {
      act.tlum = a.tlum;
      pokazTablice();
    } else if (p === 'scenka') {
      act.wait = (a.scenka.czas ?? 6) + 0.5;
      act.scenka = a;
      swiat.felgiPrzyKurniku.slice(0, 3).forEach((f) => (f.visible = true));
    } else if (p === 'kasa') act.wait = 0.4;
  }

  // The bet board (plan §4): every side and stake with the possible win in złoty, "nie stawiam" always there
  function tablicaZakladu(a) {
    const pz = a.przejazd;
    const kto = postacie[pz.trzyma]?.imie ?? pz.trzyma;
    const rows = [
      ['Linia', `${dane.zaklady.zasady.prog_wygranej} czyste z ${dane.zaklady.zasady.slupki} = TAK`],
      ...a.strony.map((s) => [`Kurs na ${s.toUpperCase()} (na oko)`, a.kursy[s].toFixed(1).replace('.', ',')]),
      ['Kasa', `${zl(story.state.kasa)} · brakuje ${zl(Math.max(0, story.cel - story.state.kasa))}`],
    ];
    const buttons = [];
    for (const s of a.strony) for (const st of a.stawki.filter((x) => x > 0)) {
      const win = wyplata(st, a.kursy[s]);
      buttons.push({ label: `${s.toUpperCase()} ${st} zł → ${win} zł`, action: () => postaw(a, s, st) });
    }
    buttons.push({ label: 'Nie stawiam', action: () => postaw(a, a.strony[0], 0) });
    choice.show({ title: `${a.id === 'RANO_GRACZ' ? 'Zakład na siebie' : 'Zakład'} · trzyma ${kto}`, text: a.id === 'RANO_GRACZ' ? 'Ty jedziesz. Sześć słupków.' : `${a.przejazd.kierowca.replace('NPC ', '')} · sześć słupków`, rows, buttons, cancel: buttons.length - 1 });
    act.panel = true;
  }
  function postaw(a, strona, stawka) {
    story.bet(a.id, strona, stawka);
    act.panel = false;
    act.wait = 0.2;
    act.go = true;
    if (a.id === 'RANO_GRACZ') pokazTablice();
  }
  function pokazTablice() {
    const tl = dane.zaklady.przejazdy.RANO_GRACZ.tlum.map((b) => [postacie[b.kto]?.imie ?? b.kto, `${b.stawka} zł na ${b.strona.toUpperCase()}`]);
    const moj = story.state.zaklady.RANO_GRACZ;
    if (moj) tl.push(['Ty', moj.stawka ? `${moj.stawka} zł na TAK → ${wyplata(moj.stawka, story.kurs('RANO_GRACZ', 'tak'))} zł` : 'nie stawiasz']);
    ui.tablica(tl);
  }

  function startPrzejazd(a) {
    act.run = createRun(course, slupkiSettings);
    act.werdykty = [];
    if (a.npc) {
      const auto = a.id === 'NOC_BMW' ? swiat.auta.bmw : swiat.auta.bus;
      act.path = npcPath(course, a.slupki);
      swiat.przejazdNPC(auto, act.path);
      if (a.id === 'RANO_BUS') swiat.people.show('ZDZICHU', false);
      ui.slupki({ naglowek: `${a.id === 'NOC_BMW' ? 'Beemka' : 'Bus Zdzicha'} · słupek 0/6 · czyste 0`, legenda: legenda() });
      act.npc = true;
    } else {
      ui.slupki({ naglowek: 'Na start: linia przy hali, jedź na południe', legenda: legenda() });
      act.gracz = true;
    }
  }
  const legenda = () => `czyste = bokiem ≥ ${slupkiSettings.minKat}°, po stronie z łukiem, bez dotknięcia słupka`;

  function finish() {
    if (koniec) return;
    koniec = true;
    running = false;
    ui.schowaj();
    ui.slupki(null);
    ui.tablica(null);
    try {
      storage()?.removeItem(SAVE);
    } catch {}
    const st = story.state;
    const f = st.flagi;
    const noc = { wygrana: 'wygrany', przegrana: 'przegrany', bez_zakladu: 'bez zakładu' };
    const rows = [
      ['Zakończenie', st.zakonczenie?.nazwa ?? '–'],
      ['Kasa', zl(st.kasa)],
      ['Kartka od Zbycha', `${dane.ekonomia.cel} zł`],
      ['Brakuje', zl(Math.max(0, dane.ekonomia.cel - st.kasa))],
      ['Zakład na beemkę', f.NOC_BMW ? noc[f.NOC_BMW] : 'nie podjechałeś'],
      ['Mirkowi', f.PRAWDA === 'powiedzial' ? 'powiedziałeś o biciu' : 'zmilczałeś'],
      ['Kamilowi', f.PIWO === 'dane' ? 'dwie dyszki na piwo' : 'piwo dalej wisi'],
      ['Zakład na busa', f.RANO_BUS ? noc[f.RANO_BUS] : '–'],
      ['Słupki o świcie', st.wyniki.RANO_GRACZ ? `${st.wyniki.RANO_GRACZ.czyste}/6 czystych` : '–'],
      ['Noc', '23:35 – 06:40'],
    ];
    choice.show({
      title: 'W nocy robota · koniec',
      rows,
      buttons: [
        { label: 'Nowa noc', action: () => nowaNoc() },
        { label: 'Menu', action: () => ctx.onMenu?.() },
      ],
    });
    ctx.onKoniec?.(st);
  }

  // ---------- every frame while the current action runs ----------
  function step(dt, state) {
    const a = act.a;
    act.t += dt;
    if (a.typ === 'brama') return brama(dt, state);
    if (a.typ === 'kwestia' || a.typ === 'wybor') return; // (ui events, below)
    if (act.skok != null) {
      // fade to black, move the clock, fade back
      if (fade > 0.98 && !act.skokDone) {
        act.skokDone = true;
        zegar = Math.max(zegar, act.skok);
        if (a.typ === 'ekran') ui.ekran(a.tekst);
        fadeTarget = 0;
      }
      if (!act.skokDone) return;
    }
    if (act.panel) return;
    if (act.npc) return npcRun(dt);
    if (act.gracz) return graczRun(dt, state);
    if (act.scenka) scenka();
    if (a.typ === 'polecenie' && a.polecenie === 'zaklad' && !act.go) return;
    if (act.t >= (act.wait ?? 0)) done();
  }
  function done(wynik) {
    story.done(wynik);
  }

  function brama(dt, state) {
    const b = act.a.brama;
    const pos = state.position;
    const moved = lastPos ? Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z) : 0;
    act.moved += moved;
    const p = punkty[b.punkt];
    const stoi = state.speed < 1.6;
    if (b.typ === 'dojazd') {
      ctx.target = { x: p.x, z: p.z, r: p.r ?? b.r };
      ui.cel(`→ ${b.cel} · ${Math.round(dist(p, pos))} m`);
      if (dist(p, pos) < (b.r ?? p.r) && stoi) done();
    } else if (b.typ === 'obok') {
      ctx.target = { x: p.x, z: p.z, r: 6 };
      ui.cel(`→ ${b.cel}`);
      if (dist(p, pos) < b.r) done();
    } else if (b.typ === 'jazda') {
      ui.cel(b.cel ? `→ ${b.cel}` : '');
      if (act.moved >= b.metry) done();
    } else if (b.typ === 'strefa') {
      ctx.target = { x: p.x, z: p.z, r: b.r };
      ui.cel(`${b.cel}`);
      if (dist(p, pos) < b.r && stoi) done({ spelniona: true });
      else if (act.t > fabulaSettings.sc0Limit) done({ spelniona: false });
    } else if (b.typ === 'czas') {
      if (act.t >= fabulaSettings.sc0Telefon) done();
    } else if (b.typ === 'tankowanie') {
      if (!act.panel && !choice.open) {
        act.panel = true;
        choice.show({
          title: 'Kometa',
          text: 'Pb95 · 6,99 zł/l',
          rows: [['W baku', `${economy.state.fuel.toFixed(1)} l`], ['Kasa', zl(story.state.kasa)]],
          buttons: [{ label: `Za pięć dych (${b.zl} zł)`, action: () => {
            economy.restore({ fuel: economy.state.fuel + b.litry });
            act.panel = false;
            done();
          } }],
        });
      }
    }
  }

  function npcRun(dt) {
    const bieg = swiat.bieg;
    if (bieg?.pos && bieg.t >= 0) {
      for (const e of act.run.update(dt, { x: bieg.pos.x, z: bieg.pos.z, yaw: bieg.pos.yaw, sideSlip: bieg.path.at(bieg.t).slip })) pokazWerdykt(e, act.a.id === 'NOC_BMW' ? 'Beemka' : 'Bus Zdzicha');
    }
    if (!bieg) {
      if (!act.koniecT) {
        act.koniecT = act.t;
        const r = rozlicz();
        toast(r);
      }
      if (act.t - act.koniecT > 2.2 / fabulaSettings.tempoTestu) {
        ui.slupki(null);
        if (act.a.id === 'RANO_BUS') swiat.people.show('ZDZICHU', true);
        act.npc = false;
        act.wait = 0;
        done();
      }
    }
  }
  function rozlicz() {
    // what the bet will pay (the engine settles it on done())
    const a = act.a;
    const cz = (a.slupki ?? act.slupki).filter(Boolean).length;
    const z = story.state.zaklady[a.id];
    const tak = cz >= dane.zaklady.zasady.prog_wygranej;
    if (!z?.stawka) return `${cz}/6 czystych · ${tak ? 'TAK' : 'NIE'}`;
    const won = a.id === 'RANO_GRACZ' ? tak : (z.strona === 'tak') === tak;
    const k = story.kurs(a.id, z.strona);
    return `${cz}/6 czystych · ${won ? `wygrana ${wyplata(z.stawka, k)} zł` : `przegrana ${z.stawka} zł`}`;
  }
  function pokazWerdykt(e, kto) {
    if (e.typ === 'slupek') {
      ui.werdykt(e.napis, e.czyste);
      if (e.werdykt === 'dotyk') swiat.wobble(e.k);
      const r = act.run.state;
      ui.slupki({ naglowek: `${kto} · słupek ${r.next}/6 · czyste ${r.czyste}`, legenda: legenda() });
    }
    if (e.typ === 'start') ui.slupki({ naglowek: `${kto} · słupek 0/6 · czyste 0`, legenda: legenda() });
  }
  function graczRun(dt, state) {
    const run = act.run;
    if (wymus.RANO_GRACZ != null && !run.state.done) {
      act.slupki = Array.from({ length: 6 }, (_, k) => k < wymus.RANO_GRACZ);
      run.state.done = true;
      run.state.czyste = wymus.RANO_GRACZ;
    }
    if (!run.state.started) ctx.target = { x: course.start.x, z: course.start.z, r: 5 };
    const q = state.quaternion;
    const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
    for (const e of run.update(dt, { x: state.position.x, z: state.position.z, yaw: Math.atan2(-fz, fx), sideSlip: state.sideSlip ?? 0 })) {
      pokazWerdykt(e, 'Ty');
      if (e.typ === 'koniec') act.slupki = e.slupki;
    }
    if (run.state.done) {
      if (!act.koniecT) {
        act.koniecT = act.t;
        toast(rozlicz());
      }
      if (act.t - act.koniecT > 2.5 / fabulaSettings.tempoTestu) {
        ui.slupki(null);
        ui.tablica(null);
        act.gracz = false;
        done({ slupki: act.slupki });
      }
    }
  }
  // FELGA_BICIE: the car stands, the camera looks at the henhouse, the fourth rim rolls out crooked and wobbling,
  // one line of technical text, back to the story
  function scenka() {
    const s = act.scenka.scenka;
    const f = swiat.felgiPrzyKurniku[3];
    const k = Math.min(1, act.t / ((s.czas ?? 6) * 0.7));
    const [kx, kz] = fab.wies.kurnik;
    const from = { x: fab.wies.x + 4, z: fab.wies.z - 3 }, to = { x: kx + 1.05, z: kz + 2.2 };
    f.visible = true;
    f.position.set(from.x + (to.x - from.x) * k, 0.45, from.z + (to.z - from.z) * k);
    const wobble = Math.sin(act.t * 9) * 0.28 * (1 - k * 0.5);
    f.rotation.set(0, Math.PI / 2 + wobble, k * 12);
    if (act.t > 1.8 && !act.tekst) {
      act.tekst = true;
      if (s.tekst) ui.ekran(s.tekst, 5);
    }
    act.cam = { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 };
  }

  // Cargo: +70 kg in the powertrain and the ball, the load shifts in corners (a small pull on the steering), the
  // mirror is blocked (ui.js)
  function ladunek(on) {
    if (on === cargoOn) return;
    cargoOn = on;
    tuning.mass += on ? fabulaSettings.ladunekKg : -fabulaSettings.ladunekKg;
    car.applyParams();
    if (drivetrain) drivetrain.cargoKg = on ? fabulaSettings.ladunekKg : 0;
  }

  function dawn() {
    const k = THREE.MathUtils.clamp((zegar - DAWN.od) / (DAWN.do - DAWN.od), 0, 1) * (story?.state.scena === 11 || story?.state.lista !== 'sceny' ? 1 : 0);
    const c = new THREE.Color(0x020203).lerp(new THREE.Color(0x46566e), k);
    sky.scene.background.copy(c);
    sky.scene.fog.color.copy(c);
    sky.ambient.intensity = sky.night.ambient + k * 1.1;
    sky.moon.intensity = sky.night.moon + k * 0.8;
    sky.scene.fog.far = sky.night.visibility + k * 50;
  }

  const api = {
    ui,
    radio,
    wymus,
    punkty,
    course,
    get story() {
      return story;
    },
    get zegar() {
      return zegar;
    },
    get running() {
      return running;
    },
    nowaNoc,
    wczytaj,
    hasSave,
    get target() {
      return ctx.target;
    },
    // the "talk" action (E, pad B, the touch button): on with the current line
    naprzod() {
      return ui.naprzod();
    },
    radioNext() {
      if (!story) return;
      story.state.radio = radio.next();
      toast(`♪ ${radio.stacja.replace('_', ' ')}`);
    },
    kartka() {
      ui.kartka();
    },
    // → { lock: the car must stand, cam: a state for the camera instead of the car, steer: pull from the load }
    update(dt, state, time) {
      const out = { lock: false, cam: null, steer: 0 };
      radio.update(dt);
      fade += Math.sign(fadeTarget - fade) * Math.min(Math.abs(fadeTarget - fade), dt * 2.2 * fabulaSettings.tempoTestu);
      ui.fade(fade);
      if (!story) return out;
      const sdt = dt * fabulaSettings.tempoTestu;
      const st = story.state;
      ctx.target = null;
      // the current action
      const a = story.action;
      if (a !== shown) {
        shown = a;
        ui.cel('');
        if (a) enter(a, state);
      }
      if (a && act && !koniec) step(sdt, state);
      // lines and choices finished by the player / the timer
      const u = ui.update(dt);
      if (u.keys) audio.type();
      if (u.ev && story.action === shown && (shown?.typ === 'kwestia' || shown?.typ === 'wybor')) {
        if (u.ev.typ === 'wybor') story.choose(u.ev.i);
        else story.done();
        if (!['kwestia', 'wybor'].includes(story.action?.typ)) ui.schowaj();
      }
      // the phone closes a moment after the call is over
      if (ui.telefonOtwarty && !st.telefon && !(story.action?.typ === 'polecenie' && story.action.polecenie === 'telefon')) {
        if ((telClose += dt) > 1.5) (ui.telefonZamknij(), (telClose = 0));
      } else telClose = 0;
      // save at every new scene
      if (story.checkpoint !== lastCheckpoint) {
        lastCheckpoint = story.checkpoint;
        zapisz(state);
      }
      // clock: faster than real time, never past the next scripted hour
      const next = story.nextTime();
      if (!koniec) zegar = Math.min(zegar + (dt * fabulaSettings.zegarTempo) / 60, next != null ? Math.max(zegar, next - 1) : Infinity);
      st.zegar = Math.max(st.zegar ?? 0, Math.floor(zegar));
      dawn();
      // radio: the story's station, quieter when someone talks in the car
      if (radio.stacja !== st.radio) radio.set(st.radio);
      const talk = ui.aktywne;
      radio.duck(st.pasazer && !st.spi ? (talk ? 1 : 0.55) : ui.telefonOtwarty ? 0.8 : talk ? 0.6 : 0);
      // cargo
      ladunek(st.ladunek === 'FELGI');
      // fuel: from the distance driven, scaled so the night takes ~6.7 l (plan §3); never below the "fumes"
      const pos = state.position;
      const moved = lastPos ? Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z) : 0;
      if (moved < 20) {
        const perM = (dane.ekonomia.paliwo.trasa_km * dane.ekonomia.paliwo.spalanie_l_na_100km) / 100 / fabulaSettings.trasaM;
        economy.restore({ fuel: Math.max(fabulaSettings.paliwoDno, economy.state.fuel - moved * perM) });
      }
      lastPos = { x: pos.x, z: pos.z };
      // the load sliding: lateral acceleration → a sprung offset → a small pull on the steering and a knock
      if (cargoOn) {
        const v = state.velocity;
        const q = state.quaternion;
        const rx = 2 * (q.x * q.z + q.w * q.y), rz = 1 - 2 * (q.x * q.x + q.y * q.y); // the car's +Z (right) axis
        const lat = v.x * rx + v.z * rz;
        const acc = (lat - lastLat) / Math.max(dt, 1e-3);
        lastLat = lat;
        swayV += (-acc * 0.05 - sway * 18 - swayV * 4) * dt;
        sway = THREE.MathUtils.clamp(sway + swayV * dt, -1, 1);
        out.steer = sway * fabulaSettings.kolysanie;
        if (Math.abs(swayV) > 2.2 && time - (holes.get('stuk') ?? 0) > 0.6) {
          holes.set('stuk', time);
          audio.hit(2);
        }
      }
      // potholes on the road out: a jolt (camera, a knock; the rims knock louder)
      if (state.speed > 4) {
        for (const h of swiat.dziury) {
          if (Math.abs(h.x - pos.x) > 3 || Math.abs(h.z - pos.z) > 3) continue;
          if (Math.hypot(h.x - pos.x, h.z - pos.z) < h.r + 0.9 && time - (holes.get(h) ?? -9) > 2) {
            holes.set(h, time);
            ctx.rig.hit(3 + state.speed * 0.2);
            audio.hit(cargoOn ? 5 : 3);
          }
        }
      }
      // the world: who stands where, lamps, the NPC run
      swiat.update(dt, { scena: st.lista === 'sceny' ? st.scena : 12, zegar, pasazer: st.pasazer, spi: st.spi, ladunek: st.ladunek, time });
      document.body.classList.toggle('can-talk', ui.aktywne && !ui.postoj); // (touch: the "dalej" button while driving)
      ui.hud({ zegar: minutyNaCzas(zegar), kasa: st.kasa, radio: radio.stacja, pasazer: st.pasazer, spi: st.spi, ladunek: st.ladunek });
      // does the car have to stand?
      const x = story.action;
      const freeMode = ['jazda', 'telefon', 'sms'].includes(x?.tryb ?? (ui.telefonOtwarty ? 'telefon' : trybSceny()));
      out.lock = !koniec && !!x && !(x.typ === 'brama' || act?.gracz || freeMode) || !!act?.npc || !!act?.scenka || fade > 0.05;
      if (koniec) out.lock = true;
      // the camera: on the NPC's car during its run, on the henhouse during the scene
      const b = swiat.bieg;
      if (act?.npc && b?.pos) out.cam = camState(b.pos.x, b.pos.z, b.pos.yaw, b.pos.speed);
      else if (act?.scenka && act.cam) out.cam = camState(act.cam.x, act.cam.z, 0, 0);
      return out;
    },
  };
  const camS = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), velocity: new THREE.Vector3(), speed: 0, forwardSpeed: 0 };
  function camState(x, z, yaw, speed) {
    camS.position.set(x, 0.7, z);
    camS.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    camS.velocity.set(Math.cos(yaw) * speed, 0, -Math.sin(yaw) * speed);
    camS.speed = camS.forwardSpeed = speed;
    return camS;
  }
  return api;
}

export { WERDYKT, uiSettings };
