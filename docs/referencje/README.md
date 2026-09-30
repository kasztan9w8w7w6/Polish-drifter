# Referencje – zdjęcia, drony, mapy

Materiały, z których bierzemy wygląd gry: zdjęcia, ujęcia z drona, eksporty OpenStreetMap, screeny map i notatki.
Tylko do dokumentacji: nic z tego folderu nie trafia do gry (build go nie widzi) i nie jest assetem w sensie `CREDITS.md`.

## Stan (30.09.2026): pierwsze zdjęcia są w repozytorium

118 zdjęć od autora gry, zmniejszonych (do 2000 px, plany i mapy do 3200 px), obróconych wg EXIF i **bez metadanych (GPS)**.
Oryginały zostają u autora na dysku. Lista wszystkich plików z oryginalnymi nazwami i wymiarami: [`INDEKS.csv`](INDEKS.csv).

| Folder | Zdjęcia | Co to jest |
|---|---|---|
| `park/` | 8 | miejsce do driftu i park przemysłowy: **rzut z góry z zaznaczonym startem (niebieski) i zawrotką (żółty)**, zbiorniki wodne, opony na zakrętach, start, budowa parku |
| `drogi/` | 18 | zróżnicowane drogi między wioskami: nawierzchnie, budowa dróg, otoczenie, skrzyżowania (zrzuty z Google, bez dziur) |
| `mapy/` | 2 | `droga-na-wioski-i-zalew.jpg` (trasa wylotówki) i `miasto-i-park.jpg` (układ miasta i Parku) |
| `miasto/` | 66 + `uklad/` 5 | studzienki, ławki, śmietniki, parkingi, kościoły, domy, dziury, małe uliczki i osiedla; `uklad/` = trzy szkice układu miasta i dwa pliki `Plik_00x` |
| `wioska/` | 13 | podwórka, kościół, światło we wsi, zabudowa wiejska |
| `auta/golf2/`, `auta/fiat126p/` | 4 + 2 | zdjęcia Golfa II i Fiata 126p (do modeli w `assets-src/modele-aut/`) |

Nazwy folderów to podział autora (nie tabela poniżej). Tabela „Proponowane foldery” z dawnej wersji tego pliku nadal
działa dla zdjęć, które dojdą później (bloki, stacje, noc, woda).

### Notatki autora do zdjęć (przepisane z plików Word)

- **Miasto:** „Jak widać, są tu różne elementy: od studzienek, przez ławki, śmietniki i parkingi, po kościoły, domy itp.
  Zauważ, że są z różnych części miasta, często małe uliczki, część to osiedla, więc **nie mieszamy tego ze sobą, tylko
  rozdzielamy na różne dzielnice w mieście**.”
- **Drogi:** „Stricte zróżnicowane zdjęcia dróg między wioskami, budowy ich, otoczenia, skrzyżowań itp. Zdjęcia dróg z
  dziurami są bardziej w folderze zdjęć miasta i wiosek.”
- **Park / miejsce do driftu** (rzut z góry + zdjęcia przy zbiornikach): „Na zakrętach po ptosru [po bokach?] umieściłbym takie
  **ścianki z opon**, w które auto może wlecieć, a one się rozlecą; co start są układane, więc się poprawiają, ale
  amortyzują wjazd, tak jak na torach. **Przejazd zaczyna się na samym początku, gdzie zbiorniki się zaczynają (lewy dolny
  róg), jadą w górę, potem w lewo, potem skręt w prawo i zawrotka na końcu.** Punkty są liczone algorytmem za bliskość
  skrajnego przejazdu, czyli tył im bliżej opon i krańca, tym lepiej; punkty liczone za styl, palenie i bujanie, nawet na
  prostej. Zaznaczyłem na niebiesko punkt startu, na żółto punkt zawrotki na rzucie z góry.”
  (Punktacja za bliskość krańca to pomysł na później; zakłady na 6 słupków z fabuły zostają bez zmian. Patrz ROADMAP.)
- **Golf II** (`assets-src/modele-aut/golf2/`): „Wdrażamy na ulicach warianty dwu- i trzydrzwiowe.”

### Jak pracować z tyloma zdjęciami (dla kolejnych sesji)

Nie czytaj wszystkich naraz: każde zdjęcie to koszt kontekstu, a 118 to bardzo dużo.
1. Zacznij od tego pliku i `INDEKS.csv`. Zdjęcia oglądaj **tylko z folderów potrzebnych do bieżącej części** i po kilka
   naraz, wnioski zapisuj od razu do docs (kolory, materiały, elementy do zbudowania), a nie trzymaj w głowie.
2. Do v0.8 (beemka, ludzie, rozmowy, wylotówka, Park, mapa) wystarczą: `park/` (8), `drogi/` (18), `mapy/` (2) i modele
   aut. `miasto/` (71) i `wioska/` (13) są na v0.9 (polski świat, dzielnice).
3. Katalog: osobna krótka sesja (albo podagent z modelem Haiku, partiami po ok. 10 zdjęć) wypełnia `KATALOG.md`:
   plik · co pokazuje · dzielnica / typ miejsca · elementy do gry (obiekty, materiały, kolory, oświetlenie) · uwagi.
   Do takiego opisu Haiku wystarcza, trzeba mu tylko podać sztywny szablon. Sesja implementująca (Opus) czyta `KATALOG.md`
   i ogląda dopiero wybrane zdjęcia.

## Jak wgrać

1. Na GitHubie: repozytorium → gałąź `main` → **Add file → Upload files**. Przeciągnij całe foldery; ścieżka w polu
   nazwy to `docs/referencje/<folder>/`. Przez stronę plik może mieć do 25 MB, jedno wgranie do 100 plików.
2. HEIC z iPhone'a można wgrać bez konwersji. Skrypt zamieni je na JPG i zmniejszy.
3. Commit na `main` albo na osobną gałąź – wystarczy napisać w rozmowie, gdzie są.

Zdjęcia z telefonu mają w EXIF położenie GPS. Skrypt je usuwa, ale dopiero po wgraniu, więc w historii gita zostaje
oryginał. Jeśli to przeszkadza, wyłącz lokalizację w aparacie albo wyślij zdjęcia przez komunikator, który czyści EXIF.

## Proponowane foldery

| Folder | Co |
|---|---|
| `bloki/` | bloki z wielkiej płyty: całe elewacje, klatki, balkony, okna nocą, dachy, szczyty, murale |
| `ulice/` | jezdnie osiedlowe i główne, krawężniki, dziury, łaty asfaltu, studzienki, znaki, przejścia |
| `podworka/` | trzepaki, piaskownice, ławki, śmietniki (wiaty), garaże blaszaki, płoty, zieleń |
| `sklepy/` | pawilony, sklepy nocne, szyldy, kraty, witryny, kioski, przystanki |
| `stacje/` | stacje paliw (wiaty, dystrybutory, kiosk, oświetlenie) |
| `auta/` | auta z epoki (Polonez, Maluch, Duży Fiat, Żuk, Nysa, Tico…), detale, tablice |
| `noc/` | wszystko nocą: latarnie (kolor światła), okna, neony, mgła |
| `dron/` | ujęcia z góry: układ osiedla, dachy, parkingi |
| `osm/` | eksporty OpenStreetMap (`.osm`, `.geojson`, zrzuty) |
| `mapy/` | screeny map (Google, Geoportal, zdjęcia lotnicze) |
| `woda/` | przyszła trasa nad wodą: bulwary, nabrzeża, mosty, parkingi nad rzeką/jeziorem |

W każdym folderze może leżeć `opis.txt` z uwagami: jedna linia na plik (`IMG_1234.HEIC: to chcę mieć w grze, bo…`)
albo ogólne uwagi do całego folderu.

## Obróbka (`scripts/referencje.py`)

```
pip install pillow pillow-heif
python3 scripts/referencje.py                     # HEIC → JPG, zmniejszenie do 2000 px, obrót z EXIF, bez metadanych
python3 scripts/referencje.py --nazwy nazwy.json  # zmiana nazw: {"bloki/IMG_1234.jpg": "blok-pastelowy-klatka-noc-01.jpg"}
python3 scripts/referencje.py --paleta            # główne kolory każdego zdjęcia (HEX, udział %) → docs/STYL.md
```

Nazwy: `<co>-<cecha>-<detal>-<dzień|noc>-NN.jpg`, małe litery bez polskich znaków, np. `blok-pastelowy-klatka-noc-01.jpg`,
`stacja-wiata-dystrybutor-noc-01.jpg`, `dron-osiedle-parking-dzien-01.jpg`.
