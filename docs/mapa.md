# Plan osiedla – Osiedle Kosmonautów (v0.5c)

Mapa gry to plik [`src/maps/osiedle.json`](../src/maps/osiedle.json), wygenerowany przez `scripts/build-map.py`
z tego planu (potem można go edytować ręcznie).

- **Układ współrzędnych:** x rośnie na wschód, z na południe (północ = góra szkicu).
- **Teren:** 200 × 200 m, betonowy płot na ±100 m.
- **Skala szkicu:** jedna kratka = 10 m.

**Co się zmieniło względem v0.4c:**
- ulice tworzą zamknięte pętle;
- między blokami są podwórka (trawa, chodniki, plac zabaw), nie jezdnia;
- uliczki osiedlowe mają 6 m i nie mają linii (linie są tylko na głównej);
- zamiast kafli Kenneya jest jedna pikselowa tekstura podłoża z zaokrąglonymi narożnikami, więc źle obróconych zakrętów już nie ma;
- bloki z wielkiej płyty są z własnych brył;
- garaże mają plac połączony z ulicą.

## Szkic

```
          -100      -80       -60       -40       -20        0        20        40        60        80       100
   -100   +--------------------------------------------------------------------------------------------------+
          |  ~   ~   ~   ~   ~   ~   ~   ~   ~   ~   ~       ~        ~     [=====  SUPERSAM  =====]    ~   |
    -80   |  [G][G][G][G][G][G][G][G]  <- garaże              ~                 | rampa, śmietniki |        |
          |  ::::::: plac przed garażami :::::::   ~                          +------------------------+      |
    -60   |  ==========================+======================================+ ::::::::::::::::::::::: |     |
          |  ul. Tereszkowej (6 m)     |  *    [BLOK 1 · 10 p. · 5G maszt ]  | ::                    :: |     |
    -40   |    +------+                | ~        v   v   v   v (klatki)     | ::                    :: |     |
          |    |BLOK 6|                |[BLOK]  PODWÓRKO PÓŁNOCNE:           | ::    PLAC DO DRIFTU  :: |     |
    -20   |    | 4 p. |          ul. |[ 3  ]  plac zabaw, trzepak, ławki,   <= wjazd  (latarnie)     :: |     |
          |    |      |       Lotn.  |[4 p.]  ~ chodniki ~  [Paczkobox]  ul.| ::                    :: |     |
      0   |    +------+          (6m)+================ ul. Komarowa ========+ ::  S  S  S (chłopaki) :: |     |
          |                            |    ^   ^   ^ (klatki)           Gag.| ::    przy wjeździe   :: |     |
     20   |   +-----+                  |  [BLOK 5 · 10 p.]               (6m) <= wjazd                :: |     |
          |   | B4  | <- parking       |  PODWÓRKO POŁUDNIOWE: trzepak,      | ::                    :: |     |
     40   |   |10 p.|    (dostawa)     |  piaskownica, ławki, drzewa         | ::                    :: |     |
          |   +-----+                  |  [BLOK 2 · 4 p.]  v  v  v  v        | ::::::::::::::::::::::::: |     |
     60   |                            |  :: parking pod Blokiem 2 ::        |           | wjazd            |     |
     72   | ===========================+========== ul. Kosmonautów (główna, linie) ===+==========================|
          |  [przystanek]   [PAWILON]      Zbyszek  [pp][ŻAPPKA 24h][pp]   [PAWILON]                         |
    100   +--------------------------------------------------------------------------------------------------+
   == ulice   :: asfalt placu/parkingu   ~ drzewa   * latarnie   v ^ wejścia do klatek (daszek)   S chłopaki
```

## Ulice i pętle

| Ulica | Oś | Szerokość | Linie |
|---|---|---|---|
| ul. Kosmonautów (główna) | z = 72, cała szerokość | 10 m + chodniki 2,5 m | przerywana środkowa, krawędziowe, pasy przy Żappce i przy przystanku |
| ul. Lotników | x = −60, od Tereszkowej do głównej | 6 m + chodniki 1,5 m | brak |
| ul. Gagarina | x = 30, od Tereszkowej do głównej | 6 m | brak |
| ul. Tereszkowej | z = −62, od płotu na zachodzie do Gagarina | 6 m | brak |
| ul. Komarowa | z = 0, od Lotników do Gagarina | 6 m | brak |

Pętle:
- **Duża** (trasa wyścigu, 2 okrążenia): Kosmonautów → Gagarina → Tereszkowej → Lotników → Kosmonautów, ok. 450 m;
  start i meta na głównej pod Blokiem 2.
- **Północna:** Lotników → Tereszkowej → Gagarina → Komarowa.
- **Południowa:** Lotników → Komarowa → Gagarina → Kosmonautów.

Wszystkie narożniki i skrzyżowania mają zaokrąglony asfalt (promień ok. 4 m), więc da się jeździć w kółko bez zawracania.

## Strefy

| Strefa | Gdzie | Co jest |
|---|---|---|
| **Kwartał północny** | między Lotników, Tereszkowej, Gagarina, Komarowa | Blok 1 (10 pięter, 4 klatki, maszt 5G na dachu), Blok 3 (4 piętra, 2 klatki); podwórko: trawa, chodniki od klatek, plac zabaw (piaskownica, huśtawka), trzepak, ławki, drzewa, Paczkobox przy Bloku 1 |
| **Kwartał południowy** | między Komarowa a główną | Blok 5 (10 pięter, 3 klatki), Blok 2 (4 piętra, 4 klatki); podwórko z trzepakiem, piaskownicą, ławkami; parking pod Blokiem 2 z dwoma wjazdami z głównej |
| **Zachód** | za ul. Lotników | Blok 4 (punktowiec, 10 pięter) z parkingiem od Lotników (cel dostawy), Blok 6 (4 piętra), drzewa |
| **Garaże** | północny zachód | rząd blaszaków, drzwi na południe, asfaltowy plac przed nimi przylega do ul. Tereszkowej |
| **Supersam i plac** | wschód, za ul. Gagarina | market na północy; wielki asfaltowy plac (wjazdy z Gagarina i z głównej), rzędy latarń, pusty środek do driftu; chłopaki stoją przy zachodnim wjeździe |
| **Pierzeja handlowa** | południe, przy głównej | Żappka 24h z parkingiem i świecącym polem zapisu, pawilony, przystanek |

## Zasady

- **Podłoże** to jedna pikselowa tekstura (0,25 m na teksel), malowana z danych mapy:
  - `streets`: ulice z chodnikami;
  - `areas`: asfalt placów i parkingów, bruk;
  - `paths`: chodniki na podwórkach;
  - reszta to trawa.
  Krawężniki rysują się na granicy asfaltu, a narożniki zaokrągla zamknięcie morfologiczne (dylatacja + erozja maski jezdni).
- **Bloki** (`blocks`) to bryły z kodu (`src/blocks.js`):
  - płyty z widocznymi łączeniami, rzędy okien (część zapalona, różne kolory światła);
  - klatki schodowe: pionowy pas luksferów, drzwi, daszek i lampka nad wejściem;
  - balkony z kolorowymi balustradami od podwórka;
  - maszyny wind na dachu, na jednym bloku maszt 5G.
  Kolizja = obrys bryły.
- **Nic nie stoi na jezdni:** test (`test/map.test.mjs`) sprawdza, że:
  - pasy ruchu każdej ulicy są wolne;
  - podwórka nie są jezdnią;
  - pętle są zamknięte;
  - garaże mają dojazd;
  - cele misji i postacie są dostępne.
- **Zaparkowane auta** stoją tylko na parkingach i placu.

## Misje na tej mapie

1. **„Paczka”:** parking pod Blokiem 2 → Paczkobox przy Bloku 1 (przez ul. Komarowa, na podwórko) → ładowanie
   driftem na placu → dostawa pod Blok 4 (parking od Lotników) → Żappka.
2. **„Pokaz”:** Seba przy zachodnim wjeździe na plac → 3000 pkt driftu na placu w 60 s → Seba.
3. **„Wyścig z sąsiadem”:** Zbyszek na głównej pod Blokiem 2 → 2 okrążenia dużej pętli → rozmowa na mecie.

![Plan z góry](mapa.png)
