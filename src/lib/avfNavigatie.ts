/** De volgorde waarin een projectgroep door het AVF loopt. Sectie D heeft drie stappen: kop, romp en staart. */
export interface Stap {
  id: string;
  href: string;
  label: string;
}

export const STAPPEN: Stap[] = [
  { id: "A", href: "/avf/A", label: "A · Basisgegevens" },
  { id: "B", href: "/avf/B", label: "B · Beginsituatie" },
  { id: "C", href: "/avf/C", label: "C · Doelen" },
  { id: "D-kop", href: "/avf/D?fase=kop", label: "D · Kop" },
  { id: "D-romp", href: "/avf/D?fase=romp", label: "D · Romp" },
  { id: "D-staart", href: "/avf/D?fase=staart", label: "D · Staart" },
  { id: "E", href: "/avf/E", label: "E · Veiligheid, EHBO en weer" },
  { id: "F", href: "/avf/F", label: "F · Materialen en financiën" },
  { id: "G", href: "/avf/G", label: "G · Thema en organisatie" },
  { id: "H", href: "/avf/H", label: "H · Communicatie" },
];

/** De stap vóór en na de opgegeven stap (null aan het begin en einde). */
export function buren(id: string): { vorige: Stap | null; volgende: Stap | null } {
  const i = STAPPEN.findIndex((s) => s.id === id);
  if (i < 0) return { vorige: null, volgende: null };
  return { vorige: STAPPEN[i - 1] ?? null, volgende: STAPPEN[i + 1] ?? null };
}
