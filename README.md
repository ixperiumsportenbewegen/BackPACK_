# Backpack_

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
