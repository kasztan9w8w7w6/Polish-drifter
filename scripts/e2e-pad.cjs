// E2E (pad): `npm run build && npx vite preview --port 4175`, then `node scripts/e2e-pad.cjs` (Playwright + Chromium).
const { chromium } = require(process.env.PLAYWRIGHT ?? 'playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  const errs = [], log = [];
  p.on('pageerror', (e) => errs.push('ERR ' + e.message));
  // A fake standard-mapping pad: window.padPress(i) holds button i for a moment
  await p.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, id: 'fake' };
    navigator.getGamepads = () => [pad];
    window.padPress = (i) => { buttons[i].pressed = true; buttons[i].value = 1; setTimeout(() => { buttons[i].pressed = false; buttons[i].value = 0; }, 2500); };
  });
  const ev = (f, a) => p.evaluate(f, a);
  const press = async (i) => { await ev((i) => padPress(i), i); await p.waitForTimeout(3200); };
  await p.goto('http://localhost:4175/?debug&stare'); // (the old prototype: ?stare)
  await p.waitForSelector('[data-go=play]', { timeout: 90000 });
  await p.waitForTimeout(1000);
  await press(0); // A on the focused "Graj"
  log.push('menu A → misja ' + (await ev(() => agro.mission.def.id + ', menu otwarte: ' + agro.menu.open)));
  await press(9); // Start = pause
  log.push('Start → pauza: ' + (await ev(() => agro.menu.screen)));
  await press(1); // B = back = resume
  log.push('B → menu otwarte: ' + (await ev(() => agro.menu.open)));
  // conversation: next to Seba, B = talk, A = on, d-pad down + A = second answer
  await ev(() => agro.startMission('pokaz'));
  const s = await ev(() => agro.mission.target());
  await ev((s) => agro.car.reset({ x: s.x + 3.2, y: 1, z: s.z }, 0), s);
  await p.waitForTimeout(1500);
  await press(1);
  log.push('B → rozmowa: ' + (await ev(() => agro.dialogue.open)));
  for (let i = 0; i < 8 && !(await ev(() => document.querySelectorAll('#dialogue li').length)); i++) await press(0);
  await press(13);
  log.push('d-pad ↓ → zaznaczona: ' + (await ev(() => document.querySelector('#dialogue li.on')?.textContent)));
  await press(0);
  for (let i = 0; i < 8 && !(await ev(() => document.querySelectorAll('#dialogue li').length)) && (await ev(() => agro.dialogue.open)); i++) await press(0);
  await press(0);
  log.push('po wyborze: rozmowa ' + (await ev(() => agro.dialogue.open)) + ', krok ' + (await ev(() => agro.mission.state.step.id)));
  // summary panel with the pad
  await ev(() => agro.choice.show({ title: 'Test', buttons: [{ label: 'Jeden', action: () => (window.picked = 1) }, { label: 'Dwa', action: () => (window.picked = 2) }] }));
  await press(15);
  await press(0);
  log.push('panel: d-pad → + A → wybrano ' + (await ev(() => window.picked)));
  console.log(log.join('\n'));
  console.log(errs.join('\n') || 'bez błędów');
  await b.close();
})();
