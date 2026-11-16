/** Types en rekenregels voor materialen. Geen servercode, zodat ook schermen in de browser dit mogen gebruiken. */

export type Locatie = "camping" | "bivak";

export interface Materiaal {
  id: string;
  naam: string;
  categorie: string;
  /** leeg (null) = nog niet ingeschat door Logistiek & Facilitair */
  voorraadCamping: number | null;
  voorraadBivak: number | null;
  opmerking: string | null;
  actief: boolean;
  toegevoegdDoorCluster: string | null;
  bijgewerktDoorNaam: string | null;
  updatedAt: string;
}

export interface Categorie {
  id: string;
  naam: string;
  volgorde: number;
  /** aantal materialen in deze categorie (voor het beheer) */
  aantal: number;
}

export interface LijstStatus {
  status: "concept" | "definitief";
  definitiefOp: string | null;
  definitiefDoorNaam: string | null;
}

export interface AvfMateriaal {
  id: string;
  avfId: string;
  fase: "kop" | "romp" | "staart" | null;
  materiaalId: string | null;
  omschrijving: string | null;
  aantal: number;
  aantalGecorrigeerd: number | null;
  gecorrigeerdDoorNaam: string | null;
}

export interface Beschikbaarheid {
  /** wat er echt is: de laatste telling, anders de ingeschatte voorraad */
  voorraad: number;
  anderen: number;
  /** false = de voorraad is nog niet ingeschat ("voorraad volgt") */
  ingeschat: boolean;
}

export interface Aanvraag {
  id: string;
  avfId: string;
  materiaalId: string | null;
  omschrijving: string | null;
  aantal: number;
  toelichting: string | null;
  status: "open" | "afgehandeld" | "afgewezen";
  doorNaam: string;
  uitkomst: string | null;
  afgehandeldDoorNaam: string | null;
  afgehandeldOp: string | null;
  createdAt: string;
}

/** Eén regel van de paklijst: wat er is meegenomen, op locatie aanwezig is en teruggekomen. */
export interface Telling {
  materiaalId: string;
  locatie: Locatie;
  meegenomen: number | null;
  opKamp: number | null;
  retour: number | null;
  opmerking: string | null;
  bijgewerktDoorNaam: string | null;
  updatedAt: string;
}

export interface MateriaalMelding {
  soort: "tekort" | "niet_beschikbaar";
  materiaal: string;
  tekst: string;
}

/** Totaal van camping en bivak (wat al is ingeschat); null als er nog niets is ingevuld. */
export function totaalVoorraad(m: { voorraadCamping: number | null; voorraadBivak: number | null }): number | null {
  if (m.voorraadCamping === null && m.voorraadBivak === null) return null;
  return (m.voorraadCamping ?? 0) + (m.voorraadBivak ?? 0);
}

/** Het aantal dat telt: de correctie van de stuurgroep als die er is. */
export function effectiefAantal(r: { aantal: number; aantalGecorrigeerd: number | null }): number {
  return r.aantalGecorrigeerd ?? r.aantal;
}

/**
 * Hoeveel een belevenis van één materiaal tegelijk nodig heeft: de fasen kop, romp en staart volgen op elkaar,
 * dus het grootste aantal van de drie, plus wat voor de hele belevenis is gekozen. Zelfde regel als in de database.
 */
export function vraagVan(regels: AvfMateriaal[]): number {
  const perFase = new Map<string, number>();
  let algemeen = 0;
  for (const r of regels) {
    if (r.fase === null) algemeen += effectiefAantal(r);
    else perFase.set(r.fase, (perFase.get(r.fase) ?? 0) + effectiefAantal(r));
  }
  return algemeen + Math.max(0, ...perFase.values());
}

/** Aantal dat tekortkomt: wat deze belevenis en andere tegelijk nodig hebben, min wat er ligt. */
export function tekort(eigen: number, b: Beschikbaarheid): number {
  return Math.max(0, eigen + b.anderen - b.voorraad);
}

/** Is de voorraad van dit materiaal volledig ingeschat (camping en bivak)? */
export function isIngeschat(m: { voorraadCamping: number | null; voorraadBivak: number | null }): boolean {
  return m.voorraadCamping !== null && m.voorraadBivak !== null;
}

export function locatieNaam(l: string | null): string {
  return l === "bivak" ? "Bivak" : l === "camping" ? "Camping" : "";
}

