export type Accountsoort = "docent" | "stuurgroep" | "projectgroep" | "student";

export interface LabelInvoer {
  soort: Accountsoort;
  clusterCode?: string | null;
  projectgroepNaam?: string | null;
  stuurgroeprolNaam?: string | null;
}

/** Het label bovenaan elk scherm, bijv. "VD · Projectgroep 3". */
export function accountLabel(i: LabelInvoer): string {
  switch (i.soort) {
    case "docent":
      return "Docent";
    case "stuurgroep":
      return `${i.clusterCode} · ${i.stuurgroeprolNaam}`;
    case "projectgroep":
      return `${i.clusterCode} · ${i.projectgroepNaam}`;
    case "student":
      return `${i.clusterCode} · Student`;
  }
}
