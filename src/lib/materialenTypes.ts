/** Types en rekenregels voor materialen. Geen servercode, zodat ook schermen in de browser dit mogen gebruiken. */

export type Locatie = "camping" | "bivak";

export interface Materiaal {
  id: string;
  naam: string;
  categorie: string | null;
  voorraadCamping: number;
  voorraadBivak: number;
  opmerking: string | null;
  actief: boolean;
  toegevoegdDoorCluster: string | null;
  bijgewerktDoorNaam: string | null;
  updatedAt: string;
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
  voorraad: number;
  anderen: number;
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

export function locatieNaam(l: string | null): string {
  return l === "bivak" ? "Bivak" : l === "camping" ? "Camping" : "";
}

