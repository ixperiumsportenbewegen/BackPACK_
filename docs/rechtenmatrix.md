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
| meerdaagsethema | L S | L S | L | L | L |
| stuurgroeprol (namen studenten) | L S | L S (eigen rol) | L | L | L |
| projectgroep | L S | L | L | L | L |
| projectgroep_rol (rolverdeling) | L S | L | L S | L | – |
| account | L S (via beheerfunctie) | L eigen | L eigen | – | L eigen |
| avf – volledige inhoud | L S | L (wijzigen alleen via verbeterverzoek) | L, S zolang status niet `ingediend` is | – | – |
| avf.dag, starttijd, eindtijd, locatie | L S | F (`avf_planning_toewijzen`) | L | via `avf_publiek` | via `avf_publiek` |
| avf – publieke velden (view `avf_publiek`: titel, verschijningsvorm, publieke_samenvatting, dag, tijden, status) | L | L | L | L | L |
| avf.status, versie, goedkeuring | F | F (`aanpassing_vragen`, `goedkeuren`) | F (`indienen`) | – | – |
| avf_fase, avf_onderdeel, avf_materiaal | L S | L | L, S zolang status niet `ingediend` is | – | – |
| avf_materiaal.aantal_gecorrigeerd_* | L S | L S | L | – | – |
| avf_versie | L | L | L | – | – |
| verbeterverzoek | L S | L S | L, status naar `aangepast` | – | – |
| themacheck | L S | L S | L | – | – |
| materiaal (basislijst) | L S | L, S voor rol `logistiek_facilitair` | L | L | – |
| view `materiaal_behoefte` | L | L | L (alleen eigen behoefte en beschikbare voorraad) | – | – |
| budgetaanvraag | L S | L, besluit via F (`budget_besluit`) | L S zolang `concept` of `teruggegeven`; indienen via F. Na goedkeuring van het AVF is het financieel plan vast; extra kosten via een losse aanvraag | – | – |
| wijziging (logboek) | L | L (eigen cluster) | L (eigen avf) | – | – |
| Storage `avf` | L S | L | L S (onder dezelfde voorwaarde als avf) | – | – |
| Storage `thema` | L S | L S | L | L | L |

## Functies (security definer, met eigen rechtencontrole)

| Functie | Wie | Wat |
|---|---|---|
| `avf_indienen(avf_id, naam, wijzigingssamenvatting)` | PG eigen | Controleert verplichte velden (volgens `docs/avf-velden.md`) en of alle zes projectgroeprollen een naam hebben; maakt `avf_versie`; zet status op `ingediend`; zet budgetaanvraag `concept` → `aangevraagd` |
| `avf_aanpassing_vragen(avf_id, naam)` | Stuurgroep, docent | Alleen als er minstens één open verbeterverzoek is; status → `aanpassing_gevraagd` |
| `avf_goedkeuren(avf_id, naam)` | Stuurgroep, docent | Status → `goedgekeurd`; legt account, naam en tijd vast; zet `opnieuw_te_controleren` op false |
| `avf_planning_toewijzen(avf_id, dag, starttijd, eindtijd, locatie, naam)` | Stuurgroep, docent | Legt dag, tijd en locatie vast; geeft een waarschuwing (geen blokkade) bij overlap met een andere belevenis op dezelfde locatie |
| `budget_besluit(aanvraag_id, besluit, bedrag, toelichting, naam)` | Stuurgroep, docent | `toegekend` (eventueel lager bedrag), `teruggegeven` of `afgewezen`; toelichting verplicht behalve bij volledig toekennen |
| `budget_aanvraag_indienen(aanvraag_id, naam)` | PG eigen | Losse aanvraag (`soort = los`), alleen als het AVF is goedgekeurd |
| `budget_resterend(cluster_id)` | Iedereen in het cluster, docent | Geeft alleen het resterende bedrag terug |
| `account_wachtwoord_resetten(account_id)` | Docent | Server-side met service role; nieuw wachtwoord tonen aan docent |

Een goedgekeurd AVF blijft voor de projectgroep bewerkbaar. Een wezenlijke wijziging (verschijningsvorm, sectie D-onderdelen toevoegen of verwijderen, fysieke veiligheid van een onderdeel, sectie E of materialen) zet via een trigger `opnieuw_te_controleren = true`. De status blijft `goedgekeurd`, maar het AVF verschijnt bij de stuurgroep met het label "Opnieuw te controleren" tot een stuurgroeplid opnieuw goedkeurt. De stuurgroep wijzigt AVF-inhoud nooit zelf; zij plaatst verbeterverzoeken.

## Verplichte afschermingstests (minimaal)

1. `vd-groep-1` kan het AVF van `vd-groep-2` niet lezen, ook niet via directe query, Storage-pad of `avf_versie`.
2. `vd-groep-1` ziet van `vd-groep-2` alleen de velden van `avf_publiek`.
3. Geen enkel VD-account (behalve docent) ziet iets van VC en andersom; TEST-accounts zien niets van VD en VC en andersom.
4. `vd-groep-1` kan zijn eigen AVF niet wijzigen als het `ingediend` is en kan nooit dag, tijd of locatie wijzigen.
10. Een stuurgroepaccount kan geen AVF-inhoud wijzigen, wel verbeterverzoeken plaatsen en de planning toewijzen.
5. `vd-groep-1` kan `avf.status` niet rechtstreeks wijzigen en geen budget toekennen.
6. `vd-groep-1` kan de budgetaanvragen van andere groepen niet lezen, wel `budget_resterend`.
7. `vd-student` kan niets schrijven.
8. Alleen `vd-stuur-logistiek` en `docent` kunnen de materialenlijst wijzigen.
9. Een niet-ingelogde bezoeker kan niets lezen.
