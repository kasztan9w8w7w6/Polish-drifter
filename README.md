# Agro Drifter 🇵🇱 (v0.2a)

Przeglądarkowa gra o driftowaniu starym polskim sedanem z napędem na tył. Docelowo: noc, osiedle,
estetyka PS1 i ucieczka przed „promieniowaniem 5G” (opis projektu i roadmapa w [`CLAUDE.md`](CLAUDE.md)).

Zasada projektu: **składamy gotowe klocki zamiast pisać własne**.

| Warstwa | Gotowiec | Co z niego bierzemy |
|---|---|---|
| Render | [three.js](https://threejs.org) | scena, cienie, materiały PBR |
| Niebo | `three/addons/objects/Sky.js` | shader nieba + oświetlenie środowiskowe (PMREM) |
| Post-process | `three/addons/postprocessing` | bloom (`UnrealBloomPass`), tone mapping (`OutputPass`) |
| Fizyka | [Rapier](https://rapier.rs) (`@dimforge/rapier3d-compat`) | świat, kolizje, raycast, debug render |
| Model jazdy i kamera | [Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) (MIT) | auto jako toczona kula + model podążający za nią, kamera z opóźnieniem (przeniesione z GDScript do TypeScript) |
| Tuning | [lil-gui](https://lil-gui.georgealways.com) | suwaki, presety, eksport/import JSON (klawisz **G**) |
| Pad | Gamepad API przeglądarki | analogowy gaz, hamulec i skręt |
| Testy | `node:test` (wbudowany w Node ≥ 22.18, czyta TypeScript) | scenariusze jazdy bez przeglądarki |
| Typy | [TypeScript](https://www.typescriptlang.org) | `vehicle.ts`, `camera.ts`, `tuning.ts`; sprawdzanie `npm run typecheck` |
| Build | [Vite](https://vite.dev) | dev server z HMR, produkcyjny build |

## Uruchomienie

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testy scenariuszy jazdy (Node, ~5 s)
npm run typecheck
npm run build    # statyczny build do dist/
```

## Sterowanie

| | Klawiatura | Pad |
|---|---|---|
| Gaz / hamulec (wsteczny) | W / S | RT / LT |
| Skręt | A / D | lewa gałka |
| Ręczny | Spacja | A lub RB |
| Reset auta | R | Y |
| Kamera (pościg / daleko / maska) | C | X |
| Panel tuningu | G | Start |
| Podgląd kolizji (Rapier debug render) | F | — |

## Jak jeździć driftem (preset „Łatwy”)

1. **Wejście** (od ~30 km/h):
   - skręć i wciśnij **ręczny** (Spacja),
   - albo przy ~55 km/h+ skręć **do oporu z gazem**.
2. Trzymaj **gaz**: podtrzymuje drift i powiększa kąt; drift traci mało prędkości.
3. Kierownicą regulujesz kąt:
   - w stronę zakrętu = głęboko (do ~45°),
   - prosto = ~25–30°,
   - lekka kontra = płytko (~20°).

   Kąt ma twardy limit, bączka nie da się zrobić.
4. **Przekładka:** mocna kontra (na klawiaturze przytrzymany przeciwny kierunek) przerzuca drift na drugą stronę.
5. **Wyjście:** puść gaz, a auto samo płynnie się wyprostuje.

Presety w panelu (G):
- **Łatwy:** domyślny, drift wchodzi też z samego ostrego skrętu.
- **Pro:** tylko z ręcznego, większy zakres kąta od kierownicy, szybsza reakcja, większa utrata prędkości.

Przycisk **Eksport ustawień (JSON)** kopiuje wszystkie parametry do schowka (i pokazuje je w okienku), a **Wczytaj JSON** wczytuje wklejone.

## Punktacja

Punkty rosną z kątem poślizgu × prędkością, a mnożnik co 2 s ciągłego driftu. Po ~1,2 s bez driftu punkty trafiają do wyniku.
Uderzenie w przeszkodę (od ~20 km/h) w trakcie driftu = punkty przepadają. Rekord zapisywany w `localStorage`.

## Struktura

Opis modułów i modelu jazdy: [`CLAUDE.md`](CLAUDE.md#architektura-v02a). Fizyka auta jest zamknięta w `src/vehicle.ts`
z prostym interfejsem wejście/wyjście, więc reszta gry nie zależy od biblioteki fizycznej.

## Deploy

Workflow `.github/workflows/pages.yml` publikuje build na GitHub Pages po pushu na `main`
(w ustawieniach repo: *Settings → Pages → Source: GitHub Actions*).

## Znane ograniczenia

- Bundle ma ~5 MB (1,8 MB gzip), bo `rapier3d-compat` wbudowuje WASM w JS. Do optymalizacji później (wariant bez `-compat` + ładowanie `.wasm`).
- Kolizja auta to kula r = 1 m, więc przeszkody mają niewidoczną „skorupę” grubszą o 1 m; bokiem auto zatrzymuje się ~1 m przed ścianą.
- Auto to na razie bryły z prymitywów.

Assety i licencje: [`CREDITS.md`](CREDITS.md).
