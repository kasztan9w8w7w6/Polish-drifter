# Credits

Wszystkie zewnętrzne elementy gry: biblioteki, assety, dźwięki, fonty. Każdy nowy asset dopisz tutaj.

## Biblioteki (npm)

| Paczka | Do czego | Licencja |
|---|---|---|
| [three](https://threejs.org) (+ `three/addons`: Sky, EffectComposer, UnrealBloomPass, OutputPass) | renderowanie, niebo, post-process | MIT |
| [@dimforge/rapier3d-compat](https://rapier.rs) | fizyka, kolizje, raycast, debug render | Apache-2.0 |
| [lil-gui](https://lil-gui.georgealways.com) | panel tuningu | MIT |
| [Vite](https://vite.dev) | dev server i build | MIT |
| [TypeScript](https://www.typescriptlang.org), [@types/three](https://www.npmjs.com/package/@types/three) | sprawdzanie typów (dev) | Apache-2.0 / MIT |

## Kod przeniesiony z innych projektów

| Źródło | Co | Licencja |
|---|---|---|
| [Kenney – Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) (`scripts/vehicle.gd`, `scripts/view.gd`, `scenes/vehicle.tscn`), © 2023–2026 Kenney | model jazdy „toczona kula + model podążający za nią” z wyrównaniem do podłoża, wartości startowe (masa 1000, gravity scale 1,5, angular damping 4, linear damping 0,1, tarcie 5), wygładzanie skrętu i gazu, przechył nadwozia, kamera z opóźnieniem i oddalaniem z prędkością; przeniesione z GDScript do TypeScript w `src/vehicle.ts` i `src/camera.ts` | MIT |

## Assety

Na razie brak zewnętrznych assetów. Auto, tor, bloki, tekstury asfaltu i okien, dym są generowane w kodzie.

## Inspiracje i techniki (bez kopiowania kodu)

- Model opon z v0.1.5 (usunięty w v0.2a) korzystał z pomysłów: [AC Advanced Gamepad Assist](https://github.com/adam10603/AC-Advanced-Gamepad-Assist): koła podążające za poślizgiem, limit kontry, tłumienie obrotu, skręt zależny od prędkości.
- [REDLINE sandbox](https://github.com/seancope357/redline-sandbox): ręczny na Rapierze jako blokada tyłu + chwilowy spadek przyczepności tyłu, ograniczenie tempa skrętu.
- Unity Input Manager „sensitivity/gravity”: płynna rampa klawiszy cyfrowych.
