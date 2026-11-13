# Huisstijl

Bron: HAN-huisstijlsite (blog3.han.nl/huisstijl), geraadpleegd 13 november 2026. Karakter van de HAN-stijl: **helder, krachtig, stoer en basaal**. Brandvoice: **nieuwsgierig, gedreven, menselijk en betrouwbaar**.

De app gebruikt drie lagen:
1. **HAN-basis** – kleuren, letter en logo volgens de HAN-huisstijl.
2. **Outdoor** – eigen foto's van de Ardennen en de secundaire HAN-kleuren als natuurtinten.
3. **Meerdaagsethema** – naam, sfeerbeeld, logo en één accentkleur per cluster.

## Kleuren

### Primair palet
| Naam | HEX | Gebruik in de app |
|---|---|---|
| HAN rood | `#E50056` | merkkleur: knoppen, actieve navigatie, accenten. Contrast op wit 4,7:1 (voldoende voor tekst en knoppen) |
| HAN wit | `#FFFFFF` | achtergrond, tekst op rood en zwart |
| HAN zwart | `#000000` | koppen, tekst, donkere kopbalk |

### Grijswaarden
| Naam | HEX | Gebruik |
|---|---|---|
| Alabaster | `#F8F8F8` | achtergrond van schermen |
| Mercury | `#E3E3E3` | randen, scheidingslijnen |
| Gray | `#919191` | uitgeschakelde elementen (niet voor tekst op wit: 3,2:1) |
| Boulder | `#757575` | secundaire tekst (4,6:1 op wit) |
| Mineshaft | `#454545` | broodtekst (9,6:1 op wit) |

### Secundair palet – de outdoorlaag
| Naam | HEX | Gebruik |
|---|---|---|
| Oranje | `#F5A846` | vuur, avond, waarschuwingen |
| Groen | `#7AC48E` | bos, gelukt, camping |
| Blauw | `#6AC3ED` | rivier, water, bivak |

Deze kleuren zijn licht: **altijd zwarte tekst erop**, nooit witte (contrast met wit ca. 2:1, met zwart ca. 10:1). Gebruik ze als vlak, label of illustratie, niet als tekstkleur op wit.

### Tertiair palet
Olijf `#BBD737`, Geel `#F8E260`, Koraal `#EB5241`, Violet `#B14196`, Navy `#325CA7`. **Alleen voor grafieken, diagrammen en illustraties** (bijv. budget- of materiaalgrafieken), niet voor de interface. Tinten van HAN rood mogen ook alleen in grafieken.

### Accentkleur van het meerdaagsethema
Kies uit **HAN rood, oranje, groen of blauw**. Zo blijft de app binnen de HAN-huisstijl. De app regelt het contrast zelf: op rood komt witte tekst, op oranje, groen en blauw zwarte tekst.

## Letter

- Officiële huisstijlletter voor web en drukwerk: **Avenir Next** en **Avenir Next Condensed**. Die zijn niet vrij beschikbaar.
- De HAN gebruikt **Roboto** en **Roboto Condensed** (Open Font License, via Google Fonts) als alternatief. De app gebruikt die, geladen via `next/font/google` zodat ze offline beschikbaar zijn.
- Koppen: Roboto Condensed, gewicht 600 of 700 (afgeleid van Avenir Next Condensed Demi Bold).
- Tekst: Roboto, gewicht 400; nadruk 500.
- Zodra er een Avenir Next-webfontlicentie is, alleen de variabelen `--font-kop` en `--font-basis` aanpassen.

## Logo

- Het HAN-logo bestaat uit het woordmerk **HAN_**, het beeldmerk (de springplank) en de descriptor (University of Applied Sciences). Woordmerk en beeldmerk altijd in één HAN-kleur: rood, wit of zwart. De descriptor is zwart of wit. Officiële varianten: woordmerk + descriptor + springplank, woordmerk + descriptor, alleen woordmerk.
- De HAN communiceert altijd met het volledige HAN-logo, eventueel met academie of opleiding.
- Logobestanden in `assets/logo` (aangeleverd door Bart, bijgesneden en verkleind, kleuren ongewijzigd):

| Bestand | Variant | Gebruik in de app |
|---|---|---|
| `han-woordmerk-descriptor-200.png` / `-400.png` | HAN_ University of Applied Sciences, zonder springplank, witte achtergrond | kopbalk (hoogte ca. 24 px; `-400` voor scherpte op telefoons) |
| `han-merkteken-descriptor-240.png` / `-480.png` | met springplank, transparant | inlogscherm, PDF-voorblad |
| `han-sport-en-bewegen-400.png` / `-800.png` | HAN-logo met blok "Sport en Bewegen", transparant | inlogscherm onder het merkteken of als voettekst van PDF's |

- **Niet** het logo opnieuw tekenen, omkleuren, vervormen, schaduw geven of op een drukke foto zetten. Altijd op een witte of rustige lichte achtergrond met vrije ruimte rondom (minstens de hoogte van de letters "HAN").
- Een witte variant voor donkere achtergronden ontbreekt. Gebruik het logo daarom alleen op wit; de kopbalk is wit.
- De bestanden zijn PNG uit 2019. Vraag bij huisstijl@han.nl na of dit de actuele versie is en vraag een SVG (scherper en kleiner). Vervang dan alleen de bestanden in `assets/logo`.

## Iconen

- De HAN heeft een eigen iconenset (rode lijniconen) voor web, tools en apps, op te vragen via huisstijl@han.nl of Brandspot.
- Tot die set er is: Lucide-iconen in lijnstijl (`tent`, `compass`, `backpack`, `mountain`, `flame`, `map`, `waves`, `trees`), in HAN zwart of HAN rood, lijndikte 1,75.

## Foto's

- HAN-richtlijn: heldere kleuren, herkenbare en geloofwaardige situaties, natuurlijk standpunt.
- Gebruik de geselecteerde foto's in `assets/fotos` (geen herkenbare gezichten).
- Herkenbare personen alleen met akkoordverklaring (formulier "Akkoordverklaring foto en video" van de HAN).
- Geen donkere, fantasy- of post-apocalyptische AI-beelden ("We zijn niet de Efteling. We zijn de HAN."). Dat geldt ook voor sfeerbeelden die studenten bij hun meerdaagsethema uploaden: toon in het thema-scherm een korte tip hierover.
- Illustraties alleen in de HAN-illustratiestijl. De app gebruikt daarom geen eigen illustraties, alleen foto's en iconen.

## Vormgeving

- Basaal en krachtig: veel wit, duidelijke koppen, weinig decoratie, vlakke kaarten zonder zware schaduwen.
- Kopbalk: wit met links het HAN-logo (woordmerk + descriptor), rechts het accountlabel, onderaan een dunne balk in de accentkleur van het meerdaagsethema. Daaronder op het startscherm het sfeerbeeld met een donkere laag en de naam van het thema in wit.
- Outdoorelement: subtiel hoogtelijnenpatroon (dunne lijnen in Mercury) als achtergrond van de kopbalk en lege schermen.
- Statuslabels met tekst en icoon: groen = goedgekeurd, oranje = actie nodig, blauw = ingediend, grijs = in ontwikkeling.

## Naam en metafoor

De app heet **BackPACK_**: alles wat je nodig hebt voor de meerdaagse zit erin. De underscore sluit aan op het HAN-woordmerk (HAN_).

- Als woordmerk (kopbalk, inlogscherm, app-icoon): **BackPACK_** in Roboto Condensed 700, HAN zwart, de underscore in HAN rood.
- In lopende tekst ook altijd **BackPACK_** (met underscore, PACK in hoofdletters).
- Ondertitel: "Pleister, Aansteker, Camera en Kompas: alles in je BackPACK_".

### PACK: de vier vakken

| Vak | Voorwerp | Betekenis | Icoon (Lucide) |
|---|---|---|---|
| P | Pleister | zorgen voor elkaar en meenemen wat nodig is: veiligheid, welzijn, eten, materialen, locaties, corvee | `bandage` |
| A | Aansteker | het vuur aansteken: meerdaagsethema, belevenissen, AVF's | `flame` |
| C | Camera | vastleggen en delen: communicatie, documenten, budget | `camera` |
| K | Kompas | koers houden: draaiboek, planning, besluiten, deadlines | `compass` |

PACK is een speelse indeling, geen zwaar concept: een kleine letter en een icoon boven de groepen op het stuurgroepdashboard. Projectgroepen zien PACK niet. De vier vakken zijn de indeling van de stuurgroeppagina's en de groepering van de rollen. Gebruik per vak altijd hetzelfde icoon. Geef de vakken geen eigen kleuren buiten het HAN-palet; het icoon en de letter maken het verschil.

### Voorbeeldteksten

| Plek | Tekst |
|---|---|
| Inlogscherm | "BackPACK_ · Pleister, Aansteker, Camera en Kompas: alles in je BackPACK_" |
| Lege staat AVF | "Jullie BackPACK_ is nog leeg. Begin met sectie A." |
| Voortgang AVF | "5 van 8 vakken ingepakt" (vakken = secties A–H) |
| AVF goedgekeurd | "Goedgekeurd – deze belevenis is klaar voor vertrek" |
| Indienen | "BackPACK_ dichtdoen en indienen?" |
| Offline opgeslagen (later) | "Je BackPACK_ is ingepakt voor onderweg · laatst bijgewerkt 14:32" |
| Meerdaagsemodus (later) | Tabnaam "Onderweg" |
| Informatiepagina paklijst (later) | "Wat moet er in je eigen backpack?" |

Functionele woorden (AVF, budget, ingediend, goedgekeurd) blijven altijd zoals ze zijn. Niet elke knop of melding een backpackgrap; liever één keer goed dan overal.

## Schrijven

- Toon: nieuwsgierig, gedreven, menselijk en betrouwbaar. Spreek studenten aan met "je" en "jullie".
- Spelling volgens de HAN-schrijfwijzer en de Nederlandse Taalunie. Geen komma vóór "en".
- "Meerdaagse", nooit "kamp".
