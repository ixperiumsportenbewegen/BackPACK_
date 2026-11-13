# PRD Backpack_

Versie 3.0 | 4 november 2026 | Eigenaar en bouwer: Bart

**Backpack_** is de app voor de Ardennen-meerdaagse van Sportkunde: alles wat je nodig hebt voor de meerdaagse zit erin. De vier vakken heten PACK: Pleister, Aansteker, Camera en Kompas (zie 4.1).

Deze PRD beschrijft wat versie 1 van Backpack_ moet kunnen, in welke volgorde het gebouwd wordt en wat bewust later komt. Hij bouwt voort op het achtergronddocument (v1.0) en verwerkt de besluiten van 4 november 2026. De kern: elk cluster krijgt overzicht over zijn eigen meerdaagse, met het zelfgekozen meerdaagsethema centraal in uitstraling en inhoud.

### Leidende documenten

| Document | Status |
| --- | --- |
| Voorbeeld AVF.pdf | Bestaand AVF-format; basis voor de velden in hoofdstuk 5.1. |
| Achtergronddocument (oud) | Niet meegeleverd en niet leidend. Deze PRD en de documenten in docs/ gaan altijd voor. |
| PRD.md (dit document) | Productbeschrijving; voor wat nu gebouwd wordt geldt docs/bouwvolgorde.md. |
| AVF_velden_en_deelbeleid.md | Vervallen. Beschreef één AVF per editie van de meerdaagse voor de coördinator; hoofdstuk 5 van deze PRD vervangt het. |

## 1 Context en doel

| Onderdeel | Invulling |
| --- | --- |
| Wat | Ardennen-meerdaagse van Sportkunde (HAN): studenten ontwerpen en begeleiden zelf belevenissen |
| Wanneer | Maandag 28 t/m woensdag 30 juni 2027 |
| Waar | Yvoir (België); camping en bivak, gespiegeld gebruikt door de twee clusters |
| Deelnemers | Ca. 110 studenten in twee clusters (VD en VC) van elk ca. 55, plus docenten |
| Per cluster | Zes projectgroepen (elk één belevenis), één stuurgroep van ca. 12 studenten met zes thema's, eigen draaiboek en eigen budget |
| AVF-periode VD | November 2026 t/m januari 2027 (precieze deadline volgt) |
| AVF-periode VC | April 2027 t/m half juni 2027 (precieze deadline volgt) |
| Externe partij | Rocks n Rivers (outdooractiviteiten) |
| Communicatie | Microsoft Teams blijft het communicatieplatform; de app heeft geen chat |
| Status product | Experiment; gebouwd door Bart met AI-tools, zonder HAN-ICT |

### 1.1 Probleem

Projectgroepen bereiden hun belevenis voor in losse AVF-documenten. De stuurgroep moet die informatie opnieuw uitvragen of overtypen om zicht te krijgen op kwaliteit, veiligheid, materiaal en budget. Tijdens de meerdaagse is het programma lastig terug te vinden, verandert het door het weer en is het bereik onbetrouwbaar. Ondertussen mogen andere studenten de verrassingen van een belevenis niet vooraf zien.

### 1.2 Kernidee

**Onze meerdaagse centraal.** De app geeft elk cluster overzicht over alle onderdelen van zijn eigen meerdaagse: meerdaagsethema, belevenissen, draaiboek, stuurgroepthema's, budget, materialen en meerdaagse-informatie. Het meerdaagsethema dat de studenten kiezen kleurt de uitstraling binnen de HAN-huisstijl en loopt als rode draad door de inhoud.

**Eén keer vastleggen, op meerdere plekken gebruiken.** Het AVF is een belangrijk onderdeel, maar niet het enige. Een projectgroep vult het AVF één keer gestructureerd in. Dezelfde gegevens voeden automatisch het overzicht, de zes werkpagina's van de stuurgroep, de materiaalbehoefte, het budgetoverzicht, het draaiboek en de PDF-exports.

### 1.3 Succesindicatoren

| Indicator | Streefwaarde |
| --- | --- |
| AVF | Alle belevenissen van VD en VC zijn in de app voorbereid en door de stuurgroep goedgekeurd; geen losse Word-AVF's |
| Geen dubbel werk | De stuurgroep vraagt geen informatie op die al in een AVF staat |
| Budget | Het budgetoverzicht in de app is de bron in het stuurgroepoverleg |
| Meerdaagsemodus | Studenten vinden programma, locatie en noodinformatie binnen enkele handelingen, ook zonder bereik |
| Meerdaagsethema | Studenten herkennen hun meerdaagsethema direct in de app; elke belevenis laat zien hoe ze bij het thema past |
| Afscherming | Geen enkele melding van een uitgelekte belevenis via de app |
| Leren | Evaluatie in juli 2027 levert een geprioriteerde lijst voor versie 2 op |

## 2 Onze meerdaagse: meerdaagsethema en overzicht

Een van de eerste stappen van elk cluster is het kiezen van een meerdaagsethema. Vanaf dat moment staat het thema centraal in alle onderdelen van de app: in de uitstraling (naam, sfeerbeeld, logo en accentkleur binnen de HAN-huisstijl) en in de inhoud (elke belevenis sluit aan op het thema). Het startscherm geeft iedereen overzicht over de eigen meerdaagse.

**Begrippen.** Het meerdaagsethema is het verhaal of thema van de meerdaagse dat de studenten kiezen. Een stuurgroepthema is een verantwoordelijkheidsgebied binnen de stuurgroep (hoofdstuk 4). Het stuurgroepthema Beleving & Thema bewaakt het meerdaagsethema.

### 2.1 Meerdaagsethema

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| THM-01 | Meerdaagsethema vastleggen per cluster | Naam, korte verhaallijn, sfeerbeeld, optioneel logo en slogan, accentkleur uit HAN rood, oranje, groen of blauw<br>Ingesteld door het stuurgroepthema Beleving & Thema of de docent<br>Altijd te wijzigen; de wijziging is direct overal zichtbaar | Must |
| THM-02 | Uitstraling volgt het meerdaagsethema | Binnen de HAN-basisstijl (zie 2.3) bepalen naam, sfeerbeeld, logo en accentkleur de app voor alle accounts van dat cluster: startscherm, kopbalk, kaarten en PDF-exports<br>Tekst blijft leesbaar (contrast wordt automatisch gecontroleerd)<br>Zolang er geen thema is: alleen de HAN-basisstijl met outdoorelementen | Must |
| THM-03 | Meerdaagsethema in de inhoud | Elke belevenis toont hoe ze bijdraagt aan het meerdaagsethema (AVF sectie G)<br>Het overzicht toont het meerdaagsethema boven de belevenissen<br>De werkpagina Beleving & Thema signaleert belevenissen zonder themakoppeling | Must |
| THM-04 | Themakeuze in de app | Projectgroepen of stuurgroep dienen themavoorstellen in met naam, korte pitch en beeld<br>De stuurgroep kiest; het gekozen voorstel wordt het meerdaagsethema | Should |
| THM-05 | Pre-exposure | Beleving & Thema plaatst teasers (korte tekst en beeld) met een publicatiemoment<br>Teasers verschijnen op het startscherm van het cluster<br>Nooit inhoud uit een AVF zonder dat de rol die zelf heeft overgenomen | Should |

### 2.2 Overzicht van onze meerdaagse

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| OVZ-01 | Startscherm Onze meerdaagse | Voor elk account: meerdaagsethema (naam, beeld, verhaal), aftellen tot 28 juni, de zes belevenissen met titel, publieke samenvatting en status, eerstvolgende deadlines en per stuurgroepthema een korte stand van zaken (bijv. budget, materiaal, veiligheid)<br>Inhoud past zich aan het account aan; afscherming blijft gelden | Must |
| OVZ-02 | Alles vanuit één plek | Vanuit het overzicht met één tik naar belevenissen, draaiboek, stuurgroepthema's, budget, materialen en meerdaagse-informatie<br>Vaste onderste navigatie op de telefoon | Must |
| OVZ-03 | Wat moet ik nu doen? | Per account de eerstvolgende stap, bijv. "Sectie E van jullie AVF is nog leeg", "2 verbeterverzoeken open" of "3 AVF's wachten op beoordeling" | Should |

### 2.3 Huisstijl: HAN met outdoorelementen

De basis van de app is de huisstijl van de HAN. Die wordt aangevuld met outdoorelementen die passen bij de Ardennen. Het meerdaagsethema komt daar als laag bovenop.

| Laag | Invulling |
| --- | --- |
| 1 HAN-basis | HAN rood (#E50056), wit en zwart met de HAN-grijswaarden; Roboto en Roboto Condensed als door de HAN toegestaan alternatief voor Avenir Next; HAN-logo (aan te vragen via huisstijl@han.nl). Gebruikt voor kopbalk, navigatie, knoppen, tekst en PDF-opmaak. Details in docs/huisstijl.md van het bouwpakket |
| 2 Outdoor | Eigen foto's van de editie 2022 (geselecteerd en geoptimaliseerd in Ardennen 2027/Foto's/app-klaar: vallei met viaduct, ochtend op het tentterrein, rotswand, klimmen, wandeling in de schemer, avondvuur en bivak): landschap, bos, rivier, rotsen en activiteiten, bij voorkeur zonder herkenbare gezichten; subtiele hoogtelijnen als achtergrond; iconen in lijnstijl (HAN-iconenset, tot die er is Lucide: tent, kompas, backpack, rivier, vuur, route); de secundaire HAN-kleuren oranje, groen en blauw als natuurtinten (altijd met zwarte tekst) |
| 3 Meerdaagsethema | Per cluster: naam, sfeerbeeld, optioneel logo en een accentkleur uit HAN rood, oranje, groen of blauw; zichtbaar op het startscherm, in kopbalk en kaarten en op PDF-voorbladen |

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| STL-01 | HAN-basisstijl | Kleuren, lettertype en logo als vaste ontwerpwaarden (design tokens) in één bestand<br>Alle schermen en PDF's gebruiken die waarden | Must |
| STL-02 | Outdoorelementen | Iconenset, achtergrondpatroon en minstens drie sfeerfoto's ingebouwd<br>Tertiaire HAN-kleuren alleen in grafieken<br>Geen fantasy- of donkere AI-beelden (HAN-richtlijn)<br>Afbeeldingen geoptimaliseerd voor mobiel en offline | Must |
| STL-03 | Leesbaar buiten | Hoog contrast; geen tekst over drukke foto's zonder donkere of lichte laag<br>Grote aanraakvlakken | Must |

## 3 Rollen en afscherming

| Account | Aantal | Mag | Mag niet |
| --- | --- | --- | --- |
| Docent | 1 (beide clusters) | Beide clusters volledig bekijken en bewerken; wachtwoorden van alle accounts beheren; budget, links en clusters instellen; eindverantwoordelijk voor veiligheid en doorgaan van een belevenis | - |
| Stuurgroepthema | 6 per cluster | Alles binnen het eigen cluster bekijken; AVF-inhoud niet zelf wijzigen maar verbeterverzoeken plaatsen; dag, tijd en locatie van belevenissen toewijzen; themacheck vastleggen; belevenis formeel goedkeuren; budgetaanvragen beoordelen; draaiboek, locaties, deadlines en meerdaagsemodus beheren | Het andere cluster zien; accounts beheren |
| Projectgroep | 6 per cluster | Eigen AVF volledig bekijken en bewerken; financieel plan, materiaalbehoefte en locatievoorstel indienen; draaiboek en meerdaagse-informatie van het eigen cluster bekijken | Andere AVF's inhoudelijk zien (alleen titel, publieke samenvatting en programmagegevens); goedkeuren; draaiboek wijzigen; het andere cluster zien |
| Student | 1 per cluster | Draaiboek, meerdaagse-informatie, noodinformatie en publieke samenvattingen van het eigen cluster bekijken; vooral bedoeld voor tijdens de meerdaagse | Iets bewerken; AVF-inhoud zien; het andere cluster zien |

Er zijn geen persoonlijke accounts. Elke login hoort bij een rol of groep en is niet gekoppeld aan een naam: in totaal 27 accounts (1 docent, per cluster 6 stuurgroepthema's, 6 projectgroepen en 1 student), plus 4 accounts in het fictieve oefencluster TEST. Alle stuurgroepthema's mogen alle werkpagina's en belevenissen van hun cluster bekijken. De stuurgroep wijzigt een AVF nooit zelf maar plaatst verbeterverzoeken, zodat de projectgroep eigenaar blijft. De stuurgroep wijst wel dag, tijd en locatie van elke belevenis toe.

**Wie deed wat?** Omdat een account door meerdere studenten wordt gedeeld, vraagt de app bij indienen, goedkeuren, verbeterverzoeken en budgetbesluiten om een naam (vrij tekstveld). Die naam wordt samen met het account en het tijdstip vastgelegd.

**Afscherming wordt in de database afgedwongen** (Row Level Security op cluster, projectgroep en rol). Dat geldt ook voor zoekresultaten, afbeeldingen, PDF-exports en de offline cache. Alleen knoppen verbergen is niet genoeg. Omdat wachtwoorden gedeeld worden, kan de docent elk wachtwoord met één actie vervangen als het uitlekt naar een andere groep.

## 4 Zes stuurgroepthema's

De stuurgroep heeft zes coördinerende rollen met twee studenten per rol. Samen sturen ze de zes projectgroepen aan. Elke rol heeft één gedeeld account en een werkpagina die zoveel mogelijk automatisch gevuld wordt uit de AVF's van het cluster. Namen zijn per editie aanpasbaar.

| Nr | Rol | Focus | Bron in AVF | Werkpagina toont onder meer |
| --- | --- | --- | --- | --- |
| 1 | Projectleiding | Aansturing, besluiten en groepsdynamiek | A titel, studenten, aantal, contactpersoon, dag en tijd (toewijzen); G rolverdeling en afstemming; status van alle AVF's | Stuurgroepdashboard: voortgang van alle belevenissen en rollen, deadlines en mijlpalen, besluitenlijst, open punten per rol |
| 2 | Programma & Kwaliteit | Planning, samenhang en overdracht | A verschijningsvorm en doelgroep; B; C; D organisatie, onderdelen, differentiatie en USV; G samenhang | Centraal draaiboek en planning, samenhang tussen belevenissen, volledigheid per AVF, open verbeterverzoeken, voorbereiding formele goedkeuring, overdracht via compacte uitvoeringsdraaiboeken (PDF) |
| 3 | Beleving & Thema | Verhaal, sfeer, huisstijl en pre-exposure | A publieke samenvatting; G bijdrage aan het meerdaagsethema | Meerdaagsethema en uitstraling instellen (hoofdstuk 2), samenhang met het verhaal, pre-exposure: wat deelnemers vooraf te zien krijgen (publieke samenvattingen en teasers) zonder spoilers |
| 4 | Veiligheid & Welzijn | Risicoanalyse, EHBO, weerplan en catering | D sociale en fysieke veiligheid; E volledig (incl. EHBO); G catering | Risicoanalyses per belevenis, ontbrekende weerafwegingen, weerplan, EHBO- en noodinformatie, maaltijden in het draaiboek, veiligheidscheck vóór vertrek |
| 5 | Logistiek & Facilitair | Locaties, materialen, op-/afbouw en corvee | A locatie (toewijzen); D opruimen; F materialen; G vervoer, opbouw en afbouw, corvee | Locaties en locatievoorstellen, basismaterialenlijst camping/bivak, behoefte en tekorten, op- en afbouwplanning, corveerooster |
| 6 | Communicatie & Financiën | Documenten, budget, inkoop en evaluatie | F financieel plan; H communicatie | Clusterbudget, aanvragen, goedgekeurd en besteed, inkooplijst, Forms-declaratielink, Teams-link, meerdaagse-informatie en documenten (PDF-exports); evaluatie volgt in versie 2 |

Automatische signaleringen (regelgebaseerd, geen AI): risicoanalyse ontbreekt, weerafweging ontbreekt, verantwoordelijke ontbreekt, aanvraag overschrijdt budgetruimte, materiaalbehoefte groter dan voorraad, deadline verstreken, belevenis nog niet goedgekeurd.

### 4.1 PACK: de vier vakken van je Backpack_

Elke letter is een voorwerp dat je echt in je backpack meeneemt en dat staat voor een deel van de organisatie. De app groepeert de werkpagina's van de stuurgroep en de rollen in de projectgroepen in deze vier vakken. Ondertitel van de app: "Pleister, Aansteker, Camera en Kompas: alles in je Backpack_".

| Vak | Voorwerp en betekenis | Stuurgroeprollen | Projectgroeprollen | Inhoud in de app |
| --- | --- | --- | --- | --- |
| P | Pleister: zorgen voor elkaar en meenemen wat nodig is | Veiligheid & Welzijn; Logistiek & Facilitair | Veiligheid & EHBO; Logistiek & Materialen; Catering | Risicoplan, weerplan, EHBO, eetplan, materialen, locaties, corvee |
| A | Aansteker: het vuur aansteken | Beleving & Thema; Programma & Kwaliteit | Programma & Beleving | Meerdaagsethema als rode draad, belevenissen en hun AVF's, kwaliteit en samenhang |
| C | Camera: vastleggen en delen | Communicatie & Financiën | Corvee & Communicatie | Communicatieplan, informatiepagina's, documenten, budget en inkoop |
| K | Kompas: koers houden | Projectleiding | Projectleider | Draaiboek, programma, planning, besluiten en deadlines |

### 4.2 Rollen in elke projectgroep

Iedere projectgroep heeft duidelijke rollen. Verdeel de taken onderling en leg per onderdeel één verantwoordelijke vast.

| Rol | Taken | Aanspreekpunt voor stuurgroeprol |
| --- | --- | --- |
| Projectleider | Planning, taakverdeling en afstemming | Projectleiding |
| Programma & Beleving | Activiteit, thema en deelnemerservaring | Programma & Kwaliteit; Beleving & Thema |
| Veiligheid & EHBO | Risico's, instructies en slechtweerplan | Veiligheid & Welzijn |
| Logistiek & Materialen | Locatie, vervoer, op- en afbouw | Logistiek & Facilitair |
| Catering | Eten, drinken, allergieën en uitgifte | Veiligheid & Welzijn |
| Corvee & Communicatie | Schoonmaakrooster, afspraken en draaiboek | Logistiek & Facilitair; Communicatie & Financiën |

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| PGR-01 | Rolverdeling per projectgroep | De zes rollen staan vast in de app<br>Per rol de naam van de verantwoordelijke student(en)<br>Indienen van het AVF kan pas als elke rol een verantwoordelijke heeft | Must |
| PGR-02 | Rollen gekoppeld aan het AVF | Elke AVF-sectie toont welke projectgroeprol eigenaar is (zie 5.1)<br>Verbeterverzoeken tonen de rol waarvoor ze bedoeld zijn | Must |
| PGR-03 | Rollenoverzicht voor de stuurgroep | Per stuurgroeprol een lijst van de bijbehorende projectgroeprollen in alle zes groepen, met namen | Must |

## 5 Het AVF

Het AVF (Activiteiten Voorbereidings Formulier) is een belangrijk onderdeel van de app: één AVF per belevenis, ingevuld door de projectgroep. De basis is het bestaande format (Voorbeeld AVF.pdf). Dat wordt niet één-op-één gekopieerd: de opbouw blijft herkenbaar, maar dubbelingen verdwijnen en veiligheid bij weer komt erbij.

### 5.1 Velden

Het AVF volgt de volgorde van het voorbeeld-AVF (A–G) plus een sectie H Communicatie. De volledige veldenlijst met de koppeling per veld staat in docs/avf-velden.md van het bouwpakket.

| Sectie | Velden | Verplicht bij indienen | Eigenaar projectgroep (zichtbaar) | Stuurgroep (achter de schermen) |
| --- | --- | --- | --- | --- |
| A Basisgegevens | Titel; verschijningsvorm; publieke samenvatting zonder spoilers; organiserende studenten; doelgroep en aantal deelnemers; contactpersoon; dag, tijd en locatie (toegewezen door de stuurgroep, alleen-lezen) | Alle behalve dag, tijd en locatie | Projectleider; Programma & Beleving (verschijningsvorm, doelgroep, publieke samenvatting) | K Projectleiding; A Programma & Kwaliteit; A Beleving & Thema (publieke samenvatting); P Logistiek & Facilitair (locatie) |
| B Beginsituatie | Algemene omschrijving; motorisch, cognitief, sociaal-emotioneel ("x van de y deelnemers ...") | Algemeen en minstens één domein | Programma & Beleving | A Programma & Kwaliteit |
| C Doelen | Activiteitsdoelen per domein, meetbaar; persoonlijke leerdoelen per organiserende student | Minstens één activiteitsdoel | Programma & Beleving (leerdoelen: Projectleider verzamelt) | A Programma & Kwaliteit |
| D Kop–romp–staart | Per fase: organisatievorm met overzichtstekening, coachen en instructies, stemgebruik en houding, opruimen (6 W's), materialen. Per onderdeel: naam, duur, beschrijving, sociale en fysieke veiligheid, differentiatie, groepsaanpassing, USV | Elke fase minstens één onderdeel met beschrijving en fysieke veiligheid | Programma & Beleving; Veiligheid & EHBO (veiligheid); Corvee & Communicatie (opruimen) | A Programma & Kwaliteit; P Veiligheid & Welzijn (veiligheid); P Logistiek & Facilitair (opruimen, materialen) |
| E Veiligheid, EHBO en weer | Overkoepelende risico's en maatregelen; vier weerscenario's met relevantie, maatregel, alternatief, stopcriterium en beslisser; aanvullende EHBO-maatregelen nodig ja/nee: zo ja welke (wie, waar, middelen), zo nee verwijzing naar het algemene EHBO-plan van de stuurgroep | Risico's, alle vier weerscenario's (mag "niet relevant") en de EHBO-vraag | Veiligheid & EHBO | P Veiligheid & Welzijn |
| F Materialen en financiën | Materialen uit de basislijst met aantal per locatie (automatisch aangevuld uit D); aanvullende materialen; financieel plan met regels | Nee (leeg mag) | Logistiek & Materialen (materialen); Projectleider (financieel plan) | P Logistiek & Facilitair; C Communicatie & Financiën (financieel plan) |
| G Thema en organisatie | Bijdrage aan het meerdaagsethema; samenhang met het programma; rolverdeling (zie 4.2); vervoer, opbouw en afbouw; catering (eten, drinken, uitgifte, rekening gehouden met allergieën, zonder namen of medische details); corvee en schoonmaakrooster; afstemming met anderen | Bijdrage aan thema, rolverdeling | Programma & Beleving (thema, samenhang); Projectleider (rolverdeling, afstemming); Logistiek & Materialen (vervoer, op- en afbouw); Catering; Corvee & Communicatie (corvee) | A Beleving & Thema; A Programma & Kwaliteit; K Projectleiding; P Logistiek & Facilitair; P Veiligheid & Welzijn (catering) |
| H Communicatie | Voor: wat deelnemers vooraf moeten weten en meenemen (kleding, spullen, verzamelpunt en -tijd). Tijdens: instructies en signalen, bereikbaarheid van de organisatoren, wie communiceert bij een calamiteit. Na: afsluiting, terugkoppeling aan deelnemers en stuurgroep, foto's of resultaten delen | Voor en tijdens | Corvee & Communicatie | C Communicatie & Financiën |

**Koppeling achter de schermen.** Elk AVF-veld is in de app gekoppeld aan één projectgroeprol en één stuurgroeprol (met PACK-vak). Projectgroepen zien alleen hun eigen projectgroeprol per sectie; de stuurgroepkoppeling is voor hen niet zichtbaar. Het stuurgroepdashboard gebruikt die koppeling: elke stuurgroeprol ziet precies de velden uit alle zes AVF's die bij zijn rol horen.

### 5.2 Vereenvoudigingen ten opzichte van het oude format

- USV "veilig" en "fysieke veiligheid" overlappen: de app toont bij "veilig" de ingevulde fysieke veiligheid en vraagt alleen een aanvulling als die nodig is.
- Differentiatie en groepsaanpassing worden vier korte velden (individu moeilijker/makkelijker, groep moeilijker/makkelijker) in plaats van vrije tekst.
- Materialen worden per fase gekozen uit de basislijst en tellen automatisch op tot de materiaalbehoefte in F; geen losse materiaallijst meer overtypen.
- Organisatievorm, coachen, stemgebruik en opruimen staan per fase, niet per onderdeel, zoals in het oude format.
- Nieuw ten opzichte van het oude format: publieke samenvatting, weerscenario's, EHBO-vraag, bijdrage aan het meerdaagsethema, financieel plan en sectie H Communicatie (voor, tijdens en na).

Docenten bevestigen deze vereenvoudigingen bij OD-01.

### 5.3 Eisen

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| AVF-01 | Gestructureerd AVF per belevenis | Secties A–H<br>Automatisch opslaan<br>Voortgang per sectie (niet gestart, onvolledig, compleet)<br>Eenvoudige opmaak: kopjes, opsommingen, vet | Must |
| AVF-02 | Kop–romp–staart met onderdelen | Onderdelen toevoegen, verwijderen en verschuiven per fase<br>Per onderdeel kan veiligheid/differentiatie/USV worden uitgewerkt of als "niet van toepassing" gemarkeerd | Must |
| AVF-03 | Weerscenario's | Alle vier scenario's moeten zijn afgewogen vóór indienen<br>32 °C en 18 °C zijn voorbeeldgrenzen, geen automatische norm | Must |
| AVF-04 | Afbeeldingen | Uploaden bij secties en onderdelen met bijschrift<br>Automatisch verkleind<br>Geen PDF-, Word- of PowerPointbijlagen | Must |
| AVF-05 | Publieke samenvatting | Apart veld; andere projectgroepen zien alleen titel, dit veld en programmagegevens<br>Nooit automatisch afgeleid uit AVF-inhoud | Must |
| AVF-06 | Status en goedkeuring | In ontwikkeling → ingediend → aanpassing gevraagd → goedgekeurd<br>Eén formele goedkeuring door een stuurgroepthema-account; account, ingevulde naam en tijd worden vastgelegd | Must |
| AVF-07 | Verbeterverzoeken | Per sectie of onderdeel<br>Status open, aangepast, afgehandeld<br>Geen chatfunctie | Must |
| AVF-08 | Themachecks | Elk thema kan per AVF een check vastleggen (akkoord of aandachtspunt)<br>Zichtbaar vóór de formele goedkeuring<br>Blokkeert goedkeuring niet automatisch | Should |
| AVF-09 | Wijziging na goedkeuring | Een goedgekeurd AVF blijft voor de projectgroep bewerkbaar<br>Wezenlijke wijziging (verschijningsvorm, onderdelen, fysieke veiligheid, sectie E of materialen) geeft het label "Opnieuw te controleren" tot de stuurgroep opnieuw goedkeurt<br>Financieel plan ligt na goedkeuring vast; extra kosten via een losse aanvraag | Must |
| AVF-10 | Planning toewijzen | Stuurgroep wijst per belevenis dag, start- en eindtijd en locatie toe<br>Waarschuwing bij overlap op dezelfde locatie<br>Projectgroep ziet de planning bovenaan het AVF | Must |
| AVF-11 | Veldkoppeling | Eén configuratiebestand legt per AVF-veld vast: sectie, label, verplicht, projectgroeprol, stuurgroeprol, PACK-vak en of een wijziging wezenlijk is<br>Alle schermen, controles en dashboards lezen deze koppeling<br>De stuurgroepkoppeling is niet zichtbaar voor projectgroepen | Must |

## 6 Overige functionele eisen

### 6.1 Accounts

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| ACC-01 | Gedeelde rol- en groepsaccounts | Inloggen met gebruikersnaam en wachtwoord (bijv. vd-projectgroep-3)<br>Blijft ingelogd op het apparaat<br>Geen persoonlijke accounts, geen HAN-SSO | Must |
| ACC-02 | Accountbeheer door docent | Docent maakt de 27 accounts aan, geeft groepen en thema's een naam en kan elk wachtwoord resetten<br>Na een reset moet iedereen met dat account opnieuw inloggen | Must |
| ACC-03 | Gelijktijdig werken | Meerdere studenten kunnen tegelijk met hetzelfde projectgroepaccount werken<br>Opslaan per veld of onderdeel, zodat ze elkaars werk niet overschrijven<br>Waarschuwing als iemand anders hetzelfde onderdeel net heeft gewijzigd | Must |

### 6.2 Stuurgroep

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| STG-01 | Stuurgroepdashboard per cluster | Voortgang en status van alle zes belevenissen<br>Open verbeterverzoeken<br>Deadlines<br>Budget, materiaaltekorten en veiligheidssignalen | Must |
| STG-02 | Dashboard per stuurgroeprol | Stuurgroepdashboard ingedeeld in de vier PACK-vakken met daaronder de zes rollen<br>Per rol een overzicht van alle zes AVF's met alleen de velden die bij die rol horen: ingevuld of leeg, laatste wijziging, open verbeterverzoeken<br>Vanuit een veld direct naar die plek in het AVF en een verbeterverzoek plaatsen (automatisch gericht aan de juiste projectgroeprol)<br>Inhoud verder volgens hoofdstuk 4<br>Ruimte voor besluiten en notities per rol<br>Projectleiding houdt een besluitenlijst bij (besluit, datum, ingevulde naam) | Must |
| STG-03 | Deadlines en mijlpalen | Voor alle groepen of één groep<br>Altijd aanpasbaar, met wie en wanneer<br>Verlopen deadlines gemarkeerd | Must |

### 6.3 Budget

Budgetbeheer is een overzicht voor de stuurgroep. Aankopen doen studenten zelf; declareren gaat via Microsoft Forms en docenten betalen terug buiten de app.

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| BUD-01 | Clusterbudget | Eén budget per cluster, startbedrag € 250, aanpasbaar door stuurgroep en docent<br>Geen vast budget per projectgroep | Must |
| BUD-02 | Aanvraag vanuit AVF | Het financieel plan in sectie F wordt een aanvraag<br>De rol Communicatie & Financiën (of een andere stuurgroeprol) kent toe, past het bedrag aan of geeft de aanvraag terug met toelichting<br>De projectgroep ziet direct het besluit en de toelichting | Must |
| BUD-06 | Losse aanvraag | Na goedkeuring van het AVF kan een projectgroep een extra aanvraag indienen (omschrijving, bedrag, toelichting)<br>Zelfde afhandeling als BUD-02 | Must |
| BUD-03 | Budgetoverzicht | Per belevenis en totaal: aangevraagd, goedgekeurd, besteed en resterende ruimte<br>Waarschuwing bij overschrijding<br>Geen dubbeltelling<br>Een projectgroep ziet alleen de eigen aanvragen en de resterende ruimte van het cluster, niet de aanvragen van andere groepen | Must |
| BUD-04 | Besteed bedrag | Werkelijke kosten handmatig in te vullen na aankoop<br>De app claimt nooit dat een declaratie is ontvangen of betaald | Should |
| BUD-05 | Forms- en Teams-link | Instelbare links per cluster met korte instructie<br>Geen bankgegevens of bonnetjes in de app | Must |

### 6.4 Materialen, corvee en inkoop

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| MAT-00 | Materialenlijst beheren | Logistiek & Facilitair en de docent voegen materialen toe, wijzigen ze en zetten ze op inactief<br>Per item: naam, categorie, voorraad camping, voorraad bivak, opmerking | Must |
| MAT-01 | Gedeelde basismaterialenlijst | Eén lijst voor beide clusters met voorraad per locatie (camping, bivak)<br>Niet dubbel per cluster | Must |
| MAT-02 | Behoefte vanuit AVF | Projectgroep kiest in het AVF materiaal en aantal per locatie uit de actuele lijst en ziet daarbij de beschikbare voorraad<br>Wijzigingen in de lijst werken direct door in alle AVF's; een materiaal dat inactief wordt of te weinig voorraad heeft geeft een melding bij de betrokken projectgroepen<br>Stuurgroep ziet totale behoefte en tekorten per locatie en kan aantallen corrigeren | Must |
| MAT-03 | Check en meldingen | Materiaalcheck bij aankomst en vertrek<br>Melding van ontbrekend of beschadigd materiaal met aantal en toelichting | Should |
| LOG-01 | Corveerooster | Corveetaken per dagdeel en locatie gekoppeld aan projectgroepen<br>Zichtbaar in het draaiboek en de meerdaagsemodus | Should |
| FIN-01 | Inkooplijst | Goedgekeurde budgetregels en ontbrekende materialen vormen samen een inkooplijst met status (te kopen, gekocht) | Should |

### 6.5 Draaiboek en locaties

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| PRG-01 | Centraal draaiboek per cluster | Belevenissen, maaltijden, verplaatsingen, Rocks n Rivers en overige onderdelen<br>Parallelle onderdelen<br>Gekoppelde groepen en locatie<br>Filter op dag, dagdeel, groep en locatie | Must |
| PRG-02 | Koppeling met AVF | Een belevenis in het draaiboek haalt tijd en locatie uit het AVF<br>Andere studenten zien geen afgeschermde details | Must |
| PRG-03 | Wijzigen | Alleen stuurgroep en docent<br>Gewijzigde onderdelen gemarkeerd met wie en wanneer | Must |
| PRG-04 | Locaties | Centrale lijst met naam, adres, kaartlink en tekstuele routebeschrijving<br>Projectgroep kan een locatie voorstellen; stuurgroep accepteert of wijst af | Must |

### 6.6 Meerdaagse-informatie en meerdaagsemodus

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| KAM-01 | Meerdaagse-informatie | Vaste pagina met A Veiligheid en noodinformatie (noodnummers, adressen, verzamelpunten, procedures bij onweer, hitte, regen en kou) en B Algemene info (regels, maaltijden, wisseling camping/bivak, routes)<br>Contactpersonen met aanklikbare telefoonnummers | Must |
| KAM-02 | Meerdaagsemodus per cluster | Handmatig aan en uit door stuurgroep of docent<br>Startscherm: eerstvolgend onderdeel, vandaag, noodinformatie, locaties, contacten | Must |
| KAM-03 | Offline lezen | Draaiboek, meerdaagse-informatie, noodinformatie, contacten en eigen AVF zijn offline leesbaar<br>Laatste synchronisatietijd en waarschuwing voor mogelijke veroudering altijd zichtbaar | Must |

### 6.7 Zoeken en informatie

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| ZOE-01 | Zoekfunctie | Eén zoekbalk, altijd bereikbaar<br>Zoekt in belevenissen, AVF-inhoud, draaiboek, informatiepagina's, locaties, materialen en contacten<br>Resultaten gegroepeerd per soort met de zoekterm gemarkeerd<br>Toont alleen wat het account mag zien (studenten binnen hun eigen rechten, docent in beide clusters) | Must |
| ZOE-02 | Zoeken zonder bereik | Zoeken werkt ook in de offline opgeslagen gegevens | Should |
| INF-01 | Informatiepagina's door de stuurgroep | Stuurgroepleden maken en wijzigen informatiepagina's per cluster (bijv. paklijst, regels, praktische info, veelgestelde vragen) met eenvoudige opmaak en afbeeldingen<br>Elke pagina toont wanneer en door wie (ingevulde naam) hij is bijgewerkt<br>Zichtbaar voor alle accounts van het cluster en offline beschikbaar | Must |
| INF-03 | Algemeen EHBO-plan | Veiligheid & Welzijn maakt per cluster een informatiepagina met het algemene EHBO-plan (EHBO'ers, posten, procedure, noodnummers)<br>AVF sectie E verwijst ernaar als de projectgroep geen aanvullende maatregelen nodig heeft<br>Zolang het plan er nog niet is, staat er "Het algemene EHBO-plan volgt" | Must |
| INF-02 | Geen chat, wel Teams | Geen chat, reacties of pushmeldingen in de app<br>Korte termijn mededelingen gaan via Teams; de app toont een vaste knop naar het Teams-kanaal van het cluster | Must |

### 6.8 PDF-export

| ID | Eis | Acceptatiecriteria | Prio |
| --- | --- | --- | --- |
| PDF-01 | Volledig AVF | Alle secties met afbeeldingen | Must |
| PDF-02 | Compact uitvoeringsdraaiboek per belevenis | Tijd, locatie, verloop kop–romp–staart, materialen, begeleiding, belangrijkste risico's en weerplan | Must |
| PDF-03 | Centraal draaiboek | Per dag, dagdeel of periode met parallelle onderdelen | Must |

PDF's maken we eerst via een printvriendelijke weergave (browser: opslaan als PDF). Exports respecteren dezelfde rechten als het scherm.

## 7 Bewust niet in versie 1

| Onderdeel | Waarom later |
| --- | --- |
| Docentfeedback per belevenis | Besluit 4 november: versie 2 |
| Sjablonen, nieuwe editie en archief | Besluit 4 november: versie 2. Het datamodel houdt wel rekening met edities. |
| Offline bewerken met wachtrij en conflictafhandeling | Grootste technische risico; versie 1 is offline alleen-lezen |
| Pushmeldingen | Teams blijft het kanaal voor urgente berichten |
| Server-side PDF met vaste huisstijl | Printweergave volstaat voor versie 1 |
| Chat, aanwezigheidsregistratie, cijfers of rubrics | Buiten het doel van de app |

## 8 Privacy en veiligheid

- Geen persoonsgegevens in accounts. Alleen namen die studenten zelf invullen bij acties en bij "betrokken studenten" in het AVF. Allergieën en dieetwensen van deelnemers staan nooit per persoon in de app; Catering regelt die buiten de app. Geen e-mailadressen, studentnummers, medische of andere bijzondere gegevens, bankgegevens of bonnetjes.
- Afscherming per cluster, groep en rol in de database (zie hoofdstuk 3).
- Afbeeldingen in privéopslag met dezelfde rechten als het AVF.
- Hosting en database in de EU.
- Testen en demonstreren alleen met fictieve studenten.
- De app is een experiment buiten HAN-ICT en zonder tussenkomst van HAN-privacyfunctionarissen. Dataminimalisatie en afscherming zijn daarom de belangrijkste waarborgen.
- De goedkeuring door de stuurgroep vervangt nooit de eindverantwoordelijkheid van docenten voor veiligheid.

## 9 Techniek (voorgesteld)

| Onderdeel | Keuze |
| --- | --- |
| Frontend | React met TypeScript (Next.js) als PWA; Tailwind; hosting op Vercel |
| Database, login, opslag | Supabase in een EU-regio: Postgres, Auth (gebruikersnaam en wachtwoord), Storage voor afbeeldingen, Row Level Security |
| Offline | Service worker en IndexedDB-momentopname per gebruiker (alleen data waar die gebruiker recht op heeft) |
| PDF | Printstylesheet |
| Code | GitHub, zodat een collega het kan overnemen |
| Abonnement | Eén Supabase-project, gratis abonnement. Tot de livegang met testdata; daarna een fictief oefencluster TEST in hetzelfde project. Een dagelijkse geplande aanroep (Vercel Cron) houdt website en database actief; een wekelijkse export via GitHub Actions dient als back-up |

Het conceptuele datamodel uit hoofdstuk 23 van het achtergronddocument is de bouwrichting. Voor versie 1 vallen templates, lecturer_feedback en sync_operations af. Users en memberships worden vervangen door één tabel met 27 accounts (rol, cluster, projectgroep of thema). Bij acties wordt naast het account een ingevulde naam opgeslagen. Clusters krijgen velden voor het meerdaagsethema (naam, verhaal, sfeerbeeld, logo, kleuren); de app zet die om in een themastijl via CSS-variabelen bovenop de HAN-basisstijl.

## 10 Opleverdoel

**Eerste werkbare versie: half november 2026.** Daarin kan elk cluster zijn meerdaagsethema instellen, ziet iedereen het overzicht van de eigen meerdaagse in de uitstraling van dat thema, kunnen de VD-projectgroepen hun AVF voorbereiden en kan de stuurgroep beoordelen en goedkeuren. De app wordt daarna doorontwikkeld tot de meerdaagse van 28–30 juni 2027. Must gaat vóór Should.

## 11 Open beslissingen

| ID | Beslissing | Wie | Uiterlijk |
| --- | --- | --- | --- |
| OD-01 | AVF-velden en vereenvoudigingen bevestigen (hoofdstuk 5.1 en 5.2) | Docenten | Vóór half november 2026 |
| OD-02 | Hoe het meerdaagsethema wordt gekozen (in de app via voorstellen of daarbuiten); uitgangspunt is één eigen meerdaagsethema per cluster | Docenten | Vóór half november 2026 |
| OD-03 | Precieze AVF-deadlines VD en VC | Docenten | Half november 2026 |
| OD-04 | Welke wijzigingen na goedkeuring "opnieuw te controleren" opleveren | Docenten en stuurgroep | December 2026 |
| OD-05 | Docentvrijgave veiligheid als aparte status of als vinkje | Docenten | Voorjaar 2027 |
| OD-06 | Dagindeling van de meerdaagse, wisselmomenten camping/bivak, adressen | Docenten | April 2027 |
| OD-07 | Bewaartermijn en verwijderen van gegevens na de meerdaagse | Docenten | Vóór juni 2027 |
| OD-08 | Maximale afbeeldingsgrootte en toegestane formaten | Bart | Vóór half november 2026 |
| OD-09 | HAN-logo (SVG) en HAN-iconenset aanvragen via huisstijl@han.nl | Bart | Zo snel mogelijk |
| OD-10 | Hoe wachtwoorden veilig bij groepen komen (bijv. via het eigen Teams-kanaal van de groep) | Docenten | Vóór half november 2026 |

## 12 Acceptatiescenario's

- Het stuurgroepthema Beleving & Thema van VD stelt het meerdaagsethema in met naam, sfeerbeeld en drie kleuren. Na verversen zien alle VD-accounts de nieuwe naam en uitstraling op het startscherm en in een PDF-export; VC ziet er niets van.
- Projectgroep 3 van VD vult kop, romp en staart in met drie onderdelen, voegt een organisatietekening toe en weegt alle vier weerscenario's af. Indienen lukt pas als de verplichte velden compleet zijn.
- Iemand van projectgroep 3 opent een andere VD-belevenis en ziet alleen titel en publieke samenvatting. Via een directe link of API-aanroep naar een VC-belevenis krijgt hij niets.
- Het account Veiligheid & Welzijn plaatst een verbeterverzoek bij sectie E. De projectgroep past aan en dient opnieuw in. Een stuurgroepthema-account keurt goed; account, ingevulde naam en tijd worden vastgelegd.
- Het financieel plan van € 60 verschijnt als aanvraag. De stuurgroep keurt € 50 goed; het budgetoverzicht toont € 50 goedgekeurd en € 200 ruimte van € 250.
- Twee projectgroepen vragen samen meer bivakmateriaal dan de voorraad: de werkpagina Logistiek & Facilitair toont het tekort.
- Een stuurgroepthema-account verplaatst een belevenis naar een ander tijdstip. Een student ziet na verversen de wijziging gemarkeerd. In vliegtuigmodus blijven draaiboek en noodinformatie zichtbaar met de synchronisatietijd.
- Twee studenten werken tegelijk met hetzelfde projectgroepaccount aan verschillende onderdelen van de romp; beide wijzigingen blijven bewaard. De docent reset het wachtwoord van projectgroep 2; ingelogde apparaten moeten opnieuw inloggen.