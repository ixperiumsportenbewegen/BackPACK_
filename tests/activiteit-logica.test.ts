import { describe, expect, it } from "vitest";
import { herinneringTekst, nogNietGestart, samenvatting, stand, type ActiviteitRij } from "../src/lib/activiteit";

const rij = (p: Partial<ActiviteitRij>): ActiviteitRij => ({
  account_id: "x", gebruikersnaam: "vd-groep-1", soort: "projectgroep", cluster_code: "VD", label: "Projectgroep 1",
  laatst_ingelogd: null, laatst_gewerkt: null, avf_status: null, tussentijds: null, ...p,
});

describe("activiteit", () => {
  it("stand: gewerkt gaat vóór ingelogd, en zonder inlog is het nog niet ingelogd", () => {
    expect(stand({ laatst_ingelogd: "2026-11-17T08:00:00Z", laatst_gewerkt: "2026-11-17T09:00:00Z" })).toBe("gewerkt");
    expect(stand({ laatst_ingelogd: "2026-11-17T08:00:00Z", laatst_gewerkt: null })).toBe("ingelogd");
    expect(stand({ laatst_ingelogd: null, laatst_gewerkt: null })).toBe("niet_ingelogd");
  });

  it("samenvatting telt per soort en laat lege soorten weg", () => {
    const s = samenvatting([
      rij({ laatst_ingelogd: "2026-11-17T08:00:00Z", laatst_gewerkt: "2026-11-17T09:00:00Z" }),
      rij({ laatst_ingelogd: "2026-11-17T08:00:00Z" }),
      rij({}),
      rij({ soort: "stuurgroep", label: "Stuurgroep · Projectleiding", laatst_ingelogd: "2026-11-17T08:00:00Z" }),
    ]);
    expect(s).toEqual([
      { soort: "stuurgroep", totaal: 1, ingelogd: 1, gewerkt: 0 },
      { soort: "projectgroep", totaal: 3, ingelogd: 2, gewerkt: 1 },
    ]);
  });

  it("de herinnering noemt alleen groepen en rollen die nog niet hebben gewerkt, zonder studenten", () => {
    const rijen = [
      rij({ label: "Projectgroep 1", laatst_gewerkt: "2026-11-17T09:00:00Z" }),
      rij({ label: "Projectgroep 2" }),
      rij({ soort: "stuurgroep", label: "Stuurgroep · Veiligheid & Welzijn" }),
      rij({ soort: "student", label: "Studenten" }),
    ];
    expect(nogNietGestart(rijen)).toHaveLength(2);
    const t = herinneringTekst(rijen);
    expect(t).toContain("Projectgroep 2");
    expect(t).toContain("Veiligheid & Welzijn");
    expect(t).not.toContain("Projectgroep 1");
    expect(t).not.toContain("Studenten");
  });

  it("geen herinnering als iedereen heeft gewerkt", () => {
    expect(herinneringTekst([rij({ laatst_gewerkt: "2026-11-17T09:00:00Z" })])).toBe("");
  });
});
