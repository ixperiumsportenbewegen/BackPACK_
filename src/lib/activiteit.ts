/** Activiteit per account (beheerpagina voor de docent): samenvatting en herinneringstekst. Zonder servercode, zodat het te testen is. */

export type ActiviteitRij = {
  account_id: string;
  gebruikersnaam: string;
  soort: "stuurgroep" | "projectgroep" | "student";
  cluster_code: string | null;
  label: string;
  laatst_ingelogd: string | null;
  laatst_gewerkt: string | null;
  avf_status: string | null;
  tussentijds: boolean | null;
};

export type Stand = "gewerkt" | "ingelogd" | "niet_ingelogd";

/** Eén stand per account: gewerkt (er staat echt iets), alleen ingelogd, of nog niet ingelogd. */
export function stand(r: Pick<ActiviteitRij, "laatst_ingelogd" | "laatst_gewerkt">): Stand {
  if (r.laatst_gewerkt) return "gewerkt";
  return r.laatst_ingelogd ? "ingelogd" : "niet_ingelogd";
}

export const STAND_TEKST: Record<Stand, string> = {
  gewerkt: "Gewerkt",
  ingelogd: "Alleen ingelogd",
  niet_ingelogd: "Nog niet ingelogd",
};

export const SOORT_TEKST: Record<ActiviteitRij["soort"], string> = {
  stuurgroep: "Stuurgroep",
  projectgroep: "Projectgroepen",
  student: "Studenten",
};

export type Samenvatting = { soort: ActiviteitRij["soort"]; totaal: number; ingelogd: number; gewerkt: number };

/** Per soort account: hoeveel er ooit zijn ingelogd en hoeveel er hebben gewerkt. */
export function samenvatting(rijen: ActiviteitRij[]): Samenvatting[] {
  return (["stuurgroep", "projectgroep", "student"] as const)
    .map((soort) => {
      const lijst = rijen.filter((r) => r.soort === soort);
      return {
        soort,
        totaal: lijst.length,
        ingelogd: lijst.filter((r) => r.laatst_ingelogd).length,
        gewerkt: lijst.filter((r) => r.laatst_gewerkt).length,
      };
    })
    .filter((s) => s.totaal > 0);
}

/** Accounts waar nog niemand mee heeft gewerkt (voor de herinnering). Projectgroepen en stuurgroep, niet de losse studenten. */
export function nogNietGestart(rijen: ActiviteitRij[]): ActiviteitRij[] {
  return rijen.filter((r) => r.soort !== "student" && stand(r) !== "gewerkt");
}

/** Kant-en-klare tekst om in Teams te plakken. Noemt alleen de labels (rol of groep), geen personen. */
export function herinneringTekst(rijen: ActiviteitRij[]): string {
  const open = nogNietGestart(rijen);
  if (open.length === 0) return "";
  const namen = open.map((r) => r.label.replace(/^Stuurgroep · /, ""));
  return [
    "Herinnering BackPACK_",
    `Er is nog niet gewerkt in de app door: ${namen.join(", ")}.`,
    "Log in met jullie gegevens uit de handleiding en begin met de eerste stappen. Lukt het niet? Laat het weten in Teams.",
  ].join("\n");
}
