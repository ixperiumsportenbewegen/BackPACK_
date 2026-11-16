/**
 * Voortgang per AVF-sectie (niet gestart, onvolledig, compleet) en de lijst van ontbrekende verplichte velden.
 * Leest de verplichtingen uit src/config/avf-velden.ts; alleen de regels die niet uit één veld
 * te lezen zijn (weerscenario's, onderdelen per fase, EHBO, allergieën, rolverdeling) staan hier.
 * Dezelfde berekening wordt later gebruikt bij indienen (opdracht 4).
 */
import { AVF_VELDEN, OPRUIMEN_VELDEN, SECTIES, WEER_SCENARIOS, WEER_VELDEN, type SectieCode } from "@/config/avf-velden";

export type Json = Record<string, unknown>;
export type FaseCode = "kop" | "romp" | "staart";

export interface FaseInhoud {
  fase: FaseCode;
  organisatievorm: string | null;
  coachen_instructies: string | null;
  stemgebruik_houding: string | null;
  overzichtstekening_pad: string | null;
  opruimen: Json | null;
}

export interface OnderdeelInhoud {
  id?: string;
  fase: FaseCode;
  volgorde?: number;
  naam: string | null;
  duur_minuten: number | null;
  beschrijving: string | null;
  fysieke_veiligheid: string | null;
  [veld: string]: unknown;
}

export interface AvfInhoud {
  titel: string | null;
  verschijningsvorm: string | null;
  publieke_samenvatting: string | null;
  organiserende_studenten: string | null;
  doelgroep: string | null;
  aantal_deelnemers: number | null;
  contactpersoon: string | null;
  locatie_keuze: string | null;
  locatie_detail: string | null;
  beginsituatie: Json;
  doelen: Json;
  veiligheid: Json;
  organisatie: Json;
  communicatie: Json;
  fasen: FaseInhoud[];
  onderdelen: OnderdeelInhoud[];
  /** Aantal van de zes projectgroeprollen met een naam. */
  rollenIngevuld: number;
  /** Gekozen materialen uit de lijst en eigen materialen (sectie F). */
  materialenAantal?: number;
  eigenMaterialenAantal?: number;
  /** Aantal regels in het financieel plan (sectie F). */
  financieelPlanRegels?: number;
}

export type VoortgangStatus = "niet_gestart" | "onvolledig" | "compleet" | "nvt";

export interface Ontbrekend {
  sleutel: string;
  melding: string;
}

export interface SectieVoortgang {
  sectie: SectieCode;
  status: VoortgangStatus;
  ontbrekend: Ontbrekend[];
}

export function isGevuld(w: unknown): boolean {
  if (w === null || w === undefined) return false;
  if (typeof w === "string") return w.trim().length > 0;
  if (typeof w === "number") return Number.isFinite(w);
  if (typeof w === "boolean") return true;
  if (Array.isArray(w)) return w.length > 0;
  if (typeof w === "object") return Object.keys(w as object).length > 0;
  return false;
}

/** Leest een waarde met een sleutel als "titel" of "beginsituatie.algemeen". */
export function leesWaarde(inhoud: AvfInhoud, sleutel: string): unknown {
  const [eerste, ...rest] = sleutel.replace(/\[\]$/, "").split(".");
  let huidig: unknown = (inhoud as unknown as Json)[eerste];
  for (const deel of rest) {
    if (huidig && typeof huidig === "object") huidig = (huidig as Json)[deel];
    else return undefined;
  }
  return huidig;
}

const FASE_LABEL: Record<FaseCode, string> = { kop: "Kop", romp: "Romp", staart: "Staart" };
const FASEN: FaseCode[] = ["kop", "romp", "staart"];

// Velden die niet uit één eenvoudige waarde te beoordelen zijn
const SPECIAAL = new Set([
  "tijdvak", "veiligheid.risicos[]", "veiligheid.weer.*", "veiligheid.ehbo.aanvullend",
  "veiligheid.ehbo.maatregelen", "organisatie.allergieen_rekening_gehouden", "projectgroep_rol",
  "avf_materiaal", "avf_materiaal.aanvullend", "budgetaanvraag", "doelen.persoonlijk[]",
]);

function sectieA_B_C_G_H(sectie: SectieCode, inhoud: AvfInhoud): { ontbrekend: Ontbrekend[]; gevuldAny: boolean } {
  const ontbrekend: Ontbrekend[] = [];
  let gevuldAny = false;
  const groepen = new Map<string, { gevuld: boolean; labels: string[] }>();

  for (const v of AVF_VELDEN.filter((x) => x.sectie === sectie && x.niveau === "avf" && !SPECIAAL.has(x.sleutel))) {
    const gevuld = isGevuld(leesWaarde(inhoud, v.sleutel));
    if (gevuld) gevuldAny = true;
    if (v.verplicht === "ja" && !gevuld) ontbrekend.push({ sleutel: v.sleutel, melding: v.label });
    if (v.verplicht === "voorwaardelijk" && v.groep) {
      const g = groepen.get(v.groep) ?? { gevuld: false, labels: [] };
      g.gevuld ||= gevuld;
      g.labels.push(v.label);
      groepen.set(v.groep, g);
    }
  }
  for (const [groep, g] of groepen) {
    if (!g.gevuld) ontbrekend.push({ sleutel: groep, melding: `Minstens één van: ${g.labels.join(", ")}` });
  }

  if (sectie === "C" && isGevuld(leesWaarde(inhoud, "doelen.persoonlijk"))) gevuldAny = true;

  // De rolverdeling hoort bij sectie A: het eerste dat een projectgroep kan doen.
  if (sectie === "A") {
    if (inhoud.rollenIngevuld > 0) gevuldAny = true;
    if (inhoud.rollenIngevuld < 6) {
      ontbrekend.push({ sleutel: "projectgroep_rol", melding: "Rolverdeling: elke van de zes rollen heeft een naam nodig" });
    }
  }

  if (sectie === "G") {
    const allergie = leesWaarde(inhoud, "organisatie.allergieen_rekening_gehouden");
    if (isGevuld(allergie)) gevuldAny = true;
    if (isGevuld(leesWaarde(inhoud, "organisatie.catering")) && !isGevuld(allergie)) {
      ontbrekend.push({ sleutel: "organisatie.allergieen_rekening_gehouden", melding: "Allergieën: is er rekening mee gehouden (ja of nee)?" });
    }
  }
  return { ontbrekend, gevuldAny };
}

function sectieD(inhoud: AvfInhoud): { ontbrekend: Ontbrekend[]; gevuldAny: boolean } {
  const ontbrekend: Ontbrekend[] = [];
  let gevuldAny = false;
  for (const fase of FASEN) {
    const f = inhoud.fasen.find((x) => x.fase === fase);
    const naam = FASE_LABEL[fase];
    if (f) {
      if ([f.organisatievorm, f.coachen_instructies, f.stemgebruik_houding, f.overzichtstekening_pad].some(isGevuld) || isGevuld(f.opruimen)) {
        gevuldAny = true;
      }
    }
    if (!isGevuld(f?.organisatievorm)) ontbrekend.push({ sleutel: `${fase}.organisatievorm`, melding: `${naam}: organisatievorm` });
    if (!isGevuld(f?.coachen_instructies)) ontbrekend.push({ sleutel: `${fase}.coachen_instructies`, melding: `${naam}: coachen en instructies` });
    const opruimen = (f?.opruimen ?? {}) as Json;
    const leeg = OPRUIMEN_VELDEN.filter((w) => !isGevuld(opruimen[w.sleutel])).map((w) => w.label.toLowerCase());
    if (leeg.length) ontbrekend.push({ sleutel: `${fase}.opruimen`, melding: `${naam}: opruimen, nog in te vullen: ${leeg.join(", ")}` });

    const onderdelen = inhoud.onderdelen.filter((o) => o.fase === fase);
    if (onderdelen.length === 0) {
      ontbrekend.push({ sleutel: `${fase}.onderdelen`, melding: `${naam}: minstens één onderdeel` });
    }
    onderdelen.forEach((o, i) => {
      gevuldAny = true;
      const naamO = isGevuld(o.naam) ? `"${o.naam}"` : `${i + 1}`;
      const vooraf = `${naam}, onderdeel ${naamO}`;
      if (!isGevuld(o.naam)) ontbrekend.push({ sleutel: `${fase}.${i}.naam`, melding: `${vooraf}: naam` });
      if (!isGevuld(o.duur_minuten)) ontbrekend.push({ sleutel: `${fase}.${i}.duur`, melding: `${vooraf}: duur` });
      if (!isGevuld(o.beschrijving)) ontbrekend.push({ sleutel: `${fase}.${i}.beschrijving`, melding: `${vooraf}: beschrijving` });
      if (!isGevuld(o.fysieke_veiligheid)) ontbrekend.push({ sleutel: `${fase}.${i}.fysieke_veiligheid`, melding: `${vooraf}: fysieke veiligheid` });
    });
  }
  return { ontbrekend, gevuldAny };
}

function sectieE(inhoud: AvfInhoud): { ontbrekend: Ontbrekend[]; gevuldAny: boolean } {
  const ontbrekend: Ontbrekend[] = [];
  const v = inhoud.veiligheid ?? {};
  const risicos = Array.isArray(v.risicos) ? (v.risicos as Json[]) : [];
  const weer = (v.weer ?? {}) as Json;
  const ehbo = (v.ehbo ?? {}) as Json;
  let gevuldAny = risicos.length > 0 || isGevuld(ehbo.aanvullend) || isGevuld(ehbo.maatregelen);

  if (!risicos.some((r) => isGevuld(r.risico))) {
    ontbrekend.push({ sleutel: "veiligheid.risicos", melding: "Minstens één risico met maatregel" });
  }
  for (const s of WEER_SCENARIOS) {
    const sc = (weer[s.sleutel] ?? {}) as Json;
    if (isGevuld(sc.relevant)) gevuldAny = true;
    if (typeof sc.relevant !== "boolean") {
      ontbrekend.push({ sleutel: `veiligheid.weer.${s.sleutel}`, melding: `Weer "${s.label}": afwegen (wel of niet relevant)` });
    } else if (sc.relevant) {
      const leeg = WEER_VELDEN.filter((f) => !isGevuld(sc[f.sleutel])).map((f) => f.label.toLowerCase());
      if (leeg.length) ontbrekend.push({ sleutel: `veiligheid.weer.${s.sleutel}`, melding: `Weer "${s.label}": nog in te vullen: ${leeg.join(", ")}` });
    }
  }
  if (typeof ehbo.aanvullend !== "boolean") {
    ontbrekend.push({ sleutel: "veiligheid.ehbo.aanvullend", melding: "EHBO: zijn aanvullende maatregelen nodig (ja of nee)?" });
  } else if (ehbo.aanvullend && !isGevuld(ehbo.maatregelen)) {
    ontbrekend.push({ sleutel: "veiligheid.ehbo.maatregelen", melding: "EHBO: welke maatregelen (wie, waar, middelen)?" });
  }
  return { ontbrekend, gevuldAny };
}

export function sectieVoortgang(sectie: SectieCode, inhoud: AvfInhoud): SectieVoortgang {
  // Sectie F is niet verplicht: leeg is "optioneel", met materialen is het compleet
  if (sectie === "F") return { sectie, status: (inhoud.materialenAantal ?? 0) + (inhoud.eigenMaterialenAantal ?? 0) + (inhoud.financieelPlanRegels ?? 0) > 0 ? "compleet" : "nvt", ontbrekend: [] };
  const { ontbrekend, gevuldAny } =
    sectie === "D" ? sectieD(inhoud) : sectie === "E" ? sectieE(inhoud) : sectieA_B_C_G_H(sectie, inhoud);
  const status: VoortgangStatus = ontbrekend.length === 0 ? "compleet" : gevuldAny ? "onvolledig" : "niet_gestart";
  return { sectie, status, ontbrekend };
}

export function voortgangPerSectie(inhoud: AvfInhoud): SectieVoortgang[] {
  return SECTIES.map((s) => sectieVoortgang(s.code, inhoud));
}

/** Bijvoorbeeld "5 van 7 secties ingepakt" (sectie F telt nog niet mee). */
export function samenvatting(voortgang: SectieVoortgang[]): { compleet: number; totaal: number } {
  const meetellend = voortgang.filter((v) => v.status !== "nvt");
  return { compleet: meetellend.filter((v) => v.status === "compleet").length, totaal: meetellend.length };
}

/**
 * Waar je een ontbrekend punt invult. Sectie D opent de juiste fase, de rolverdeling staat bovenaan sectie A,
 * alle andere punten staan in hun sectie.
 */
export function ontbrekendLink(sectie: SectieCode, sleutel: string): string {
  if (sleutel === "projectgroep_rol") return "/avf/A#rolverdeling";
  if (sectie === "D") {
    const fase = sleutel.split(".")[0];
    if ((FASEN as string[]).includes(fase)) return `/avf/D?fase=${fase}`;
  }
  return `/avf/${sectie}`;
}

export function alleOntbrekend(voortgang: SectieVoortgang[]): Ontbrekend[] {
  return voortgang.flatMap((v) => v.ontbrekend);
}

export function legeInhoud(): AvfInhoud {
  return {
    titel: null, verschijningsvorm: null, publieke_samenvatting: null, organiserende_studenten: null,
    doelgroep: null, aantal_deelnemers: null, contactpersoon: null, locatie_keuze: null, locatie_detail: null,
    beginsituatie: {}, doelen: {}, veiligheid: {}, organisatie: {}, communicatie: {},
    fasen: FASEN.map((fase) => ({ fase, organisatievorm: null, coachen_instructies: null, stemgebruik_houding: null, overzichtstekening_pad: null, opruimen: {} })),
    onderdelen: [],
    rollenIngevuld: 0,
  };
}
