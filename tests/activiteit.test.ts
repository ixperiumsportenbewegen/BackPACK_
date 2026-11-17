/**
 * Activiteit per account (beheerpagina voor de docent). Alleen de docent mag de functie aanroepen;
 * alle anderen krijgen een fout. Draait tegen het echte Supabase-project; er wordt niets gewijzigd.
 */
import { describe, expect, it } from "vitest";
import { anoniem, inloggenAls } from "./helpers";

type Rij = {
  account_id: string; gebruikersnaam: string; soort: string; cluster_code: string | null; label: string;
  laatst_ingelogd: string | null; laatst_gewerkt: string | null; avf_status: string | null; tussentijds: boolean | null;
};

describe("account_activiteit", () => {
  it("de docent ziet alle accounts van alle clusters, zonder het docentaccount zelf", async () => {
    const docent = await inloggenAls("docent");
    const { data, error } = await docent.rpc("account_activiteit");
    expect(error).toBeNull();
    const rijen = data as Rij[];
    const namen = rijen.map((r) => r.gebruikersnaam);
    for (const n of ["vd-groep-1", "vd-stuur-veiligheid", "vc-groep-3", "vc-stuur-financien", "test-groep-1", "vd-student"]) {
      expect(namen, n).toContain(n);
    }
    expect(namen).not.toContain("docent");
    const pg = rijen.find((r) => r.gebruikersnaam === "vd-groep-1")!;
    expect(pg.soort).toBe("projectgroep");
    expect(pg.cluster_code).toBe("VD");
    expect(pg.label).toMatch(/Projectgroep|groep/i);
    expect(pg.avf_status).not.toBeNull();
    const stuur = rijen.find((r) => r.gebruikersnaam === "vd-stuur-veiligheid")!;
    expect(stuur.label).toBe("Stuurgroep · Veiligheid & Welzijn");
    expect(stuur.avf_status).toBeNull();
  });

  it("geeft geen persoonsgegevens: alleen accountgegevens en tijden", async () => {
    const docent = await inloggenAls("docent");
    const { data } = await docent.rpc("account_activiteit");
    const sleutels = new Set(Object.keys((data as Rij[])[0]));
    expect([...sleutels].sort()).toEqual(
      ["account_id", "avf_status", "cluster_code", "gebruikersnaam", "label", "laatst_gewerkt", "laatst_ingelogd", "soort", "tussentijds"],
    );
  });

  it("stuurgroep, projectgroepen en studenten (ook van TEST) krijgen een fout", async () => {
    for (const g of [
      "vd-stuur-projectleiding", "vd-stuur-financien", "vc-stuur-programma", "vd-groep-1", "vc-groep-2", "vd-student", "test-stuur", "test-groep-1", "test-student",
    ]) {
      const c = await inloggenAls(g);
      const { data, error } = await c.rpc("account_activiteit");
      expect(error, g).not.toBeNull();
      expect(data, g).toBeNull();
    }
  });

  it("niet ingelogde bezoekers krijgen een fout", async () => {
    const { data, error } = await anoniem().rpc("account_activiteit");
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});
