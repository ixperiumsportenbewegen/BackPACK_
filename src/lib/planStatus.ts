/**
 * Wanneer is het calamiteitenplan of de persoonlijke paklijst "af"? Op de werkpagina van Veiligheid & Welzijn en van
 * Logistiek & Facilitair staat een uitroepteken zolang er nog iets ontbreekt. Geen servercode, dus ook in tests te gebruiken.
 */
import { PLAN_SECTIES } from "../config/calamiteitenplan";
import type { Plan } from "./calamiteitenplan";
import type { Paklijst } from "./paklijst";

const gevuld = (t: string | undefined) => Boolean(t?.trim());

/** Onderdelen van het calamiteitenplan die mogen leeg blijven: alleen "Overig", voor wat nergens anders past. */
const OPTIONELE_SECTIES = new Set(["overig"]);

/**
 * De onderdelen van het calamiteitenplan waar nog iets ontbreekt; een lege lijst betekent dat het plan af is. Het plan is alleen
 * af als het volledig is ingevuld: alle tekstvelden van elk onderdeel zijn gevuld, en elke lijst heeft minstens één regel met een
 * titel (bij de contactpersonen ook een telefoonnummer). Alleen "Overig" mag leeg blijven.
 */
export function planOntbreekt(plan: Plan): string[] {
  const ontbreekt: string[] = [];
  for (const sectie of PLAN_SECTIES) {
    if (OPTIONELE_SECTIES.has(sectie.code)) continue;
    const veldenOk = (sectie.velden ?? []).every((v) => gevuld(plan.velden[v.sleutel]));
    const lijst = sectie.lijst;
    const lijstOk =
      !lijst ||
      (plan.lijsten[lijst.sleutel] ?? []).some((regel) => gevuld(regel.velden[lijst.titelVeld]) && (sectie.code !== "contacten" || gevuld(regel.velden.telefoon)));
    if (!veldenOk || !lijstOk) ontbreekt.push(sectie.naam);
  }
  return ontbreekt;
}

/** In welke blokken van de persoonlijke paklijst nog geen item staat; leeg betekent af: in beide blokken staat minstens één item. */
export function paklijstOntbreekt(paklijst: Paklijst): string[] {
  const heeftItem = (blok: "persoon" | "groepje") =>
    paklijst.categorieen.some((c) => c.blok === blok && c.spullen.some((s) => s.naam.trim() !== ""));
  const ontbreekt: string[] = [];
  if (!heeftItem("persoon")) ontbreekt.push("per persoon");
  if (!heeftItem("groepje")) ontbreekt.push("om met een groepje te delen");
  return ontbreekt;
}

/** "a", "a en b", "a, b en c" (geen komma voor "en"). */
export function opsomming(delen: string[]): string {
  if (delen.length <= 1) return delen.join("");
  return `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`;
}
