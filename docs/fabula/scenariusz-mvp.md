# W NOCY ROBOTA

Scenariusz MVP · wersja 4 · 29.09.2026
Zastępuje wszystkie wcześniejsze wersje (w archiwum). Numeracja scen zgodna z plan-mvp.md.
Ten plik jest **źródłem prawdy**: z niego skrypt generuje `dane-mvp.json` dla gry.

---

## JAK TO CZYTAĆ

| Znak | Znaczenie | Trafia do gry? |
|---|---|---|
| *kursywa* | Opis dla czytającego, w 2. osobie („ty” = gracz za kierownicą). | Nie (tylko jako notatka dla twórcy) |
| **IMIĘ:** tekst | Kwestia w dymku / na pasku. | Tak |
| ▸ [id] „tekst” | Opcja wyboru. Po `→` może być odpowiedź postaci. | Tak |
| ⚑ FLAGA = wartość | Wybór zapamiętany na później. | Tak (niewidoczne) |
| ▭ **(tekst)** | Tekst techniczny na ekranie: godzina, kwota, miejsce. Płaski, urzędowy. | Tak |
| ♪ *tekst* | Muzyka i dźwięk. | Tak |
| ⚙ polecenie | Mechanika: zmiana kasy, zakład, przejazd, zakończenie. Parametry w plan-mvp.md. | Tak |
| #### jeśli FLAGA = wartość | Blok warunkowy, trwa do `#### dalej` albo do końca sceny. | Tak |
| ⟶ | Hak: zdanie, które pcha do następnej sceny. | Nie |

**Zasada 5: nikt nie udaje, że wie.** Kto nie wie, mówi to. Zgaduje głośno, dosłownie, po dziecięcemu. Przysłowie jest dozwolone, bo to „pożyczona pewność” („jak to mówią”), a nie własna wiedza.

**Pieniądze są prawdziwe (ceny z 2026 r.).** Jedna pula: „Kasa”. Mirek płaci blikiem, zakłady idą w gotówce, paliwo kartą — w grze to wszystko jedno konto.

---

## USTAWIENIA

*Początek października. Masz dwadzieścia lat, Poloneza Caro i kartkę od Zbycha, który ma kanał w garażu i nie ma telefonu. Na kartce, napisane długopisem na odwrocie paragonu, jest wszystko, czego twoje auto potrzebuje, żeby za trzy tygodnie przejść badanie techniczne. Zbychu podkreślił sumę dwa razy, jakby chciał, żeby bolało dwa razy.*

*Miasto nie ma nazwy. Mówi się: „do miasta”, „na wioskę”, „na Park”.*

---

# SCENA 0 — PARK
▭ **(Park · 23:35)**

*Płyta jest większa, niż pamiętasz. Zawsze jest większa, kiedy nikt na niej nie stoi — a przecież ktoś stoi. Latarnie rosną co czterdzieści metrów i każda oświetla własny kawałek asfaltu, jakby nie wiedziała o pozostałych. Za zbiornikami szumi woda, która dokądś płynie w środku nocy i nikt nie wie po co. Tiry śpią w rzędzie z zasłoniętymi szybami. Z betonu unosi się mgła, cienka jak oddech.*

*Nie jesteś tu sam. Facet w starym kombi siedzi przy otwartych drzwiach, pije z termosu i je kanapkę, patrząc w nic. Dwoje na rolkach robi wielkie, powolne koło wokół słupka. Na dalekim końcu ktoś w starym BMW, w e trzydzieści cztery, smaży gumę — krótko, bez przekonania, jakby sprawdzał, czy jeszcze może. Nikt na nikogo nie patrzy. Tak tu jest: przyjeżdża się nie po to, żeby być razem, tylko żeby nie być nigdzie.*

♪ *Techno, cichy bas, jeden motyw powtarzany jak cierpliwość.*

▭ **(Kasa: 699 zł)**
▭ **(Kartka od Zbycha: badanie 149 · łata na próg 300 · tarcze i klocki 170 · tłumik 120 · robota 150 · RAZEM 889 zł)**
▭ **(Termin: 21 dni)**

*Nic nie musisz. Możesz pojeździć: zakręt, wolna prosta, kółko wokół słupka. Polonez brzmi tak, jakby ktoś w środku przestawiał meble. Możesz też podjechać do kombi. Nikt cię nie woła.*

#### jeśli PODJECHAL_DO_KOMBI = tak

*Facet z termosem nie wstaje. Kiwa głową w stronę BMW, jak ktoś, kto pokazuje pogodę.*

**FACET Z TERMOSEM:** Ten w beemce zaraz jedzie. Sześć słupków.

**FACET Z TERMOSEM:** Cztery czyste i wygrywa, kto stawiał, że wygra.

**FACET Z TERMOSEM:** Ja tu tylko trzymam.

**FACET Z TERMOSEM:** Na tak — jeden osiem. Na nie — dwa siedem.

**FACET Z TERMOSEM:** Kurs nocy jest inny.

▸ [1] „Czemu inny?” → **FACET Z TERMOSEM:** Bo ciemno. W ciemno się inaczej stawia.
▸ [2] „Skąd te liczby?” → **FACET Z TERMOSEM:** Na oko. Mam jedno dobre.
▸ [3] „Ile można?” → **FACET Z TERMOSEM:** Dycha albo dwie. Dycha. Kiedyś to było sto tysięcy.

⚙ zaklad NOC_BMW

*Beemka rusza. Tył wychodzi, wraca, wychodzi. Słupki mijają ją jak znajomi, którym nie chce się zatrzymać.*

⚙ przejazd NOC_BMW

#### jeśli NOC_BMW = wygrana

**FACET Z TERMOSEM:** No. Szczęście w nocy też jest inne.

#### jeśli NOC_BMW = przegrana

**FACET Z TERMOSEM:** Pieniądz w nocy lekki. Odlatuje.

#### jeśli NOC_BMW = bez_zakladu

**FACET Z TERMOSEM:** Nie stawiasz. Też dobrze. Ktoś musi patrzeć.

#### dalej

*Po chwili telefon zaczyna drgać w uchwycie.*

⚙ telefon ROZMOWA MIREK

▭ **(MIREK)**

**MIREK:** Jesteś na Parku?

▸ [1] „Jestem.”

**MIREK:** Wiedziałem.

**MIREK:** Jest robota. Dzisiaj.

**MIREK:** Cztery felgi. Na wioskę.

**MIREK:** Przyjedź, to opowiem. Blikiem, tej nocy.

⟶ *Odkładasz telefon. Suma na kartce Zbycha nie mruga i nie ponagla. Po prostu jest, jak tablica z nazwą miejscowości.*

---

# SCENA 1 — PODWÓRKO MIRKA
▭ **(Miasto · 23:58)**

*Miasto o tej porze wygląda jak dekoracja po spektaklu: światła zmieniają się dla nikogo, Żabka świeci jak akwarium, a pod wiaduktem wilgoć ma własny kolor. Mirek mieszka i handluje w tym samym miejscu, na podwórku za halą z roletami. Pod wiatą stoją rzeczy, których pochodzenia lepiej nie zgłębiać: dwa agregaty, zgrzewarka, pralka z niemiecką naklejką i fotel, który kiedyś należał do dentysty.*

*Mirek stoi z kubkiem w kurtce z napisem, którego nigdy nie tłumaczył. Za nim, oparte o siebie jak zmęczeni ludzie, czekają cztery felgi.*

**MIREK:** No jesteś.

**MIREK:** Cztery felgi. Szesnastki. Do golfa. Ale nie do każdego golfa.

**MIREK:** Do trójki. Do czwórki nie pasują.

**MIREK:** Mają inne dziury. Nie wiem czemu, tak zrobili.

**MIREK:** Do tego opony. Zimowe.

**MIREK:** Felgi: dwie dobre, dwie takie sobie. Nie pamiętam, które.

**MIREK:** Jedziesz na wioskę. Za lasem. Znaczy przed lasem. Zależy, z której strony.

**MIREK:** Facet czeka. Nie odbiera telefonu, ale czeka.

▸ [1] „Nie odbiera?” → **MIREK:** Nie lubi. Ale czeka. Zawsze czekał.
▸ [2] „Ile?” → **MIREK:** Zaraz, zaraz.
▸ [3] „Okej.” → **MIREK:** No.

**MIREK:** Dwie stówy.

**MIREK:** W dzień dałbym stówę. Kurs nocy jest inny.

**MIREK:** Jak to mówią: w nocy robota dla kurwy i kota.

**MIREK:** Kotem to ty nie jesteś.

*Mówi to bez uśmiechu, jak prognozę. Nie ma w tym złośliwości. Mirek po prostu nie słyszy, co powiedział.*

**MIREK:** Blikiem, jak zrobisz. Ten sam numer?

▸ [1] „Ten sam.”

**MIREK:** To dobrze. Bo nie pamiętam.

**MIREK:** A jeszcze jedno.

**MIREK:** Wiesz, czemu w moim kombi świeci lampka w bagażniku?

**MIREK:** W dzień. Cały czas.

▸ [1] „Nie wiem.” → **MIREK:** Ja też nie.
▸ [2] „Może styk.” → **MIREK:** Styk. Może. Styk brzmi mądrze.
▸ [3] „Długo jeszcze?” → **MIREK:** Krótko. To jest minuta.

**MIREK:** Ja myślę, że to masa. Ale nie wiem, czyja.

**MIREK:** No. Ładuj.

⟶ *Podchodzisz do felg. Są cięższe, niż wyglądają. Wszystko jest cięższe, niż wygląda, kiedy ktoś na to patrzy.*

---

# SCENA 2 — ZAŁADUNEK
▭ **(00:06)**

*Otwierasz klapę Poloneza. Z bagażnika wypada zapach, którego nie potrafisz nazwać: coś między gumą, benzyną i starym psem, którego nigdy nie miałeś. Mirek zagląda do środka jak ktoś, kto ocenia głębokość studni.*

**MIREK:** Ludzie nie umieją ładować.

**MIREK:** Jeden włożył mi lodówkę na leżąco. I się kurwa dziwił, że cieknie.

**MIREK:** Jeden włożył szafę i nie zamknął. I się dziwił, że pada.

**MIREK:** Jeden powiedział, że się zmieści. Nie zmieściło się. I się dziwił.

**MIREK:** No. Bierz tę pod spód.

**MIREK:** Nie tę. Tę z lewej. Ze swojej lewej.

**MIREK:** Kołem do dołu. Do dołu, nie do siebie.

**MIREK:** Nie na bok, bo się turlają. O. Widzisz.

**MIREK:** Trzy wchodzą. Czwarta... no na siedzenie.

**MIREK:** Co się nie mieści, to jedzie z tyłu.

*Czwarta felga ląduje na tylnej kanapie, oparta o zagłówek jak pasażer, który postanowił się nie odzywać.*

**MIREK:** Zapnij ją pasem.

▸ [1] „Pasem?” → **MIREK:** Żeby się nie ruszała. Jak człowiek.
▸ [2] „Zasłania lusterko.” → **MIREK:** Trochę. Na prosto nie potrzeba.
▸ [3] *(Wsiadasz bez słowa.)*

*Mirek zamyka klapę, otwiera ją znowu, zamyka. Jak ktoś, kto sprawdza, czy w domu ktoś jest.*

**MIREK:** U ciebie się w ogóle nie świeci. W bagażniku.

**MIREK:** U mnie świeci cały czas, u ciebie wcale. Nie wiem, co lepsze.

▭ **(Ładunek: 4 felgi z oponami. Masa +70 kg.)**

⚙ ladunek FELGI

⟶ *Zamykasz drzwi. Coś za tobą przesuwa się i opiera z westchnieniem. Zanim dojedziesz do skrzyżowania, telefon zaczyna dzwonić.*

---

# SCENA 3 — TELEFON I ORLEN
▭ **(00:18)**

*Na ekranie: ŚLIMAK. Tak się nazywa. Kamil Ślimak. Czytane od tyłu też wychodzi coś, ale nikt jeszcze nie ustalił co.*

⚙ telefon ROZMOWA KAMIL

**KAMIL:** Ty, nie dojadę.

**KAMIL:** Stanęło. Samo stanęło.

**KAMIL:** Na wylotówce. Przy tym przystanku w polu. Tam, gdzie nic nie ma.

**KAMIL:** Nie dzwoń po nikogo. Przyjedź. Proszę.

*Rozłącza się, zanim zdążysz cokolwiek powiedzieć. Zawsze tak robi. Uważa, że to oszczędza minuty.*

▭ **(Orlen · 00:31)**

*Orlen na wyjeździe z miasta świeci jak lądowisko. Poza tobą stoi tu jeden tir i człowiek za szybą, który patrzy w monitor na coś, co nie jest filmem. Wskaźnik od wtorku leży na rezerwie. Za pięć dych wejdzie tyle, żeby wrócić. Więcej nie wejdzie, bo więcej nie masz ochoty wydać.*

▭ **(Pb95 · 6,99 zł/l · 7,15 l · 50,00 zł)**

⚙ kasa −50

⟶ *Wylotówka zaczyna się tuż za ostatnią latarnią, jakby ktoś w mieście zdecydował, że dalej to już nie jego sprawa.*

---

# SCENA 4 — PRZYSTANEK W POLU
▭ **(00:52)**

*Ciemność za miastem jest inna: gęsta, prawie miękka. Reflektory wyjmują z niej po kawałku: dziurę, kępę trawy, znak, który ostrzega przed czymś, co się skończyło. Przez całą drogę mijasz jedno auto z naprzeciwka. Kierowca unosi dwa palce znad kierownicy i ty przyjmujesz to jak przysługę.*

*Przystanek stoi w polu sam: blaszany daszek i ławka dla nikogo. Obok, z zapalonymi awaryjnymi, stoi auto Kamila. Mruga w rytmie serca kogoś bardzo spokojnego. Kamil siedzi na masce, ubrany jak na wyjście do sklepu.*

**KAMIL:** Jesteś.

**KAMIL:** Nie wiem, co mu jest.

**KAMIL:** Może się zmęczył. Może się obraził.

**KAMIL:** Jak mu dać chwilę, to czasem samo przechodzi.

*Kamil wsuwa głowę pod maskę i wpatruje się w silnik, jakby czekał, aż ten coś powie.*

▸ [1] „Sprawdzałeś?” → **KAMIL:** Patrzyłem. Długo. Nic mi nie powiedział.
▸ [2] „Może świece?” → **KAMIL:** Może. Nie wiem, jak wyglądają świece. Widziałem w sklepie. Takie małe.
▸ [3] „Poświecić?” → **KAMIL:** No. Tu. Nie tu. Tu.

*Latarka telefonu ślizga się po metalu. Silnik wygląda jak silnik. Nic w nim nie kapie, nic nie iskrzy, nic nie tłumaczy.*

**KAMIL:** Każde auto kiedyś się obrazi. Tata tak mówił.

**KAMIL:** Zostawię go tu. Nikt go nie weźmie.

**KAMIL:** Nawet ja bym go nie wziął, a ja go mam.

*Kamil klepie auto po dachu, jak konia.*

**KAMIL:** Zostań tu. Wrócę po ciebie. Nie bój się.

**KAMIL:** Awaryjne zostawiam. Żeby wiedział, że ktoś o nim pamięta.

*Zdejmuje z lusterka zielony kartonik zapachu — choinkę — i chowa do kieszeni.*

**KAMIL:** Choinki nie zostawię. Ona nic nie zawiniła.

*Otwierasz mu drzwi. Wsiada, zapina pas i od razu odwraca głowę do tyłu.*

**KAMIL:** O. Jest felga.

▸ [1] „Zapięta.” → **KAMIL:** No to dobrze. Niech się nie boi.
▸ [2] „Nie ruszaj jej.” → **KAMIL:** Nie ruszam. Patrzę.

*Kamil wiesza choinkę na twoim lusterku. Zapach przykrywa gumę, ale nie do końca.*

⚙ pasazer KAMIL

♪ *Radio ścisza się samo, jakby się zawstydziło.*

⟶ *Ruszacie. Awaryjne w bocznym lusterku mrugają jeszcze długą chwilę. Kamil zdaje się liczyć ich mrugnięcia.*

---

# SCENA 5 — TRASA
▭ **(00:58)**

*Do wsi jest dwadzieścia kilometrów prostej, dziurawej drogi bez latarni. Jedziesz wolniej, niż byś chciał, bo za plecami masz cztery cudze koła, a obok kogoś, kto lubi rozmawiać o pieniądzach.*

**KAMIL:** Ja jadę za piwo. Wiesz.

**KAMIL:** Ale ty nie jedziesz za piwo. Ty jedziesz na przegląd.

**KAMIL:** Ile ci dał?

▸ [1] „Dwie stówy.”

**KAMIL:** Dwie stówy.

**KAMIL:** To dużo czy mało? Ja nie wiem. Ja jestem od piwa.

*Prosta. Ciemno. Reflektory robią w nocy dziurę dokładnie wielkości auta.*

**KAMIL:** Ile poszło na paliwo?

▸ [1] „Pięć dych.”

**KAMIL:** Pięć dych. To już nie dwie stówy, tylko sto pięćdziesiąt.

**KAMIL:** Tak jest: coś dostajesz i zaraz tego trochę mniej.

*Polonez szarpie w bok. Z tyłu felga stuka o zagłówek — raz, jak ktoś pukający do drzwi.*

**KAMIL:** O, kurwa. Dziura.

**KAMIL:** To też kosztuje.

**KAMIL:** Zawieszenie się męczy. Jak się męczy, trzeba mu dać odpocząć.

**KAMIL:** Odpoczynek kosztuje. Sto trzydzieści dziewięć. Tak myślę.

**KAMIL:** W sklepach zawsze jest dziewięć na końcu.

*Próbujesz zadzwonić do odbiorcy po raz trzeci.*

▭ **(Abonent nie odbiera.)**

**KAMIL:** Nie odbiera?

**KAMIL:** Ludzie, co nie odbierają, zwykle stoją i czekają.

**KAMIL:** Ja też tak mam.

**KAMIL:** A czas? Pięć godzin. Może więcej.

**KAMIL:** Godzina to chyba z trzydzieści złotych. Tyle płacą w Biedronce. Słyszałem.

**KAMIL:** Pięć godzin to sto pięćdziesiąt.

*Na horyzoncie pojawia się jedno światło. Jedno. Jak ktoś, kto został po zmianie.*

**KAMIL:** No i jeszcze ryzyko.

**KAMIL:** Cudze felgi to jak pełna szklanka.

**KAMIL:** Ktoś ci mówi: nie rozlej.

**KAMIL:** Jak rozbijesz, płacisz za cztery. Cztery felgi to chyba z pięć stów.

**KAMIL:** Plus pięć dych za to, że ciemno.

**KAMIL:** Policzę. Pięćdziesiąt i sto trzydzieści dziewięć. Sto osiemdziesiąt dziewięć.

**KAMIL:** Plus sto pięćdziesiąt. Trzysta trzydzieści dziewięć.

**KAMIL:** Plus pięćset pięćdziesiąt. Osiemset osiemdziesiąt dziewięć.

**KAMIL:** Wychodzi osiemset osiemdziesiąt dziewięć.

**KAMIL:** Sam się zdziwiłem. Przypadek.

*Kamil patrzy w okno tak uważnie, jak patrzy się, kiedy się kłamie na niby. Osiemset osiemdziesiąt dziewięć to liczba z kartki Zbycha. Pokazywałeś mu ją w zeszłym tygodniu. Raz.*

▸ [1] „Dostaję dwie stówy.” → **KAMIL:** No właśnie. ⚑ KAMIL_WIE = nie
▸ [2] „Przypadek?” → **KAMIL:** No. Przypadek. ⚑ KAMIL_WIE = tak

⟶ *Wieś zaczyna się od psa. Potem jest płot, potem drugi płot, potem lampa. Jedna. Stoi na środku podwórka jak ostatni pracownik zmiany.*

---

# SCENA 6 — WIEŚ: CZEKANIE
▭ **(Wieś · 01:38)**

*Przy kurniku nikogo nie ma. Jest podwórko, dom z zasłoniętym oknem, w którym telewizor przesuwa po suficie kolorowe cienie, i lampa, która świeci na nic.*

▭ **(Abonent nie odbiera.)**

*Próbujesz jeszcze raz. Potem jeszcze. Potem gasisz silnik, bo stanie na jałowym kosztuje, a ty już wiesz, ile co kosztuje.*

*Robi się cicho tak, jak cicho bywa tylko na wsi: coś skrzypnie, coś się zakołysze, gdzieś daleko pies powie coś psu.*

**KAMIL:** Poczekamy.

**KAMIL:** On zawsze czeka. Mirek mówił.

**KAMIL:** Skoro czeka, to pewnie jest. Tylko jeszcze go nie widać.

*Kamil, nie pytając, przełącza radio na stację, na której ktoś stary i smutny śpiewa o niedzielach. Zauważa, że zauważyłeś.*

⚙ radio DAD_ROCK

**KAMIL:** Mogę?

*Już jest.*

**KAMIL:** Mirek mówi: w nocy robota dla kurwy i kota.

**KAMIL:** To my kim jesteśmy?

*Myśli nad tym dłużej niż nad silnikiem.*

**KAMIL:** Ja chyba kot.

*Odchyla siedzenie, poprawia choinkę na lusterku i patrzy w dach.*

**KAMIL:** Ty byś stąd wyjechał?

*Nie odpowiadasz. Cisza trwa dwie sekundy dłużej, niż powinna.*

**KAMIL:** No. Tak mi się powiedziało.

**KAMIL:** Ja bym chyba nie. Ale nie wiem. Jeszcze nie próbowałem.

*Po chwili jego oddech robi się długi. Kamil zasnął tak, jak zasypia się w cudzych autach: nagle i zupełnie.*

⚙ skok_czasu 02:40

*Czekasz. Świat za szybą robi to, co świat robi w nocy: nic, ale coraz staranniej. Kot przechodzi przez podwórko tak, jakby miał tu meldunek.*

⚙ skok_czasu 03:25

♪ *Z radia sączy się kawałek dad rocka o facecie, który w niedzielę odwozi dzieci i wraca do pustego domu, do którego wszedł kiedyś z kartonami. Kamil pochrapuje w rytmie refrenu.*

⚙ skok_czasu 04:05

*I wtedy widzisz go pod lampą. Stoi z rękami w kieszeniach, w zimowej kurtce zapiętej pod szyję, jakby czekał na autobus, który kursuje tu od zawsze i jeszcze się nie spóźnił. Nie ma w tym nic niezwykłego, poza tym, że nie wiesz, skąd się wziął.*

⟶ *Kamil otwiera oczy. Pierwsze, co robi, to sprawdza choinkę.*

---

# SCENA 7 — ODBIORCA
▭ **(04:08)**

**ODBIORCA:** O. Są.

**KAMIL:** Długo pan tu stoi?

**ODBIORCA:** Nie. Dopiero.

**ODBIORCA:** Ja tu tylko tak stoję.

**ODBIORCA:** Kto czeka, ten się doczeka. Ja czekam od zawsze.

**ODBIORCA:** Postawcie przy kurniku. Tam gdzie zawsze.

**KAMIL:** Przy kurniku. Jasne.

*Nikt nie pyta, skąd „zawsze”. Otwierasz klapę. Trzy pierwsze felgi wyjmujecie razem z Kamilem i ustawiacie w rządku pod kurnikiem, gdzie ziemia jest sucha. Potem Kamil idzie do furtki i pyta odbiorcę o psa.*

**KAMIL:** Ugryzie?

**ODBIORCA:** Nie wiem. Nie mój.

**KAMIL:** To czyj?

**ODBIORCA:** Też nie wiem. Tu zawsze był.

*Czwartą felgę wyjmujesz z tylnej kanapy sam. Kładziesz ją na ziemi, żeby przetoczyć pod kurnik — i widzisz, jak toczy się krzywo. Nie mocno. Tylko tyle, żeby dało się zauważyć, jeśli się patrzy. A jeśli się nie patrzy — nie.*

⚙ scenka FELGA_BICIE

*Przystajesz. Toczysz ją jeszcze raz, wolniej. Ta sama krzywizna, jak drobny uśmiech, którego nie da się cofnąć.*

*Bicie. Od transportu? Od dziury, którą złapałeś jednym kołem? Od tego, co Mirek nazwał „takie sobie”? Albo była taka od zawsze?*

*Nie ma nikogo, kogo możesz zapytać. Kamil przy furtce dowiaduje się, że pies lubi kości, ale nie wiadomo, czyje. Odbiorca patrzy w niebo, jakby też na coś czekał.*

*Stawiasz felgę przy kurniku, na końcu rządka. Wygląda jak pozostałe. To najgorsze, co można o niej powiedzieć.*

⚙ ladunek BRAK

**ODBIORCA:** No. Dobra.

**ODBIORCA:** Mirkowi powiedzcie, że dobra.

*Odbiorca odchodzi w stronę domu wolnym krokiem człowieka, który nigdy w życiu się nie spieszył i nie zamierza zaczynać. Lampa gaśnie za nim. Światło robi się szare od dołu.*

**KAMIL:** Idziemy?

*Kamil wraca zaspany, z odciśniętym na policzku szwem rękawa.*

⟶ *W aucie nikt nic nie mówi. Radio, które przez całą noc mieszkało cicho pod rozmową, podnosi głos, jakby ktoś je o to poprosił.*

---

# SCENA 8 — TELEFON MIRKA
▭ **(04:31)**

*Wyjeżdżacie ze wsi. Lusterko po raz pierwszy od załadunku pokazuje coś poza kanapą: pustą drogę, którą przed chwilą jechaliście. Nie wiesz, co z tym zrobić. Przyzwyczaiłeś się do braku.*

*Kamil zasnął, zanim skończył się las. Głowa oparta o szybę, usta lekko otwarte, choinka kiwa się nad nim jak wahadło.*

⚙ pasazer_spi KAMIL

*Telefon zaczyna drgać w uchwycie. Kamil nie budzi się. Odbierasz cicho.*

⚙ telefon ROZMOWA MIREK

▭ **(MIREK · 04:31)**

**MIREK:** I jak?

**MIREK:** Wszystko poszło gładko?

▸ [A] „Jedna felga ma bicie. Nie wiem od czego.” ⚑ PRAWDA = powiedzial
▸ [B] „Gładko.” ⚑ PRAWDA = zmilczal

#### jeśli PRAWDA = powiedzial

**MIREK:** Bicie.

*W słuchawce coś skrzypi: krzesło albo Mirek.*

**MIREK:** Od czego?

▸ [1] „Nie wiem.”

**MIREK:** Ja też nie wiem. Mówiłem, że dwie takie sobie.

**MIREK:** Pięć dych mniej. Nie że ci nie wierzę. Tak się robi.

**MIREK:** Ale że powiedziałeś — to się liczy. Ludzie nie mówią.

**MIREK:** Sto pięćdziesiąt. Wysyłam.

⚙ kasa +150

▭ **(BLIK: +150 zł)**

**MIREK:** Zadzwonię jeszcze.

#### jeśli PRAWDA = zmilczal

**MIREK:** No i dobrze.

**MIREK:** Dwie stówy. Wysyłam.

⚙ kasa +200

▭ **(BLIK: +200 zł)**

**MIREK:** Na pewno gładko?

▸ [1] „Tak.”

**MIREK:** No.

#### dalej

**MIREK:** A ta lampka w moim bagażniku. Myślisz, że masa?

▸ [1] „Może.”

**MIREK:** No. Może.

⟶ *Odkładasz telefon. Droga do miasta jest jedna i wszystkie jej dziury znasz już z imienia.*

---

# SCENA 9 — PRZYSTANEK PO RAZ DRUGI
▭ **(05:12)**

*Przystanek wyłania się z ciemności później, niż powinien, bo ciemność jest już inna: cieńsza, jak pończocha. Auto Kamila stoi tam, gdzie je zostawiliście. Awaryjne mrugają dalej. Słabiej. Ale mrugają.*

*Kamil budzi się nie wiadomo od czego. Może od zmiany rytmu opon.*

⚙ pasazer_budzi KAMIL

**KAMIL:** Mruga jeszcze.

**KAMIL:** Nie boi się.

**KAMIL:** Wrócę po niego jutro. Albo pojutrze. Zależy, czy będzie chciał.

*Kamil zamyka oczy, ale tylko dla ozdoby.*

⟶ *Awaryjne znikają za zakrętem. Zostaje po nich to, że mrugały.*

---

# SCENA 10 — POD BLOKIEM KAMILA
▭ **(05:41)**

*Kamil mieszka w bloku, który wygląda jak wszystkie bloki: pudełko, w którym każde okno ma inną zasłonę i tę samą historię. Zatrzymujesz się przy śmietniku, jedynym miejscu z wolnym miejscem.*

*Kamil odpina pas, ziewa, zdejmuje z lusterka choinkę, a po sekundzie wiesza z powrotem.*

**KAMIL:** Niech ci pachnie.

**KAMIL:** Piwo mi dasz kiedyś. Nie teraz. Teraz jest rano.

*Masz w kieszeni dwie dyszki. Jedyne papierowe pieniądze tej nocy.*

▸ [1] „Masz. Na browary.” ⚑ PIWO = dane
▸ [2] „Kiedyś.” ⚑ PIWO = kiedys

#### jeśli PIWO = dane

⚙ kasa −20

*Kamil patrzy na banknoty tak, jak patrzył na silnik: długo, i nic mu nie mówią.*

**KAMIL:** Dwadzieścia.

**KAMIL:** To ci teraz brakuje więcej.

**KAMIL:** No... dobra. Bo jak nie wezmę, to wyjdzie, że liczyłem.

#### jeśli PIWO = kiedys

**KAMIL:** No. Kiedyś.

#### dalej

*Otwiera drzwi. Zatrzymuje się z ręką na klamce.*

**KAMIL:** Osiemset osiemdziesiąt dziewięć.

#### jeśli KAMIL_WIE = tak

**KAMIL:** Nie przypadek.

#### dalej

*Zamyka drzwi tak, jak się zamyka coś, co ma się nie obudzić.*

⚙ pasazer BRAK

⟶ *Zostaje jeszcze Park. Miejsce, do którego się jedzie, kiedy nie ma dokąd.*

---

# SCENA 11 — PARK O ŚWICIE
▭ **(Park · 06:04)**

*Wracasz na płytę, kiedy niebo nad zbiornikami przestało być czarne, a jeszcze nie stało się niczym innym. Latarnie palą się nadal, choć nie są już potrzebne, jak ludzie, którzy nie zauważyli końca imprezy. Kombi z termosem zniknęło. Beemka zniknęła. Rolkarze zniknęli. Został papierowy kubek na słupku, ustawiony tak starannie, że nikt nie ośmieli się go wyrzucić.*

*Radio wciąż gra dad rocka. Przełączasz na techno. Palec sam wie, gdzie.*

⚙ radio TECHNO

♪ *Ten sam motyw, ten sam cichy bas.*

▭ **(Kasa: [KASA]. Kartka od Zbycha: 889 zł. Brakuje: [BRAK].)**

*Parkujesz tam, skąd wyjechałeś. Wszystko jest tak samo jak wtedy, tylko teraz wiesz, ile co kosztuje.*

▭ **(06:12)**

*Potem Park zaczyna się budzić, bo Park nie jest twój. Na płytę wjeżdża pierwsze auto porannej zmiany, potem drugie, potem służbowy bus. Pod halą staje trzech facetów w odblaskowych kamizelkach, z kubkami. Mają niecałe pół godziny do syreny i nic do roboty. Jeden z nich trzyma w ręku banknoty i gumkę recepturkę.*

**HENIO:** Ty. To twój polonez?

**HENIO:** Tyłem pójdzie?

**HENIO:** Polonez bokiem to jak szafa na lodzie. Da się, ale po co.

**HENIO:** Zdzichu jedzie busem. Potem ty, jak chcesz. Sześć słupków, cztery czyste.

**HENIO:** Ja trzymam, bo ja nie piję przed zmianą.

**HENIO:** Na Zdzicha: jeden osiem, w obie strony. Rano kurs jest normalny.

▸ [1] „Rano normalny, a w nocy?” → **HENIO:** W nocy nie wiem. W nocy śpię.
▸ [2] „Dawaj.”

⚙ zaklad RANO_BUS

*Służbowy bus rusza z gracją lodówki, którą ktoś wypchnął z ciężarówki. Zdzichu trzyma kierownicę tak, jakby się z nią kłócił.*

⚙ przejazd RANO_BUS

#### jeśli RANO_BUS = wygrana

**HENIO:** Masz. Zdzichu, ty mi się nie odzywaj.

#### jeśli RANO_BUS = przegrana

**HENIO:** No. Zdzichu dziś nie jest sobą. Zdzichu rzadko jest sobą.

#### jeśli RANO_BUS = bez_zakladu

**HENIO:** Nie stawiałeś. Mądry albo biedny.

#### dalej

**HENIO:** No. To teraz ty.

**HENIO:** Ja nie wiem, czy umiesz. Ja stawiam, że nie. To co innego.

⚙ tlum RANO_GRACZ

▭ **(Henio: 20 zł na NIE · Zdzichu: 20 zł na NIE · Jurek: 20 zł na TAK)**

**JUREK:** Ja mówię, że chyba umiesz. Jak wygram, dycha twoja.

**HENIO:** Na ciebie trzy zero. Stawiasz na siebie?

⚙ zaklad RANO_GRACZ

*Ostatni raz tej nocy robisz coś, na czym się znasz. Albo na czym myślałeś, że się znasz.*

⚙ przejazd RANO_GRACZ

#### jeśli RANO_GRACZ = sukces

**JUREK:** No! Mówiłem, że chyba.

**JUREK:** Dycha twoja.

⚙ kasa +10

**HENIO:** Szafa na lodzie. A jednak.

#### jeśli RANO_GRACZ = porazka

**HENIO:** No. Polonez.

**JUREK:** Ja i tak mówię, że chyba umiesz.

#### dalej

▭ **(06:40 · syrena)**

*Faceci wyrzucają kubki do kosza i idą do hali. Henio chowa banknoty pod gumkę. Park znowu należy do kogoś innego.*

⚙ zakonczenie

---

## ZAKOŃCZENIA

*Zakończenie wynika z dwóch rzeczy: czy powiedziałeś Mirkowi prawdę i czy po świcie masz 889 zł. Każdą drogę da się domknąć, ale im uczciwiej i hojniej grałeś tej nocy, tym więcej musisz postawić na siebie o świcie. Kłamstwo jest tańsze. Prawda kosztuje ryzyko.*

### ZAKOŃCZENIE 1 — NA STYK
Warunek: PRAWDA = zmilczal · kasa ≥ 889

▭ **(Kasa: [KASA]. Kartka od Zbycha: 889 zł. Brakuje: 0 zł.)**

*Liczba, którą nosiłeś przez całą noc, znika. Nie ma fanfar. Jest cisza i silnik, który stygnie z cichym tykaniem, jakby liczył dalej sam.*

*Choinka się kołysze. Nie wysiadasz.*

♪ *Radio gra do końca utworu.*

▭ **(Trzy dni później)**
▭ **(Badanie techniczne: pozytywne.)**

⚙ telefon SMS MIREK

**MIREK:** Facet dzwonił. Jedna bije.

*To SMS. Czekasz na drugi. Nie przychodzi.*

▭ **(Mirek · ostatnio aktywny: 3 dni temu)**

### ZAKOŃCZENIE 2 — PRAWIE
Warunek: PRAWDA = zmilczal · kasa < 889

▭ **(Kasa: [KASA]. Kartka od Zbycha: 889 zł. Brakuje: [BRAK].)**

*Zabrakło jednego słupka. Albo odwagi, żeby postawić więcej. Henio zdążył zapomnieć, jak wyglądasz.*

*Silnik gaśnie sam. Choinka kołysze się jeszcze przez chwilę, potem przestaje. Nie wysiadasz.*

♪ *Radio gra do końca utworu.*

▭ **(Trzy dni później)**
▭ **(Termin badania: 18 dni.)**

⚙ telefon SMS MIREK

**MIREK:** Facet dzwonił. Jedna bije.

*To SMS. Czekasz na drugi. Nie przychodzi.*

▭ **(Mirek · ostatnio aktywny: 3 dni temu)**

### ZAKOŃCZENIE 3 — JUTRO
Warunek: PRAWDA = powiedzial · kasa < 889

▭ **(Kasa: [KASA]. Kartka od Zbycha: 889 zł. Brakuje: [BRAK].)**

*Brakuje. Postawiłeś albo nie postawiłeś, i tak wyszło za mało. Ale nikt cię nie szuka i nikt do ciebie nie pisze krótkich wiadomości.*

*Silnik gaśnie sam. Choinka kołysze się jeszcze przez chwilę. Nie wysiadasz.*

♪ *Radio gra do końca utworu.*

▭ **(Trzy dni później)**
▭ **(Termin badania: 18 dni.)**

*Telefon dzwoni. Nie wiadomość. Dzwoni.*

⚙ telefon ROZMOWA MIREK

▭ **(MIREK)**

**MIREK:** Jest robota.

**MIREK:** Pralka. Nad wodę.

**MIREK:** Ten sam numer. Pamiętam.

▭ **(Nowe zlecenie: nad wodę.)**

### ZAKOŃCZENIE 4 — CZYSTO
Warunek: PRAWDA = powiedzial · kasa ≥ 889

▭ **(Kasa: [KASA]. Kartka od Zbycha: 889 zł. Brakuje: 0 zł.)**

*Postawiłeś wszystko, co mogłeś postawić, na rzecz, na którą nikt nie stawiał. Liczba znika. Nikt tego nie widział poza Jurkiem, a Jurek już jest w hali.*

*Choinka się kołysze. Nie wysiadasz. Nie musisz nigdzie jechać, a pierwszy raz tej nocy to jest dobra wiadomość.*

♪ *Radio gra do końca utworu.*

▭ **(Trzy dni później)**
▭ **(Badanie techniczne: pozytywne.)**

*Telefon dzwoni.*

⚙ telefon ROZMOWA MIREK

▭ **(MIREK)**

**MIREK:** Jest robota.

**MIREK:** Pralka. Nad wodę.

**MIREK:** Ten sam numer. Pamiętam.

▭ **(Nowe zlecenie: nad wodę.)**

---

## EPILOG KAMILA (po każdym zakończeniu)

▭ **(Tydzień później)**

⚙ telefon SMS KAMIL

#### jeśli PIWO = dane

**KAMIL:** Wypiłem za ciebie. Auto odpaliło samo. Mówiłem, że się obraziło.

#### jeśli PIWO = kiedys

**KAMIL:** Auto odpaliło samo. Mówiłem, że się obraziło. Piwo dalej wisi.

#### dalej

**KONIEC**

---

## CELOWO NIE JEST DECYZJĄ

„Ty byś stąd wyjechał?” (scena 6) zostaje bez opcji wyboru. To otwarcie na pełną grę, nie szczebel drabinki MVP.
