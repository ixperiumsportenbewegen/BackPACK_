/**
 * De opzet van het algemene calamiteitenplan (incl. EHBO): welke onderdelen er zijn en welke velden daarin staan.
 * De inhoud komt niet uit dit bestand maar van de stuurgroep (Veiligheid & Welzijn), per cluster. Hier staan alleen
 * labels en hulpteksten die uitleggen wat erin hoort.
 */

export type PlanVeldSoort = "kort" | "lang" | "tel" | "link";

export interface PlanVeld {
  sleutel: string;
  label: string;
  soort: PlanVeldSoort;
  hulp?: string;
  maxLengte: number;
}

export interface PlanLijst {
  /** Sleutel van de lijst in de database (calamiteit_item.lijst). */
  sleutel: string;
  /** "Contactpersoon", "Ziekenhuis": de naam van één regel. */
  itemNaam: string;
  toevoegenLabel: string;
  leegTekst: string;
  /** Het veld dat als kop van een regel dient (in de leesweergave en bij het bewerken). */
  titelVeld: string;
  velden: PlanVeld[];
}

export interface PlanSectie {
  code: string;
  naam: string;
  uitleg: string;
  velden?: PlanVeld[];
  lijst?: PlanLijst;
  /** In deze sectie staat ook de link naar de groepsapp voor noodmeldingen. */
  groepsapp?: boolean;
}

export const PLAN_SECTIES: PlanSectie[] = [
  {
    code: "eerste_stappen",
    naam: "Eerste stappen bij een ongeval",
    uitleg: "Wat doet iedereen als er iets gebeurt? Schrijf de stappen in volgorde, elke stap op een eigen regel.",
    velden: [{ sleutel: "stappen", label: "De eerste stappen", soort: "lang", maxLengte: 2000, hulp: "Bijvoorbeeld: veiligheid, wat is er gebeurd, eerste hulp ter plaatse, hulp inschakelen." }],
  },
  {
    code: "nood",
    naam: "Noodnummer en melden",
    uitleg: "Wie bel je en waar meld je een noodsituatie?",
    groepsapp: true,
    velden: [
      { sleutel: "noodnummer", label: "Noodnummer", soort: "tel", maxLengte: 40, hulp: "Het alarmnummer in het land van de meerdaagse. Het staat bovenaan het plan als knop om te bellen." },
      { sleutel: "melden", label: "Waar meld je een noodsituatie?", soort: "lang", maxLengte: 1000, hulp: "Bijvoorbeeld in de groepsapp, en bij wie." },
      { sleutel: "ter_plaatse", label: "Organisatie of aanbieder ter plaatse", soort: "lang", maxLengte: 1000, hulp: "Naam en telefoonnummer van de organisatie waar jullie activiteiten doen." },
    ],
  },
  {
    code: "contacten",
    naam: "Wie bel je (in volgorde)",
    uitleg: "Contactpersonen in de volgorde waarin je ze belt, met wanneer ze bereikbaar zijn. Zet geen privégegevens van studenten in het plan.",
    lijst: {
      sleutel: "contactpersonen", itemNaam: "Contactpersoon", toevoegenLabel: "Contactpersoon toevoegen",
      leegTekst: "Nog geen contactpersonen.", titelVeld: "naam",
      velden: [
        { sleutel: "naam", label: "Naam", soort: "kort", maxLengte: 100 },
        { sleutel: "telefoon", label: "Telefoonnummer", soort: "tel", maxLengte: 40 },
        { sleutel: "wanneer", label: "Wanneer bereikbaar", soort: "kort", maxLengte: 200, hulp: "Bijvoorbeeld: maandag tot en met woensdag." },
        { sleutel: "toelichting", label: "Toelichting", soort: "lang", maxLengte: 500 },
      ],
    },
  },
  {
    code: "ziekenhuizen",
    naam: "Ziekenhuizen en hulp in de buurt",
    uitleg: "De dichtstbijzijnde ziekenhuizen en andere hulp, met adres en telefoonnummer.",
    lijst: {
      sleutel: "ziekenhuizen", itemNaam: "Ziekenhuis of hulpplek", toevoegenLabel: "Ziekenhuis of hulpplek toevoegen",
      leegTekst: "Nog geen ziekenhuizen of hulpplekken.", titelVeld: "naam",
      velden: [
        { sleutel: "naam", label: "Naam", soort: "kort", maxLengte: 150 },
        { sleutel: "adres", label: "Adres", soort: "kort", maxLengte: 200 },
        { sleutel: "telefoon", label: "Telefoonnummer", soort: "tel", maxLengte: 40 },
        { sleutel: "website", label: "Website", soort: "link", maxLengte: 300 },
        { sleutel: "opmerking", label: "Opmerking", soort: "lang", maxLengte: 500, hulp: "Bijvoorbeeld openingstijden of welke locatie wanneer open is." },
      ],
    },
  },
  {
    code: "thuisfront",
    naam: "Calamiteit in de thuisomgeving",
    uitleg: "Wat als er thuis iets gebeurt terwijl een student op de meerdaagse is? Wie kan het thuisfront bellen?",
    velden: [{ sleutel: "thuisfront", label: "Afspraken voor het thuisfront", soort: "lang", maxLengte: 2000 }],
  },
  {
    code: "extern",
    naam: "Calamiteit bij een externe aanbieder",
    uitleg: "Wat doen studenten bij een ongeval tijdens een activiteit van een externe aanbieder, en wie informeren ze eerst?",
    velden: [{ sleutel: "extern", label: "Afspraken bij een externe aanbieder", soort: "lang", maxLengte: 2000 }],
  },
  {
    code: "risicos",
    naam: "Situaties met verhoogd risico",
    uitleg: "Veelvoorkomende situaties, elk met de klachten, wat je doet en wanneer je hulp belt. Voeg zelf situaties toe.",
    lijst: {
      sleutel: "situaties", itemNaam: "Situatie", toevoegenLabel: "Situatie toevoegen",
      leegTekst: "Nog geen situaties.", titelVeld: "titel",
      velden: [
        { sleutel: "titel", label: "Situatie", soort: "kort", maxLengte: 100, hulp: "Bijvoorbeeld: zonnesteek, teek of verzwikte enkel." },
        { sleutel: "klachten", label: "Wat is het, welke klachten?", soort: "lang", maxLengte: 1000 },
        { sleutel: "aanpak", label: "Wat doe je?", soort: "lang", maxLengte: 1500 },
        { sleutel: "hulp", label: "Wanneer bel je hulp?", soort: "lang", maxLengte: 1000 },
      ],
    },
  },
  {
    code: "zorgsysteem",
    naam: "Zorgsysteem in het land",
    uitleg: "Hoe werkt de zorg ter plaatse: wat betaal je, wat vergoedt de verzekering, wat moet je bewaren?",
    lijst: {
      sleutel: "zorg", itemNaam: "Onderwerp", toevoegenLabel: "Onderwerp toevoegen",
      leegTekst: "Nog geen onderwerpen.", titelVeld: "onderwerp",
      velden: [
        { sleutel: "onderwerp", label: "Onderwerp", soort: "kort", maxLengte: 100, hulp: "Bijvoorbeeld: arts, ziekenhuisopname, ambulance." },
        { sleutel: "tekst", label: "Uitleg", soort: "lang", maxLengte: 2000 },
      ],
    },
  },
  {
    code: "overig",
    naam: "Overig",
    uitleg: "Alles wat verder in het plan hoort en nergens anders past.",
    lijst: {
      sleutel: "overig", itemNaam: "Onderwerp", toevoegenLabel: "Onderwerp toevoegen",
      leegTekst: "Nog niets toegevoegd.", titelVeld: "titel",
      velden: [
        { sleutel: "titel", label: "Titel", soort: "kort", maxLengte: 100 },
        { sleutel: "tekst", label: "Tekst", soort: "lang", maxLengte: 2000 },
      ],
    },
  },
];

/** Alle tekstvelden (zonder lijsten) met hun sectie, voor controles. */
export function planVelden(): PlanVeld[] {
  return PLAN_SECTIES.flatMap((s) => s.velden ?? []);
}

export function planLijsten(): PlanLijst[] {
  return PLAN_SECTIES.flatMap((s) => (s.lijst ? [s.lijst] : []));
}

export function planVeld(sleutel: string): PlanVeld | undefined {
  return planVelden().find((v) => v.sleutel === sleutel);
}

export function planLijst(sleutel: string): PlanLijst | undefined {
  return planLijsten().find((l) => l.sleutel === sleutel);
}
