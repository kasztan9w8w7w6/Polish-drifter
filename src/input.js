// Keyboard state. Handles WASD, arrows and a few one-shot action keys.
export function createInput(actions = {}) {
  const down = new Set();
  addEventListener('keydown', (e) => {
    if (!down.has(e.code) && actions[e.code]) actions[e.code]();
    down.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => down.clear());

  const any = (...codes) => codes.some((c) => down.has(c));
  return {
    read() {
      return {
        throttle: any('KeyW', 'ArrowUp'),
        brake: any('KeyS', 'ArrowDown'),
        steer: (any('KeyA', 'ArrowLeft') ? 1 : 0) - (any('KeyD', 'ArrowRight') ? 1 : 0),
        handbrake: any('Space'),
      };
    },
  };
}
