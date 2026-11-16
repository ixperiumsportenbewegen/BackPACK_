# Datamodel

Voorstel voor versie 1. Tabellen gemarkeerd met *(later)* horen bij latere opdrachten; neem ze pas op als de bouwvolgorde erom vraagt. Alle tabellen krijgen `id uuid primary key default gen_random_uuid()` (tenzij anders vermeld), `created_at` en `updated_at` (met trigger).

## Opzet en accounts

### editie
| veld | type | opmerking |
|---|---|---|
| naam | text | "Ardennen-meerdaagse 2027" |
| startdatum, einddatum | date | 2027-06-28 t/m 2027-06-30 |

### cluster
| veld | type | opmerking |
|---|---|---|
| editie_id | uuid → editie | |
| code | text | `VD`, `VC` of `TEST`, uniek per editie; TEST is een fictief oefencluster |
| naam | text | |
| budget_totaal | numeric(10,2) | standaard 150.00, aanpasbaar door stuurgroep en docent |
| teams_link | text | knop naar Teams-kanaal |
| forms_link | text | declaratieformulier |
| meerdaagsemodus_aan | boolean | standaard false *(gebruikt in latere opdracht)* |

### meerdaagsethema
Eén per cluster (`cluster_id` is primary key).
| veld | type | opmerking |
|---|---|---|
| cluster_id | uuid → cluster | PK |
| naam | text | leeg = nog geen thema → neutrale HAN-stijl |
| verhaal | text | korte verhaallijn |
| slogan | text | optioneel |
| accentkleur | text | hex, bijv. `#E1005C`; contrast wordt gecontroleerd |
| sfeerbeeld_pad | text | pad in Storage-bucket `thema` |
| logo_pad | text | optioneel |
| bijgewerkt_door_naam | text | ingevulde naam |

### stuurgroeprol
Zes per cluster.
| veld | type | opmerking |
|---|---|---|
| cluster_id | uuid → cluster | |
| code | enum `stuurgroeprol_code` | `projectleiding`, `programma_kwaliteit`, `beleving_thema`, `veiligheid_welzijn`, `logistiek_facilitair`, `communicatie_financien` |
| naam | text | weergavenaam, bijv. "Programma & Kwaliteit" |
| focus | text | bijv. "Planning, samenhang en overdracht" |
| studenten | text | namen van de studenten bij deze rol, gescheiden door een komma ("Anna, Bram"); in de app één naam per veld, zie `src/lib/namen.ts`; oude vrije tekst blijft leesbaar |
| pack | enum `pack_vak` | `P`, `A`, `C` of `K` (zie PRD 4.1) |

Uniek: (`cluster_id`, `code`).

PACK-indeling stuurgroeprollen: projectleiding → K; programma_kwaliteit en beleving_thema → A; veiligheid_welzijn en logistiek_facilitair → P; communicatie_financien → C.
PACK-indeling projectgroeprollen (vast in code): projectleider → K; programma_beleving → A; veiligheid_ehbo, logistiek_materialen en catering → P; corvee_communicatie → C.

### projectgroep
Zes per cluster.
| veld | type | opmerking |
|---|---|---|
| cluster_id | uuid → cluster | |
| nummer | int | 1–6, uniek per cluster |
| naam | text | bijv. "Projectgroep 3" of een eigen naam |

### projectgroep_rol
Zes vaste rollen per projectgroep. PK (`projectgroep_id`, `rol`).
| veld | type | opmerking |
|---|---|---|
| projectgroep_id | uuid → projectgroep | |
| rol | enum `projectgroeprol` | `projectleider`, `programma_beleving`, `veiligheid_ehbo`, `logistiek_materialen`, `catering`, `corvee_communicatie` |
| namen | text | verantwoordelijke student(en), gescheiden door een komma ("Anna, Bram"); in de app één naam per veld; leesbaar voor het hele cluster |

### account
Koppelt een Supabase Auth-gebruiker aan een rol. PK = `auth.users.id`.
| veld | type | opmerking |
|---|---|---|
| id | uuid → auth.users | |
| gebruikersnaam | text | uniek, bijv. `vd-groep-3` |
| soort | enum `accountsoort` | `docent`, `stuurgroep`, `projectgroep`, `student` |
| cluster_id | uuid → cluster | leeg bij docent |
| projectgroep_id | uuid → projectgroep | alleen bij soort `projectgroep` |
| stuurgroeprol_id | uuid → stuurgroeprol | alleen bij soort `stuurgroep` |

Inloggen met gebruikersnaam: de app zet de gebruikersnaam om naar een intern e-mailadres `<gebruikersnaam>@ardennen.invalid` (e-mailbevestiging uit). Wachtwoord resetten doet de docent via een serverfunctie met de service role.

Hulpfuncties (SQL, `security definer`, `stable`): `mijn_soort()`, `mijn_cluster()`, `mijn_projectgroep()`, `mijn_stuurgroeprol()`, `is_docent()`. Alle afschermingsregels gebruiken deze functies.

## Programma

### programma_regel
Het vaste programma van de meerdaagse, per cluster. Zes regels hebben soort `belevenis`: dat zijn de tijdvakken waarin een projectgroep haar belevenis organiseert (één groep per tijdvak). De overige regels zijn vast (verzamelen, busreis, maaltijden, verplaatsingen enz.).
| veld | type | opmerking |
|---|---|---|
| cluster_id | uuid → cluster | |
| volgorde | int | volgorde in het hele programma; uniek per cluster |
| dag | date | |
| starttijd, eindtijd | time | |
| soort | enum `programma_soort` | `vast` of `belevenis` |
| titel | text | bijv. "Spiegelprogramma ochtend · 3 uur" |
| omschrijving | text | korte toelichting bij een vaste regel |
| locatie | text | bijv. "Camping" of "Bivaklocatie" |
| deelnemers | int[] | nummers (1–6) van de projectgroepen die aan de belevenis meedoen |
| rocks_rivers_groepen | int[] | nummers van de projectgroepen die op hetzelfde moment met Rocks n Rivers zijn |
| oorspronkelijke_starttijd, oorspronkelijke_eindtijd | time | de tijd zoals die oorspronkelijk was, zolang de tijd is aangepast (uitroepteken); leeg als de tijd gelijk is aan het begin of de stuurgroep de wijziging heeft bevestigd |
| bijgewerkt_door_naam | text | ingevulde naam van de stuurgroep |

Alleen lezen voor het cluster; wijzigen via de functies `programma_regel_wijzigen`, `programma_regel_toevoegen`, `programma_regel_verwijderen` en `programma_wijzigingen_bevestigen`.
Het aantal belevenisregels blijft zes: een regel van soort `belevenis` kan niet worden toegevoegd of verwijderd en de soort kan niet veranderen (de database dwingt dat af); de tijd kan wel worden aangepast. Vaste regels kunnen worden toegevoegd en verwijderd.
Verandert de eindtijd van een regel, dan schuiven de aansluitende regels van dezelfde dag standaard mee (dezelfde duur); bij een gat in het programma stopt het meeschuiven. Volgnummers (`volgorde`) mogen gaten hebben.

## AVF

### avf
Eén per projectgroep (`projectgroep_id` uniek). Velden van sectie A staan als kolommen; B, C, E, G en H als `jsonb` met een vaste structuur (zie onder). De koppeling van elk veld aan projectgroeprol, stuurgroeprol en PACK-vak staat niet in de database maar in `src/config/avf-velden.ts` (bron: `docs/avf-velden.md`).
| veld | type | opmerking |
|---|---|---|
| projectgroep_id | uuid → projectgroep | uniek |
| cluster_id | uuid → cluster | voor snelle afscherming |
| status | enum `avf_status` | `in_ontwikkeling`, `ingediend`, `aanpassing_gevraagd`, `goedgekeurd` |
| opnieuw_te_controleren | boolean | true na wezenlijke wijziging na goedkeuring; status blijft `goedgekeurd` |
| versie | int | ophogen bij elke indiening |
| tussentijds | boolean | true als de laatste indiening ter feedback was (onvolledig toegestaan); `avf_indienen` zet het weer op false. Goedkeuren kan alleen als dit false is |
| **A** titel | text | |
| verschijningsvorm | text | één of meer van Spel, Wedstrijd, Avontuur, Gezondheid, Recreatie, Show, gescheiden door ", " (afgedwongen met een check) |
| publieke_samenvatting | text | zonder spoilers |
| organiserende_studenten | text | namen |
| doelgroep | text | |
| aantal_deelnemers | int | |
| programma_regel_id | uuid → programma_regel | toegewezen tijdvak (een regel van soort `belevenis`); uniek: één groep per tijdvak; dag en tijd komen altijd uit deze regel; alleen te wijzigen via `avf_planning_toewijzen` |
| locatie_tekst | text | locatie; alleen te wijzigen door de stuurgroep via `avf_planning_toewijzen` (later eventueel `locatie_id` → `locatie`) |
| contactpersoon | text | |
| **B** beginsituatie | jsonb | `{algemeen, motorisch, cognitief, sociaal_emotioneel}` |
| **C** doelen | jsonb | `{motorisch, cognitief, sociaal_emotioneel, persoonlijk: [{naam, doel}]}` |
| **E** veiligheid | jsonb | `{risicos: [{risico, maatregel, wie}], weer: {zeer_warm, zware_regen, onweer, koel}, ehbo: {aanvullend: bool, maatregelen}}` met per weerscenario `{relevant: bool, maatregel, alternatief, stopcriterium, beslisser}` |
| **G** organisatie | jsonb | `{bijdrage_thema, samenhang, vervoer, opbouw_afbouw, catering, allergieen_rekening_gehouden: bool, corvee, afstemming}` |
| **H** communicatie | jsonb | `{voor, tijdens, na}` |
| sectie_bijgewerkt | jsonb | per sectie `updated_at` en ingevulde naam, voor de waarschuwing bij gelijktijdig werken |
| ingediend_op, ingediend_door_naam | timestamptz, text | |
| goedgekeurd_op, goedgekeurd_door_naam | timestamptz, text | |
| goedgekeurd_door_account | uuid → account | |

### avf_fase
Drie per AVF (kop, romp, staart). PK (`avf_id`, `fase`).
| veld | type | opmerking |
|---|---|---|
| avf_id | uuid → avf | |
| fase | enum `fase` | `kop`, `romp`, `staart` |
| organisatievorm | text | |
| overzichtstekening_pad | text | Storage-bucket `avf` |
| overzichtstekening_bijschrift | text | |
| coachen_instructies | text | aanwijzingen en instructies |
| stemgebruik_houding | text | |
| opruimen | jsonb | `{wie, wat, waar, wanneer, hoe, wat_erna}` (6 W's) |

### avf_onderdeel
| veld | type | opmerking |
|---|---|---|
| avf_id | uuid → avf | |
| fase | enum `fase` | |
| volgorde | int | |
| naam | text | |
| duur_minuten | int | |
| beschrijving | text | |
| sociale_veiligheid | text | |
| fysieke_veiligheid | text | |
| individu_moeilijker, individu_makkelijker | text | |
| groep_moeilijker, groep_makkelijker | text | |
| usv_uitdagend, usv_speelbaar | text | |
| usv_veilig_aanvulling | text | "veilig" toont de fysieke veiligheid; dit is alleen een aanvulling |
| afbeelding_pad | text | optioneel |
| afbeelding_bijschrift | text | |
| niet_van_toepassing | text[] | velden die bewust als n.v.t. zijn gemarkeerd |

### avf_versie
Bevroren kopie bij elke indiening.
| veld | type | opmerking |
|---|---|---|
| avf_id | uuid → avf | |
| versie | int | |
| inhoud | jsonb | volledige momentopname van avf, fasen, onderdelen, materialen en financieel plan |
| ingediend_door_naam | text | |
| wijzigingssamenvatting | text | verplicht vanaf versie 2 |
| tussentijds | boolean | deze indiening was ter feedback (niet definitief) |

### verbeterverzoek
| veld | type | opmerking |
|---|---|---|
| avf_id | uuid → avf | |
| sectie | text | `A`–`G` |
| onderdeel_id | uuid → avf_onderdeel | optioneel |
| projectgroeprol | enum `projectgroeprol` | voor wie het bedoeld is |
| tekst | text | |
| veld_sleutel | text | optioneel: het AVF-veld waar het verzoek over gaat (uit het dashboard) |
| status | enum | `open`, `aangepast`, `afgehandeld`. Wordt `aangepast` zodra de projectgroep daarna iets opslaat in die sectie (of dat onderdeel); de database doet dat met triggers |
| aangepast_op, afgehandeld_op | timestamptz | |
| door_account, door_naam | uuid, text | |

### themacheck
PK (`avf_id`, `stuurgroeprol_code`).
| veld | type | opmerking |
|---|---|---|
| oordeel | enum | `akkoord`, `aandachtspunt` |
| toelichting | text | |
| door_naam | text | |

## Materialen en budget

### materiaal
Eén lijst voor beide clusters, met de voorraad per locatie (op basis van ervaring van vorige jaren). Logistiek & Facilitair van VD bouwt de lijst; VC kan zodra hij definitief is materialen toevoegen.
| veld | type | opmerking |
|---|---|---|
| naam | text | |
| categorie | text | naam uit de vaste lijst `materiaal_categorie` (standaard `Overig`) |
| voorraad_camping, voorraad_bivak | int | leeg = nog niet ingeschat; Logistiek & Facilitair schat ze zelf in; de lijst kan pas definitief als ze bij elk actief materiaal zijn ingevuld (0 mag) |
| opmerking | text | |
| actief | boolean | inactief = niet meer kiesbaar; bestaande keuzes krijgen een melding |
| toegevoegd_door_cluster, bijgewerkt_door_naam | uuid, text | wie het materiaal toevoegde of het laatst wijzigde |

### materiaal_categorie
Vaste lijst van categorieën (`naam`, `volgorde`), beheerd door de docent en Logistiek & Facilitair van VD; VC kiest alleen. Startlijst: Afbakening en markering, Teamherkenning, Ballen, Sport- en spelmateriaal, Touwen en stokken, Archery tag, Veiligheid en communicatie, Organisatie en schrijfmateriaal, Opslag en Overig. Een categorie hernoemen werkt door bij alle materialen; verwijderen kan alleen als er geen materialen in zitten.

### materiaal_telling (materiaalcontrole)
PK (`materiaal_id`, `locatie`). `meegenomen`, `op_kamp`, `retour` (alle optioneel), `opmerking`, `bijgewerkt_door_naam`. Verschil = retour min meegenomen (of plan). Wat er echt is (`op_kamp`, anders `meegenomen`, anders de voorraad uit de lijst) telt mee in `materiaal_beschikbaar` en `materiaal_context`, zodat projectgroepen een tekort direct zien.

### materiaal_aanvraag
Een projectgroep vraagt materiaal aan (`avf_id`, `materiaal_id` of `omschrijving`, `aantal` in totaal nodig, `toelichting`, `status` open, afgehandeld of afgewezen, `uitkomst`, namen en tijden). De stuurgroep past de lijst zelf aan en handelt de aanvraag af.

### materiaallijst_status
Eén rij: `status` (`concept` of `definitief`), `definitief_op`, `definitief_door_naam`, `definitief_door_cluster`. Projectgroepen kunnen pas materiaal kiezen als de lijst definitief is.

### avf_materiaal
Materialen in sectie F. De locatie (camping of bivak) staat in het AVF (`avf.locatie_keuze`), dus er is één aantal.
| veld | type | opmerking |
|---|---|---|
| avf_id | uuid → avf | |
| fase | enum `fase` | optioneel; leeg = hele belevenis |
| materiaal_id | uuid → materiaal | leeg bij eigen materiaal |
| omschrijving | text | alleen bij eigen materiaal (telt niet mee voor de voorraad) |
| aantal | int | minstens 1 |
| aantal_gecorrigeerd | int | door de stuurgroep, optioneel; telt dan in plaats van `aantal` |

Materiaal kiezen kan pas als de locatie bekend is en de lijst definitief is. Materialen worden hergebruikt: de behoefte van een belevenis op één moment is het grootste aantal van kop, romp en staart plus wat voor de hele belevenis is gekozen. Een tekort is er alleen als belevenissen op dezelfde locatie met overlappende tijd (VD en VC samen) meer nodig hebben dan er ligt. De functies `materiaal_beschikbaar(avf_id)` (voor de projectgroep) en `materiaal_context(cluster_id)` (voor de stuurgroep) rekenen dat uit. TEST telt apart van VD en VC.

### budgetaanvraag
| veld | type | opmerking |
|---|---|---|
| cluster_id | uuid → cluster | |
| projectgroep_id | uuid → projectgroep | |
| avf_id | uuid → avf | |
| soort | enum | `avf` (financieel plan, één per AVF) of `los` |
| omschrijving | text | bij een losse aanvraag: waarvoor |
| toelichting | text | optionele toelichting van de groep |
| regels | jsonb | `[{omschrijving, bedrag}]`, maximaal 30 regels |
| bedrag_aangevraagd | numeric(10,2) | som van regels |
| status | enum `budgetstatus` | `concept`, `aangevraagd`, `toegekend`, `teruggegeven`, `afgewezen` |
| bedrag_toegekend | numeric(10,2) | mag lager zijn dan aangevraagd |
| besluit_toelichting | text | verplicht bij teruggeven, afwijzen of lager bedrag |
| besluit_door_naam, besluit_op | text, timestamptz | |
| besteed | numeric(10,2) | handmatig na aankoop (Should) |
| ingediend_door_naam, ingediend_op | text, timestamptz | |

Elk AVF heeft automatisch één (aanvankelijk lege) aanvraag van soort `avf`: het financieel plan in sectie F. Dat plan gaat mee met het indienen van het AVF en ligt na goedkeuring vast; extra kosten gaan via een losse aanvraag.

Functie `budget_resterend(cluster_id)` (`security definer`): budget_totaal minus toegekend. Projectgroepen gebruiken deze functie; zij kunnen de aanvragen van anderen niet lezen.

## Calamiteitenplan

Een algemeen calamiteitenplan (incl. EHBO) per cluster, als sectie in de app. De opzet (onderdelen en velden) staat in `src/config/calamiteitenplan.ts`; de inhoud komt van de stuurgroep.

### calamiteit_veld
Losse tekstvelden. Sleutel: (`cluster_id`, `sleutel`). `tekst` (maximaal 4000 tekens), `bijgewerkt_door_naam`, `created_at`, `updated_at`.

### calamiteit_item
Regels in lijsten (contactpersonen, ziekenhuizen, situaties met verhoogd risico, zorgsysteem, overig): `id`, `cluster_id`, `lijst` (sleutel van de lijst), `volgorde`, `velden` (jsonb met tekstwaarden per veld), `bijgewerkt_door_naam`, tijden. Maximaal 50 regels per lijst.

### cluster.whatsapp_link
De link naar de groepsapp voor noodmeldingen (https, optioneel). Alleen een link: er is geen chat in de app.

## Persoonlijke paklijst

Wat neemt een student mee? Per cluster, gemaakt door de stuurgroep. Niet te verwarren met de materiaalcontrole (`materiaal_telling`). Twee vaste blokken (`persoon` en `groepje`, zie `src/config/paklijst.ts`).

### paklijst_categorie
`id`, `cluster_id`, `blok` (`persoon` of `groepje`), `naam` (1 tot 80 tekens), `volgorde`, `bijgewerkt_door_naam`, tijden. Elk cluster krijgt vooraf de vaste categorieën (zonder items) via `paklijst_standaard_categorieen`.

### paklijst_item
`id`, `cluster_id`, `categorie_id`, `bovenliggend_id` (null bij een item; verwijst bij een onderdeel naar het item, één niveau diep), `naam` (maximaal 150), `aantal` (vrije tekst, maximaal 40), `toelichting` (maximaal 500), `optioneel`, `volgorde`, `bijgewerkt_door_naam`, tijden. Een item zonder naam is nog niet ingevuld en staat niet op de leesweergave. Wat een student afvinkt staat niet in de database maar alleen op het eigen toestel.

## Logboek

### wijziging
| veld | type | opmerking |
|---|---|---|
| tabel, record_id | text, uuid | |
| actie | text | bijv. `ingediend`, `goedgekeurd`, `budget_toegekend` |
| account_id, naam | uuid, text | |
| details | jsonb | |

## Beheer

### systeem_instelling
`sleutel`, `waarde`: alleen voor de server. Nu alleen `livegang_op` (tijdstip van de livegang): zolang die er is, laadt `npm run seed` geen voorbeeld-AVF meer in VD.

## Storage

| bucket | inhoud | afscherming |
|---|---|---|
| `avf` | afbeeldingen bij AVF, fasen en onderdelen; pad `cluster/<cluster_id>/avf/<avf_id>/...` | zelfde regels als `avf` |
| `thema` | sfeerbeeld en logo; pad `cluster/<cluster_id>/...` | lezen: hele cluster en docent; schrijven: stuurgroep en docent |
| `algemeen` | foto's uit `assets/fotos` | lezen: iedereen die is ingelogd |

Afbeeldingen worden bij upload verkleind (max. 1600 px, WebP) en EXIF-gegevens worden verwijderd.

## Latere opdrachten *(nog niet bouwen)*

`locatie`, `draaiboek_onderdeel`, `deadline`, `besluit`, `infopagina`, `teaser`, `corveetaak`, `inkoopregel`. Zie PRD hoofdstuk 6.
