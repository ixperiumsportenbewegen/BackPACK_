# Zo start je met bouwen

Dit pakket is de startinhoud van je codeproject. Claude Code leest het en bouwt de app in vijf opdrachten.

## Eenmalig voorbereiden (ongeveer een uur)

1. **GitHub:** maak een nieuwe, privé repository, bijvoorbeeld `ardennen-meerdaagse`.
2. **Bestanden erin:** zet de inhoud van deze map (CLAUDE.md, STARTEN.md, docs/, seed/, assets/, src/) in de hoofdmap van die repository.
3. **Supabase:** maak één project `ardennen-meerdaagse` in regio **Central EU (Frankfurt)**. Bewaar het databasewachtwoord in je wachtwoordbeheerder. Noteer de Project URL, de anon key en de service role key (Project Settings → API). Deel die sleutels niet in chats.
4. **Supabase-instelling:** zet bij Authentication → Providers → Email de optie "Confirm email" uit (de app gebruikt interne e-mailadressen bij gebruikersnamen).
5. **Vercel:** koppel de GitHub-repository aan een nieuw Vercel-project. De omgevingsvariabelen vult Claude Code samen met jou in tijdens opdracht 1.
6. **Claude Code:** open de repository in Claude Code.

## Bouwen

Geef Claude Code de prompt van opdracht 1 uit `docs/bouwvolgorde.md`:

> Lees CLAUDE.md en docs/bouwvolgorde.md. Voer opdracht 1 uit. Maak eerst een plan en wacht op mijn akkoord.

Controleer het plan, geef akkoord en test aan het eind met de testaccounts. Pas daarna opdracht 2, enzovoort.

## Tips

- Eén opdracht per keer. Stop een opdracht niet halverwege om iets nieuws toe te voegen; noteer het in `docs/open-punten.md`.
- Test elke opdracht ook op je telefoon.
- Twijfel je over een keuze van Claude Code, vraag dan "Waarom kies je dit en wat zijn de alternatieven?".
- Na opdracht 5: `npm run livegang` (testdata van VD en VC weg, nieuwe wachtwoorden), daarna wachtwoorden via Teams naar de groepen. Het cluster TEST blijft om later nieuwe functies te proberen.

## Nog aanvragen

- Actuele HAN-logo's als SVG en de HAN-iconenset via huisstijl@han.nl (zie `docs/huisstijl.md`). Tot dan gebruikt de app de PNG-logo's in `assets/logo`.
