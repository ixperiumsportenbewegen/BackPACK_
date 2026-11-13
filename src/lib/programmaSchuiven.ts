/**
 * Voorbeeld van het meeschuiven van tijden in het programma (de database doet het echte werk in
 * `programma_schuiven`; dit is dezelfde regel, zodat het scherm vooraf kan laten zien wat er verschuift).
 *
 * Regel: de aansluitende activiteiten na een wijziging schuiven mee met dezelfde duur. Bij een gat in het
 * programma (een activiteit begint niet waar de vorige eindigde) stopt het meeschuiven.
 */
export interface TijdRegel {
  id: string;
  dag: string;
  volgorde: number;
  starttijd: string;
  eindtijd: string;
}

export interface Verschuiving {
  id: string;
  oudStart: string;
  oudEind: string;
  nieuwStart: string;
  nieuwEind: string;
}

export function naarMinuten(t: string): number {
  const [u, m] = t.split(":").map(Number);
  return u * 60 + m;
}

export function naarTijd(minuten: number): string {
  return `${String(Math.floor(minuten / 60)).padStart(2, "0")}:${String(minuten % 60).padStart(2, "0")}`;
}

/** Wat verschuift er na activiteit `na` als dat deel van de dag `deltaMin` minuten opschuift (negatief = naar voren). */
export function berekenVerschuiving(
  regels: TijdRegel[],
  na: { dag: string; volgorde: number },
  oudEind: string,
  deltaMin: number,
): { verschoven: Verschuiving[]; pastNiet: boolean } {
  const verschoven: Verschuiving[] = [];
  if (deltaMin === 0) return { verschoven, pastNiet: false };
  let vorigeEind = naarMinuten(oudEind);
  const volgende = regels
    .filter((r) => r.dag === na.dag && r.volgorde > na.volgorde)
    .sort((a, b) => a.volgorde - b.volgorde);
  for (const r of volgende) {
    const start = naarMinuten(r.starttijd);
    const eind = naarMinuten(r.eindtijd);
    if (start !== vorigeEind) break; // een gat: hier stopt het meeschuiven
    const ns = start + deltaMin;
    const ne = eind + deltaMin;
    if (ns < 0 || ne > 1439) return { verschoven, pastNiet: true };
    verschoven.push({ id: r.id, oudStart: r.starttijd.slice(0, 5), oudEind: r.eindtijd.slice(0, 5), nieuwStart: naarTijd(ns), nieuwEind: naarTijd(ne) });
    vorigeEind = eind;
  }
  return { verschoven, pastNiet: false };
}
