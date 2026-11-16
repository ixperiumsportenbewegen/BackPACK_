/**
 * De persoonlijke paklijst: twee vaste blokken, zoals in de paklijst van eerdere jaren. De categorieën en spullen komen
 * uit de database (per cluster); de vaste categorieën worden bij het aanmaken van een cluster klaargezet zonder spullen.
 */
export type PaklijstBlokCode = "persoon" | "groepje";

export const PAKLIJST_BLOKKEN: { code: PaklijstBlokCode; naam: string; uitleg: string }[] = [
  { code: "persoon", naam: "Per persoon", uitleg: "Dit neemt iedereen zelf mee." },
  { code: "groepje", naam: "Om met een groepje te delen", uitleg: "Dit hoeft per groepje maar één keer mee. Spreek af wie wat meeneemt." },
];

export const MAX_SPULLEN_PER_CATEGORIE = 100;
export const MAX_ONDERDELEN_PER_SPUL = 30;
export const MAX_CATEGORIEEN_PER_BLOK = 30;
