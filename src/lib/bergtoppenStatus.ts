import { toppenNummers, topSleutel } from "@/config/bergtoppen";

export interface BergtoppenInhoud {
  toppen: { nummer: number; titel: string; afspraak: string }[];
  toelichting_titel: string;
  toelichting: string;
}

const heeft = (t: string | undefined) => Boolean(t && t.trim());

/** Welke onderdelen nog ontbreken: "top 3" (titel of afspraak leeg) en "toelichting". Leeg = klaar om te publiceren. */
export function bergtoppenOntbreekt(velden: Record<string, string>): string[] {
  const ontbreekt: string[] = [];
  for (const n of toppenNummers) {
    if (!heeft(velden[topSleutel(n, "titel")]) || !heeft(velden[topSleutel(n, "afspraak")])) ontbreekt.push(`top ${n}`);
  }
  if (!heeft(velden.toelichting)) ontbreekt.push("toelichting");
  return ontbreekt;
}

/** Het concept als inhoud van een publicatie (zoals de database die bij het publiceren vastlegt). */
export function conceptAlsInhoud(velden: Record<string, string>): BergtoppenInhoud {
  return {
    toppen: toppenNummers.map((n) => ({
      nummer: n,
      titel: (velden[topSleutel(n, "titel")] ?? "").trim(),
      afspraak: (velden[topSleutel(n, "afspraak")] ?? "").trim(),
    })),
    toelichting_titel: (velden.toelichting_titel ?? "").trim(),
    toelichting: (velden.toelichting ?? "").trim(),
  };
}

/** Wijkt het concept af van wat nu gepubliceerd is? */
export function conceptVerschilt(velden: Record<string, string>, gepubliceerd: BergtoppenInhoud | null): boolean {
  if (!gepubliceerd) return false;
  const nu = conceptAlsInhoud(velden);
  return (
    nu.toelichting_titel !== (gepubliceerd.toelichting_titel ?? "") ||
    nu.toelichting !== (gepubliceerd.toelichting ?? "") ||
    nu.toppen.some((t) => {
      const g = gepubliceerd.toppen.find((x) => x.nummer === t.nummer);
      return !g || g.titel !== t.titel || g.afspraak !== t.afspraak;
    })
  );
}

/** Kort overzicht voor de werkpagina: hoeveel toppen zijn ingevuld. */
export function toppenIngevuld(velden: Record<string, string>): number {
  return toppenNummers.filter((n) => heeft(velden[topSleutel(n, "titel")]) && heeft(velden[topSleutel(n, "afspraak")])).length;
}
