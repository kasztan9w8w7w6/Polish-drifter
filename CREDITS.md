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
| [nipplejs](https://github.com/yoannmoinet/nipplejs) | joystick dotykowy (sterowanie mobilne) | MIT |
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
| `assets-src/modele-aut/e34/bmw-e34-lp.glb` (jeszcze niepodpięty w grze) | [BMW E34 (LP), Sketchfab](https://sketchfab.com/KrStolorz) | [KrStolorz (Krzysztof Stolorz)](https://sketchfab.com/KrStolorz) | **Sketchfab Standard** („Free standard”; jak Polonez, patrz uwaga niżej) |
| `assets-src/modele-aut/vw-t3/vw-transporter-t3.glb` (jw.) | [VW Transporter T3, Sketchfab](https://sketchfab.com/randombug) | [randombug](https://sketchfab.com/randombug) | **Sketchfab Standard** („Free Standard”; jak wyżej) |
| `assets-src/modele-aut/golf2/vw-golf-2.glb` (jw.; zmniejszona kopia, zmiana: uproszczona siatka i tekstury) | „Volkswagen Golf 2”, Sketchfab | [d4n1laa (@d4n1laaa)](https://sketchfab.com/d4n1laaa) | **CC BY** (wymagane uznanie autorstwa w grze / opisie) |
| `assets-src/modele-aut/fiat126p/fiat-126p.glb` (jw.; zmniejszona kopia, zmiana: uproszczona siatka) | „Polski Fiat (Fiat 126p)”, Sketchfab | [Martin Trafas (@TinoD2)](https://sketchfab.com/TinoD2) | **CC BY** (wymagane uznanie autorstwa w grze / opisie) |
| `assets-src/plate-agro.png` (tablica „AGR 5G01”) | wygenerowana na potrzeby gry | Polish Drifter | CC0 |
| `public/assets/kenney/roads/*` (latarnie, śmietniki, słupy; kafle dróg nieużywane od v0.5c) | [City Kit (Roads)](https://kenney.nl/assets/city-kit-roads), `assets-src/kenney_city-kit-roads.zip` | Kenney | CC0 |
| `public/assets/kenney/commercial/*` (pawilony, sklep, market, markiza) | [City Kit (Commercial)](https://kenney.nl/assets/city-kit-commercial) 2.1, `assets-src/kenney_city-kit-commercial_2.1.zip` | Kenney | CC0 |
| `public/assets/kenney/suburban/*` (drzewa, płoty) | [City Kit (Suburban)](https://kenney.nl/assets/city-kit-suburban) 2.0, `assets-src/kenney_city-kit-suburban_20.zip` | Kenney | CC0 |
| `public/assets/kenney/cars/*` (zaparkowane auta, auto Sąsiada Zbyszka w wyścigu) | [Car Kit](https://kenney.nl/assets/car-kit), `assets-src/kenney_car-kit.zip` | Kenney | CC0 |
| `public/assets/kenney/racing/audio/engine.ogg`, `impact.ogg` | [Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) `audio/` | Kenney | CC0 |
| `public/assets/kenney/racing/audio/skid.ogg` | jw. | [Landeplage](https://github.com/Landeplage) | CC0 |
| `public/assets/kenney/city/*` (garaże) | [Starter Kit City Builder](https://github.com/KenneyNL/Starter-Kit-City-Builder) `models/` | Kenney | CC0 |

Licencje Kenneya leżą obok modeli (`License.txt` w każdym folderze, `LICENSE-starter-kits.txt`).

**Uwaga o modelach Sketchfab Standard (Polonez, E34, VW T3):** licencja Sketchfab Standard pozwala użyć modelu w grze, także komercyjnej. Nie pozwala natomiast
udostępniać samego pliku modelu tak, żeby dało się go wyciągnąć i używać osobno. Publiczne repozytorium z plikiem `.glb`/`.gltf`
może być z tym sprzeczne. Przed upublicznieniem sprawdź warunki na stronie modelu albo zapytaj autora.

Generowane w kodzie: asfalt, żarówki i światła latarni, szyld „Żappka 24h” (fikcyjna nazwa), paczkomat „Paczkobox 24/7” (fikcyjna marka), świecące pole przed sklepem, szyld „SUPERSAM”, ławki, trzepaki, piaskownica, huśtawka, przystanek (bryły w map.js), znacznik celu, pisk ostrzeżenia baterii (Web Audio), dziury w drodze, linie parkingowe, dym, zastępcze auto z brył (gdy model się nie wczyta).

## Inspiracje i techniki (bez kopiowania kodu)

- Model opon z v0.1.5 (usunięty w v0.2a) korzystał z pomysłów: [AC Advanced Gamepad Assist](https://github.com/adam10603/AC-Advanced-Gamepad-Assist): koła podążające za poślizgiem, limit kontry, tłumienie obrotu, skręt zależny od prędkości.
- [REDLINE sandbox](https://github.com/seancope357/redline-sandbox): ręczny na Rapierze jako blokada tyłu + chwilowy spadek przyczepności tyłu, ograniczenie tempa skrętu.
- Unity Input Manager „sensitivity/gravity”: płynna rampa klawiszy cyfrowych.

## Postacie (v0.5b)

Postacie na osiedlu i ich portrety w rozmowach są zrobione w kodzie gry (`src/npc.js`: bryły z prostopadłościanów,
portret rysowany na kanwie 24 × 24) – bez zewnętrznych assetów. Gotowe modele CC0 (Kenney Mini Characters) nie były
dostępne z tego środowiska; jak je podmienić: `docs/teksty.md` → „Postacie – modele 3D”.

## Bloki i podłoże (v0.5c)

Bloki z wielkiej płyty (`src/blocks.js`), ich tekstury (malowane w kodzie na kanwie) i podłoże osiedla (`src/ground.js`)
są zrobione na potrzeby gry – bez zewnętrznych assetów. `BufferGeometryUtils.mergeGeometries` z `three/addons` (MIT)
łączy detale bloków w kilka siatek.

## Dane aut (v0.6c)

Dane techniczne Poloneza Caro i silników (`src/cars/polonez.json`, `src/engines/*.json`) pochodzą z publicznych katalogów
i forów (AutoCentrum.pl, automobile-catalog.com, automotyw.com, elektroda.pl, fora FSO), a kody lakierów z forów miłośników
FSO. Źródła są wpisane w plikach (`_source`). Kolory RGB lakierów to przybliżenia dobrane na oko, nie próbki lakieru.

## Fabuła „W nocy robota” (v0.7)

- **Scenariusz, dane, plan, biblia stylu** (`docs/fabula/`): autor gry i scenarzysta, materiał własny.
- **Świat fabuły** (`src/fabula/swiat.js`) jest zbudowany w kodzie, bez nowych zewnętrznych assetów:
  - zbiorniki, słupki, wiata i rzeczy Mirka, sygnalizacja, wiadukt, bariera i znak, droga (tekstura malowana na kanwie), las, wieś, felgi;
  - tiry, kombi, BMW, bus i auta Kamila i Mirka to modele z Kenney Car Kit (CC0, wpisane wyżej).
- **Radio** (`src/fabula/radio.js`): tło stacji generowane w Web Audio, bez plików. Utwory do podpięcia opisuje `docs/muzyka.md`; każdy trzeba tu dopisać.
