/** Ondertitels per dag van het standaardprogramma. */
export const PROGRAMMA_DAGEN: Record<string, string> = {
  "2027-06-28": "Locaties: vertrek Gymnasion Nijmegen → hike → Camping",
  "2027-06-29": "Overdag: Camping · dinsdagavond: verplaatsing naar bivak",
  "2027-06-30": "Alle activiteiten vanuit de bivaklocatie · terugreis naar Gymnasion",
};

/** [4, 5, 6] wordt "4 t/m 6", [1, 3] wordt "1 en 3", [2, 3, 4, 5, 6] wordt "2 t/m 6". */
export function formatGroepNummers(nummers: number[]): string {
  const n = [...new Set(nummers)].sort((a, b) => a - b);
  if (n.length === 0) return "";
  const delen: string[] = [];
  let start = n[0];
  let vorige = n[0];
  for (const x of n.slice(1).concat([Infinity])) {
    if (x === vorige + 1) { vorige = x; continue; }
    delen.push(start === vorige ? String(start) : vorige === start + 1 ? `${start} en ${vorige}` : `${start} t/m ${vorige}`);
    start = x;
    vorige = x;
  }
  if (delen.length === 1) return delen[0];
  return `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`;
}

export interface ProgrammaRegel {
  id: string;
  cluster_id: string;
  volgorde: number;
  dag: string;
  starttijd: string;
  eindtijd: string;
  soort: "vast" | "belevenis";
  titel: string;
  omschrijving: string | null;
  locatie: string | null;
  deelnemers: number[];
  rocks_rivers_groepen: number[];
  bijgewerkt_door_naam: string | null;
  updated_at: string;
}
