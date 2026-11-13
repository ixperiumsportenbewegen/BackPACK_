/** De zes vaste rollen in elke projectgroep (docs/datamodel.md). Projectgroepen zien PACK niet. */
export const PROJECTGROEPROLLEN = [
  { code: "projectleider", naam: "Projectleider", taken: "Planning, taakverdeling en afstemming", pack: "K" },
  { code: "programma_beleving", naam: "Programma & Beleving", taken: "Activiteit, thema en deelnemerservaring", pack: "A" },
  { code: "veiligheid_ehbo", naam: "Veiligheid & EHBO", taken: "Risico's, instructies en slechtweerplan", pack: "P" },
  { code: "logistiek_materialen", naam: "Logistiek & Materialen", taken: "Locatie, vervoer, op- en afbouw", pack: "P" },
  { code: "catering", naam: "Catering", taken: "Eten, drinken, allergieën en uitgifte", pack: "P" },
  { code: "corvee_communicatie", naam: "Corvee & Communicatie", taken: "Schoonmaakrooster, afspraken en draaiboek", pack: "C" },
] as const;

export type ProjectgroepRolCode = (typeof PROJECTGROEPROLLEN)[number]["code"];

/** Volgorde van de stuurgroeprollen, gegroepeerd per PACK-vak: P, A, C, K. */
export const STUURGROEPROL_VOLGORDE = [
  "veiligheid_welzijn",
  "logistiek_facilitair",
  "beleving_thema",
  "programma_kwaliteit",
  "communicatie_financien",
  "projectleiding",
] as const;
