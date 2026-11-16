/**
 * Deadlines van de stuurgroep: welke onderdelen er zijn, hoe lang het nog duurt, hoe urgent dat is en
 * wanneer een projectgroep "klaar" is. Alles rekent in Nederlandse tijd (Europe/Amsterdam), zodat de tekst
 * ook rond de tijdwisseling klopt. Een deadline is een afspraak en blokkeert niets in het AVF.
 */
import { SECTIES, type SectieCode } from "@/config/avf-velden";
import { sectieVoortgang, type AvfInhoud } from "@/lib/avfVoortgang";
import { dagenTot, nlDag } from "@/lib/tijd";

const TZ = "Europe/Amsterdam";

/** Standaardtijd bij een nieuwe deadline (aanpasbaar door de stuurgroep). */
export const DEADLINE_STANDAARD_TIJD = "17:00";
/** De eerste dag van de meerdaagse: deadlines daarna krijgen een zachte waarschuwing. */
export const MEERDAAGSE_START_DAG = "2027-06-28";

export type DeadlineOnderdeel = SectieCode | "indienen" | "materiaal" | "budget";

export interface DeadlineOnderdeelInfo {
  code: DeadlineOnderdeel;
  naam: string;
  /** Een korte uitleg voor de stuurgroep: wat moet er dan klaar zijn? */
  uitleg: string;
}

export const DEADLINE_ONDERDELEN: DeadlineOnderdeelInfo[] = [
  ...SECTIES.map((s) => ({ code: s.code as DeadlineOnderdeel, naam: `Sectie ${s.code} · ${s.naam}`, uitleg: `Alle verplichte velden van sectie ${s.code} zijn ingevuld.` })),
  { code: "indienen", naam: "AVF indienen", uitleg: "Het AVF is ingediend of al goedgekeurd." },
  { code: "materiaal", naam: "Materiaal kiezen", uitleg: "De groep heeft minstens één materiaal gekozen." },
  { code: "budget", naam: "Budgetaanvraag", uitleg: "Het financieel plan heeft minstens één regel." },
];

export const DEADLINE_CODES = DEADLINE_ONDERDELEN.map((o) => o.code);

export const naamVanOnderdeel = (code: string): string => DEADLINE_ONDERDELEN.find((o) => o.code === code)?.naam ?? code;

// --------------------------------------------------------------- tijd in Nederland

const delenFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** Het verschil tussen Nederlandse tijd en UTC op een moment, in minuten (60 in de winter, 120 in de zomer). */
function nlOffsetMinuten(moment: Date): number {
  const p = Object.fromEntries(delenFormat.formatToParts(moment).map((x) => [x.type, x.value]));
  const alsUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return Math.round((alsUtc - Math.floor(moment.getTime() / 1000) * 1000) / 60000);
}

/**
 * Een dag en tijd zoals iemand in Nederland ze invult ("2026-12-04", "17:00") wordt het juiste moment,
 * ook in de zomertijd. Een ongeldige invoer geeft null.
 */
export function nlNaarMoment(dag: string, tijd: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dag);
  const t = /^(\d{2}):(\d{2})$/.exec(tijd);
  if (!d || !t) return null;
  const [j, m, dd] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [uu, mm] = [Number(t[1]), Number(t[2])];
  if (m < 1 || m > 12 || dd < 1 || dd > 31 || uu > 23 || mm > 59) return null;
  const alsUtc = Date.UTC(j, m - 1, dd, uu, mm);
  // twee keer verfijnen: de eerste schatting kan aan de verkeerde kant van een tijdwisseling liggen
  let moment = new Date(alsUtc - nlOffsetMinuten(new Date(alsUtc)) * 60000);
  moment = new Date(alsUtc - nlOffsetMinuten(moment) * 60000);
  const terug = momentNaarNl(moment);
  return terug.dag === dag ? moment : null; // bijvoorbeeld 31 februari
}

/** Een moment wordt de dag en tijd in Nederland, voor een datum- en tijdveld. */
export function momentNaarNl(moment: Date): { dag: string; tijd: string } {
  const p = Object.fromEntries(delenFormat.formatToParts(moment).map((x) => [x.type, x.value]));
  return { dag: `${p.year}-${p.month}-${p.day}`, tijd: `${p.hour}:${p.minute}` };
}

/** "vrijdag 4 december · 17:00" */
export function formatDeadline(moment: Date): string {
  const dag = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(moment);
  return `${dag} · ${momentNaarNl(moment).tijd}`;
}

// ---------------------------------------------------------------- hoe lang nog

export type DeadlineNiveau = "ruim" | "binnenkort" | "dringend" | "verstreken";

export function deadlineNiveau(moment: Date, nu: Date = new Date()): DeadlineNiveau {
  if (moment.getTime() <= nu.getTime()) return "verstreken";
  const dagen = dagenTot(nlDag(moment), nu);
  if (dagen <= 1) return "dringend"; // vandaag of morgen
  if (dagen <= 7) return "binnenkort";
  return "ruim";
}

const meervoud = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`;

/** "nog 5 dagen", "morgen", "vandaag nog 3 uur", "2 dagen te laat" */
export function resterendTekst(moment: Date, nu: Date = new Date()): string {
  const verschilMs = moment.getTime() - nu.getTime();
  const dagen = dagenTot(nlDag(moment), nu);
  if (verschilMs <= 0) {
    const geleden = -verschilMs;
    if (geleden < 60 * 60_000) return "zojuist verstreken";
    // binnen 24 uur tellen we uren (anders staat er "1 dag te laat" na middernacht, terwijl het 1 uur is)
    if (geleden < 24 * 3_600_000) return `${Math.floor(geleden / 3_600_000)} uur te laat`;
    return `${meervoud(Math.max(1, -dagen), "dag", "dagen")} te laat`;
  }
  if (dagen === 0) {
    const minuten = Math.ceil(verschilMs / 60_000);
    if (minuten < 60) return `nog ${meervoud(minuten, "minuut", "minuten")}`;
    return `vandaag nog ${Math.floor(minuten / 60)} uur`;
  }
  if (dagen === 1) return "morgen";
  return `nog ${dagen} dagen`;
}

/** Een zachte waarschuwing bij het instellen (blokkeert niets), of null. */
export function deadlineWaarschuwing(moment: Date, nu: Date = new Date()): string | null {
  if (moment.getTime() <= nu.getTime()) return "Dit moment is al voorbij.";
  if (nlDag(moment) >= MEERDAAGSE_START_DAG) return "Deze deadline ligt op of na de start van de meerdaagse (28 juni 2027).";
  return null;
}

// -------------------------------------------------------------- wanneer is een groep klaar

export interface AvfVoorDeadline {
  status: "in_ontwikkeling" | "ingediend" | "aanpassing_gevraagd" | "goedgekeurd";
  /** De laatste indiening was ter feedback: telt niet als "AVF ingediend". */
  tussentijds?: boolean;
  inhoud: AvfInhoud;
}

export interface DeadlineStand {
  klaar: boolean;
  /** Een korte tekst voor de groep, bijvoorbeeld "2 punten open" of "nog niet ingediend". */
  tekst: string;
}

/** Of een projectgroep klaar is voor een onderdeel, en wat er nog open staat. */
export function deadlineStand(onderdeel: DeadlineOnderdeel | string, avf: AvfVoorDeadline): DeadlineStand {
  if (onderdeel === "indienen") {
    const terFeedback = avf.status === "ingediend" && Boolean(avf.tussentijds);
    const klaar = (avf.status === "ingediend" && !terFeedback) || avf.status === "goedgekeurd";
    return { klaar, tekst: klaar ? "ingediend" : terFeedback ? "ter feedback ingediend, nog niet definitief" : "nog niet ingediend" };
  }
  if (onderdeel === "materiaal") {
    const aantal = (avf.inhoud.materialenAantal ?? 0) + (avf.inhoud.eigenMaterialenAantal ?? 0);
    return { klaar: aantal > 0, tekst: aantal > 0 ? "materiaal gekozen" : "nog geen materiaal gekozen" };
  }
  if (onderdeel === "budget") {
    const regels = avf.inhoud.financieelPlanRegels ?? 0;
    return { klaar: regels > 0, tekst: regels > 0 ? "financieel plan ingevuld" : "financieel plan nog leeg" };
  }
  const sectie = SECTIES.find((s) => s.code === onderdeel);
  if (!sectie) return { klaar: false, tekst: "onbekend onderdeel" };
  const v = sectieVoortgang(sectie.code, avf.inhoud);
  if (v.status === "compleet") return { klaar: true, tekst: "klaar" };
  if (v.ontbrekend.length > 0) return { klaar: false, tekst: meervoud(v.ontbrekend.length, "punt open", "punten open") };
  return { klaar: false, tekst: "nog niet gestart" }; // sectie F zonder inhoud
}

export interface DeadlineRij {
  onderdeel: string;
  moment: Date;
  toelichting: string | null;
  gezetDoorNaam: string;
  updatedAt: string;
}

/** Op volgorde van datum: eerst wat het eerst afloopt. */
export function sorteerDeadlines<T extends { moment: Date; onderdeel: string }>(rijen: T[]): T[] {
  const volgorde = (o: string) => DEADLINE_CODES.indexOf(o as DeadlineOnderdeel);
  return [...rijen].sort((a, b) => a.moment.getTime() - b.moment.getTime() || volgorde(a.onderdeel) - volgorde(b.onderdeel));
}

// ------------------------------------------------------------- herinnering voor Teams

/**
 * Een kant-en-klare tekst voor een Teams-bericht (er zijn geen pushmeldingen in de app). Alleen groepsnamen,
 * geen persoonsgegevens.
 */
export function herinneringTekst(
  d: { onderdeel: string; moment: Date; toelichting: string | null }, openGroepen: string[], nu: Date = new Date(),
): string {
  const naam = naamVanOnderdeel(d.onderdeel);
  const wanneer = formatDeadline(d.moment);
  const rest = resterendTekst(d.moment, nu);
  const regels = [
    d.moment.getTime() > nu.getTime()
      ? `Herinnering: ${naam} moet ${wanneer} klaar zijn (${rest}).`
      : `Herinnering: ${naam} had ${wanneer} klaar moeten zijn (${rest}).`,
  ];
  if (d.toelichting) regels.push(`Waarom deze datum: ${d.toelichting}`);
  if (openGroepen.length > 0) regels.push(`Nog open: ${openGroepen.join(", ")}.`);
  regels.push("Kijk in BackPACK_ op het startscherm voor jullie stand.");
  return regels.join("\n");
}
