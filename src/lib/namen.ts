/**
 * Namen van studenten bij een rol. In de database staat per rol één tekstveld (`projectgroep_rol.namen`,
 * `stuurgroeprol.studenten`) met de namen achter elkaar, gescheiden door een komma: "Anna, Bram".
 * In de app vul je één naam per veld in; deze functies zetten de lijst om naar tekst en terug.
 * Oude teksten zoals "Anna en Bram" blijven gewoon leesbaar (als één naam) tot iemand ze aanpast.
 */

export const MAX_NAMEN_PER_ROL = 12;
export const MAX_LENGTE_NAAM = 40;

/** Eén naam opschonen: spaties netjes, geen komma's (die scheiden namen), niet te lang. */
export function schoonNaam(naam: string): string {
  return naam.replace(/[,;\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_LENGTE_NAAM).trim();
}

/** De namen uit de opgeslagen tekst, zonder lege plekken. */
export function splitNamen(tekst: string | null | undefined): string[] {
  if (!tekst) return [];
  return tekst.split(/[,\n]/).map(schoonNaam).filter((n) => n !== "");
}

/** Een lijst namen als opgeslagen tekst; `null` als er niemand is ingevuld. */
export function voegNamenSamen(namen: string[]): string | null {
  const lijst = namen.map(schoonNaam).filter((n) => n !== "").slice(0, MAX_NAMEN_PER_ROL);
  return lijst.length === 0 ? null : lijst.join(", ");
}

/** Dezelfde naam bij twee rollen telt als één persoon (hoofdletters en spaties maken niet uit). */
export function uniekeNamen(teksten: (string | null | undefined)[]): string[] {
  const gezien = new Set<string>();
  const uit: string[] = [];
  for (const t of teksten) {
    for (const naam of splitNamen(t)) {
      const sleutel = naam.toLocaleLowerCase("nl");
      if (gezien.has(sleutel)) continue;
      gezien.add(sleutel);
      uit.push(naam);
    }
  }
  return uit;
}

/** "1 persoon" of "9 personen". */
export function aantalPersonen(n: number): string {
  return `${n} ${n === 1 ? "persoon" : "personen"}`;
}
