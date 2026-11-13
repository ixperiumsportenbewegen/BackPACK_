# AVF-velden en koppeling met de stuurgroep

Dit is de bron voor het configuratiebestand `src/config/avf-velden.ts` (PRD AVF-11). Elk veld heeft:
- **sleutel** – pad in de database (zie `datamodel.md`)
- **verplicht** – nodig om in te dienen (✔), voorwaardelijk (◐) of niet (–)
- **PG-rol** – eigenaar in de projectgroep; zichtbaar voor de projectgroep
- **SG-rol** – stuurgroeprol die het veld volgt; **niet zichtbaar voor projectgroepen**
- **PACK** – vak op het stuurgroepdashboard
- **W** – wezenlijk: een wijziging na goedkeuring geeft "Opnieuw te controleren"

Afkortingen PG-rol: PL Projectleider · PB Programma & Beleving · VE Veiligheid & EHBO · LM Logistiek & Materialen · CA Catering · CC Corvee & Communicatie
Afkortingen SG-rol: PRL Projectleiding · P&K Programma & Kwaliteit · B&T Beleving & Thema · V&W Veiligheid & Welzijn · L&F Logistiek & Facilitair · C&F Communicatie & Financiën

## A Basisgegevens
| Sleutel | Label | Verplicht | PG-rol | SG-rol | PACK | W |
|---|---|---|---|---|---|---|
| `titel` | Titel van de belevenis | ✔ | PL | PRL | K | |
| `verschijningsvorm` | Verschijningsvorm (spel, wedstrijd, tocht, workshop, anders) | ✔ | PB | P&K | A | ✔ |
| `publieke_samenvatting` | Publieke samenvatting (zonder spoilers) | ✔ | PB | B&T | A | |
| `organiserende_studenten` | Organiserende studenten | ✔ | PL | PRL | K | |
| `doelgroep` | Doelgroep | ✔ | PB | P&K | A | |
| `aantal_deelnemers` | Aantal deelnemers | ✔ | PL | PRL | K | |
| `contactpersoon` | Contactpersoon tijdens de belevenis | ✔ | PL | PRL | K | |
| `dag`, `starttijd`, `eindtijd` | Dag en tijd (toegewezen) | – (alleen-lezen) | – | PRL (wijst toe) | K | |
| `locatie_id` / `locatie_tekst` | Locatie (toegewezen) | – (alleen-lezen) | – | L&F (wijst toe) | P | |

## B Beginsituatie
| Sleutel | Label | Verplicht | PG-rol | SG-rol | PACK | W |
|---|---|---|---|---|---|---|
| `beginsituatie.algemeen` | Algemene omschrijving van de groep | ✔ | PB | P&K | A | |
| `beginsituatie.motorisch` | Motorische beginsituatie | ◐ minstens één domein | PB | P&K | A | |
| `beginsituatie.cognitief` | Cognitieve beginsituatie | ◐ | PB | P&K | A | |
| `beginsituatie.sociaal_emotioneel` | Sociaal-emotionele beginsituatie | ◐ | PB | P&K | A | |

## C Doelen
| Sleutel | Label | Verplicht | PG-rol | SG-rol | PACK | W |
|---|---|---|---|---|---|---|
| `doelen.motorisch` | Motorisch doel | ◐ minstens één doel | PB | P&K | A | |
| `doelen.cognitief` | Cognitief doel | ◐ | PB | P&K | A | |
| `doelen.sociaal_emotioneel` | Sociaal-emotioneel doel | ◐ | PB | P&K | A | |
| `doelen.persoonlijk[]` | Persoonlijke leerdoelen (naam, doel) | – | PL (verzamelt) | P&K | A | |

## D Kop–romp–staart
Per fase (`avf_fase`, voor kop, romp en staart):
| Sleutel | Label | Verplicht | PG-rol | SG-rol | PACK | W |
|---|---|---|---|---|---|---|
| `organisatievorm` | Organisatievorm | ✔ | PB | P&K | A | |
| `overzichtstekening_pad` | Overzichtstekening | – | PB | P&K | A | |
| `coachen_instructies` | Coachen en instructies | ✔ | PB | P&K | A | |
| `stemgebruik_houding` | Stemgebruik en houding | – | PB | P&K | A | |
| `opruimen` | Opruimen volgens de 6 W's | ✔ | CC | L&F | P | |

Per onderdeel (`avf_onderdeel`):
| Sleutel | Label | Verplicht | PG-rol | SG-rol | PACK | W |
|---|---|---|---|---|---|---|
| (toevoegen/verwijderen) | Onderdelen | ✔ minstens één per fase | PB | P&K | A | ✔ |
| `naam`, `duur_minuten`, `beschrijving` | Naam, duur, beschrijving | ✔ | PB | P&K | A | |
| `sociale_veiligheid` | Sociale veiligheid | – | VE | V&W | P | |
| `fysieke_veiligheid` | Fysieke veiligheid | ✔ | VE | V&W | P | ✔ |
| `individu_*`, `groep_*` | Differentiatie en groepsaanpassing | – | PB | P&K | A | |
| `usv_uitdagend`, `usv_speelbaar` | USV: uitdagend, speelbaar | – | PB | P&K | A | |
| `usv_veilig_aanvulling` | USV: veilig (aanvulling op fysieke veiligheid) | – | VE | V&W | P | |

## E Veiligheid, EHBO en weer
| Sleutel | Label | Verplicht | PG-rol | SG-rol | PACK | W |
|---|---|---|---|---|---|---|
| `veiligheid.risicos[]` | Risico's (risico, maatregel, wie) | ✔ minstens één | VE | V&W | P | ✔ |
| `veiligheid.weer.*` | Vier weerscenario's | ✔ alle vier afgewogen | VE | V&W | P | ✔ |
| `veiligheid.ehbo.aanvullend` | Zijn aanvullende EHBO-maatregelen nodig? (ja/nee) | ✔ | VE | V&W | P | ✔ |
| `veiligheid.ehbo.maatregelen` | Welke? (wie, waar, middelen) | ◐ als ja | VE | V&W | P | ✔ |

Bij "nee" toont de app: "Voor deze belevenis geldt het algemene EHBO-plan" met een link naar de informatiepagina van Veiligheid & Welzijn (INF-03). Zolang die pagina er niet is: "Het algemene EHBO-plan volgt".

## F Materialen en financiën
| Sleutel | Label | Verplicht | PG-rol | SG-rol | PACK | W |
|---|---|---|---|---|---|---|
| `avf_materiaal` (basislijst) | Materialen per fase en locatie | – | LM | L&F | P | ✔ |
| `avf_materiaal` (aanvullend) | Aanvullende materialen | – | LM | L&F | P | ✔ |
| `budgetaanvraag` (soort `avf`) | Financieel plan (regels en totaal) | – | PL | C&F | C | (na goedkeuring vast) |

## G Thema en organisatie
| Sleutel | Label | Verplicht | PG-rol | SG-rol | PACK | W |
|---|---|---|---|---|---|---|
| `organisatie.bijdrage_thema` | Bijdrage aan het meerdaagsethema | ✔ | PB | B&T | A | |
| `organisatie.samenhang` | Samenhang met het programma | – | PB | P&K | A | |
| `projectgroep_rol` | Rolverdeling (zes rollen) | ✔ alle zes ingevuld | PL | PRL | K | |
| `organisatie.afstemming` | Afstemming met anderen | – | PL | PRL | K | |
| `organisatie.vervoer` | Vervoer | – | LM | L&F | P | |
| `organisatie.opbouw_afbouw` | Opbouw en afbouw | – | LM | L&F | P | |
| `organisatie.catering` | Eten en drinken, uitgifte | – | CA | V&W | P | |
| `organisatie.allergieen_rekening_gehouden` | Rekening gehouden met allergieën (ja/nee, geen namen) | ◐ als catering is ingevuld | CA | V&W | P | |
| `organisatie.corvee` | Corvee en schoonmaakrooster | – | CC | L&F | P | |

## H Communicatie
| Sleutel | Label | Verplicht | PG-rol | SG-rol | PACK | W |
|---|---|---|---|---|---|---|
| `communicatie.voor` | Voor: wat deelnemers vooraf moeten weten en meenemen (kleding, spullen, verzamelpunt en -tijd) | ✔ | CC | C&F | C | |
| `communicatie.tijdens` | Tijdens: instructies en signalen, bereikbaarheid, wie communiceert bij een calamiteit | ✔ | CC | C&F | C | |
| `communicatie.na` | Na: afsluiting, terugkoppeling aan deelnemers en stuurgroep, foto's of resultaten delen | – | CC | C&F | C | |

## Overzicht per stuurgroeprol (dashboard)

| PACK | Stuurgroeprol | Ziet uit alle zes AVF's |
|---|---|---|
| P · Pleister | Veiligheid & Welzijn | D sociale en fysieke veiligheid, USV veilig; E volledig; G catering en allergieën |
| P · Pleister | Logistiek & Facilitair | A locatie (toewijzen); D opruimen; F materialen; G vervoer, opbouw en afbouw, corvee |
| A · Aansteker | Beleving & Thema | A publieke samenvatting; G bijdrage aan het meerdaagsethema |
| A · Aansteker | Programma & Kwaliteit | A verschijningsvorm, doelgroep; B; C; D organisatie, onderdelen, differentiatie, USV; G samenhang |
| C · Camera | Communicatie & Financiën | F financieel plan; H communicatie voor, tijdens en na |
| K · Kompas | Projectleiding | A titel, organiserende studenten, aantal, contactpersoon, dag en tijd (toewijzen); G rolverdeling en afstemming; plus de status van alle AVF's |

Per rol toont het dashboard voor elk van de zes AVF's: welke van zijn velden leeg of ingevuld zijn, de laatste wijziging en open verbeterverzoeken. Klik op een veld → leesweergave van het AVF op die plek → "Verbeterverzoek" (automatisch gericht aan de PG-rol van dat veld).

## Gebruik in de app

- **Projectgroep** ziet per sectie de PG-rol als eigenaar ("Eigenaar: Veiligheid & EHBO"). Geen SG-rol, geen PACK-vak.
- **Stuurgroep** ziet het dashboard per PACK-vak en rol zoals hierboven. PACK is een speelse indeling: kleine letter en icoon, geen zware uitleg.
- **Indienen** controleert alle velden met ✔ en ◐ volgens deze lijst.
- **Wezenlijke wijziging** (W ✔) na goedkeuring zet `opnieuw_te_controleren`.
- Wijzigen van de koppeling = alleen dit bestand en `src/config/avf-velden.ts` aanpassen, geen databasewijziging.
