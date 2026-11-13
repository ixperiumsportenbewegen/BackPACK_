# Bouwvolgorde

Eerste versie = opdracht 1 t/m 5. Geef Claude Code steeds één opdracht tegelijk. Een opdracht is pas af als alle punten onder "Klaar als" kloppen en Bart het met de testaccounts heeft geprobeerd.

Kopieer per opdracht de tekst onder **Prompt** naar Claude Code.

---

## Opdracht 1 – Fundament, accounts en afscherming

**Prompt:** "Lees CLAUDE.md en docs/bouwvolgorde.md. Voer opdracht 1 uit. Maak eerst een plan en wacht op mijn akkoord."

Bouw:
- Next.js-project met TypeScript, Tailwind, ESLint, Vitest en Playwright; README met alle commando's.
- Supabase CLI-koppeling, eerste migraties voor: editie, cluster, meerdaagsethema, stuurgroeprol, projectgroep, projectgroep_rol, account, wijziging, plus de hulpfuncties (`mijn_soort()` enz.).
- Row Level Security op al deze tabellen volgens `docs/rechtenmatrix.md`.
- Seed-script dat `seed/basis.json` laadt in het Supabase-project, inclusief de 27 accounts en de 4 TEST-accounts, met wachtwoorden in een lokaal, niet-gecommit bestand.
- Inloggen met gebruikersnaam en wachtwoord; uitloggen.
- Layout met kopbalk, onderste navigatie en lege schermen; ontwerpwaarden uit `src/styles/tokens.css`; Roboto en Roboto Condensed via `next/font/google`; HAN-logo's uit `assets/logo` volgens `docs/huisstijl.md`.
- PWA-manifest met naam "Backpack_" (short_name "Backpack"), een eenvoudig backpack-icoon in HAN rood op wit en themakleur HAN rood (nog geen offline).
- Afschermingstests 3, 7 en 9 uit de rechtenmatrix.

**Klaar als:** alle 27 accounts kunnen inloggen en zien het juiste accountlabel; tests slagen; deploy op Vercel werkt.

---

## Opdracht 2 – Onze meerdaagse en het meerdaagsethema

**Prompt:** "Voer opdracht 2 uit uit docs/bouwvolgorde.md. Plan eerst."

Bouw:
- Startscherm Onze meerdaagse (OVZ-01, OVZ-02) voor alle accountsoorten, voorlopig met lege belevenissen.
- Werkpagina Beleving & Thema: meerdaagsethema instellen (THM-01) met upload sfeerbeeld en logo (Storage `thema`), accentkleur met automatische contrastcontrole.
- Thema-laag (THM-02): accentkleur, naam, logo en sfeerbeeld worden CSS-variabelen bovenop de HAN-basis; zonder thema de neutrale HAN-stijl met outdoorfoto.
- Sfeerfoto's uit `assets/fotos` in Storage `algemeen` of `public/`.
- Rolverdeling projectgroep (PGR-01) en namen per stuurgroeprol.

**Klaar als:** `vd-stuur-beleving` stelt een thema in en alle VD-accounts zien direct de nieuwe naam en kleur; VC ziet niets veranderen; contrastwaarschuwing werkt.

---

## Opdracht 3 – AVF invullen

**Prompt:** "Voer opdracht 3 uit uit docs/bouwvolgorde.md. Plan eerst."

Bouw:
- Migraties en afscherming voor avf, avf_fase, avf_onderdeel, view `avf_publiek`, Storage `avf`.
- AVF-schermen voor de projectgroep (secties A–G, AVF-01 t/m AVF-05), opslaan per veld met waarschuwing bij gelijktijdig wijzigen.
- `src/config/avf-velden.ts` volgens `docs/avf-velden.md`: alle velden met sectie, label, verplicht, projectgroeprol, stuurgroeprol, PACK-vak en wezenlijk. Schermen en controles lezen hieruit.
- Sectie H Communicatie en de EHBO-vraag in sectie E.
- Kop–romp–staart met onderdelen (toevoegen, verschuiven, verwijderen) en afbeeldingen (verkleinen, EXIF weg).
- Voortgang per sectie; eigenaar-rol per sectie (PGR-02).
- Belevenissen-scherm: eigen AVF en de andere vijf als publieke kaarten.
- Printweergave volledig AVF (PDF-01).
- Testdata: `seed/avf-voorbeeld.json` ingeladen bij `vd-groep-1`.
- Afschermingstests 1 en 2.

**Klaar als:** `vd-groep-1` kan het voorbeeld-AVF volledig bekijken en aanpassen op een telefoon; twee browsers tegelijk op hetzelfde account overschrijven elkaar niet ongemerkt; `vd-groep-2` ziet alleen de publieke kaart.

---

## Opdracht 4 – Indienen en beoordelen

**Prompt:** "Voer opdracht 4 uit uit docs/bouwvolgorde.md. Plan eerst."

Bouw:
- avf_versie, verbeterverzoek, themacheck en de functies `avf_indienen`, `avf_aanpassing_vragen`, `avf_goedkeuren`.
- Controlelijst bij indienen (verplichte velden uit PRD 5.1, alle projectgroeprollen ingevuld), naamveld, wijzigingssamenvatting vanaf versie 2.
- Beoordelingsscherm voor stuurgroep en docent (AVF-06 t/m AVF-08), versie-overzicht.
- Trigger voor `opnieuw_te_controleren` (AVF-09): goedgekeurd AVF blijft bewerkbaar; wezenlijke wijziging geeft het label "Opnieuw te controleren".
- Stuurgroepdashboard met PACK-indeling en een rolweergave voor alle zes rollen, gevuld via `src/config/avf-velden.ts` (zie `docs/schermen.md`).
- Planning toewijzen met `avf_planning_toewijzen`: dag en tijd door Projectleiding, locatie door Logistiek & Facilitair (beide mogen in de database, de interface toont het bij de juiste rol).
- Logboekregels in `wijziging` voor indienen, aanpassing vragen en goedkeuren.
- Afschermingstests 4, 5 en 10.

**Klaar als:** het acceptatiescenario met verbeterverzoek, aanpassen, opnieuw indienen en goedkeuren uit PRD hoofdstuk 12 werkt van begin tot eind.

---

## Opdracht 5 – Materialen en budget

**Prompt:** "Voer opdracht 5 uit uit docs/bouwvolgorde.md. Plan eerst."

Bouw:
- materiaal, avf_materiaal, view `materiaal_behoefte`; beheer basislijst (MAT-00); kiezen in AVF sectie F met beschikbare voorraad en meldingen (MAT-02).
- Werkpagina Logistiek & Facilitair: behoefte en tekorten per locatie, correcties.
- budgetaanvraag, `budget_besluit`, `budget_aanvraag_indienen`, `budget_resterend` (BUD-01 t/m BUD-06).
- Werkpagina Communicatie & Financiën en budgetscherm voor de projectgroep.
- Beheerpagina docent: wachtwoord resetten, clustergegevens, knop "Alles exporteren" (JSON en Excel).
- Blijf-actief-route `/api/blijf-actief`: doet een kleine leesquery op Supabase (bijv. `select count(*) from editie`) en geeft `ok` terug. Beveiligd met een geheime sleutel in de header (`CRON_SECRET`).
- Vercel Cron (`vercel.json`) die `/api/blijf-actief` elke dag aanroept, zodat de website en Supabase nooit een week stil liggen.
- GitHub Actions-workflow die wekelijks een volledige export maakt (JSON, als artefact 90 dagen bewaard) en daarbij ook `/api/blijf-actief` aanroept als tweede vangnet.
- Script `npm run livegang` (zie CLAUDE.md, Omgevingen).
- Afschermingstests 6 en 8.

**Klaar als:** het budgetscenario (€ 60 aangevraagd, € 50 toegekend, € 200 resterend) en het materiaaltekortscenario uit PRD hoofdstuk 12 werken; de wekelijkse export draait.

---

## Daarna (latere opdrachten)

6. Draaiboek en locaties (PRG-01 t/m PRG-04)
7. Informatiepagina's en Teams-knop (INF-01, INF-02), meerdaagse-informatie (KAM-01)
8. Zoeken (ZOE-01, ZOE-02)
9. Meerdaagsemodus en offline lezen (KAM-02, KAM-03), PDF-draaiboeken (PDF-02, PDF-03)
10. Overige werkpagina's, deadlines en besluitenlijst (STG-01 t/m STG-03), corvee, inkooplijst en teasers (LOG-01, FIN-01, THM-05)

Livegang met echte studenten: na opdracht 5 met `npm run livegang` (testdata VD en VC weg, nieuwe wachtwoorden; cluster TEST blijft).
