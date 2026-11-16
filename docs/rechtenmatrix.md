# Rechtenmatrix

Afgedwongen met Row Level Security en Postgres-functies. Elke regel krijgt een test met het genoemde testaccount (zie `seed/basis.json`).

**Legenda:** L = lezen, S = schrijven (aanmaken/wijzigen), F = alleen via functie, – = geen toegang.
**Kolommen:**
- **Docent**: account `docent`, beide clusters.
- **Stuurgroep**: elk stuurgroepaccount, alleen het eigen cluster. Alle zes rollen hebben dezelfde rechten; de rol bepaalt alleen welke werkpagina standaard opent.
- **PG eigen**: projectgroepaccount, eigen projectgroep.
- **PG ander**: projectgroepaccount, andere projectgroep in hetzelfde cluster.
- **Student**: studentaccount van het cluster.
- **Ander cluster**: elk account (behalve docent) ten opzichte van het andere cluster: nooit toegang.

| Object | Docent | Stuurgroep | PG eigen | PG ander | Student |
|---|---|---|---|---|---|
| editie, cluster (basisgegevens, links) | L S | L | L | L | L |
| cluster.budget_totaal | L S | L S | via `budget_resterend` | via `budget_resterend` | – |
| cluster.teams_link | L S | L | L | L | L |
| cluster.forms_link | L S | L, S voor Communicatie & Financiën van het eigen cluster (via `cluster_forms_link_zetten`) | L | L | L |
| systeem_instelling (markering livegang) | – (alleen server) | – | – | – | – |
| meerdaagsethema | L S | L S | L | L | L |
| stuurgroeprol (namen studenten) | L S | L S (eigen rol) | L | L | L |
| projectgroep | L S | L | L | L | L |
| projectgroep_rol (rolverdeling met namen) | L S | L | L S | L | L (besluit 2026-11-16: iedereen in het eigen cluster ziet de namen van de groepsleden; schrijven alleen de eigen groep en de docent) |
| account | L S (via beheerfunctie) | L eigen | L eigen | – | L eigen |
| avf – volledige inhoud | L S | L (wijzigen alleen via verbeterverzoek) | L, S zolang status niet `ingediend` is | – | – |
| avf.programma_regel_id (tijdvak) | L, wijzigen via F | F (`avf_planning_toewijzen`, `avf_planning_wisselen`) | L (nooit wijzigen) | tijdvak via `avf_publiek` | tijdvak via `avf_publiek` |
| avf.locatie_keuze (camping of bivak) en locatie_detail | L S | L, corrigeren via F (`avf_planning_toewijzen`) | L, S zolang status niet `ingediend` is; kan niet leeg worden zolang er materialen zijn | – (niet publiek) | – |
| programma_regel (vast programma per cluster) | L, wijzigen via F | L, wijzigen via F (`programma_regel_wijzigen`) | L | L | L |
| avf – publieke velden (view `avf_publiek`: titel, verschijningsvorm, publieke_samenvatting, tijdvak met dag en tijden, status) | L | L | L | L | L |
| avf.status, versie, goedkeuring | F | F (`aanpassing_vragen`, `goedkeuren`) | F (`indienen`) | – | – |
| avf_fase, avf_onderdeel, avf_materiaal | L S | L | L, S zolang status niet `ingediend` is | – | – |
| avf_materiaal.aantal_gecorrigeerd_* | L S | L S | L | – | – |
| avf_versie | L | L | L | – | – |
| verbeterverzoek | L S | L S | L, status naar `aangepast` | – | – |
| themacheck | L S | L S | L | – | – |
| materiaal (gedeelde basislijst voor VD en VC) | L S | Als concept: alleen Logistiek & Facilitair van VD (en TEST) leest en schrijft. Gepubliceerd: alle stuurgroepen lezen; Logistiek & Facilitair van VD én VC wijzigen, voegen toe en verwijderen (niet als een projectgroep het materiaal heeft gekozen) | L zodra de lijst is gepubliceerd; materiaal zonder ingeschatte voorraad is nog niet te kiezen | L zodra de lijst is gepubliceerd | – |
| materiaal_categorie (vaste lijst) | L S | Lezen als de lijst; beheren (toevoegen, hernoemen, verwijderen) alleen Logistiek & Facilitair van VD en de docent | L | L | – |
| materiaal_telling (paklijst: meegenomen, op kamp, retour) | L, schrijven via F | L, schrijven via F (`materiaal_telling_zetten`, alle stuurgroepen) | – (zij zien de gevolgen als melding) | – | – |
| materiaal_aanvraag (aanvraag van een projectgroep) | L | L (eigen cluster), afhandelen via F | L eigen, plaatsen via F | – | – |
| materiaallijst_status (concept of definitief) | L, terugzetten via F | L, definitief maken via F (`materiaallijst_definitief_maken`, alleen Logistiek & Facilitair van VD) | L | L | – |
| functies `materiaal_beschikbaar` en `materiaal_context` (voorraad en gebruik door anderen op dezelfde locatie en hetzelfde moment) | L | L (eigen cluster, per belevenis) | L (alleen voor het eigen AVF: voorraad en aantal dat anderen tegelijk gebruiken, zonder namen) | – | – |
| budgetaanvraag | L S | L, besluit via F (`budget_besluit`) | L S zolang `concept` of `teruggegeven`; indienen via F. Na goedkeuring van het AVF is het financieel plan vast; extra kosten via een losse aanvraag | – | – |
| wijziging (logboek) | L | L (eigen cluster) | L (eigen avf) | – | – |
| Storage `avf` | L S | L | L S (onder dezelfde voorwaarde als avf) | – | – |
| Storage `thema` | L S | L S | L | L | L |

## Functies (security definer, met eigen rechtencontrole)

| Functie | Wie | Wat |
|---|---|---|
| `avf_indienen(avf_id, naam, wijzigingssamenvatting, open_bevestigd)` | PG eigen | Controleert verplichte velden (volgens `docs/avf-velden.md`) en of alle zes projectgroeprollen een naam hebben; maakt `avf_versie`; zet status op `ingediend`; zet het financieel plan (budgetaanvraag van soort `avf`) van `concept` of `teruggegeven` naar `aangevraagd` als er bedragen in staan. Staan er nog open verbeterverzoeken waaraan niets is aangepast, dan geeft de functie die terug en dient pas in na `open_bevestigd = true` |
| `avf_ter_feedback_indienen(avf_id, naam, samenvatting, open_bevestigd)` | PG eigen | Indienen ter feedback (besluit 2026-11-16): mag onvolledig, geen controle op verplichte velden; naam en samenvatting altijd verplicht; maakt een `avf_versie` met `tussentijds = true`; status `ingediend` en `avf.tussentijds = true`; het financieel plan gaat NIET mee; zelfde bevestiging bij open verzoeken als `avf_indienen`. Kan zo vaak als nodig (na `aanpassing_gevraagd`) |
| `avf_aanpassing_vragen(avf_id, naam)` | Stuurgroep, docent | Alleen als er minstens één open verbeterverzoek is; status → `aanpassing_gevraagd` | Bij een indiening ter feedback (`tussentijds`) mag de stuurgroep ook zonder open verbeterverzoek teruggeven ("Feedback teruggeven").
| `verbeterverzoek_plaatsen(avf_id, sectie, onderdeel_id, veld_sleutel, rol, tekst, naam)`, `verbeterverzoek_status_zetten(id, status, naam)`, `themacheck_zetten(avf_id, rol, oordeel, toelichting, naam)` | Stuurgroep, docent | Verzoeken en themachecks plaatsen en afhandelen (clients schrijven nooit rechtstreeks in deze tabellen) |
| `avf_goedkeuren(avf_id, naam, open_bevestigd)` | Stuurgroep, docent | Status → `goedgekeurd`; legt account, naam en tijd vast; zet `opnieuw_te_controleren` op false | Geweigerd (`tussentijds`) zolang de laatste indiening ter feedback was; goedkeuren kan pas na een definitieve indiening (`avf_indienen` zet `tussentijds` weer op false).
| `avf_planning_toewijzen(avf_id, programma_regel_id, locatie, naam)` | Stuurgroep, docent | Wijst een belevenis aan een tijdvak (regel van soort `belevenis`) en een locatie toe; weigert als het tijdvak al bij een andere groep hoort; legt het vast in het logboek |
| `avf_planning_wisselen(avf_a, avf_b, naam)` | Stuurgroep, docent | Laat twee groepen van tijdvak wisselen |
| `programma_regel_wijzigen(regel_id, ..., verwacht_updated_at, naam, schuif)` | Stuurgroep, docent | Past titel, tijd, locatie en deelnemers van een programmaregel aan; schuift standaard de aansluitende activiteiten van die dag mee en bewaart de oorspronkelijke tijden (uitroepteken); waarschuwt als iemand anders de regel net wijzigde; legt het vast in het logboek |
| `programma_regel_toevoegen(na_regel_id, titel, ..., schuif, naam)` | Stuurgroep, docent | Voegt een vaste activiteit toe na een bestaande activiteit (nooit een belevenisvak) |
| `programma_regel_verwijderen(regel_id, schuif, naam)` | Stuurgroep, docent | Verwijdert een vaste activiteit; een belevenisvak wordt geweigerd |
| `programma_wijzigingen_bevestigen(cluster_id, regel_id, naam)` | Stuurgroep, docent | Haalt de uitroeptekens weg zonder de tijden te veranderen |
| `budget_regels_opslaan(aanvraag_id, regels, omschrijving, toelichting, naam, verwacht_updated_at)` | PG eigen, docent | Slaat het financieel plan of een losse aanvraag op (regels met omschrijving en bedrag; het bedrag is de som). Alleen bij `concept` of `teruggegeven`; het plan van een goedgekeurd AVF ligt vast tenzij het is teruggegeven; waarschuwt bij gelijktijdig wijzigen |
| `budget_losse_aanvraag_maken(avf_id, omschrijving, naam)` | PG eigen | Start een losse aanvraag (`soort = los`), alleen als het AVF is goedgekeurd |
| `budget_aanvraag_indienen(aanvraag_id, naam)` | PG eigen | Dient een losse aanvraag in (AVF goedgekeurd) of het financieel plan opnieuw na `teruggegeven`; vraagt een bedrag |
| `budget_besluit(aanvraag_id, besluit, bedrag, toelichting, naam)` | Stuurgroep van het cluster, docent | `toegekend` (eventueel lager bedrag, nooit hoger dan aangevraagd), `teruggegeven` of `afgewezen`; toelichting verplicht behalve bij volledig toekennen. Een bedrag boven de resterende ruimte mag: de functie meldt dat terug als waarschuwing |
| `budget_besteed_zetten(aanvraag_id, bedrag, naam)` | Stuurgroep, docent | Het werkelijk bestede bedrag (handmatig, alleen bij toegekend). De app claimt nooit dat iets is betaald |
| `budget_resterend(cluster_id)` | Iedereen in het cluster, docent | Budget min wat is toegekend; geeft alleen dat bedrag terug |
| `account_wachtwoord_resetten(account_id)` | Docent | In de app: server-actie op de beheerpagina met de service role (controleert eerst of de gebruiker de docent is); het nieuwe wachtwoord wordt één keer getoond aan de docent en alle sessies van het account worden ingetrokken (`account_sessies_verwijderen`, alleen voor de service role). Staat in het logboek |
| `cluster_forms_link_zetten(cluster_id, link, naam)` | Communicatie & Financiën van het cluster, docent | Stelt de Forms-link in (https, geen spaties; leeg haalt hem weg); staat in het logboek |
| `blijf_actief()` | Iedereen, ook niet ingelogd | Geeft alleen het aantal edities terug (voor `/api/blijf-actief`) |

Een goedgekeurd AVF blijft voor de projectgroep bewerkbaar. Een wezenlijke wijziging (verschijningsvorm, sectie D-onderdelen toevoegen of verwijderen, fysieke veiligheid van een onderdeel, sectie E of materialen) zet via een trigger `opnieuw_te_controleren = true`. De status blijft `goedgekeurd`, maar het AVF verschijnt bij de stuurgroep met het label "Opnieuw te controleren" tot een stuurgroeplid opnieuw goedkeurt. De stuurgroep wijzigt AVF-inhoud nooit zelf; zij plaatst verbeterverzoeken.

| `materiaallijst_definitief_maken(naam)` (in de app: "publiceren") | Logistiek & Facilitair van VD (en TEST), docent | Publiceert de gedeelde lijst (ook als niet alle voorraden zijn ingeschat); daarna kunnen projectgroepen kiezen en ziet VC de lijst |
| `materiaal_telling_zetten(materiaal, locatie, veld, waarde, tekst, naam, verwacht)` | Alle stuurgroepen, docent | Werkt één veld van de paklijst bij met waarschuwing bij gelijktijdig wijzigen; wat er echt is (op kamp, anders meegenomen) telt mee in de beschikbaarheid |
| `materiaal_aanvraag_plaatsen(avf, materiaal, omschrijving, aantal, toelichting, naam)` | PG eigen | Vraagt een materiaal of meer voorraad aan (alleen als de lijst is gepubliceerd) |
| `materiaal_aanvraag_afhandelen(id, status, uitkomst, naam)` | Stuurgroep van het cluster, docent | Markeert de aanvraag als afgehandeld of afgewezen (toelichting verplicht bij afwijzen) |
| `materiaallijst_terugzetten(naam)` | Docent | Zet de lijst weer op concept |
| `avf_materiaal_corrigeren(id, aantal, naam)` | Stuurgroep, docent | Corrigeert het aantal van een gekozen materiaal; de projectgroep ziet de correctie |

## Verplichte afschermingstests (minimaal)

1. `vd-groep-1` kan het AVF van `vd-groep-2` niet lezen, ook niet via directe query, Storage-pad of `avf_versie`.
2. `vd-groep-1` ziet van `vd-groep-2` alleen de velden van `avf_publiek`.
3. Geen enkel VD-account (behalve docent) ziet iets van VC en andersom; TEST-accounts zien niets van VD en VC en andersom.
4. `vd-groep-1` kan zijn eigen AVF niet wijzigen als het `ingediend` is en kan nooit tijdvak of locatie wijzigen.
10. Een stuurgroepaccount kan geen AVF-inhoud wijzigen, wel verbeterverzoeken plaatsen en de planning toewijzen.
5. `vd-groep-1` kan `avf.status` niet rechtstreeks wijzigen en geen budget toekennen.
6. `vd-groep-1` kan de budgetaanvragen van andere groepen niet lezen, wel `budget_resterend`.
7. `vd-student` kan niets schrijven.
8. Alleen `vd-stuur-logistiek` en `docent` kunnen de materialenlijst wijzigen; `vc-stuur-logistiek` kan na publicatie ook toevoegen, wijzigen en verwijderen (een gekozen materiaal kan niemand verwijderen); zolang de lijst concept is, leest niemand anders hem.
9. Een niet-ingelogde bezoeker kan niets lezen.
