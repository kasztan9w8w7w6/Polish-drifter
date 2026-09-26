# Polish Drifter 🇵🇱

MVP gry driftingowej w przeglądarce: czerwono-biały sedan z lat 80., plac manewrowy, bloki na horyzoncie.

Zasada projektu: **składamy gotowe klocki zamiast pisać własne**.

| Warstwa | Gotowiec | Co z niego bierzemy |
|---|---|---|
| Render | [three.js](https://threejs.org) | scena, cienie, materiały PBR |
| Niebo | `three/addons/objects/Sky.js` | shader nieba + oświetlenie środowiskowe (PMREM) |
| Post-process | `three/addons/postprocessing` | bloom (`UnrealBloomPass`), tone mapping (`OutputPass`) |
| Fizyka | [cannon-es](https://github.com/pmndrs/cannon-es) | `RaycastVehicle`: zawieszenie, przyczepność, poślizg |
| Debug fizyki | [cannon-es-debugger](https://github.com/pmndrs/cannon-es-debugger) | podgląd brył kolizji (klawisz **F**) |
| Tuning | [lil-gui](https://lil-gui.georgealways.com) | suwaki do strojenia prowadzenia na żywo (klawisz **G**) |
| Build | [Vite](https://vite.dev) | dev server z HMR, produkcyjny build |

Własnego kodu jest ~600 linii: klejenie modułów, logika punktacji driftu, efekty (dym, ślady opon).

## Uruchomienie

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # statyczny build do dist/
```

## Sterowanie

**W/S** gaz / hamulec (wsteczny) · **A/D** skręt · **Spacja** ręczny · **R** reset · **C** kamera · **G** tuning · **F** debug fizyki

## Punktacja

Punkty rosną z kątem poślizgu × prędkością; mnożnik rośnie co 2 s ciągłego driftu. Po ~1,2 s bez driftu punkty trafiają do wyniku. Uderzenie w przeszkodę w trakcie driftu = punkty przepadają. Rekord zapisywany w `localStorage`.

## Struktura

```
src/main.js    – renderer, niebo, post-process, pętla gry, kamera, HUD
src/car.js     – auto na RaycastVehicle (RWD) + parametry tuningu
src/track.js   – plac, bariery, pachołki, opony, bloki
src/effects.js – dym spod opon (sprite pool), ślady opon (InstancedMesh)
src/drift.js   – punktacja driftu
src/input.js   – klawiatura
```

## Deploy

Workflow `.github/workflows/pages.yml` publikuje build na GitHub Pages po pushu na `main`
(w ustawieniach repo: *Settings → Pages → Source: GitHub Actions*).

## Znane pułapki (obejścia są już w kodzie)

- `CANNON.Plane` po obrocie ma błędnie liczony AABB → raycasty kół nie trafiały w ziemię na połowie mapy. Podłoże to statyczny `Box`.
- `RaycastVehicle.updateWheelTransform()` zeruje `isInContact` — `car.sync()` przywraca tę wartość.

## Następne kroki (dalej gotowcami)

- Model auta GLTF (np. [Kenney Car Kit](https://kenney.nl/assets/car-kit), CC0) zamiast brył z prymitywów.
- Dźwięk silnika/opon: [Howler.js](https://howlerjs.com) + darmowe sample.
- Sterowanie na telefonie: [nipplejs](https://github.com/yoannmoinet/nipplejs); pad: Gamepad API.
- Tor z edytora: [Blender](https://www.blender.org) → GLTF, kolizje jako `Trimesh`.
