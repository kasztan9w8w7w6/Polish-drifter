// E2E (dotyk): `npm run build && npx vite preview --port 4175`, then `node scripts/e2e-dotyk.cjs` (Playwright + Chromium).
// Missions 1→2→3 with every UI interaction by touch (CDP touch events). Driving between targets: teleport (debug).
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [], log = [];
  p.on('pageerror', (e) => errs.push('ERR ' + e.message));
  const cdp = await ctx.newCDPSession(p);
  const ev = (f, a) => p.evaluate(f, a);
  const wait = (ms) => p.waitForTimeout(ms);
  async function tap(sel) {
    const r = await ev((s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return b.width ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; }, sel);
    if (!r) throw new Error('nie ma na ekranie: ' + sel);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
    await wait(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(250);
  }
  const step = () => ev(() => `${agro.mission.def.id}/${agro.mission.state.step?.id ?? '-'}${agro.mission.state.complete ? ' (koniec)' : ''}`);
  const tp = async (x, z, h = 0) => { await ev(([x, z, h]) => agro.car.reset({ x, y: 1, z }, h), [x, z, h]); await wait(1500); };
  const pt = (id) => ev((id) => { const q = agro.mission.target(); return q; }, id);
  // talk to the person in front of us by touch: the button, then tap the window / pick answers
  async function talk(picks = []) {
    await tap('#t-talk');
    for (let i = 0; i < 40 && (await ev(() => agro.dialogue.open)); i++) {
      const choices = await ev(() => document.querySelectorAll('#dialogue li').length);
      if (choices) await tap(`#dialogue li:nth-child(${(picks.shift() ?? 0) + 1})`);
      else await tap('#dialogue .d-main');
    }
  }
  await p.goto('http://localhost:4175/?debug&touch=1');
  await p.waitForSelector('[data-go=play]', { timeout: 90000 });
  await tap('[data-go=play]');
  await wait(1000);
  log.push('Graj → ' + (await step()));
  // Mission 1
  for (let guard = 0; guard < 8 && !(await ev(() => agro.mission.state.complete)); guard++) {
    const s = await ev(() => agro.mission.state.step);
    if (s.type === 'money') await ev((min) => (agro.economy.state.money += min + 5), s.min); // (as if earned drifting on the lot)
    else if (s.type === 'refuel') {
      // the station by touch: drive up to the pump, the panel shows up, tap "Do pełna"
      const st = await ev(() => agro.points.stacja);
      await tp(st.x, st.z);
      await wait(1500);
      log.push('stacja: ' + (await ev(() => document.querySelector('#panel h2')?.textContent)));
      await tap('#panel button:nth-child(1)');
      log.push('bak po tankowaniu: ' + (await ev(() => agro.economy.state.fuel.toFixed(1))) + ' l, kasa ' + (await ev(() => agro.economy.state.money.toFixed(2))));
    } else { const q = await pt(); await tp(q.x, q.z); }
    await wait(1500);
    log.push(await step());
  }
  await wait(500);
  // at Żappka the shop panel comes first (touch "Wyjdź"), then the summary
  for (let i = 0; i < 3 && !/Misja/.test((await ev(() => document.querySelector('#panel h2')?.textContent)) ?? ''); i++) {
    log.push('panel: ' + (await ev(() => document.querySelector('#panel h2')?.textContent)));
    await tap('#panel button:last-child');
    await wait(800);
  }
  log.push('panel: ' + (await ev(() => document.querySelector('#panel h2')?.textContent)));
  await tap('#panel button:nth-child(1)');
  await wait(800);
  log.push('Dalej → ' + (await step()) + ', szacun ' + (await ev(() => Math.round(agro.economy.state.respect))));
  // Mission 2
  let q = await pt();
  await tp(q.x + 3.2, q.z);
  log.push('przycisk rozmowy: ' + (await ev(() => getComputedStyle(document.getElementById('t-talk')).display)));
  await talk([0]);
  log.push(await step());
  const lot = await ev(() => agro.mission.target());
  await tp(lot.x, lot.z);
  for (let i = 0; i < 12 && (await ev(() => agro.mission.state.step?.type === 'score')); i++) { await ev(() => (agro.scorer.state.total += 400)); await wait(400); }
  log.push(await step());
  q = await pt();
  await tp(q.x + 3.2, q.z);
  await talk();
  await wait(800);
  log.push('panel: ' + (await ev(() => document.querySelector('#panel h2')?.textContent)));
  await tap('#panel button:nth-child(1)');
  await wait(800);
  log.push('Dalej → ' + (await step()));
  // Mission 3
  q = await pt();
  await tp(q.x, q.z - 3.6);
  await talk([0]);
  log.push(await step() + ' wyścig: ' + (await ev(() => !!agro.race)));
  await ev(() => (agro.race.state.result = 'won'));
  await wait(2500);
  log.push(await step());
  log.push('po wyścigu: ' + (await ev(() => JSON.stringify({ race: agro.race?.state.result, rival: agro.race?.rival.state.speed, t: agro.race?.state.time }))));
  console.log(log.join('\n'));
  q = await pt();
  await tp(q.x + 3, q.z + 0.5);
  await talk([0]);
  await wait(800);
  log.push('panel: ' + (await ev(() => document.querySelector('#panel h2')?.textContent)) + ' / ' + (await ev(() => [...document.querySelectorAll('#panel button')].map((b) => b.textContent).join(', '))));
  await tap('#panel button:nth-child(1)');
  await wait(500);
  log.push('po ostatniej: panel ' + (await ev(() => agro.choice.open)) + ', ' + (await step()));
  await p.screenshot({ path: 'e2e-dotyk.png' });
  console.log(log.join('\n'));
  console.log(errs.join('\n') || 'bez błędów');
  await b.close();
})();
