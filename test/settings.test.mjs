// v0.4b: settings in localStorage (works without it), pixel size from the screen, key rebinding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, saveSettings, defaultSettings, pixelSizeFor, rebind, keyLabel, loadProgress, saveProgress } from '../src/settings.js';

const memory = () => {
  const m = new Map();
  return { localStorage: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) } };
};

test('ustawienia: zapis i odczyt, gra działa bez localStorage i z zepsutym wpisem', () => {
  const win = memory();
  const s = loadSettings(win);
  assert.deepEqual(s, defaultSettings());
  s.pixels = 'Grube';
  s.difficulty = 'Pro';
  s.volume = 0.3;
  s.paint = 'Granat';
  rebind(s.keys, 'handbrake', 'ShiftLeft');
  assert.ok(saveSettings(s, win));
  const back = loadSettings(win);
  assert.equal(back.pixels, 'Grube');
  assert.equal(back.difficulty, 'Pro');
  assert.equal(back.paint, 'Granat');
  assert.deepEqual(back.keys.handbrake, ['ShiftLeft', 'Space']);
  // No storage at all / storage that throws / garbage in it
  const throwing = { get localStorage() { throw new Error('blocked'); } };
  assert.deepEqual(loadSettings(throwing), defaultSettings());
  assert.equal(saveSettings(s, throwing), false);
  const bad = memory();
  bad.localStorage.setItem('agro-settings', '{nie json');
  assert.deepEqual(loadSettings(bad), defaultSettings());
  bad.localStorage.setItem('agro-settings', JSON.stringify({ volume: 'głośno', keys: { gas: [7] } }));
  assert.equal(loadSettings(bad).volume, 0.7);
  assert.deepEqual(loadSettings(bad).keys.gas, ['KeyW', 'ArrowUp']);
  saveProgress({ mission: 'paczka', step: 2, save: { x: 1, z: 2, heading: 0, level: 80 } }, win);
  assert.equal(loadProgress(win).step, 2);
  assert.equal(loadProgress(throwing), null);
});

test('piksele: rozmiar z rozdzielczości (Średnie ≈ 360 linii), Drobne/Grube', (t) => {
  const rows = [[720, 'Średnie'], [1080, 'Drobne'], [1080, 'Średnie'], [1080, 'Grube'], [1440, 'Średnie'], [2160, 'Średnie'], [390, 'Średnie'], [390, 'Grube']].map(([h, d]) => {
    const px = pixelSizeFor(h, d);
    return [h, d, px, Math.round(h / px)];
  });
  t.diagnostic(rows.map(([h, d, px, lines]) => `${h}p ${d}: piksel ${px} → ${lines} linii`).join('; '));
  for (const [h, d, px, lines] of rows) {
    assert.ok(px >= 1);
    if (d === 'Średnie' && h >= 720) assert.ok(lines >= 300 && lines <= 480, `${h}p`);
  }
  assert.ok(pixelSizeFor(1080, 'Drobne') < pixelSizeFor(1080, 'Średnie') && pixelSizeFor(1080, 'Średnie') < pixelSizeFor(1080, 'Grube'));
});

test('klawisze: zmiana przypisania zabiera klawisz innej akcji, etykiety po polsku', () => {
  const keys = defaultSettings().keys;
  rebind(keys, 'gas', 'KeyS'); // S was the brake
  assert.deepEqual(keys.gas, ['KeyS', 'KeyW']);
  assert.deepEqual(keys.brake, ['ArrowDown']);
  assert.equal(keyLabel('Space'), 'Spacja');
  assert.equal(keyLabel('KeyW'), 'W');
  assert.equal(keyLabel('ArrowLeft'), '←');
});
