# Credits

Wszystkie zewnętrzne elementy gry: biblioteki, assety, dźwięki, fonty. Każdy nowy asset dopisz tutaj.

## Biblioteki (npm)

| Paczka | Do czego | Licencja |
|---|---|---|
| [three](https://threejs.org) (+ `three/addons`: Sky, EffectComposer, UnrealBloomPass, OutputPass) | renderowanie, niebo, post-process | MIT |
| [@dimforge/rapier3d-compat](https://rapier.rs) | fizyka, `DynamicRayCastVehicleController`, debug render | Apache-2.0 |
| [lil-gui](https://lil-gui.georgealways.com) | panel tuningu | MIT |
| [Vite](https://vite.dev) | dev server i build | MIT |

## Assety

Na razie brak zewnętrznych assetów. Auto, tor, bloki, tekstury asfaltu i okien, dym są generowane w kodzie.

## Inspiracje i techniki (bez kopiowania kodu)

- [AC Advanced Gamepad Assist](https://github.com/adam10603/AC-Advanced-Gamepad-Assist): koła podążające za poślizgiem, limit kontry, tłumienie obrotu, skręt zależny od prędkości.
- [REDLINE sandbox](https://github.com/seancope357/redline-sandbox): ręczny na Rapierze jako blokada tyłu + chwilowy spadek przyczepności tyłu, ograniczenie tempa skrętu.
- Unity Input Manager „sensitivity/gravity”: płynna rampa klawiszy cyfrowych.
