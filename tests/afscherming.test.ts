/**
 * Afschermingstests 3, 7 en 9 uit docs/rechtenmatrix.md, plus aanvullende controles
 * op de tabellen van opdracht 1. Draait tegen het echte Supabase-project met de
 * testaccounts uit seed/basis.json.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { admin, anoniem, clusterId, inloggenAls, TABELLEN } from "./helpers";

let VD: string, VC: string, TEST: string;

beforeAll(async () => {
  VD = await clusterId("VD");
  VC = await clusterId("VC");
  TEST = await clusterId("TEST");
});

/** Cluster-id's die in de zichtbare rijen voorkomen (cluster_id, of id bij tabel cluster). */
async function zichtbareClusters(client: Awaited<ReturnType<typeof inloggenAls>>): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const tabel of ["cluster", "cluster_budget", "meerdaagsethema", "stuurgroeprol", "projectgroep", "account", "wijziging"]) {
    const { data, error } = await client.from(tabel).select("*");
    expect(error, `${tabel} lezen`).toBeNull();
    for (const rij of data ?? []) {
      const id = tabel === "cluster" ? rij.id : rij.cluster_id;
      if (id) ids.add(id);
    }
  }
  // projectgroep_rol heeft geen cluster_id: controleer via projectgroep
  const { data: rollen } = await client.from("projectgroep_rol").select("projectgroep_id");
  const { data: groepen } = await admin.from("projectgroep").select("id, cluster_id");
  for (const r of rollen ?? []) {
    const g = groepen!.find((x) => x.id === r.projectgroep_id)!;
    ids.add(g.cluster_id);
  }
  return ids;
}

describe("Test 3: geen toegang tot een ander cluster", () => {
  const gevallen: [string, () => string][] = [
    ["vd-groep-1", () => VD],
    ["vd-stuur-logistiek", () => VD],
    ["vd-student", () => VD],
    ["vc-groep-3", () => VC],
    ["vc-stuur-beleving", () => VC],
    ["vc-student", () => VC],
    ["test-stuur", () => TEST],
    ["test-groep-1", () => TEST],
    ["test-student", () => TEST],
  ];

  for (const [naam, eigen] of gevallen) {
    it(`${naam} ziet alleen het eigen cluster`, async () => {
      const client = await inloggenAls(naam);
      const gezien = await zichtbareClusters(client);
      for (const id of gezien) expect(id).toBe(eigen());
      const { data } = await client.from("cluster").select("id");
      expect(data?.map((c) => c.id)).toEqual([eigen()]);
    });
  }

  it("docent ziet alle drie de clusters", async () => {
    const client = await inloggenAls("docent");
    const { data } = await client.from("cluster").select("code");
    expect(data?.map((c) => c.code).sort()).toEqual(["TEST", "VC", "VD"]);
  });

  it("vd-stuur-beleving kan het thema van VC niet wijzigen of aanmaken", async () => {
    const client = await inloggenAls("vd-stuur-beleving");
    const { data: voor } = await admin.from("meerdaagsethema").select("naam").eq("cluster_id", VC).single();
    const upd = await client.from("meerdaagsethema").update({ naam: "Gehackt" }).eq("cluster_id", VC).select();
    expect(upd.data ?? []).toHaveLength(0);
    const { data: na } = await admin.from("meerdaagsethema").select("naam").eq("cluster_id", VC).single();
    expect(na?.naam).toBe(voor?.naam);
  });

  it("vd-groep-1 kan de rolverdeling van een groep in VC niet wijzigen", async () => {
    const client = await inloggenAls("vd-groep-1");
    const { data: pg } = await admin.from("projectgroep").select("id").eq("cluster_id", VC).eq("nummer", 1).single();
    const upd = await client.from("projectgroep_rol").update({ namen: "Gehackt" }).eq("projectgroep_id", pg!.id).select();
    expect(upd.data ?? []).toHaveLength(0);
  });

  it("vd-stuur-logistiek kan de studentnamen van een VC-rol niet wijzigen", async () => {
    const client = await inloggenAls("vd-stuur-logistiek");
    const upd = await client.from("stuurgroeprol").update({ studenten: "Gehackt" }).eq("cluster_id", VC).select();
    expect(upd.data ?? []).toHaveLength(0);
  });

  it("vd-groep-1 kan budget_resterend alleen voor het eigen cluster opvragen", async () => {
    const client = await inloggenAls("vd-groep-1");
    const eigen = await client.rpc("budget_resterend", { p_cluster_id: VD });
    expect(eigen.error).toBeNull();
    // budget min wat is toegekend (het clusterbudget is aanpasbaar, de startwaarde is € 150)
    const { data: budget } = await admin.from("cluster_budget").select("budget_totaal").eq("cluster_id", VD).single();
    const { data: toegekend } = await admin.from("budgetaanvraag").select("bedrag_toegekend").eq("cluster_id", VD).eq("status", "toegekend");
    expect(Number(eigen.data)).toBe(Number(budget!.budget_totaal) - (toegekend ?? []).reduce((som, r) => som + Number(r.bedrag_toegekend), 0));
    const ander = await client.rpc("budget_resterend", { p_cluster_id: VC });
    expect(ander.error).not.toBeNull();
  });
});

describe("Rechten binnen het eigen cluster", () => {
  it("projectgroepen en studenten zien cluster_budget niet; de stuurgroep wel", async () => {
    for (const naam of ["vd-groep-1", "vd-student"]) {
      const { data } = await (await inloggenAls(naam)).from("cluster_budget").select("*");
      expect(data ?? [], naam).toHaveLength(0);
    }
    const { data } = await (await inloggenAls("vd-stuur-financien")).from("cluster_budget").select("*");
    expect(data).toHaveLength(1);
  });

  it("de rolverdeling met namen is voor iedereen in het eigen cluster leesbaar en voor niemand in het andere", async () => {
    // Studenten organiseren voor elkaar en moeten elkaar kunnen vinden (besluit 2026-11-16).
    for (const naam of ["vd-student", "vd-groep-2", "vd-stuur-programma"]) {
      const { data } = await (await inloggenAls(naam)).from("projectgroep_rol").select("projectgroep_id");
      expect(data?.length, naam).toBe(36); // 6 groepen x 6 rollen, alleen van VD
    }
    for (const naam of ["vc-student", "vc-groep-1", "vc-stuur-programma"]) {
      const { data } = await (await inloggenAls(naam)).from("projectgroep_rol").select("projectgroep_id");
      expect(data?.length, naam).toBe(36); // alleen van VC
    }
    // En niet te schrijven door een student of een andere groep (zie ook de tests hieronder).
    const student = await (await inloggenAls("vd-student")).from("projectgroep_rol").update({ namen: "Gehackt" }).neq("rol", "x").select();
    expect(student.data ?? []).toHaveLength(0);
  });

  it("de namen van de stuurgroepleden zijn voor het hele eigen cluster leesbaar en niet voor het andere", async () => {
    for (const naam of ["vd-student", "vd-groep-3"]) {
      const { data } = await (await inloggenAls(naam)).from("stuurgroeprol").select("cluster_id, studenten");
      expect(data?.length, naam).toBe(6);
      expect(new Set(data?.map((r) => r.cluster_id)), naam).toEqual(new Set([VD]));
    }
  });

  it("een account ziet alleen zichzelf; de docent ziet alle accounts", async () => {
    const { data } = await (await inloggenAls("vd-groep-1")).from("account").select("gebruikersnaam");
    expect(data).toEqual([{ gebruikersnaam: "vd-groep-1" }]);
    const alle = await (await inloggenAls("docent")).from("account").select("id");
    expect(alle.data).toHaveLength(31);
  });

  it("projectgroep wijzigt alleen de eigen rolverdeling", async () => {
    const client = await inloggenAls("vd-groep-2");
    const { data: eigen } = await admin.from("projectgroep").select("id").eq("cluster_id", VD).eq("nummer", 2).single();
    const { data: ander } = await admin.from("projectgroep").select("id").eq("cluster_id", VD).eq("nummer", 3).single();
    const ok = await client.from("projectgroep_rol").update({ namen: "Test A" }).eq("projectgroep_id", eigen!.id).eq("rol", "catering").select();
    expect(ok.data).toHaveLength(1);
    const nee = await client.from("projectgroep_rol").update({ namen: "Test B" }).eq("projectgroep_id", ander!.id).select();
    expect(nee.data ?? []).toHaveLength(0);
    await admin.from("projectgroep_rol").update({ namen: null }).eq("projectgroep_id", eigen!.id).eq("rol", "catering");
  });

  it("stuurgroep wijzigt alleen studenten van de eigen rol, niets anders", async () => {
    const client = await inloggenAls("vd-stuur-programma");
    const eigen = await client.from("stuurgroeprol").update({ studenten: "Student A, Student B" })
      .eq("cluster_id", VD).eq("code", "programma_kwaliteit").select();
    expect(eigen.data).toHaveLength(1);
    const andereRol = await client.from("stuurgroeprol").update({ studenten: "X" })
      .eq("cluster_id", VD).eq("code", "beleving_thema").select();
    expect(andereRol.data ?? []).toHaveLength(0);
    const naam = await client.from("stuurgroeprol").update({ naam: "Gewijzigd" })
      .eq("cluster_id", VD).eq("code", "programma_kwaliteit").select();
    expect(naam.error).not.toBeNull();
  });

  it("stuurgroep kan het thema van het eigen cluster wijzigen", async () => {
    const client = await inloggenAls("vd-stuur-beleving");
    const { data: voor } = await admin.from("meerdaagsethema").select("slogan").eq("cluster_id", VD).single();
    const upd = await client.from("meerdaagsethema").update({ slogan: "Tijdelijke slogan" }).eq("cluster_id", VD).select();
    expect(upd.data).toHaveLength(1);
    await admin.from("meerdaagsethema").update({ slogan: voor!.slogan }).eq("cluster_id", VD);
  });

  it("niemand behalve de docent kan accounts of het logboek schrijven", async () => {
    for (const naam of ["vd-stuur-projectleiding", "vd-groep-1", "docent"]) {
      const client = await inloggenAls(naam);
      const acc = await client.from("account").update({ gebruikersnaam: "x" }).eq("gebruikersnaam", naam).select();
      expect(acc.error ?? acc.data?.length === 0, `${naam} account`).toBeTruthy();
      const log = await client.from("wijziging").insert({ tabel: "x", actie: "x" });
      expect(log.error, `${naam} wijziging`).not.toBeNull();
    }
  });
});

describe("Test 7: studentaccount kan niets schrijven", () => {
  it("vd-student kan in geen enkele tabel aanmaken, wijzigen of verwijderen", async () => {
    const client = await inloggenAls("vd-student");
    const GETELD = TABELLEN.filter((t) => t !== "wijziging");
    const voor = await Promise.all(GETELD.map(async (t) => (await admin.from(t).select("*", { count: "exact", head: true })).count));

    const pogingen = [
      client.from("editie").insert({ naam: "x", startdatum: "2027-01-01", einddatum: "2027-01-02" }),
      client.from("cluster").insert({ editie_id: (await admin.from("editie").select("id").single()).data!.id, code: "TEST", naam: "x" }),
      client.from("cluster").update({ naam: "x" }).eq("id", VD).select(),
      client.from("cluster_budget").update({ budget_totaal: 1 }).eq("cluster_id", VD).select(),
      client.from("meerdaagsethema").update({ naam: "x" }).eq("cluster_id", VD).select(),
      client.from("stuurgroeprol").update({ studenten: "x" }).eq("cluster_id", VD).select(),
      client.from("projectgroep").update({ naam: "x" }).eq("cluster_id", VD).select(),
      client.from("projectgroep_rol").update({ namen: "x" }).neq("rol", "x").select(),
      client.from("account").update({ soort: "docent" }).eq("gebruikersnaam", "vd-student").select(),
      client.from("wijziging").insert({ tabel: "x", actie: "x" }),
      client.from("cluster").delete().eq("id", VD).select(),
      client.from("projectgroep").delete().eq("cluster_id", VD).select(),
    ];
    for (const p of await Promise.all(pogingen)) {
      const geenEffect = p.error !== null || !p.data || (Array.isArray(p.data) && p.data.length === 0);
      expect(geenEffect).toBe(true);
    }

    const na = await Promise.all(GETELD.map(async (t) => (await admin.from(t).select("*", { count: "exact", head: true })).count));
    const logboek = await admin.from("wijziging").select("id", { count: "exact", head: true }).eq("tabel", "x");
    expect(logboek.count).toBe(0);
    expect(na).toEqual(voor);

    const { data: acc } = await admin.from("account").select("soort").eq("gebruikersnaam", "vd-student").single();
    expect(acc?.soort).toBe("student");
  });
});

describe("Test 9: niet-ingelogde bezoeker kan niets lezen", () => {
  for (const tabel of TABELLEN) {
    it(`anoniem kan ${tabel} niet lezen`, async () => {
      const { data, error } = await anoniem().from(tabel).select("*");
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    });
  }

  it("anoniem kan niets schrijven", async () => {
    const res = await anoniem().from("cluster").update({ naam: "x" }).eq("id", VD).select();
    expect(res.error !== null || (res.data ?? []).length === 0).toBe(true);
    const ins = await anoniem().from("wijziging").insert({ tabel: "x", actie: "x" });
    expect(ins.error).not.toBeNull();
  });

  it("anoniem kan de hulpfuncties en budget_resterend niet aanroepen", async () => {
    const a = await anoniem().rpc("budget_resterend", { p_cluster_id: VD });
    expect(a.error).not.toBeNull();
    const b = await anoniem().rpc("is_docent");
    expect(b.error).not.toBeNull();
  });
});
