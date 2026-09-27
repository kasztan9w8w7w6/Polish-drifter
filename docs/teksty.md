# Teksty gry – jak je podmieniać

Wszystkie teksty fabularne (misje, rozmowy, narrator, okrzyki postaci) są w plikach danych JSON. Zmiana tekstu
nie wymaga dotykania kodu: edytujesz plik, zapisujesz, odświeżasz grę (`npm run dev` przeładuje ją sama).

Obecne teksty są **tymczasowe**. Każdy taki tekst zaczyna się od `PLACEHOLDER: `, a każdy plik ma na górze pole
`"_teksty": "PLACEHOLDER – …"`. Gra usuwa znacznik przy wyświetlaniu, więc gracz go nie widzi.

- **Podmiana tekstu:** wpisz nowy tekst bez `PLACEHOLDER: `.
- **Gdy cały plik jest gotowy:** zmień `_teksty` na np. `"gotowe"`.
- **Co jeszcze jest tymczasowe:** `grep -rn "PLACEHOLDER" src/` pokaże wszystkie takie teksty.

Test `npm test` („teksty: każdy tekst … oznaczony PLACEHOLDER”) pilnuje, żeby żaden tymczasowy tekst nie zgubił znacznika.
Kiedy zaczniesz wpisywać teksty docelowe, zmień ten test na sprawdzanie `_teksty` (albo usuń go dla gotowych plików).

## Gdzie co jest

| Plik | Co w nim jest |
|---|---|
| `src/missions/*.json` | misje: tytuł (`title`), wstęp i zakończenie narratora (`intro`, `outro`), kroki z celem na ekranie (`goal`), narrator na początku i końcu kroku (`say`, `done`), po porażce (`fail`), po odmowie w rozmowie (`refuse`), podpowiedzi na zdarzenia (`hints`: `rezerwa`, `pusty`, `holowanie`, `stacja`, `zapis`) |
| `src/story/dialogi/*.json` | rozmowy: węzły (`nodes`), każdy ma mówiącego (`who`: id postaci albo `gracz`) i tekst (`text`); wybory odpowiedzi (`choices`: `text` + `next` albo `end`) |
| `src/story/postacie.json` | postacie: imię (`imie`), wygląd, zwykła rozmowa (`dialog`), okrzyki w dymkach (`reakcje`: `dobrze`, `slabo`, `uderzenie`, `czekanie` – jeden losowany) |
| `src/story/kampania.json` | kolejność misji (`misje`), wymagany szacun (`wymagania`), narrator po ostatniej (`koniec`), gdy brak szacunu (`brakSzacunu`) |
| `src/story/teksty.json` | teksty systemowe: powrót po „Kontynuuj”, stacja paliw, pusty bak, Żappka (sklep), poziomy szacunu, wyścig (odliczanie, „ostatnie okrążenie”), podsumowanie misji |

Etykiety przycisków menu (Graj, Ustawienia…) i krótkie komunikaty techniczne (np. „Reset”) są w kodzie
(`src/menu.js`, `src/main.js`) – to interfejs, nie scenariusz.

## Warunki w rozmowach (v0.6d)

Kwestie mogą zależeć od szacunu, kasy i flag z wcześniejszych rozmów:

```json
"a": { "who": "seba", "text": "Zwykły tekst.", "alt": [ { "if": { "szacun": 150 }, "text": "Tekst dla kogoś z szacunem." } ] },
"b": { "who": "halina", "text": "…", "choices": [ { "if": { "kasa": 10 }, "text": "Odpowiedź tylko, gdy gracz ma 10 zł", "next": "c" } ] },
"c": { "if": { "flaga": "pokaz" }, "else": "d", "who": "seba", "text": "Węzeł tylko po pokazie (inaczej przejście do „d”)." }
```

Warunki (`if`):
- `szacun` – szacun co najmniej tyle;
- `kasa` – co najmniej tyle zł;
- `flaga` – flaga ustawiona wcześniej wyborem z `set`;
- `nie` – odwrotność warunku.

Wszystkie warunki w jednym `if` muszą być spełnione. Nazwy poziomów szacunu są w `src/story/teksty.json` → `szacun`.

## Rozmowy – format

```json
{
  "id": "pokaz-start",
  "start": "a",
  "nodes": {
    "a": { "who": "seba", "text": "Tekst Seby.", "next": "b" },
    "b": { "who": "seba", "text": "Pytanie?", "choices": [
      { "text": "Odpowiedź 1", "end": "zgoda", "set": { "pokaz": true } },
      { "text": "Odpowiedź 2", "next": "c" },
      { "text": "Odpowiedź 3", "end": "odmowa" }
    ] },
    "c": { "who": "gracz", "text": "Tekst gracza." }
  }
}
```

- Węzeł bez `next`, `choices` i `end` kończy rozmowę (wynik `koniec`).
- `end` to wynik rozmowy. Misja może go wymagać, np. krok `talk` z `"result": "zgoda"` przejdzie dalej tylko wtedy, gdy rozmowa tak się skończy.
  Przy innym wyniku narrator mówi `refuse`, a gracz może zagadać jeszcze raz.
- **Nie zmieniaj:** nazw wyników (`zgoda`, `start`, `odmowa`) ani `id` plików bez zmiany misji, która ich używa.
- **Możesz swobodnie zmieniać:** liczbę węzłów, wyborów i kolejność.
- **Nowe postacie** (`who`) muszą być w `postacie.json`, a na mapie (`src/maps/osiedle.json` → `npcs`), jeśli mają stać na osiedlu.

## Długość i tempo

- **Narrator:** tekst pisze się jak na maszynie (~16 liter/s, przerwy po przecinkach i kropkach) i zostaje na ekranie
  5,5 s + 0,06 s na każdą literę. Jedna linia = jedno zdanie lub dwa; dłuższe myśli dziel na kilka linii w tablicy.
- **Rozmowy:** tekst stoi, dopóki gracz nie naciśnie E / Enter / A. Najlepiej do ~140 znaków na węzeł (dwie linijki w okienku).
- **Okrzyki w dymkach (`reakcje`):** 1–4 słowa.
- **Cel na ekranie (`goal`):** krótko, do ~60 znaków.

## Postacie – modele 3D

Postacie to na razie własne bryły z kodu (`src/npc.js`, kolory z `postacie.json` → `wyglad`). Gotowych modeli CC0
nie dało się pobrać z tego środowiska (serwer kenney.nl zablokowany).

Żeby podmienić bryłę na model:
1. Wrzuć plik `.gltf` do `public/models/npc/`. Najłatwiej zamienić `.glb` na `.gltf` przez `scripts/convert-assets.mjs`,
   bo serwer artefaktów nie serwuje `.glb`.
2. Wpisz postaci `"model": "models/npc/nazwa.gltf"`. Pierwsza animacja modelu gra w pętli.
3. Dopisz model do `CREDITS.md`.

Proponowane darmowe źródła (CC0):
- [Kenney – Mini Characters](https://kenney.nl/assets/mini-characters)
- [Kenney – Animated Characters](https://kenney.nl/assets/animated-characters-1)
- [Quaternius – Ultimate Modular Characters](https://quaternius.com/packs/ultimatemodularcharacters.html)
