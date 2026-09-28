# Referencje – zdjęcia, drony, mapy

Materiały, z których bierzemy wygląd gry: zdjęcia, ujęcia z drona, eksporty OpenStreetMap, screeny map i notatki.
Tylko do dokumentacji: nic z tego folderu nie trafia do gry (build go nie widzi) i nie jest assetem w sensie `CREDITS.md`.

> **Stan (sesja porządkowa po v0.6f):** folder był pusty – zdjęcia nie dotarły do repozytorium. `KATALOG.md`,
> `docs/STYL.md` i `docs/plan-mapy.md` powstaną, kiedy pliki będą w repo (patrz niżej).

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
