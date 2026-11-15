/**
 * Alle velden van het AVF met hun sectie, label, verplichting, eigenaar in de projectgroep,
 * stuurgroeprol, PACK-vak en of een wijziging na goedkeuring "wezenlijk" is.
 * Bron: docs/avf-velden.md (PRD AVF-11). Schermen, controles en dashboards lezen dit bestand.
 * Wijzigen van de koppeling = alleen dit bestand en docs/avf-velden.md aanpassen.
 *
 * Let op: projectgroepen zien alleen `pgRol` (de eigenaar). De stuurgroepkoppeling (`sgRol`, `pack`)
 * is voor hen niet zichtbaar in de app; hij is bedoeld voor het stuurgroepdashboard.
 */
import type { ProjectgroepRolCode } from "@/config/projectgroeprollen";

export type SectieCode = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
export type PackVak = "P" | "A" | "C" | "K";
export type StuurgroepRolCode =
  | "projectleiding"
  | "programma_kwaliteit"
  | "beleving_thema"
  | "veiligheid_welzijn"
  | "logistiek_facilitair"
  | "communicatie_financien";

export type Verplicht = "ja" | "voorwaardelijk" | "nee";
export type Niveau = "avf" | "fase" | "onderdeel";
export type Veldtype = "tekst" | "lang" | "getal" | "keuze" | "meerkeuze" | "jaNee" | "lijst" | "weer" | "opruimen" | "afbeelding" | "toegewezen" | "later";

export interface AvfVeld {
  /** Pad in de database, zoals in docs/datamodel.md. */
  sleutel: string;
  /** Sleutels uit docs/avf-velden.md die dit veld dekt (standaard alleen `sleutel`). */
  docSleutels?: string[];
  sectie: SectieCode;
  niveau: Niveau;
  label: string;
  veldtype: Veldtype;
  verplicht: Verplicht;
  /** Bij verplicht "voorwaardelijk": velden met dezelfde groep tellen samen ("minstens één"). */
  groep?: string;
  pgRol: ProjectgroepRolCode | null;
  sgRol: StuurgroepRolCode | null;
  pack: PackVak | null;
  wezenlijk: boolean;
  maxLengte?: number;
  hulp?: string;
  opties?: string[];
}

export const SECTIES: { code: SectieCode; naam: string; uitleg: string }[] = [
  { code: "A", naam: "Basisgegevens", uitleg: "Titel, korte omschrijving voor andere groepen, organisatoren en contactpersoon." },
  { code: "B", naam: "Beginsituatie", uitleg: "Wie doet er mee en wat kunnen ze al?" },
  { code: "C", naam: "Doelen", uitleg: "Wat moeten deelnemers aan het einde kunnen of hebben ervaren?" },
  { code: "D", naam: "Kop, romp en staart", uitleg: "Het verloop van de belevenis in drie fasen met onderdelen." },
  { code: "E", naam: "Veiligheid, EHBO en weer", uitleg: "Risico's, het weer en eerste hulp." },
  { code: "F", naam: "Materialen en financiën", uitleg: "Materialen en financieel plan. Alleen invullen als je materiaal of budget nodig hebt." },
  { code: "G", naam: "Thema en organisatie", uitleg: "Bijdrage aan het thema, rolverdeling, vervoer, catering en corvee." },
  { code: "H", naam: "Communicatie", uitleg: "Wat deelnemers vooraf, tijdens en na de belevenis horen." },
];

export const VERSCHIJNINGSVORMEN = ["Spel", "Wedstrijd", "Avontuur", "Gezondheid", "Recreatie", "Show"];

export const WEER_SCENARIOS = [
  { sleutel: "zeer_warm", label: "Zeer warm", hulp: "Bijvoorbeeld boven 32 °C. Dit is een voorbeeldgrens en geen automatische norm." },
  { sleutel: "zware_regen", label: "Zware regen", hulp: "" },
  { sleutel: "onweer", label: "Onweer", hulp: "" },
  { sleutel: "koel", label: "Koel", hulp: "Bijvoorbeeld onder 18 °C. Dit is een voorbeeldgrens en geen automatische norm." },
] as const;

export const WEER_VELDEN = [
  { sleutel: "maatregel", label: "Maatregel" },
  { sleutel: "alternatief", label: "Alternatief" },
  { sleutel: "stopcriterium", label: "Stopcriterium" },
  { sleutel: "beslisser", label: "Wie beslist?" },
] as const;

export const OPRUIMEN_VELDEN = [
  { sleutel: "wie", label: "Wie" },
  { sleutel: "wat", label: "Wat" },
  { sleutel: "waar", label: "Waar" },
  { sleutel: "wanneer", label: "Wanneer" },
  { sleutel: "hoe", label: "Hoe" },
  { sleutel: "wat_erna", label: "Wat erna" },
] as const;

/** Velden van een onderdeel die als "niet van toepassing" gemarkeerd kunnen worden (niet de fysieke veiligheid). */
export const ONDERDEEL_NVT_MOGELIJK = [
  "sociale_veiligheid", "individu_moeilijker", "individu_makkelijker", "groep_moeilijker", "groep_makkelijker",
  "usv_uitdagend", "usv_speelbaar", "usv_veilig_aanvulling",
] as const;

type V = Omit<AvfVeld, "wezenlijk" | "niveau" | "verplicht" | "pgRol" | "sgRol" | "pack"> &
  Partial<Pick<AvfVeld, "wezenlijk" | "niveau">> & {
    v: Verplicht;
    pg: ProjectgroepRolCode | null;
    sg: StuurgroepRolCode | null;
    pack: PackVak | null;
  };

function veld(o: V): AvfVeld {
  const { v, pg, sg, ...rest } = o;
  return { niveau: "avf", wezenlijk: false, ...rest, verplicht: v, pgRol: pg, sgRol: sg };
}

export const AVF_VELDEN: AvfVeld[] = [
  // A Basisgegevens
  veld({ sleutel: "titel", sectie: "A", label: "Titel van de belevenis", veldtype: "tekst", v: "ja", pg: "projectleider", sg: "projectleiding", pack: "K", maxLengte: 80,
    hulp: "Andere groepen zien deze titel." }),
  veld({ sleutel: "verschijningsvorm", sectie: "A", label: "Verschijningsvorm", hulp: "Kies één of meer vormen die bij jullie belevenis passen.", veldtype: "meerkeuze", v: "ja", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", wezenlijk: true, opties: VERSCHIJNINGSVORMEN, maxLengte: 60 }),
  veld({ sleutel: "publieke_samenvatting", sectie: "A", label: "Korte omschrijving voor andere groepen (zonder spoilers)", veldtype: "lang", v: "ja", pg: "programma_beleving", sg: "beleving_thema", pack: "A", maxLengte: 280,
    hulp: "Andere groepen en studenten zien alleen de titel en deze omschrijving. Verklap niet te veel." }),
  veld({ sleutel: "organiserende_studenten", sectie: "A", label: "Organiserende studenten", veldtype: "lang", v: "ja", pg: "projectleider", sg: "projectleiding", pack: "K", maxLengte: 300 }),
  veld({ sleutel: "doelgroep", sectie: "A", label: "Doelgroep", veldtype: "tekst", v: "ja", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 200 }),
  veld({ sleutel: "aantal_deelnemers", sectie: "A", label: "Aantal deelnemers", veldtype: "getal", v: "ja", pg: "projectleider", sg: "projectleiding", pack: "K" }),
  veld({ sleutel: "contactpersoon", sectie: "A", label: "Contactpersoon tijdens de belevenis", veldtype: "tekst", v: "ja", pg: "projectleider", sg: "projectleiding", pack: "K", maxLengte: 100 }),
  veld({ sleutel: "tijdvak", docSleutels: ["dag", "starttijd", "eindtijd"], sectie: "A", label: "Dag en tijd (toegewezen)", veldtype: "toegewezen", v: "nee", pg: null, sg: "programma_kwaliteit", pack: "A" }),
  veld({ sleutel: "locatie_keuze", sectie: "A", label: "Op welke locatie vindt de belevenis plaats?", veldtype: "keuze", v: "ja", pg: "logistiek_materialen", sg: "logistiek_facilitair", pack: "P", wezenlijk: true,
    opties: ["Camping", "Bivak"], hulp: "Kies camping of bivak. Dit bepaalt welke materialen er beschikbaar zijn." }),
  veld({ sleutel: "locatie_detail", sectie: "A", label: "Waar precies? (rondom de camping of het bivak)", veldtype: "tekst", v: "nee", pg: "logistiek_materialen", sg: "logistiek_facilitair", pack: "P", maxLengte: 200,
    hulp: "Bijvoorbeeld: het grasveld achter de tent, of het pad langs de rivier." }),

  // B Beginsituatie
  veld({ sleutel: "beginsituatie.algemeen", sectie: "B", label: "Algemene omschrijving van de groep", veldtype: "lang", v: "ja", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 1000,
    hulp: "Bijvoorbeeld: 10 studenten doen mee en werken in twee teams." }),
  veld({ sleutel: "beginsituatie.motorisch", sectie: "B", label: "Motorische beginsituatie", veldtype: "lang", v: "voorwaardelijk", groep: "beginsituatie-domein", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 1000,
    hulp: "Schrijf het als: x van de y deelnemers …" }),
  veld({ sleutel: "beginsituatie.cognitief", sectie: "B", label: "Cognitieve beginsituatie", veldtype: "lang", v: "voorwaardelijk", groep: "beginsituatie-domein", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 1000,
    hulp: "Schrijf het als: x van de y deelnemers …" }),
  veld({ sleutel: "beginsituatie.sociaal_emotioneel", sectie: "B", label: "Sociaal-emotionele beginsituatie", veldtype: "lang", v: "voorwaardelijk", groep: "beginsituatie-domein", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 1000,
    hulp: "Schrijf het als: x van de y deelnemers …" }),

  // C Doelen
  veld({ sleutel: "doelen.motorisch", sectie: "C", label: "Motorisch doel", veldtype: "lang", v: "voorwaardelijk", groep: "doel", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 600,
    hulp: "Meetbaar, bijvoorbeeld: aan het einde voeren 8 van de 10 deelnemers het verspringen technisch juist uit." }),
  veld({ sleutel: "doelen.cognitief", sectie: "C", label: "Cognitief doel", veldtype: "lang", v: "voorwaardelijk", groep: "doel", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 600 }),
  veld({ sleutel: "doelen.sociaal_emotioneel", sectie: "C", label: "Sociaal-emotioneel doel", veldtype: "lang", v: "voorwaardelijk", groep: "doel", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 600 }),
  veld({ sleutel: "doelen.persoonlijk[]", sectie: "C", label: "Persoonlijke leerdoelen (naam en doel)", veldtype: "lijst", v: "nee", pg: "projectleider", sg: "programma_kwaliteit", pack: "A" }),

  // D Kop, romp en staart: per fase
  veld({ sleutel: "organisatievorm", niveau: "fase", sectie: "D", label: "Organisatievorm", veldtype: "lang", v: "ja", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 1000 }),
  veld({ sleutel: "overzichtstekening_pad", niveau: "fase", sectie: "D", label: "Overzichtstekening", veldtype: "afbeelding", v: "nee", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A" }),
  veld({ sleutel: "coachen_instructies", niveau: "fase", sectie: "D", label: "Coachen en instructies", veldtype: "lang", v: "ja", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 2000 }),
  veld({ sleutel: "stemgebruik_houding", niveau: "fase", sectie: "D", label: "Stemgebruik en houding", veldtype: "lang", v: "nee", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 1000 }),
  veld({ sleutel: "opruimen", niveau: "fase", sectie: "D", label: "Opruimen volgens de 6 W's", veldtype: "opruimen", v: "ja", pg: "corvee_communicatie", sg: "logistiek_facilitair", pack: "P" }),
  // D per onderdeel
  veld({ sleutel: "onderdelen", docSleutels: [], niveau: "onderdeel", sectie: "D", label: "Onderdelen (minstens één per fase)", veldtype: "lijst", v: "ja", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", wezenlijk: true }),
  veld({ sleutel: "naam", docSleutels: ["naam", "duur_minuten", "beschrijving"], niveau: "onderdeel", sectie: "D", label: "Naam, duur en beschrijving", veldtype: "lang", v: "ja", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 3000 }),
  veld({ sleutel: "sociale_veiligheid", niveau: "onderdeel", sectie: "D", label: "Sociale veiligheid", veldtype: "lang", v: "nee", pg: "veiligheid_ehbo", sg: "veiligheid_welzijn", pack: "P", maxLengte: 1000 }),
  veld({ sleutel: "fysieke_veiligheid", niveau: "onderdeel", sectie: "D", label: "Fysieke veiligheid", veldtype: "lang", v: "ja", pg: "veiligheid_ehbo", sg: "veiligheid_welzijn", pack: "P", wezenlijk: true, maxLengte: 1000 }),
  veld({ sleutel: "differentiatie", docSleutels: ["individu_*", "groep_*"], niveau: "onderdeel", sectie: "D", label: "Differentiatie en groepsaanpassing", veldtype: "lang", v: "nee", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 500 }),
  veld({ sleutel: "usv", docSleutels: ["usv_uitdagend", "usv_speelbaar"], niveau: "onderdeel", sectie: "D", label: "USV: uitdagend en speelbaar", veldtype: "lang", v: "nee", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 500 }),
  veld({ sleutel: "usv_veilig_aanvulling", niveau: "onderdeel", sectie: "D", label: "USV: veilig (aanvulling op fysieke veiligheid)", veldtype: "lang", v: "nee", pg: "veiligheid_ehbo", sg: "veiligheid_welzijn", pack: "P", maxLengte: 500 }),

  // E Veiligheid, EHBO en weer
  veld({ sleutel: "veiligheid.risicos[]", sectie: "E", label: "Risico's (risico, maatregel en wie)", veldtype: "lijst", v: "ja", pg: "veiligheid_ehbo", sg: "veiligheid_welzijn", pack: "P", wezenlijk: true }),
  veld({ sleutel: "veiligheid.weer.*", sectie: "E", label: "Vier weerscenario's", veldtype: "weer", v: "ja", pg: "veiligheid_ehbo", sg: "veiligheid_welzijn", pack: "P", wezenlijk: true }),
  veld({ sleutel: "veiligheid.ehbo.aanvullend", sectie: "E", label: "Zijn aanvullende EHBO-maatregelen nodig?", veldtype: "jaNee", v: "ja", pg: "veiligheid_ehbo", sg: "veiligheid_welzijn", pack: "P", wezenlijk: true }),
  veld({ sleutel: "veiligheid.ehbo.maatregelen", sectie: "E", label: "Welke EHBO-maatregelen? (wie, waar, middelen)", veldtype: "lang", v: "voorwaardelijk", pg: "veiligheid_ehbo", sg: "veiligheid_welzijn", pack: "P", wezenlijk: true, maxLengte: 1000 }),

  // F Materialen en financiën: volgt in opdracht 5
  veld({ sleutel: "avf_materiaal", sectie: "F", label: "Materialen uit de lijst", veldtype: "lijst", v: "nee", pg: "logistiek_materialen", sg: "logistiek_facilitair", pack: "P", wezenlijk: true }),
  veld({ sleutel: "avf_materiaal.aanvullend", docSleutels: [], sectie: "F", label: "Eigen materialen", veldtype: "lijst", v: "nee", pg: "logistiek_materialen", sg: "logistiek_facilitair", pack: "P", wezenlijk: true }),
  veld({ sleutel: "budgetaanvraag", sectie: "F", label: "Financieel plan (regels en totaal)", veldtype: "lijst", v: "nee", pg: "projectleider", sg: "communicatie_financien", pack: "C" }),

  // G Thema en organisatie
  veld({ sleutel: "organisatie.bijdrage_thema", sectie: "G", label: "Bijdrage aan het meerdaagsethema", veldtype: "lang", v: "ja", pg: "programma_beleving", sg: "beleving_thema", pack: "A", maxLengte: 1000 }),
  veld({ sleutel: "organisatie.samenhang", sectie: "G", label: "Samenhang met het programma", veldtype: "lang", v: "nee", pg: "programma_beleving", sg: "programma_kwaliteit", pack: "A", maxLengte: 1000 }),
  veld({ sleutel: "projectgroep_rol", sectie: "G", label: "Rolverdeling (alle zes rollen ingevuld)", veldtype: "later", v: "ja", pg: "projectleider", sg: "projectleiding", pack: "K" }),
  veld({ sleutel: "organisatie.afstemming", sectie: "G", label: "Afstemming met anderen", veldtype: "lang", v: "nee", pg: "projectleider", sg: "projectleiding", pack: "K", maxLengte: 1000 }),
  veld({ sleutel: "organisatie.vervoer", sectie: "G", label: "Vervoer", veldtype: "lang", v: "nee", pg: "logistiek_materialen", sg: "logistiek_facilitair", pack: "P", maxLengte: 1000 }),
  veld({ sleutel: "organisatie.opbouw_afbouw", sectie: "G", label: "Opbouw en afbouw", veldtype: "lang", v: "nee", pg: "logistiek_materialen", sg: "logistiek_facilitair", pack: "P", maxLengte: 1000 }),
  veld({ sleutel: "organisatie.catering", sectie: "G", label: "Eten en drinken, uitgifte", veldtype: "lang", v: "nee", pg: "catering", sg: "veiligheid_welzijn", pack: "P", maxLengte: 1000 }),
  veld({ sleutel: "organisatie.allergieen_rekening_gehouden", sectie: "G", label: "Is rekening gehouden met allergieën? (geen namen of medische gegevens)", veldtype: "jaNee", v: "voorwaardelijk", pg: "catering", sg: "veiligheid_welzijn", pack: "P" }),
  veld({ sleutel: "organisatie.corvee", sectie: "G", label: "Corvee en schoonmaakrooster", veldtype: "lang", v: "nee", pg: "corvee_communicatie", sg: "logistiek_facilitair", pack: "P", maxLengte: 1000 }),

  // H Communicatie
  veld({ sleutel: "communicatie.voor", sectie: "H", label: "Voor: wat deelnemers vooraf moeten weten en meenemen", veldtype: "lang", v: "ja", pg: "corvee_communicatie", sg: "communicatie_financien", pack: "C", maxLengte: 1500,
    hulp: "Kleding, spullen, verzamelpunt en -tijd." }),
  veld({ sleutel: "communicatie.tijdens", sectie: "H", label: "Tijdens: instructies en signalen, bereikbaarheid, wie communiceert bij een calamiteit", veldtype: "lang", v: "ja", pg: "corvee_communicatie", sg: "communicatie_financien", pack: "C", maxLengte: 1500 }),
  veld({ sleutel: "communicatie.na", sectie: "H", label: "Na: afsluiting, terugkoppeling en foto's of resultaten delen", veldtype: "lang", v: "nee", pg: "corvee_communicatie", sg: "communicatie_financien", pack: "C", maxLengte: 1500 }),
];

export function veldenVanSectie(sectie: SectieCode, niveau?: Niveau): AvfVeld[] {
  return AVF_VELDEN.filter((v) => v.sectie === sectie && (!niveau || v.niveau === niveau));
}

export function veldMetSleutel(sleutel: string, niveau: Niveau = "avf"): AvfVeld | undefined {
  return AVF_VELDEN.find((v) => v.sleutel === sleutel && v.niveau === niveau);
}

/** Projectgroeprollen die eigenaar zijn van velden in een sectie (voor "Eigenaar: …" in de app). */
export function eigenarenVanSectie(sectie: SectieCode): ProjectgroepRolCode[] {
  const rollen = new Set<ProjectgroepRolCode>();
  for (const v of veldenVanSectie(sectie)) if (v.pgRol) rollen.add(v.pgRol);
  return [...rollen];
}
