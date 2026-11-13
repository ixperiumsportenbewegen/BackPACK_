/**
 * Sfeerbeelden en logo's van het meerdaagsethema.
 * Een pad is een eigen bestand in Storage (`cluster/<cluster_id>/...`) of een
 * outdoorfoto uit de app zelf (`fotos/<naam>`).
 */

export const OUTDOOR_FOTOS = [
  { id: "vallei-viaduct", label: "Vallei en viaduct" },
  { id: "ochtend-tentterrein", label: "Ochtend op het tentterrein" },
  { id: "vuur-avond", label: "Vuur in de avond" },
  { id: "bivak-zeil", label: "Bivak onder het zeil" },
  { id: "rotswand-klimmen", label: "Klimmen aan de rotswand" },
  { id: "klimmen-staand", label: "Klimmen" },
  { id: "wandeling-schemer-staand", label: "Wandeling in de schemer" },
] as const;

export const STANDAARD_SFEERBEELD = "fotos/vallei-viaduct";

/** Webadres van een thema-afbeelding. `breedte` geldt alleen voor outdoorfoto's. */
export function themaBeeldUrl(pad: string | null | undefined, breedte: 800 | 1600 = 1600): string | null {
  if (!pad) return null;
  if (pad.startsWith("fotos/")) return `/${pad}-${breedte}.webp`;
  if (pad.startsWith("cluster/")) return `/api/thema/${pad}`;
  return null;
}
