# Credits

Wszystkie zewnętrzne elementy gry: biblioteki, assety, dźwięki, fonty. Każdy nowy asset dopisz tutaj.

## Biblioteki (npm)

| Paczka | Do czego | Licencja |
|---|---|---|
| [three](https://threejs.org) (+ `three/addons`: GLTFLoader, EffectComposer, RenderPixelatedPass, UnrealBloomPass, ShaderPass, OutputPass) | renderowanie, modele, pixel-art (post-process) | MIT |
| [howler](https://howlerjs.com) | dźwięk | MIT |
| [@fontsource/silkscreen](https://fontsource.org/fonts/silkscreen) (font Silkscreen, Jason Kottke) | pikselowa czcionka HUD | OFL-1.1 |
| [@dimforge/rapier3d-compat](https://rapier.rs) | fizyka, kolizje, raycast, debug render | Apache-2.0 |
| [lil-gui](https://lil-gui.georgealways.com) | panel tuningu | MIT |
| [Vite](https://vite.dev) | dev server i build | MIT |
| [glTF-Transform](https://gltf-transform.dev) (`@gltf-transform/core`, `functions`) | konwersja modeli (`scripts/convert-assets.mjs`, dev) | MIT |
| [TypeScript](https://www.typescriptlang.org), [@types/three](https://www.npmjs.com/package/@types/three) | sprawdzanie typów (dev) | Apache-2.0 / MIT |

## Kod przeniesiony z innych projektów

| Źródło | Co | Licencja |
|---|---|---|
| [Kenney – Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) (`scripts/vehicle.gd`, `scripts/view.gd`, `scenes/vehicle.tscn`), © 2023–2026 Kenney | model jazdy „toczona kula + model podążający za nią” z wyrównaniem do podłoża, wartości startowe (masa 1000, gravity scale 1,5, angular damping 4, linear damping 0,1, tarcie 5), wygładzanie skrętu i gazu, przechył nadwozia, kamera z opóźnieniem i oddalaniem z prędkością; przeniesione z GDScript do TypeScript w `src/vehicle.ts` i `src/camera.ts` | MIT |

| [three.js – przykład `webgl_postprocessing_pixel`](https://threejs.org/examples/#webgl_postprocessing_pixel) | wyrównanie kamery ortograficznej do siatki pikseli (`pixelAlignFrustum`) w `src/camera.ts`, ustawienia RenderPixelatedPass | MIT |
| [three.js – przykład `webgl_materials_toon`](https://threejs.org/examples/#webgl_materials_toon) | gradientMap z N stopniami dla MeshToonMaterial (`src/pixelart.js`) | MIT |

## Assety

Źródła (spakowane lub oryginalne pliki) są w `assets-src/`. `node scripts/convert-assets.mjs` zamienia je na `.gltf`
z osadzonymi danymi (serwer artefaktów nie serwuje `.glb`) w `public/`. Geometria Kenneya się nie zmienia.

| Plik(i) | Źródło | Autor | Licencja |
|---|---|---|---|
| `public/models/polonez/polonez.gltf` (źródło `assets-src/polonez-mr93-lp.glb`) | [„1993 FSO Polonez MR93 (LP)”, Sketchfab](https://sketchfab.com/3d-models/1993-fso-polonez-mr93-lp-f191456e08a041ad81264ce67f4ed1d1). Zmiany: usunięte logo FSO, tablica rejestracyjna zamieniona na fikcyjną | [KrStolorz (Krzysztof Stolorz)](https://sketchfab.com/KrStolorz) | **Sketchfab Standard** (tak zapisano w metadanych pliku; to nie CC0, patrz niżej) |
| `assets-src/plate-agro.png` (tablica „AGR 5G01”) | wygenerowana na potrzeby gry | Agro Drifter | CC0 |
| `public/assets/kenney/roads/*` (drogi, latarnie, śmietniki, roboty drogowe, słupy) | [City Kit (Roads)](https://kenney.nl/assets/city-kit-roads), `assets-src/kenney_city-kit-roads.zip` | Kenney | CC0 |
| `public/assets/kenney/commercial/*` (bloki, pawilony, sklep, markiza) | [City Kit (Commercial)](https://kenney.nl/assets/city-kit-commercial) 2.1, `assets-src/kenney_city-kit-commercial_2.1.zip` | Kenney | CC0 |
| `public/assets/kenney/suburban/*` (drzewa, płoty) | [City Kit (Suburban)](https://kenney.nl/assets/city-kit-suburban) 2.0, `assets-src/kenney_city-kit-suburban_20.zip` | Kenney | CC0 |
| `public/assets/kenney/cars/*` (zaparkowane auta) | [Car Kit](https://kenney.nl/assets/car-kit), `assets-src/kenney_car-kit.zip` | Kenney | CC0 |
| `public/assets/kenney/racing/audio/engine.ogg`, `impact.ogg` | [Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) `audio/` | Kenney | CC0 |
| `public/assets/kenney/racing/audio/skid.ogg` | jw. | [Landeplage](https://github.com/Landeplage) | CC0 |
| `public/assets/kenney/city/*` (garaże) | [Starter Kit City Builder](https://github.com/KenneyNL/Starter-Kit-City-Builder) `models/` | Kenney | CC0 |

Licencje Kenneya leżą obok modeli (`License.txt` w każdym folderze, `LICENSE-starter-kits.txt`).

**Uwaga o Polonezie:** licencja Sketchfab Standard pozwala użyć modelu w grze, także komercyjnej. Nie pozwala natomiast
udostępniać samego pliku modelu tak, żeby dało się go wyciągnąć i używać osobno. Publiczne repozytorium z plikiem `.glb`/`.gltf`
może być z tym sprzeczne. Przed upublicznieniem sprawdź warunki na stronie modelu albo zapytaj autora.

Generowane w kodzie: asfalt, żarówki i światła latarni, szyld „Żappka 24h” (fikcyjna nazwa), dym, zastępcze auto z brył (gdy model się nie wczyta).

## Inspiracje i techniki (bez kopiowania kodu)

- Model opon z v0.1.5 (usunięty w v0.2a) korzystał z pomysłów: [AC Advanced Gamepad Assist](https://github.com/adam10603/AC-Advanced-Gamepad-Assist): koła podążające za poślizgiem, limit kontry, tłumienie obrotu, skręt zależny od prędkości.
- [REDLINE sandbox](https://github.com/seancope357/redline-sandbox): ręczny na Rapierze jako blokada tyłu + chwilowy spadek przyczepności tyłu, ograniczenie tempa skrętu.
- Unity Input Manager „sensitivity/gravity”: płynna rampa klawiszy cyfrowych.
