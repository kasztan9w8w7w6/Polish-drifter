// E2E: the whole night "W nocy robota" on the real game, one input device only.
//   npm run build && npx vite preview --port 4175
//   node scripts/e2e-noc.cjs [klawiatura|dotyk|pad] [NA_STYK|PRAWIE|JUTRO|CZYSTO|ZAKLADY] [zapis]
// `zapis`: at scene 5 the page is reloaded and the night goes on from "Kontynuuj" (the save of the scene's start).
// The choices and the bet runs' results are scripted (strategies below); the driving between the places is a teleport
// (debug), everything the player presses goes through the chosen device: keys, CDP touch taps or a fake pad.
// Prints the cash before dawn and at the end (compare with plan-mvp §5) and the ending.
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
const tryb = process.argv[2] ?? 'klawiatura';
const nazwa = process.argv[3] ?? 'NA_STYK';
// kombi: drive up to the kombi in sc. 0; NOC_BMW / RANO_BUS: [side, stake, clean posts]; gracz: [stake, clean posts]
const STRATEGIE = {
  NA_STYK: { kombi: false, KAMIL_WIE: 'nie', PRAWDA: 'zmilczal', PIWO: 'kiedys', RANO_BUS: null, gracz: [20, 4], oczekiwane: { przedSwitem: 849, koniec: 899, zakonczenie: 'NA STYK' } },
  PRAWIE: { kombi: false, KAMIL_WIE: 'tak', PRAWDA: 'zmilczal', PIWO: 'dane', RANO_BUS: null, gracz: [50, 3], oczekiwane: { przedSwitem: 829, koniec: 779, zakonczenie: 'PRAWIE' } },
  JUTRO: { kombi: false, KAMIL_WIE: 'nie', PRAWDA: 'powiedzial', PIWO: 'dane', RANO_BUS: null, gracz: [50, 2], oczekiwane: { przedSwitem: 779, koniec: 729, zakonczenie: 'JUTRO' } },
  CZYSTO: { kombi: false, KAMIL_WIE: 'tak', PRAWDA: 'powiedzial', PIWO: 'dane', RANO_BUS: null, gracz: [50, 5], oczekiwane: { przedSwitem: 779, koniec: 889, zakonczenie: 'CZYSTO' } },
  // with the night bet (NIE 20 on a BMW that makes 2/6 → +34) and a bus bet (TAK 10 on 5/6 → +8)
  ZAKLADY: { kombi: true, NOC_BMW: ['nie', 20, 2], KAMIL_WIE: 'nie', PRAWDA: 'powiedzial', PIWO: 'kiedys', RANO_BUS: ['tak', 10, 5], gracz: [20, 4], oczekiwane: { przedSwitem: 833, koniec: 891, zakonczenie: 'CZYSTO' } },
};
const S = STRATEGIE[nazwa];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const touch = tryb === 'dotyk';
  const ctx = await b.newContext({ viewport: { width: 800, height: 400 }, isMobile: touch, hasTouch: touch });
  const p = await ctx.newPage();
  const errs = [], log = [];
  p.on('pageerror', (e) => errs.push('ERR ' + e.message));
  if (tryb === 'pad') {
    await p.addInitScript(() => {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
      const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, id: 'fake' };
      navigator.getGamepads = () => [pad];
      window.padPress = (i, ms) => { buttons[i].pressed = true; buttons[i].value = 1; setTimeout(() => { buttons[i].pressed = false; buttons[i].value = 0; }, ms); };
    });
  }
  const cdp = touch ? await ctx.newCDPSession(p) : null;
  const ev = (f, a) => p.evaluate(f, a);
  const wait = (ms) => p.waitForTimeout(ms);
  const frame = () => ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  async function tap(sel) {
    const r = await ev((s) => { const el = document.querySelector(s); if (!el) return null; const q = el.getBoundingClientRect(); return q.width ? { x: q.x + q.width / 2, y: q.y + q.height / 2 } : null; }, sel);
    if (!r) throw new Error('nie ma na ekranie: ' + sel);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await frame();
  }
  const pad = async (i) => { await ev(([i]) => padPress(i, 900), [i]); await wait(1150); }; // (held long enough for a few frames of a slow software renderer)
  const key = async (k) => { await p.keyboard.press(k); await frame(); };
  // the player's "on" in the current box, and picking answer i
  async function dalej(box) {
    if (tryb === 'klawiatura') return key('Enter');
    if (touch) return tap(`#f-${box}`);
    return pad(box === 'okno' ? 0 : 1);
  }
  async function wybierz(box, i) {
    if (tryb === 'klawiatura') return key(`Digit${i + 1}`);
    if (touch) return tap(`#f-${box} li:nth-child(${i + 1})`);
    for (let k = 0; k < i; k++) await pad(13);
    return pad(box === 'okno' ? 0 : 1);
  }
  async function przycisk(i) {
    if (tryb === 'klawiatura') return key(`Digit${i + 1}`);
    if (touch) return tap(`#panel button:nth-child(${i + 1})`);
    const sel = await ev(() => [...document.querySelectorAll('#panel button')].findIndex((x) => x.classList.contains('on')));
    for (let k = 0; k < i - sel; k++) await pad(15);
    return pad(0);
  }
  await p.goto(`http://localhost:${process.env.PORT ?? 4175}/?debug&szybko${touch ? '&touch=1' : ''}`);
  await p.waitForSelector('[data-go=play]', { timeout: 90000 });
  await wait(800);
  // "Graj" in the menu with the device
  if (tryb === 'klawiatura') await key('Enter');
  else if (touch) await tap('[data-go=play]');
  else await pad(0);
  for (let i = 0; i < 20 && !(await ev(() => !!agro.fabula.story)); i++) {
    await wait(500);
    if (i === 10 && tryb === 'pad') await pad(0);
  }
  const wymus = () => ev((S) => {
    const w = agro.fabula.wymus;
    if (S.NOC_BMW) w.NOC_BMW = S.NOC_BMW[2];
    if (S.RANO_BUS) w.RANO_BUS = S.RANO_BUS[2]; else w.RANO_BUS = 3;
    w.RANO_GRACZ = S.gracz[1];
  }, S);
  await wymus();
  let wczytano = process.argv[4] !== 'zapis';
  if (!S.kombi) await ev(() => (agro.fabulaSettings.sc0Limit = 2));
  const t0 = Date.now();
  let przedSwitem = null, last = '', koniec = null;
  const shots = new Set();
  const box = (a) => (['telefon', 'sms'].includes(a.tryb) ? 'telefon' : a.tryb === 'jazda' ? 'pasek' : 'okno');
  for (let guard = 0; guard < 3000; guard++) {
    const st = await ev(() => {
      const f = agro.fabula, a = f.story.action, s = f.story.state;
      const panel = agro.choice.open ? { title: document.querySelector('#panel h2')?.textContent, buttons: [...document.querySelectorAll('#panel button')].map((x) => x.textContent) } : null;
      return { sc: s.scena, lista: s.lista, kasa: s.kasa, typ: a?.typ, brama: a?.brama, tryb: a?.tryb, opcje: a?.opcje?.map((o) => o.dane.ustawia ?? null), polecenie: a?.polecenie, panel, ui: f.ui.aktywne, locked: false };
    });
    const tag = `sc${st.sc} ${st.typ} ${st.brama?.typ ?? st.polecenie ?? ''}`;
    if (process.env.SHOTS && tag !== last && !shots.has(tag)) {
      shots.add(tag);
      await p.screenshot({ path: `${process.env.SHOTS}/${String(shots.size).padStart(3, '0')}-${tag.replace(/[^\w]+/g, '_')}.png` });
    }
    if (tag !== last) {
      last = tag;
      log.push(`${Math.round((Date.now() - t0) / 1000)}s ${tag}${st.panel ? ' [' + st.panel.title + ']' : ''}`);
      if (process.env.NA_ZYWO) console.log(log.at(-1));
    }
    if (st.lista === 'sceny' && st.sc === 11 && przedSwitem === null) przedSwitem = st.kasa;
    if (!wczytano && st.sc === 5) {
      // the save: reload the page, "Kontynuuj" with the device, the same scene and state
      wczytano = true;
      const przed = await ev(() => JSON.stringify(agro.fabula.story.checkpoint));
      await p.reload();
      await p.waitForSelector('[data-go=continue]:not([disabled])', { timeout: 90000 });
      await wait(800);
      if (tryb === 'klawiatura') (await key('ArrowDown'), await key('Enter'));
      else if (touch) await tap('[data-go=continue]');
      else (await pad(13), await pad(0));
      await wait(800);
      await wymus();
      const po = await ev(() => JSON.stringify({ ...agro.fabula.story.state, i: 0, bramy: {}, telefon: null, zaklady: {} }));
      const a = JSON.parse(przed), b = JSON.parse(po);
      const same = ['scena', 'kasa', 'flagi', 'ladunek', 'pasazer', 'radio'].every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
      log.push(`ZAPIS: po wczytaniu scena ${b.scena}, kasa ${b.kasa}, ładunek ${b.ladunek}, pasażer ${b.pasazer} – ${same ? 'zgodne' : 'NIEZGODNE ' + przed + ' / ' + po}`);
      if (!same) errs.push('zapis niezgodny');
      continue;
    }
    if (st.panel) {
      const t = st.panel.title ?? '';
      if (/koniec/.test(t)) {
        koniec = await ev(() => ({ kasa: agro.fabula.story.state.kasa, zak: agro.fabula.story.state.zakonczenie?.nazwa, rows: [...document.querySelectorAll('#panel .p-row')].map((r) => r.textContent) }));
        break;
      }
      let i = 0;
      if (/Zakład/.test(t)) {
        const z = /siebie/.test(t) ? ['tak', S.gracz[0]] : st.sc === 0 ? S.NOC_BMW : S.RANO_BUS;
        i = z && z[1] ? st.panel.buttons.findIndex((x) => x.startsWith(`${z[0].toUpperCase()} ${z[1]} zł`)) : st.panel.buttons.length - 1;
      }
      await przycisk(i);
      await wait(300);
      continue;
    }
    if (st.typ === 'brama') {
      const b = st.brama;
      const tp = async (pt) => { await ev((q) => agro.car.reset({ x: q.x, y: 1, z: q.z }, ((q.heading ?? 0) * Math.PI) / 180), pt); await wait(400); };
      if (b.typ === 'dojazd' || b.typ === 'obok' || (b.typ === 'strefa' && S.kombi)) await tp(await ev((k) => agro.fabula.punkty[k], b.punkt));
      else if (b.typ === 'jazda') await tp(await ev((k) => agro.fabula.punkty[k], st.sc === 3 ? 'stacja' : 'przystanek'));
      else await wait(300);
      continue;
    }
    if (st.typ === 'kwestia' && st.ui) {
      await dalej(box(st));
      await dalej(box(st));
      continue;
    }
    if (st.typ === 'wybor' && st.ui) {
      let i = st.opcje.findIndex((u) => u && Object.entries(u).every(([f, v]) => S[f] === v));
      await wybierz(box(st), Math.max(0, i));
      await wait(200);
      continue;
    }
    await wait(250);
  }
  const czas = Math.round((Date.now() - t0) / 1000);
  console.log(log.join('\n'));
  console.log(`\n${tryb} · ${nazwa}: kasa przed świtem ${przedSwitem} (plan: ${S.oczekiwane.przedSwitem}), na koniec ${koniec?.kasa} (plan: ${S.oczekiwane.koniec}), zakończenie ${koniec?.zak} (plan: ${S.oczekiwane.zakonczenie}), ${czas} s`);
  if (koniec) console.log(koniec.rows.join(' | '));
  const ok = koniec && przedSwitem === S.oczekiwane.przedSwitem && koniec.kasa === S.oczekiwane.koniec && koniec.zak === S.oczekiwane.zakonczenie;
  console.log(ok ? 'OK' : 'NIEZGODNE');
  await p.screenshot({ path: `e2e-noc-${tryb}-${nazwa}.png` });
  console.log(errs.join('\n') || 'bez błędów');
  await b.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
