# Credits

Wszystkie zewnętrzne elementy gry: biblioteki, assety, dźwięki, fonty. Każdy nowy asset dopisz tutaj.

## Biblioteki (npm)

| Paczka | Do czego | Licencja |
|---|---|---|
| [three](https://threejs.org) (+ `three/addons`: GLTFLoader, EffectComposer, RenderPixelatedPass, UnrealBloomPass, ShaderPass, OutputPass) | renderowanie, modele, post-process PS1 | MIT |
| [howler](https://howlerjs.com) | dźwięk | MIT |
| [@fontsource/silkscreen](https://fontsource.org/fonts/silkscreen) (font Silkscreen, Jason Kottke) | pikselowa czcionka HUD | OFL-1.1 |
| [@dimforge/rapier3d-compat](https://rapier.rs) | fizyka, kolizje, raycast, debug render | Apache-2.0 |
| [lil-gui](https://lil-gui.georgealways.com) | panel tuningu | MIT |
| [Vite](https://vite.dev) | dev server i build | MIT |
| [TypeScript](https://www.typescriptlang.org), [@types/three](https://www.npmjs.com/package/@types/three) | sprawdzanie typów (dev) | Apache-2.0 / MIT |

## Kod przeniesiony z innych projektów

| Źródło | Co | Licencja |
|---|---|---|
| [Kenney – Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) (`scripts/vehicle.gd`, `scripts/view.gd`, `scenes/vehicle.tscn`), © 2023–2026 Kenney | model jazdy „toczona kula + model podążający za nią” z wyrównaniem do podłoża, wartości startowe (masa 1000, gravity scale 1,5, angular damping 4, linear damping 0,1, tarcie 5), wygładzanie skrętu i gazu, przechył nadwozia, kamera z opóźnieniem i oddalaniem z prędkością; przeniesione z GDScript do TypeScript w `src/vehicle.ts` i `src/camera.ts` | MIT |

## Assety

Pliki w `public/assets/kenney/`, licencja kitów: `public/assets/kenney/LICENSE-starter-kits.txt`.

| Plik(i) | Źródło | Autor | Licencja |
|---|---|---|---|
| `racing/audio/engine.ogg`, `impact.ogg` | [Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) `audio/` | Kenney | CC0 |
| `racing/audio/skid.ogg` | jw. | [Landeplage](https://github.com/Landeplage) | CC0 |
| `city/building-garage.gltf`, `building-small-a…d.gltf`, `grass-trees*.gltf`, `Textures/colormap.png` | [Starter Kit City Builder](https://github.com/KenneyNL/Starter-Kit-City-Builder) `models/` (przekonwertowane z `.glb` na `.gltf` bez zmian w geometrii) | Kenney | CC0 |

Generowane w kodzie: auto (bryły), asfalt, bloki (tekstura okien), latarnie, szyld „Żappka 24h” (fikcyjna nazwa), dym.

### Do pobrania ręcznie (kenney.nl był niedostępny z sesji)

Rozpakuj do podanych folderów, a potem dopisz pliki do tabeli powyżej:

- [City Kit (Roads)](https://kenney.nl/assets/city-kit-roads) → `public/assets/kenney/city-roads/`
- [City Kit (Suburban)](https://kenney.nl/assets/city-kit-suburban) → `public/assets/kenney/city-suburban/`
- [City Kit (Commercial)](https://kenney.nl/assets/city-kit-commercial) → `public/assets/kenney/city-commercial/`
- [Car Kit](https://kenney.nl/assets/car-kit) (sedan) → `public/assets/kenney/car-kit/`
- [Kenney Fonts](https://kenney.nl/assets/kenney-fonts) (CC0, zamiennik Silkscreen) → `public/assets/kenney/fonts/`

## Inspiracje i techniki (bez kopiowania kodu)

- Model opon z v0.1.5 (usunięty w v0.2a) korzystał z pomysłów: [AC Advanced Gamepad Assist](https://github.com/adam10603/AC-Advanced-Gamepad-Assist): koła podążające za poślizgiem, limit kontry, tłumienie obrotu, skręt zależny od prędkości.
- [REDLINE sandbox](https://github.com/seancope357/redline-sandbox): ręczny na Rapierze jako blokada tyłu + chwilowy spadek przyczepności tyłu, ograniczenie tempa skrętu.
- Unity Input Manager „sensitivity/gravity”: płynna rampa klawiszy cyfrowych.
