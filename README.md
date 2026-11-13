# BackPACK_

Mobiele webapp (PWA) voor de Ardennen-meerdaagse van Sportkunde (HAN), 28–30 juni 2027. Zie `CLAUDE.md` en `docs/`.

## Eenmalig

```bash
npm install
cp .env.example .env.local   # vul de sleutels in, nooit committen
npx supabase login
npx supabase link --project-ref aryntrmhpgowvzxyobfr
```

## Commando's

| Commando | Wat het doet |
|---|---|
| `npm run dev` | Ontwikkelserver op http://localhost:3000 |
| `npm run build` | Productiebuild |
| `npm run lint` | ESLint |
| `npm test` | Vitest (waaronder de afschermingstests tegen het Supabase-project) |
| `npm run test:e2e` | Playwright (mobiel) |
| `npm run db:push` | Migraties uit `supabase/migrations/` toepassen op het gekoppelde project |
| `npm run seed` | `seed/basis.json` laden; schrijft wachtwoorden naar `seed/wachtwoorden.local.json` |

Export, livegang en blijf-actief volgen in latere opdrachten.

## Op Windows

PowerShell blokkeert soms `npx`. Gebruik dan `npx.cmd` (bijvoorbeeld `npx.cmd supabase login`).

## Testaccounts

De wachtwoorden staan na `npm run seed` in `seed/wachtwoorden.local.json` (niet in git). Gebruikersnamen: zie `seed/basis.json`.

## Tests

- `npm test`: afschermingstests (3, 7 en 9 uit `docs/rechtenmatrix.md`) tegen het Supabase-project.
- `npm run test:e2e`: inloggen met alle accounts op een telefoonscherm. Eenmalig `npx.cmd playwright install chromium`.

- Tegen de Vercel-site: `BASE_URL=https://back-pack-one.vercel.app npm run test:e2e` (in PowerShell: `$env:BASE_URL="https://back-pack-one.vercel.app"; npm.cmd run test:e2e`).

## Let op bij tests

Supabase remt inloggen af op ca. 30 pogingen per 5 minuten per IP-adres (zie `docs/open-punten.md`, punt 8). Draai `npm test` en `npm run test:e2e` daarom niet vlak achter elkaar; de inlogtest voor alle accounts (`e2e/inloggen.spec.ts`) gebruikt er in één keer 31.

## Programma en AVF

- `seed/programma.json`: het programma (28–30 juni) per cluster (VD, VC en TEST) met de zes tijdvakken voor belevenissen; `npm run seed` laadt het en laat bestaande regels staan. Een programma opnieuw laden (overschrijft de regels van dat cluster, toewijzingen blijven): `npm run seed -- --programma-opnieuw=VC`.
- `seed/avf-voorbeeld.json`: het voorbeeld-AVF bij `vd-groep-1` en `test-groep-1` (alleen als het AVF nog leeg is).
- `src/config/avf-velden.ts`: alle AVF-velden met eigenaar, verplichting en stuurgroepkoppeling (bron: `docs/avf-velden.md`; een test bewaakt dat beide gelijk blijven).

## Testsessies

De tests hergebruiken sessies (30 minuten, map `.auth-cache/`, niet in git), zodat we onder de inloglimiet van Supabase blijven. Alleen `e2e/inloggen.spec.ts` logt echt in met alle accounts: draai die los en niet vlak achter andere tests.
