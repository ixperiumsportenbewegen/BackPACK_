# Overdracht (stand 13 november 2026)

Voor een nieuwe sessie of een nieuwe collega. Lees eerst `CLAUDE.md` (leidende documenten en harde regels). Dit bestand vult aan met de stand van zaken, hoe je werkt en wat je moet weten uit de eerdere sessie. Het is geen vervanging van `docs/bouwvolgorde.md`.

## Waar staat wat

| Wat | Waar |
|---|---|
| Code | https://github.com/ixperiumsportenbewegen/BackPACK_ (branch `main`) |
| Website | https://back-pack-one.vercel.app (Vercel-team iXperium Sport en Bewegen; deployt automatisch bij elke push) |
| Database | Supabase-project `backpack`, ref `aryntrmhpgowvzxyobfr` (één project voor alles; gratis abonnement) |
| Sleutels | `.env.local` (niet in git). Vercel heeft alleen `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Wachtwoorden testaccounts | `seed/wachtwoorden.local.json` (niet in git; komt uit `npm run seed`) |
| Gebruikers | Bart is docent en geen ontwikkelaar: leg keuzes kort en in gewone taal uit, schrijf Nederlands, vraag liever dan te gokken |

## Wat is af

- **Opdracht 1** Fundament: Next.js 16 (App Router, Tailwind 4), inloggen met gebruikersnaam, 31 gedeelde accounts (docent, per cluster 6 stuurgroep + 6 projectgroep + 1 student, plus 4 TEST), Row Level Security, PWA-manifest, kopbalk en onderste navigatie.
- **Opdracht 2** Onze meerdaagse: meerdaagsethema per cluster (stuurgroep stelt het in, uploadt sfeerbeeld of kiest een outdoorfoto), rolverdeling per projectgroep en namen per stuurgroeprol. Zonder thema staat er "Meerdaagsethema nog niet gekozen".
- **Opdracht 3** AVF invullen, uitgebreid met:
  - AVF-secties A–H voor de projectgroep (F toont "komt later"), opslaan per veld met waarschuwing bij gelijktijdig wijzigen, kop-romp-staart met onderdelen en afbeeldingen, voortgang per sectie, publieke kaarten (`avf_publiek`), afdrukweergave, voorbeeld-AVF bij `vd-groep-1` en `test-groep-1`.
  - **Vast programma per cluster** met zes tijdvakken voor belevenissen (één projectgroep per tijdvak). VD en VC hebben elk hun eigen programma (VC is gespiegeld); TEST gebruikt dat van VD. De stuurgroep beheert tijden, wijst groepen toe en wisselt ze, en voegt vaste activiteiten toe of verwijdert ze. De zes belevenisvakken kunnen nooit worden verwijderd (afgedwongen in de database). Verandert een eindtijd, dan schuiven de aansluitende activiteiten mee, met een uitroepteken en de oorspronkelijke tijd tot de stuurgroep bevestigt.
  - Verschijningsvorm met meerdere keuzes (Spel, Wedstrijd, Avontuur, Gezondheid, Recreatie, Show), locatie kiezen (Camping, Bivak of Anders) door de stuurgroep, navigatie door het AVF (sectiebalk, vorige en volgende), het BackPACK_-avatar als app-icoon.
- Alles staat live. Test voor elke opdracht: log in met de testaccounts, ook op een telefoon.

- **Opdracht 4** Indienen en beoordelen: `/avf/indienen` (controlelijst, naam, samenvatting vanaf versie 2, waarschuwing bij open verzoeken zonder aanpassing), beoordelen op `/belevenissen/[id]` (verbeterverzoeken per sectie en onderdeel, themachecks, aanpassing vragen, goedkeuren, tabblad Versies), label "Opnieuw te controleren" via triggers, stuurgroepdashboard met rolweergave op `/stuurgroep/rol/[code]` (opent op de eigen rol, overzicht via `/stuurgroep?alle=1`). Migraties 12 en 13.

- **Opdracht 5, deel A (materialen)**: de projectgroep kiest zelf de locatie (camping of bivak, plus waar precies) in sectie A. Eén gedeelde materialenlijst voor VD en VC met voorraad per locatie: Logistiek & Facilitair van VD bouwt hem als concept en maakt hem definitief (`/stuurgroep/materialen`); daarna kiezen projectgroepen in sectie F en ziet VC de lijst (VC mag alleen toevoegen). Voorraad per locatie en moment (hergebruik): `/stuurgroep/materialen/behoefte` met tekorten en correcties. Migraties 14 tot en met 18. De startlijst (50 materialen in 10 categorieën, zonder voorraad) staat in `seed/materialen.json`; Logistiek & Facilitair schat de voorraad zelf in. Zie de beslissingen van 13 november.

**Volgende stap: opdracht 5, deel B (budget) en deel C (beheer, export, blijf-actief, livegang).** Zie `docs/bouwvolgorde.md` en het plan in het gesprek. `avf_indienen` moet dan ook de budgetaanvraag doorzetten.

## Hoe je werkt

Op deze Windows-machine blokkeert PowerShell `npx` en `npm`: gebruik `npx.cmd` en `npm.cmd`, of Git Bash.

| Doel | Commando |
|---|---|
| Ontwikkelserver | `npm run dev` (http://localhost:3000). Na een wijziging in `globals.css` of de Tailwind-instellingen de server herstarten |
| Controle | `npm run lint`, `npm run build` (draai build niet terwijl de ontwikkelserver loopt en je tegelijk test) |
| Database-tests | `npm test` (Vitest, tegen het echte Supabase-project; de bestanden draaien achter elkaar omdat ze één database delen) |
| End-to-endtests | `npx playwright test e2e/<bestand>` (telefoonformaat); tegen de live site: `BASE_URL=https://back-pack-one.vercel.app npx playwright test ...` |
| Migraties toepassen | `npm run db:push -- --yes` (leest het databasewachtwoord uit `.env.local`) |
| Testdata laden | `npm run seed`; een programma terugzetten: `npm run seed -- --programma-opnieuw=VC` |
| Iconen opnieuw maken | `node scripts/maak-iconen.mjs` |

Migraties staan in `supabase/migrations/` (nu 1 t/m 18). Voor de livegang mogen ze nog opruimen; daarna alleen toevoegend (zie `CLAUDE.md`).

## Valkuilen uit de vorige sessie

1. **Inloglimiet Supabase:** ca. 30 inlogpogingen per 5 minuten per IP-adres (open punt 8). De tests hergebruiken sessies in `.auth-cache/`; `e2e/inloggen.spec.ts` logt in met alle accounts en moet los en niet vlak na andere tests draaien. Bij `over_request_rate_limit`: 5 minuten wachten.
2. **Tests raken echte data.** Alles draait tegen het ene Supabase-project. Een test mag niets achterlaten: herstel wat je wijzigt, en test wijzigingen aan het programma bij voorkeur op het TEST-cluster (`test-stuur`). Eén keer wijzigde een test per ongeluk het VD-programma; dat is hersteld.
3. **Test op echte wachttijden:** wacht in e2e-tests op de database of de pagina (`expect.poll`, `waitForLoadState("networkidle")`) voor je doorgaat, en gebruik `getByText("Opgeslagen", { exact: true })` (anders vindt hij ook de uitlegtekst "…direct opgeslagen").
4. **Opslaan per veld** vergelijkt de waarde die iemand zag met de huidige waarde (compare-and-set), niet het tijdstip van de hele rij. Zie `src/app/(app)/avf/actions.ts` en de functies `avf_veld_opslaan`, `avf_lijst_*`. Bij gedeelde accounts logt uitloggen alleen dat apparaat uit.
5. **Woordgebruik:** altijd "BackPACK_", "meerdaagse" (nooit "kamp"), Nederlandse teksten zonder komma voor "en".
6. Maak tijdelijke scripts als `scripts/tmp-*` en verwijder ze direct; ze horen niet in git.

## Open punten en keuzes om te onthouden

- `docs/open-punten.md`: punt 8 (inloglimiet), punt 9 (bij dinsdagmiddag staat "PG5*", gelezen als projectgroep 6) en punt 10 (de docent kan AVF-inhoud in de app nog niet bewerken, alleen lezen).
- `docs/beslissingen.md` bevat elk besluit met datum, ook die over het programma, de verschijningsvorm, de locatiekeuze, de navigatie en het icoon.
- Het HAN-logo is nog de PNG uit 2019 (open punt 1). Sectie F (materialen en financieel plan) komt in opdracht 5; materialen staan in `seed/basis.json` maar worden pas dan geladen.
