# Backpack_

**Backpack_** is een mobiele webapp (PWA) voor de Ardennen-meerdaagse van Sportkunde (HAN), 28–30 juni 2027. Twee clusters (VD en VC) van elk ca. 55 studenten. Per cluster zes projectgroepen die elk een belevenis voorbereiden met een AVF (Activiteiten Voorbereidings Formulier) en een stuurgroep van studenten met zes rollen. De app geeft elk cluster overzicht over de eigen meerdaagse, met het zelfgekozen meerdaagsethema centraal.

De naam is ook de metafoor: alles wat je nodig hebt voor de meerdaagse zit in je backpack. De underscore verwijst naar de HAN-stijl (HAN_). De vier vakken heten **PACK**: Pleister (veiligheid, welzijn, logistiek), Aansteker (beleving, thema, AVF's), Camera (communicatie en financiën) en Kompas (projectleiding). Zie PRD 4.1 en `docs/huisstijl.md`.

Dit is een experiment van docent Bart, gebouwd zonder HAN-ICT. Bart is geen ontwikkelaar: leg keuzes kort en in gewone taal uit.

## Welke documenten leidend zijn

Bij tegenstrijdigheid geldt deze volgorde:

1. `docs/bouwvolgorde.md` – wat je NU bouwt. Bouw alleen de opdracht waar Bart om vraagt.
2. `docs/rechtenmatrix.md` – wie wat mag zien en wijzigen. Nooit van afwijken zonder overleg.
3. `docs/datamodel.md` – tabellen, velden en relaties.
   `docs/avf-velden.md` – alle AVF-velden met verplichting en koppeling aan projectgroep- en stuurgroeprol.
4. `docs/schermen.md` – schermen en navigatie per account.
   `docs/huisstijl.md` – HAN-kleuren, letter, logo, iconen en foto's.
5. `docs/PRD.md` – volledige productbeschrijving en acceptatiecriteria.
6. `docs/open-punten.md` – nog niet besloten. Gebruik de daar genoemde tijdelijke keuze en meld het.

Een ouder "achtergronddocument" bestaat, maar is NIET leidend (oude themanamen, offline bewerken, docentfeedback, het woord "kamp"). Gebruik het niet.

Is iets onduidelijk of ontbreekt het: vraag het Bart in plaats van te gokken. Leg besluiten vast in `docs/beslissingen.md` (datum, besluit, reden).

## Stack

- Next.js (App Router) met TypeScript en Tailwind CSS
- Supabase (EU-regio, gratis abonnement): Postgres, Auth, Storage, Row Level Security
- `@supabase/ssr` voor sessies; server actions of route handlers voor schrijfacties
- PWA: manifest en service worker (Serwist); offline komt pas in een latere opdracht
- Hosting: Vercel; code: GitHub
- Tests: Vitest (unit), Playwright (end-to-end), SQL-tests voor de afscherming (zie hieronder)

Gebruik stabiele, gangbare versies. Voeg geen extra diensten of betaalde pakketten toe zonder te vragen.

## Harde regels

- **Afscherming zit in de database.** Elke tabel heeft Row Level Security. Verberg nooit alleen knoppen. Statuswijzigingen (indienen, goedkeuren enz.) lopen via Postgres-functies die de rechten controleren, niet via losse updates vanaf de client.
- **Service role key nooit in de browser.** Alleen in server-code en scripts, via omgevingsvariabelen.
- **Test de afscherming eerst.** Bij elke nieuwe tabel of functie: tests die met elk testaccount proberen te lezen en schrijven wat niet mag. Een opdracht is pas af als deze tests slagen.
- **Geen persoonsgegevens in accounts.** Er zijn alleen gedeelde accounts per rol of groep. Namen typen studenten zelf in (bijv. bij indienen). Nooit e-mailadressen van studenten, studentnummers, medische gegevens of allergieën per persoon opslaan.
- **Geen chat, reacties of pushmeldingen.** Communicatie op korte termijn gaat via Teams.
- **Taal:** alle teksten in de interface in het Nederlands. Gebruik "meerdaagse", nooit "kamp". In Nederlandse teksten geen komma vóór "en".
- **Mobiel eerst:** alles moet goed werken op een telefoon met één hand, ook buiten in fel licht. Grote aanraakvlakken, hoog contrast.
- **Huisstijl:** volg `docs/huisstijl.md`. Alle kleuren, lettertypen en afstanden komen uit `src/styles/tokens.css`. Tertiaire HAN-kleuren alleen in grafieken. Het meerdaagsethema overschrijft alleen accentkleur (rood, oranje, groen of blauw), naam, logo en sfeerbeeld. Gebruik alleen de logobestanden uit `assets/logo` volgens `docs/huisstijl.md`; nooit een logo natekenen of omkleuren.
- **Opslaan per veld.** Meerdere studenten werken tegelijk met hetzelfde account. Sla velden afzonderlijk op en waarschuw als iemand anders hetzelfde onderdeel net heeft gewijzigd (vergelijk `updated_at`).

## Naamgeving

- Database- en domeinnamen in het Nederlands, zoals in `docs/datamodel.md` (bijv. `avf`, `projectgroep`, `budgetaanvraag`).
- Overige code (functies, componenten) in het Engels mag.
- Accountnamen: zie `seed/basis.json`.

## Werkwijze

1. Lees bij de start van een opdracht `docs/bouwvolgorde.md` en de genoemde PRD-eisen.
2. Maak een kort plan en laat het Bart goedkeuren voor je begint.
3. Werk in kleine stappen met een commit per stap en duidelijke commitberichten in het Nederlands.
4. Schrijf eerst de migratie en de afschermingstests, dan de schermen.
5. Rond af met: tests groen, `npm run build` zonder fouten en een korte uitleg voor Bart wat hij kan testen en met welk account.

## Omgevingen

Er is **één** Supabase-project (`ardennen-meerdaagse`, gratis abonnement, EU-regio). Daarom:
- **Tot de livegang** bevat het project de testdata uit `seed/` (clusters VD en VC met fictieve groepen).
- **Livegang** via het script `npm run livegang`: verwijdert alle data van VD en VC, laadt de basisgegevens opnieuw zonder voorbeeld-AVF en maakt nieuwe wachtwoorden voor alle accounts. Vraagt eerst om bevestiging en maakt vooraf een export.
- **Cluster TEST** blijft altijd bestaan: een apart, fictief cluster met eigen accounts (`test-stuur`, `test-groep-1`, `test-groep-2`, `test-student`) en het voorbeeld-AVF. Hierin probeer je na de livegang nieuwe functies uit. Door de afscherming per cluster ziet niemand van VD of VC er iets van. De docent ziet TEST wel, als derde keuze naast VD en VC.
- **Migraties na de livegang** draaien op echte data. Daarom altijd: eerst een export, migratie laten lezen door Bart, alleen toevoegende wijzigingen (geen kolommen of tabellen verwijderen zonder overleg), daarna testen in cluster TEST.
- Migraties staan in `supabase/migrations/` en worden met de Supabase CLI toegepast.
- Geheime sleutels in `.env.local` (nooit committen); maak een `.env.example` met lege waarden.

## Commando's

Leg de gebruikte commando's (installeren, ontwikkelen, testen, migreren, seed laden, exporteren, livegang) vast in `README.md` zodra ze bestaan.
