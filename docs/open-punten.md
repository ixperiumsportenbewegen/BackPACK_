# Open punten

Nog niet besloten. Claude Code gebruikt de **tijdelijke keuze** en meldt het aan Bart als het punt in een opdracht speelt. Zodra Bart beslist: verplaats het punt naar `beslissingen.md`.

| # | Vraag | Tijdelijke keuze | Speelt in opdracht |
|---|---|---|---|
| 1 | Actuele HAN-logo's als SVG (de PNG's in `assets/logo` zijn uit 2019) en de HAN-iconenset, aan te vragen via huisstijl@han.nl | PNG-logo's uit `assets/logo` op witte achtergrond; Lucide-lijniconen | 1, 2 |
| 2 | AVF-velden en vereenvoudigingen bevestigd door de docenten (PRD 5.1 en 5.2) | Velden zoals in PRD 5.1 | 3 |
| 3 | Precieze AVF-deadlines VD en VC | Geen deadline in de app tot ze bekend zijn | later |
| 4 | Hoe wachtwoorden bij de groepen komen | Docent deelt per groep via het eigen Teams-kanaal | livegang |
| 5 | Wanneer gaan de eerste VD-projectgroepen de app echt gebruiken? | Na opdracht 5 | livegang |
| 6 | Webadres (nu back-pack-one.vercel.app; eigen naam kan later) | `<projectnaam>.vercel.app` | 1 |
| 7 | Avenir Next-webfontlicentie | Roboto en Roboto Condensed (door de HAN toegestaan alternatief) | – |
| 8 | Supabase remt inloggen af op ca. 30 pogingen per 5 minuten per IP-adres (gemeten 13 november 2026: foutmelding `over_request_rate_limit`). Als een hele klas tegelijk inlogt vanaf het schoolwifi kunnen studenten tijdelijk niet inloggen | "Ingelogd blijven" staat standaard aan, dus meestal één keer per telefoon inloggen. Bart kijkt in Supabase onder Authentication → Rate Limits of de limiet omhoog kan; anders de groepen laten inloggen met een paar minuten ertussen | livegang |
| 9 | Programma: bij dinsdagmiddag staat in de bron "PG5*" (zowel VD als VC); gelezen als projectgroep 6 (PG5 organiseert voor PG4 en PG6). Het cluster TEST gebruikt het programma van VD | Zoals in `seed/programma.json`; de stuurgroep past het programma in de app aan | 3 |
| 10 | De docent kan in de app nog niet zelf AVF-inhoud bewerken (de database staat het wel toe); de stuurgroep en docent lezen het AVF in de afdrukweergave | Alleen lezen voor stuurgroep en docent | 3 |
