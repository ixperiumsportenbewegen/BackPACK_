/** Types en hulpfuncties voor het budget. Geen servercode, zodat ook schermen in de browser dit mogen gebruiken. */

export type BudgetStatus = "concept" | "aangevraagd" | "toegekend" | "teruggegeven" | "afgewezen";

export interface BudgetRegel {
  omschrijving: string;
  bedrag: number;
}

export interface BudgetAanvraag {
  id: string;
  avfId: string;
  projectgroepId: string;
  soort: "avf" | "los";
  omschrijving: string | null;
  toelichting: string | null;
  regels: BudgetRegel[];
  bedragAangevraagd: number;
  status: BudgetStatus;
  bedragToegekend: number | null;
  besluitToelichting: string | null;
  besluitDoorNaam: string | null;
  besluitOp: string | null;
  besteed: number | null;
  ingediendOp: string | null;
  updatedAt: string;
}

export type BudgetAanvraagMetGroep = BudgetAanvraag & { groepNaam: string; groepNummer: number; titel: string | null };

export const STATUS_NAAM: Record<BudgetStatus, string> = {
  concept: "Concept",
  aangevraagd: "Aangevraagd",
  toegekend: "Toegekend",
  teruggegeven: "Teruggegeven",
  afgewezen: "Afgewezen",
};

const euroFormaat = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

/** "€ 50,00"; een streepje als er nog geen bedrag is. */
export function euro(n: number | null | undefined): string {
  return n === null || n === undefined ? "–" : euroFormaat.format(n);
}

/** Bedrag uit een invoerveld ("12,50" of "12.5"); null als het leeg is, "ongeldig" bij een fout. */
export function leesBedrag(tekst: string): number | null | "ongeldig" {
  const t = tekst.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 99999 ? Math.round(n * 100) / 100 : "ongeldig";
}

export function somRegels(regels: BudgetRegel[]): number {
  return Math.round(regels.reduce((s, r) => s + r.bedrag, 0) * 100) / 100;
}
