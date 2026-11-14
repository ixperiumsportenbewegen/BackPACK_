# Beheer instellen: geheime instellingen, blijf-actief en wekelijkse export

Een paar functies hebben geheime instellingen nodig die niet in de code mogen staan. Eenmalig instellen, op drie plekken.

## 1. Een geheime sleutel voor de blijf-actief-aanroep (CRON_SECRET)

Verzin een lange willekeurige tekst (minstens 30 tekens, letters en cijfers). Bijvoorbeeld in een terminal:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Gebruik **dezelfde** tekst op de drie plekken hieronder. Bewaar hem ook in je wachtwoordmanager.

## 2. In Vercel (website)

1. Ga naar vercel.com, kies het team **iXperium Sport en Bewegen** en het project **back-pack-one**.
2. Open **Settings** en dan **Environment Variables**.
3. Voeg toe (kies bij Environments: Production, Preview en Development):
   - `CRON_SECRET` met de tekst uit stap 1.
   - `SUPABASE_SERVICE_ROLE_KEY` met de service role key uit `.env.local` (Supabase: Project Settings, API). **Zet hem niet als "NEXT_PUBLIC"** en laat hem uit alle screenshots. Hiermee kan de docent wachtwoorden resetten.
4. Ga naar **Deployments** en kies bij de laatste deployment de drie puntjes en **Redeploy**, zodat de nieuwe instellingen worden gebruikt.

De dagelijkse aanroep staat al in `vercel.json` (elke dag om 06:00 UTC). Vercel stuurt de sleutel dan automatisch mee.

## 3. In GitHub (wekelijkse export)

1. Ga naar github.com/ixperiumsportenbewegen/BackPACK_ en open **Settings**, dan **Secrets and variables**, dan **Actions**.
2. Kies **New repository secret** en voeg drie geheimen toe:
   - `SUPABASE_URL`: het projectadres uit `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`).
   - `SUPABASE_SERVICE_ROLE_KEY`: dezelfde service role key.
   - `CRON_SECRET`: de tekst uit stap 1.
3. Open het tabblad **Actions**, kies **Wekelijkse export** en dan **Run workflow** om het meteen te proberen. Na een minuut staat onder de run een artefact **backpack-export** (JSON en Excel), 90 dagen bewaard.

Daarna draait de export elke maandag om 04:00 UTC.

## 4. Controleren

- **Blijf-actief:** open in de browser niets; de route antwoordt alleen met de sleutel. Test in een terminal (vervang de tekst):

  ```bash
  curl -i -H "x-cron-secret: JOUW_SLEUTEL" https://back-pack-one.vercel.app/api/blijf-actief
  ```

  Je krijgt `200` en de tekst `ok`. Zonder sleutel krijg je `401`.
- **Wachtwoord resetten:** log in als docent, ga naar Meer, dan Beheer, en reset een testaccount van het cluster TEST.

## Livegang

`npm run livegang -- --droog` laat eerst zien wat er zou gebeuren. `npm run livegang` doet het echt, na het intypen van LIVEGANG, en maakt vooraf een export in de map `export/`. Zie de uitleg bovenin `scripts/livegang.ts`.
Na de livegang staan de nieuwe inloggegevens per account in `seed/livegang-inloggegevens.txt` (niet in git): deel ze per groep via Teams en verwijder het bestand daarna.
