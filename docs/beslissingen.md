# Beslissingen

| Datum | Besluit | Reden |
|---|---|---|
| 2026-11-04 | Experiment buiten HAN-ICT, zonder tussenkomst van HAN-privacyfunctionarissen | Kleinschalig experiment; dataminimalisatie en afscherming als waarborg |
| 2026-11-04 | Gedeelde accounts per rol of groep (27), geen persoonlijke accounts | Eenvoud en geen persoonsgegevens |
| 2026-11-04 | Offline alleen lezen; geen offline bewerken | Grootste technische risico |
| 2026-11-04 | Docentfeedback, sjablonen en archief naar versie 2 | Focus eerste versie |
| 2026-11-05 | Overal "meerdaagse" in plaats van "kamp"; HAN-huisstijl met outdoorelementen; meerdaagsethema als laag erbovenop | Besluit Bart |
| 2026-11-13 | Zes stuurgroeprollen en zes projectgroeprollen volgens PRD hoofdstuk 4 | Besluit Bart |
| 2026-11-13 | Eerste bouw = opdracht 1–5 (kern, thema, AVF, materialen en budget) | Besluit Bart |
| 2026-11-13 | Projectgroep ziet eigen budgetaanvragen en de resterende clusterruimte | Besluit Bart |
| 2026-11-13 | Supabase gratis abonnement met eigen export en wekelijkse geplande taak | Besluit Bart |
| 2026-11-13 | Stuurgroep wijzigt AVF-inhoud nooit zelf; alleen verbeterverzoeken | Projectgroep blijft eigenaar |
| 2026-11-13 | Stuurgroep wijst dag, tijd en locatie van elke belevenis toe | Besluit Bart |
| 2026-11-13 | Goedgekeurd AVF blijft bewerkbaar; wezenlijke wijziging geeft "Opnieuw te controleren" | Besluit Bart |
| 2026-11-13 | HAN-huisstijl volgens blog3.han.nl/huisstijl: HAN rood #E50056, wit, zwart, grijswaarden; secundair oranje, groen, blauw als outdoorlaag; Roboto als alternatief voor Avenir Next; accentkleur thema uit rood, oranje, groen of blauw | HAN-huisstijlregels |
| 2026-11-13 | De app heet Backpack_ (underscore naar HAN_); de backpack is de metafoor | Besluit Bart |
| 2026-11-13 | PACK-indeling: Pleister (Veiligheid & Welzijn, Logistiek & Facilitair), Aansteker (Beleving & Thema, Programma & Kwaliteit), Camera (Communicatie & Financiën), Kompas (Projectleiding) | Besluit Bart |
| 2026-11-13 | HAN-logo's uit Barts map gebruiken (PNG, 2019); kopbalk wit omdat er geen witte logovariant is | Logo alleen op wit volgens HAN-regels |
| 2026-11-13 | AVF krijgt sectie H Communicatie (voor, tijdens en na) | Besluit Bart |
| 2026-11-13 | AVF sectie E: aanvullende EHBO-maatregelen ja/nee; nee = verwijzing naar algemeen EHBO-plan van de stuurgroep | Besluit Bart |
| 2026-11-13 | Financieel plan in het AVF valt onder de Projectleider | Besluit Bart |
| 2026-11-13 | Elk AVF-veld gekoppeld aan projectgroeprol, stuurgroeprol en PACK-vak; stuurgroepkoppeling niet zichtbaar voor projectgroepen; dashboard per PACK-vak en rol | Besluit Bart |
| 2026-11-13 | PACK is een speelse indeling, niet te zwaar maken | Besluit Bart |
| 2026-11-13 | Eén Supabase-project (gratis); testdata tot livegang, daarna oefencluster TEST in hetzelfde project | Ruimte voor één gratis project |
| 2026-11-13 | Blijf-actief: dagelijkse Vercel Cron naar /api/blijf-actief met kleine Supabase-query, plus wekelijkse export via GitHub Actions | Voorkomt pauze na een week inactiviteit |
| 2026-11-13 | `budget_totaal` staat in aparte tabel `cluster_budget` (docent en stuurgroep van het cluster) in plaats van op `cluster` | Row Level Security werkt per rij; projectgroepen en studenten mogen het totaalbedrag niet lezen |
| 2026-11-13 | `wijziging` krijgt extra kolommen `cluster_id` en `projectgroep_id` | Nodig om het logboek per cluster en per groep af te schermen |
| 2026-11-13 | Afschermingstests draaien met Vitest tegen het Supabase-project (geen Docker) | Eenvoudiger voor Bart; testaccounts bestaan al in het project |
| 2026-11-13 | Webadres voorlopig https://back-pack-one.vercel.app (Vercel, team iXperium Sport en Bewegen) | Open punt 6: tijdelijke keuze `<projectnaam>.vercel.app` |
| 2026-11-13 | De naam wordt overal geschreven als BackPACK_ (PACK in hoofdletters, met underscore), ook in lopende tekst en in het manifest | Besluit Bart; vervangt de schrijfwijze Backpack_ |
| 2026-11-13 | Meerdaagsethema per cluster: de stuurgroep bedenkt het thema zelf en voegt het plaatje toe (eigen upload of een outdoorfoto uit assets/fotos); één accentkleur uit rood, oranje, groen of blauw; PRD-zin over "drie kleuren" vervalt | Besluit Bart; bouwvolgorde en huisstijl gaan voor het PRD |
| 2026-11-13 | Beginwaarden: geen enkel cluster heeft een thema; het startscherm toont "Meerdaagsethema nog niet gekozen" met uitleg (VD heette eerder Oerspelen in de testdata) | Besluit Bart; de stuurgroep kiest het thema zelf |
| 2026-11-13 | Vast programma met zes tijdvakken voor belevenissen per cluster, één projectgroep per tijdvak (afgedwongen door de database); tijd komt altijd uit het programma; tijdvak en locatie kan de projectgroep nooit wijzigen | Besluit Bart; vervangt de losse velden dag, starttijd en eindtijd in het AVF |
| 2026-11-13 | Programma en toewijzing worden beheerd door de stuurgroep (aandachtsgebied Programma & Kwaliteit); in de database hebben alle stuurgroepaccounts dezelfde rechten; locatie en tijden zijn door de stuurgroep aan te passen | Besluit Bart; vervangt het eerdere besluit dat Projectleiding de tijd en Logistiek & Facilitair de locatie toewijst |
| 2026-11-13 | Eerste versie van het centrale programma (PRG-01) gaat mee in opdracht 3; de rest van het draaiboek volgt in opdracht 6 | Het programma bepaalt hoe het AVF zijn tijd krijgt |
| 2026-11-13 | De titel "Hike naar het kamp" en "Kamp inrichten" worden in de app "Hike naar de camping" en "Camping inrichten" | Het woord "kamp" gebruiken we niet |
| 2026-11-13 | Elk cluster heeft zijn eigen programma: VD begint op de camping en gaat dinsdagavond naar het bivak; VC is gespiegeld (eerst bivak, dinsdagavond naar de camping). Tijdvakken en organisatoren zijn voor beide clusters gelijk. TEST gebruikt het programma van VD | Bart: het eerst gestuurde programma is dat van VD, VC heeft een ander programma |
| 2026-11-13 | Verschijningsvorm: één of meer van Spel, Wedstrijd, Avontuur, Gezondheid, Recreatie en Show; de oude opties (Tocht, Workshop, Anders) zijn vervallen en bestaande waarden daarvan zijn geleegd | Besluit Bart |
| 2026-11-13 | De locatie van een belevenis kiest de stuurgroep (op de Programma-pagina) uit Camping, Bivak of Anders met een zelf in te vullen naam; projectgroepen kunnen de locatie niet wijzigen | Besluit Bart; sluit aan op het eerdere besluit dat tijdvak en locatie niet door projectgroepen worden aangepast |
| 2026-11-13 | Navigatie in het AVF: vaste sectiebalk, grote vorige- en volgende-knoppen, terugknoppen en een hoofdmenu dat bij onderliggende schermen de juiste knop markeert | Besluit Bart: na een AVF-blokje moet je gemakkelijk naar het volgende of vorige kunnen |
