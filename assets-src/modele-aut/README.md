# Modele aut (źródła, 30.09.2026)

Modele z Sketchfab, dodane przez autora gry jako materiał do wdrożenia. Nie są jeszcze podpięte w grze (żaden nie ma wpisu
w `public/`); konwersja jak przy Polonezie: `scripts/convert-assets.mjs` (logo producenta usunąć, tablica fikcyjna).

| Folder / plik | Model | Autor | Licencja | Stan pliku | Do czego |
|---|---|---|---|---|---|
| `e34/bmw-e34-lp.glb` | BMW E34 (low poly), 25 tys. trójkątów, 2 tekstury 1024², szkielet: drzwi, maska, bagażnik, koła osobno (`F_wheel.L/R`, `B_wheel.L/R`) | KrStolorz (Krzysztof Stolorz) | Sketchfab Standard („Free standard”) | oryginał | beemka na Parku (przejazd NPC) |
| `vw-t3/vw-transporter-t3.glb` | VW Transporter T3, 12 tys. trójkątów, koła osobno (`WFL`, `WFR`, `WBL`, `WBR`), 1 materiał | randombug | Sketchfab Standard („Free Standard”) | oryginał | bus Zdzicha (poranna zmiana) |
| `golf2/vw-golf-2.glb` | VW Golf II (GTI), 64 tys. trójkątów | d4n1laa (@d4n1laaa) | CC BY (uznanie autorstwa) | ZMNIEJSZONY: oryginał miał 1 040 096 trójkątów i 22 tekstury 4096² (169 MB), za duży dla gita (limit 100 MB) i dla gry; tu uproszczenie meshopt + tekstury 1024². Nadal za ciężki na ruch uliczny: zmniejszyć do ok. 10–15 tys. | auta na ulicach; notatka autora: „wdrażamy na ulicach warianty dwu- i trzydrzwiowe” |
| `fiat126p/fiat-126p.glb` | Polski Fiat (Fiat 126p), 29 tys. trójkątów, koła osobno | Martin Trafas (@TinoD2) | CC BY (uznanie autorstwa) | ZMNIEJSZONY: oryginał 154 tys. trójkątów, 27 MB | auta na ulicach |

Oryginały `golf2` i `fiat126p` zostają u autora gry na dysku. Zdjęcia referencyjne Golfa i Fiata: `docs/referencje/auta/`.
Wpisy licencyjne: `CREDITS.md`.
