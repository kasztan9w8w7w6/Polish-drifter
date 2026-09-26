# Agro Drifter 🇵🇱 (v0.1.5)

Przeglądarkowa gra o driftowaniu starym polskim sedanem z napędem na tył. Docelowo: noc, osiedle,
estetyka PS1 i ucieczka przed „promieniowaniem 5G” (opis projektu i roadmapa w [`CLAUDE.md`](CLAUDE.md)).

Zasada projektu: **składamy gotowe klocki zamiast pisać własne**.

| Warstwa | Gotowiec | Co z niego bierzemy |
|---|---|---|
| Render | [three.js](https://threejs.org) | scena, cienie, materiały PBR |
| Niebo | `three/addons/objects/Sky.js` | shader nieba + oświetlenie środowiskowe (PMREM) |
| Post-process | `three/addons/postprocessing` | bloom (`UnrealBloomPass`), tone mapping (`OutputPass`) |
| Fizyka | [Rapier](https://rapier.rs) (`@dimforge/rapier3d-compat`) | świat, kolizje, `DynamicRayCastVehicleController`, debug render |
| Tuning | [lil-gui](https://lil-gui.georgealways.com) | suwaki, presety, eksport/import JSON (klawisz **G**) |
| Pad | Gamepad API przeglądarki | analogowy gaz, hamulec i skręt |
| Testy | `node:test` (wbudowany w Node) | scenariusze jazdy bez przeglądarki |
| Build | [Vite](https://vite.dev) | dev server z HMR, produkcyjny build |

## Uruchomienie

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testy scenariuszy jazdy (Node, ~10 s)
npm run build    # statyczny build do dist/
```

## Sterowanie

| | Klawiatura | Pad |
|---|---|---|
| Gaz / hamulec (wsteczny) | W / S | RT / LT |
| Skręt | A / D | lewa gałka |
| Ręczny | Spacja | A lub RB |
| Reset auta | R | Y |
| Kamera | C | X |
| Panel tuningu | G | Start |
| Podgląd kolizji (Rapier debug render) | F | — |

## Jak jeździć driftem (preset „Drift łatwy”)

1. Rozpędź się do ~50–60 km/h, skręć i szarpnij **ręczny**. Tył odjedzie płynnie.
2. Trzymaj **gaz** (od ok. połowy): gaz podtrzymuje poślizg, a drift traci mało prędkości.
3. Kierownicą wybierasz kąt: w stronę zakrętu = głęboki drift (~40°), puszczona = ~30°, kontra = płytki (~15–20°). Asysta nie pozwala na bączka.
4. Żeby wyjść z driftu, **puść gaz**. Auto samo się wyprostuje.

Presety w panelu (G):
- **Przyczepny:** ręczny tylko zarzuca, tył szybko łapie.
- **Drift łatwy:** domyślny.
- **Drift pro:** słabsze asysty, można zrobić bączka.

Przycisk **Eksport ustawień (JSON)** kopiuje wszystkie parametry do schowka (i pokazuje je w okienku), a **Wczytaj JSON** wczytuje wklejone.

## Punktacja

Punkty rosną z kątem poślizgu × prędkością, a mnożnik co 2 s ciągłego driftu. Po ~1,2 s bez driftu punkty trafiają do wyniku.
Uderzenie w przeszkodę (od ~15 km/h) w trakcie driftu = punkty przepadają. Rekord zapisywany w `localStorage`.

## Struktura

Opis modułów i modelu driftu: [`CLAUDE.md`](CLAUDE.md#architektura-v015). Fizyka auta jest zamknięta w `src/vehicle.js`
z prostym interfejsem wejście/wyjście, więc reszta gry nie zależy od biblioteki fizycznej.

## Deploy

Workflow `.github/workflows/pages.yml` publikuje build na GitHub Pages po pushu na `main`
(w ustawieniach repo: *Settings → Pages → Source: GitHub Actions*).

## Znane ograniczenia

- Bundle ma ~5 MB (1,8 MB gzip), bo `rapier3d-compat` wbudowuje WASM w JS. Do optymalizacji później (wariant bez `-compat` + ładowanie `.wasm`).
- Auto to na razie bryły z prymitywów. Model Poloneza jest w planie na v0.2.

Assety i licencje: [`CREDITS.md`](CREDITS.md).
