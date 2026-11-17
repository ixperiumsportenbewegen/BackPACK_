// Maakt per stuurgroeprol van VD één A4-handleiding als pdf.
//
// Gebruik:
//   node scripts/maak-handleidingen.mjs                      -> wachtwoordvak blijft leeg ("wordt ingevuld")
//   node scripts/maak-handleidingen.mjs --wachtwoorden=pad.json
//        pad.json: { "vd-stuur-projectleiding": "...", ... } (gebruikersnaam -> wachtwoord)
//
// Resultaat: export/handleidingen/BackPACK_handleiding_VD_<rol>.pdf
// De map export/ staat in .gitignore (met wachtwoorden erin nooit committen).
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const uit = join(root, "export", "handleidingen");
mkdirSync(uit, { recursive: true });

const arg = process.argv.find((a) => a.startsWith("--wachtwoorden="));
const wachtwoorden = arg ? JSON.parse(readFileSync(arg.split("=")[1], "utf8")) : {};

const WEBSITE = "back-pack-one.vercel.app";
const dataUri = (f) => "data:image/png;base64," + readFileSync(join(root, "assets", "logo", f)).toString("base64");
const logo = dataUri("han-merkteken-descriptor-480.png");
const sport = dataUri("han-sport-en-bewegen-400.png");

const rollen = [
  {
    bestand: "Projectleiding",
    gebruikersnaam: "vd-stuur-projectleiding",
    naam: "Projectleiding",
    pack: "K · Kompas",
    focus: "Aansturing, besluiten en groepsdynamiek. Jullie houden het overzicht over alle zes de projectgroepen.",
    ziet: [
      "Rolverdeling, titel, organiserende studenten, aantal deelnemers en contactpersoon (sectie A)",
      "Afstemming met anderen (sectie G)",
      "De status van álle AVF's",
    ],
    eerste: [
      "Open <b>Onze meerdaagse</b> en kies <b>Deadlines instellen</b>: wie moet wat wanneer af hebben.",
      "Vul onder <b>Meer → Stuurgroep</b> de namen van de stuurgroep in (één naam per veld).",
      "Wijs per belevenis dag en tijd toe op de werkpagina Projectleiding.",
      "Bekijk bij <b>Belevenissen</b> welke groepen vooraf achterlopen.",
    ],
  },
  {
    bestand: "Programma_en_Kwaliteit",
    gebruikersnaam: "vd-stuur-programma",
    naam: "Programma &amp; Kwaliteit",
    pack: "A · Aansteker",
    focus: "Planning, samenhang en overdracht. Jullie bewaken de kwaliteit van het programma en van elk AVF.",
    ziet: [
      "Verschijningsvorm, doelgroep en tijdvak (A), beginsituatie (B) en doelen (C)",
      "Kop, romp en staart: organisatie, onderdelen, differentiatie en USV (D)",
      "Samenhang met het programma (G)",
    ],
    eerste: [
      "Open <b>Stuurgroep → Programma &amp; Kwaliteit</b> en kijk per AVF welke velden leeg zijn.",
      "Bekijk of het programma klopt: <b>Meer → Programma beheren</b>.",
      "Tik op een veld, lees het AVF en kies <b>Verbeterverzoek</b> voor de juiste projectgroeprol.",
      "Controleer of het beoordelingsformulier en de criteria klaarstaan voor de workshop.",
    ],
  },
  {
    bestand: "Beleving_en_Thema",
    gebruikersnaam: "vd-stuur-beleving",
    naam: "Beleving &amp; Thema",
    pack: "A · Aansteker",
    focus: "Verhaal, sfeer, huisstijl en pre-exposure. Jullie bewaken de rode draad van de meerdaagse.",
    ziet: [
      "Publieke samenvatting van elke belevenis (sectie A)",
      "Bijdrage aan het meerdaagsethema (sectie G)",
      "Het meerdaagsethema zelf: naam, verhaal, sfeerbeeld en accentkleur",
    ],
    eerste: [
      "Zodra het thema is gekozen: <b>Onze meerdaagse → Thema kiezen</b> (naam, verhaal, beeld, accentkleur).",
      "Kies een rustig, helder sfeerbeeld; geen donkere of fantasy-beelden.",
      "Lees per AVF de bijdrage aan het thema en geef een <b>themacheck</b> (akkoord of aandachtspunt).",
      "Vertel de projectgroepen wat de rode draad is, voordat ze sectie G invullen.",
    ],
  },
  {
    bestand: "Veiligheid_en_Welzijn",
    gebruikersnaam: "vd-stuur-veiligheid",
    naam: "Veiligheid &amp; Welzijn",
    pack: "P · Pleister",
    focus: "Risicoanalyse, EHBO, weerplan, sociale veiligheid en catering. Veiligheid gaat voor alles.",
    ziet: [
      "Sociale en fysieke veiligheid per onderdeel en USV &ldquo;veilig&rdquo; (D)",
      "Risico's, vier weerscenario's en EHBO (sectie E, volledig)",
      "Catering en allergieën (sectie G; zonder namen)",
    ],
    eerste: [
      "Open <b>Meer → Calamiteitenplan</b> en maak het af (het uitroepteken verdwijnt dan).",
      "Zie per AVF waar de weerafweging of het EHBO-antwoord nog ontbreekt.",
      "Zet geen namen, allergieën of medische gegevens in de app; die haal je buiten de app op.",
      "Leg afspraken en de meldroute voor sociale veiligheid vast.",
    ],
  },
  {
    bestand: "Logistiek_en_Facilitair",
    gebruikersnaam: "vd-stuur-logistiek",
    naam: "Logistiek &amp; Facilitair",
    pack: "P · Pleister",
    focus: "Locaties, materialen, op- en afbouw en corvee. Jullie regelen dat alles op de juiste plek is.",
    ziet: [
      "Locatie van elke belevenis toewijzen: camping of bivak (A)",
      "Opruimen (D), materialen (F)",
      "Vervoer, op- en afbouw en corvee (G)",
    ],
    eerste: [
      "Vul <b>Meer → Materialenlijst</b>: de voorraad per locatie (camping en bivak) en maak de lijst definitief.",
      "Bekijk <b>Aanvragen</b> van de projectgroepen en handel ze af.",
      "Controleer materiaal met de <b>Materiaalcontrole</b> (inpakken, op locatie, retour).",
      "Maak de <b>persoonlijke paklijst</b> af (Meer), zodat iedereen weet wat mee moet.",
    ],
  },
  {
    bestand: "Communicatie_en_Financien",
    gebruikersnaam: "vd-stuur-financien",
    naam: "Communicatie &amp; Financiën",
    pack: "C · Camera",
    focus: "Documenten, budget, inkoop en communicatie voor, tijdens en na de meerdaagse.",
    ziet: [
      "Het financieel plan van elke belevenis (sectie F)",
      "Communicatie voor, tijdens en na (sectie H)",
      "Het budget van het cluster en alle aanvragen",
    ],
    eerste: [
      "Open <b>Stuurgroep → Budget beheren</b> en controleer het clusterbudget.",
      "Beoordeel aanvragen: toekennen, lager bedrag, terug of afwijzen (met toelichting).",
      "Stel de <b>Forms-link</b> in voor aankopen en declareren (onder Meer → Beheer).",
      "Geef feedback op sectie H van de projectgroepen.",
    ],
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function html(r) {
  const ww = wachtwoorden[r.gebruikersnaam];
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 0 }
  * { box-sizing: border-box }
  body { margin:0; font-family: Roboto, Arial, sans-serif; font-size: 10.2pt; line-height: 1.38; color:#454545 }
  .pagina { width:210mm; height:297mm; padding: 11mm 13mm 9mm; position:relative }
  h1,h2,h3 { font-family:"Roboto Condensed", Roboto, Arial, sans-serif; color:#000; margin:0; font-weight:700 }
  .kop { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #E50056; padding-bottom:6px }
  .kop img { height: 15mm }
  .kop .titel { text-align:right }
  .kop .titel .merk { font-family:"Roboto Condensed"; font-weight:700; font-size:21pt; color:#000; line-height:1 }
  .kop .titel .sub { color:#757575; font-size:9pt }
  h2 { font-size:18pt; margin:10px 0 2px }
  .pack { display:inline-block; background:#F5A846; color:#000; font-weight:700; font-size:8pt; padding:1px 7px; border-radius:8px; margin-left:6px; vertical-align:middle }
  .focus { margin: 0 0 7px }
  .inlog { border:2px solid #000; border-radius:8px; padding:9px 12px; display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; background:#F8F8F8 }
  .inlog .l { font-size:7.4pt; text-transform:uppercase; letter-spacing:.04em; color:#757575; font-weight:500 }
  .inlog .w { font-size:13pt; font-weight:700; color:#000; word-break:break-all }
  .inlog .leeg { color:#919191; font-weight:400; font-style:italic; font-size:9.5pt }
  .twee { display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-top:11px }
  h3 { font-size:12.5pt; border-bottom:1px solid #E3E3E3; padding-bottom:1px; margin-bottom:3px }
  ol, ul { margin:0; padding-left:15px }
  li { margin:0 0 3px }
  .knoppen { display:grid; grid-template-columns: repeat(4,1fr); gap:5px; margin:4px 0 0 }
  .kn { border:1px solid #E3E3E3; border-radius:6px; padding:4px 4px; text-align:center; font-size:8.4pt; background:#fff }
  .kn b { display:block; color:#000; font-size:9.2pt }
  .rol { background:#fff; border:2px solid #E50056; border-radius:8px; padding:8px 12px 6px; margin-top:12px }
  .afspraken { background:#F8F8F8; border-radius:8px; padding:6px 10px; margin-top:8px }
  .voet { position:absolute; left:13mm; right:13mm; bottom:8mm; display:flex; justify-content:space-between; align-items:flex-end; font-size:7.5pt; color:#757575 }
  .voet img { height:11mm }
  b { color:#000 }
</style></head><body><div class="pagina">
  <div class="kop">
    <img src="${logo}" alt="HAN">
    <div class="titel"><div class="merk">BackPACK_</div><div class="sub">Ardennen-meerdaagse 28–30 juni 2027 · Cluster VD</div></div>
  </div>

  <h2>Handleiding ${r.naam} <span class="pack">${r.pack}</span></h2>
  <p class="focus">${r.focus}</p>

  <div class="inlog">
    <div><div class="l">Website (open op je telefoon)</div><div class="w">${WEBSITE}</div></div>
    <div><div class="l">Gebruikersnaam</div><div class="w">${esc(r.gebruikersnaam)}</div></div>
    <div><div class="l">Wachtwoord</div>${ww ? `<div class="w">${esc(ww)}</div>` : `<div class="w leeg">wordt ingevuld</div>`}</div>
  </div>

  <div class="twee">
    <div>
      <h3>Eerste keer inloggen</h3>
      <ol>
        <li>Open de website in je telefoonbrowser en log in met de gegevens hierboven. Laat <b>ingelogd blijven</b> aan staan.</li>
        <li>Zet de app op je beginscherm: <b>Delen → Zet op beginscherm</b> (iPhone) of <b>⋮ → App installeren</b> (Android).</li>
        <li>Dit account deel je met de studenten in jouw rol. Deel het niet met anderen.</li>
        <li>Wachtwoord kwijt? Vraag Bart. Er is geen &ldquo;wachtwoord vergeten&rdquo;.</li>
      </ol>
    </div>
    <div>
      <h3>De vier knoppen onderaan</h3>
      <div class="knoppen">
        <div class="kn"><b>Onze meerdaagse</b>start, thema, aftellen, deadlines</div>
        <div class="kn"><b>Belevenissen</b>alle zes AVF's</div>
        <div class="kn"><b>Stuurgroep</b>jullie werkpagina's</div>
        <div class="kn"><b>Meer</b>plannen, paklijst, uitloggen</div>
      </div>
      <p style="margin:4px 0 0">Tik op het logo bovenaan om terug te gaan naar het startscherm.</p>
    </div>
  </div>

  <div class="rol">
    <h3 style="border:0;margin-bottom:2px;color:#E50056">Jullie rol: ${r.naam}</h3>
    <div class="twee" style="margin-top:2px">
      <div><b>Jullie volgen in de AVF's:</b><ul>${r.ziet.map((x) => `<li>${x}</li>`).join("")}</ul></div>
      <div><b>Doe dit als eerste:</b><ol>${r.eerste.map((x) => `<li>${x}</li>`).join("")}</ol></div>
    </div>
  </div>

  <div class="twee">
    <div>
      <h3>Een AVF beoordelen</h3>
      <ol>
        <li>Kies <b>Belevenissen</b> en tik op een belevenis; je ziet het AVF per sectie (A t/m H).</li>
        <li>Zie je iets dat beter kan? Tik op het veld en kies <b>Verbeterverzoek</b>. Het gaat automatisch naar de juiste rol in de projectgroep.</li>
        <li>Onderaan: <b>Feedback teruggeven</b> (bij tussentijds indienen) of <b>Aanpassing vragen</b> / <b>Goedkeuren</b> (bij definitief indienen). Vul je naam in.</li>
        <li>Leg per rol je <b>themacheck</b> vast: akkoord of aandachtspunt.</li>
      </ol>
    </div>
    <div>
      <h3>Goed om te weten</h3>
      <ul>
        <li>Bij elke actie vul je je <b>eigen naam</b> in; het account is gedeeld.</li>
        <li>Velden slaan <b>vanzelf</b> op. Zie je &ldquo;Iemand anders heeft dit net gewijzigd&rdquo;, laad dan de pagina opnieuw.</li>
        <li>Zet <b>geen persoonsgegevens</b> in de app: geen allergieën, medische gegevens of studentnummers.</li>
        <li>Chatten kan niet in de app. Dat doen we in <b>Teams</b>.</li>
        <li>Je ziet alleen je eigen cluster. Andere groepen zien van een belevenis alleen titel en samenvatting.</li>
      </ul>
    </div>
  </div>

  <div class="voet">
    <div>Vragen of iets werkt niet? Zet het in het Teams-kanaal van de stuurgroep of mail Bart.<br>Bewaar deze pagina veilig: er staat een wachtwoord op.</div>
    <img src="${sport}" alt="HAN Sport en Bewegen">
  </div>
</div></body></html>`;
}

const browser = await chromium.launch();
const pagina = await browser.newPage();
for (const r of rollen) {
  await pagina.setContent(html(r), { waitUntil: "load" });
  const pad = join(uit, `BackPACK_handleiding_VD_${r.bestand}.pdf`);
  await pagina.pdf({ path: pad, format: "A4", printBackground: true });
  if (process.env.PNG) { await pagina.setViewportSize({ width: 794, height: 1123 }); await pagina.screenshot({ path: join(process.env.PNG, r.bestand + ".png"), fullPage: true }); }
  const n = (await pagina.evaluate(() => document.documentElement.scrollHeight)) / 3.7795;
  console.log(pad, `(inhoud ${Math.round(n)} mm hoog)`);
}
await browser.close();
