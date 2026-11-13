/**
 * Opdracht 5, deel A: gedeelde materialenlijst (concept en definitief), afscherming (test 8 uit de rechtenmatrix),
 * materialen in het AVF, correcties en de voorraad per locatie en moment.
 * Draait tegen het echte Supabase-project. De test zet de status van de lijst zelf met de service role en herstelt
 * die aan het eind; alles wat de test aanmaakt wordt weer opgeruimd.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anoniem, clusterId, inloggenAls } from "./helpers";

type R = { ok: boolean; reden?: string };

const NAAM = "Testpersoon";
let VD: string, VC: string, TEST: string;
let avfVd1: string, avfVd2: string, avfVd3: string, avfVc1: string, avfTest1: string;
let touw: string; // id van "Touw (10 m)": camping 6, bivak 4
let beginStatus: Record<string, unknown>;
const origineel: Record<string, { locatie_keuze: string | null; status: string; opnieuw_te_controleren: boolean }> = {};
const aangemaakteRegels: string[] = [];
const aangemaakteMaterialen: string[] = [];

async function avfId(cluster: string, nummer: number): Promise<string> {
  const { data } = await admin.from("avf").select("id, projectgroep:projectgroep_id!inner(nummer)").eq("cluster_id", cluster).eq("projectgroep.nummer", nummer).single();
  return data!.id;
}

async function regel(avf: string, materiaal: string, aantal: number, fase: string | null = null) {
  const { data, error } = await admin.from("avf_materiaal").insert({ avf_id: avf, materiaal_id: materiaal, aantal, fase }).select("id").single();
  if (error) throw new Error(error.message);
  aangemaakteRegels.push(data.id);
  return data.id as string;
}

async function opschonen() {
  if (aangemaakteRegels.length) await admin.from("avf_materiaal").delete().in("id", aangemaakteRegels);
  await admin.from("avf_materiaal").delete().in("avf_id", [avfTest1]).is("materiaal_id", null);
  if (aangemaakteMaterialen.length) await admin.from("materiaal").delete().in("id", aangemaakteMaterialen);
  await admin.from("materiaal").delete().ilike("naam", "TestMat%");
  for (const [id, o] of Object.entries(origineel)) {
    await admin.from("avf").update({ locatie_keuze: o.locatie_keuze, status: o.status, opnieuw_te_controleren: o.opnieuw_te_controleren }).eq("id", id);
  }
  await admin.from("verbeterverzoek").delete().eq("avf_id", avfTest1);
  await admin.from("materiaal").update({ actief: true }).eq("id", touw);
  await admin.from("wijziging").delete().eq("naam", NAAM).in("tabel", ["materiaal", "materiaallijst_status"]);
  await admin.from("wijziging").delete().eq("naam", NAAM).eq("record_id", avfTest1);
  if (beginStatus) {
    await admin.from("materiaallijst_status").update({
      status: beginStatus.status, definitief_op: beginStatus.definitief_op, definitief_door_naam: beginStatus.definitief_door_naam,
      definitief_door_cluster: beginStatus.definitief_door_cluster,
    }).eq("id", true);
  }
}

beforeAll(async () => {
  VD = await clusterId("VD");
  VC = await clusterId("VC");
  TEST = await clusterId("TEST");
  [avfVd1, avfVd2, avfVd3, avfVc1, avfTest1] = await Promise.all([avfId(VD, 1), avfId(VD, 2), avfId(VD, 3), avfId(VC, 1), avfId(TEST, 1)]);
  for (const id of [avfVd1, avfVd2, avfVd3, avfVc1, avfTest1]) {
    const { data } = await admin.from("avf").select("locatie_keuze, status, opnieuw_te_controleren").eq("id", id).single();
    origineel[id] = data!;
  }
  const { data: m } = await admin.from("materiaal").select("id").eq("naam", "Touw (10 m)").single();
  touw = m!.id;
  const { data: s } = await admin.from("materiaallijst_status").select("*").eq("id", true).single();
  beginStatus = s!;
  await opschonen();
  await admin.from("materiaallijst_status").update({ status: "concept" }).eq("id", true);
});

afterAll(opschonen);

describe("De lijst is concept: alleen de bouwers zien hem", () => {
  it("Logistiek & Facilitair van VD en de docent lezen de lijst; anderen niet", async () => {
    for (const g of ["vd-stuur-logistiek", "docent"]) {
      const { data } = await (await inloggenAls(g)).from("materiaal").select("id");
      expect((data ?? []).length, g).toBeGreaterThanOrEqual(13);
    }
    for (const g of ["vd-groep-1", "vc-stuur-logistiek", "vd-stuur-programma", "vd-student", "test-groep-1", "vc-groep-1"]) {
      const { data } = await (await inloggenAls(g)).from("materiaal").select("id");
      expect(data ?? [], g).toHaveLength(0);
    }
    expect((await anoniem().from("materiaal").select("id")).data ?? []).toHaveLength(0);
  });

  it("projectgroepen kunnen nog geen materiaal uit de lijst kiezen", async () => {
    await admin.from("avf").update({ locatie_keuze: "camping" }).eq("id", avfVd1);
    const res = await (await inloggenAls("vd-groep-1")).from("avf_materiaal").insert({ avf_id: avfVd1, materiaal_id: touw, aantal: 1 });
    expect(res.error).not.toBeNull();
  });
});

describe("Test 8: alleen Logistiek & Facilitair en de docent wijzigen de lijst", () => {
  it("vd-stuur-logistiek en de docent voegen toe en wijzigen; anderen kunnen dat niet", async () => {
    const logistiek = await inloggenAls("vd-stuur-logistiek");
    const ins = await logistiek.from("materiaal").insert({ naam: "TestMat A", categorie: "Test", voorraad_camping: 5, voorraad_bivak: 2, bijgewerkt_door_naam: NAAM }).select("id, toegevoegd_door_cluster").single();
    expect(ins.error).toBeNull();
    aangemaakteMaterialen.push(ins.data!.id);
    expect(ins.data!.toegevoegd_door_cluster).toBe(VD);

    const upd = await logistiek.from("materiaal").update({ voorraad_camping: 7, bijgewerkt_door_naam: NAAM }).eq("id", ins.data!.id).select("voorraad_camping");
    expect(upd.data?.[0]?.voorraad_camping).toBe(7);
    const inactief = await logistiek.from("materiaal").update({ actief: false }).eq("id", ins.data!.id).select("actief");
    expect(inactief.data?.[0]?.actief).toBe(false);
    // dubbele naam (ook met andere hoofdletters) mag niet
    const dubbel = await logistiek.from("materiaal").insert({ naam: "testmat a " });
    expect(dubbel.error).not.toBeNull();
    // verwijderen kan niemand
    const del = await logistiek.from("materiaal").delete().eq("id", ins.data!.id).select();
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);

    const docent = await (await inloggenAls("docent")).from("materiaal").insert({ naam: "TestMat B", bijgewerkt_door_naam: NAAM }).select("id").single();
    expect(docent.error).toBeNull();
    aangemaakteMaterialen.push(docent.data!.id);

    for (const g of ["vd-stuur-programma", "vd-stuur-veiligheid", "vc-stuur-logistiek", "vd-groep-1", "vd-student", "test-stuur"]) {
      const c = await inloggenAls(g);
      expect((await c.from("materiaal").insert({ naam: `TestMat X ${g}` })).error, `${g} insert`).not.toBeNull();
      const u = await c.from("materiaal").update({ voorraad_camping: 999 }).eq("id", touw).select();
      expect(u.error !== null || (u.data ?? []).length === 0, `${g} update`).toBe(true);
    }
    expect((await anoniem().from("materiaal").insert({ naam: "TestMat anoniem" })).error).not.toBeNull();
    const { data: touwNa } = await admin.from("materiaal").select("voorraad_camping").eq("id", touw).single();
    expect(touwNa?.voorraad_camping).toBe(6);
  });

  it("wijzigingen in de lijst staan in het logboek met naam en cluster", async () => {
    const { data } = await admin.from("wijziging").select("actie, naam, cluster_id").eq("tabel", "materiaal").eq("naam", NAAM);
    const acties = new Set(data?.map((l) => l.actie));
    expect(acties.has("materiaal_toegevoegd")).toBe(true);
    expect(acties.has("materiaal_gewijzigd")).toBe(true);
    expect(data?.some((l) => l.cluster_id === VD)).toBe(true);
  });
});

describe("Definitief maken", () => {
  it("alleen Logistiek & Facilitair van VD (of de docent) kan de lijst definitief maken, met een naam", async () => {
    for (const g of ["vd-stuur-programma", "vc-stuur-logistiek", "vd-groep-1", "vd-student", "test-stuur"]) {
      expect((await (await inloggenAls(g)).rpc("materiaallijst_definitief_maken", { p_naam: NAAM })).error, g).not.toBeNull();
    }
    expect((await anoniem().rpc("materiaallijst_definitief_maken", { p_naam: NAAM })).error).not.toBeNull();
    const logistiek = await inloggenAls("vd-stuur-logistiek");
    expect(((await logistiek.rpc("materiaallijst_definitief_maken", { p_naam: " " })).data as R).reden).toBe("naam");
    const { data: nog } = await admin.from("materiaallijst_status").select("status").eq("id", true).single();
    expect(nog?.status).toBe("concept");

    expect(((await logistiek.rpc("materiaallijst_definitief_maken", { p_naam: NAAM })).data as R).ok).toBe(true);
    expect(((await logistiek.rpc("materiaallijst_definitief_maken", { p_naam: NAAM })).data as R).reden).toBe("al_definitief");
    const { data } = await admin.from("materiaallijst_status").select("status, definitief_door_naam, definitief_door_cluster").eq("id", true).single();
    expect(data).toEqual({ status: "definitief", definitief_door_naam: NAAM, definitief_door_cluster: VD });
  });

  it("de status kan niet rechtstreeks worden gewijzigd; terugzetten kan alleen de docent", async () => {
    for (const g of ["vd-stuur-logistiek", "vd-groep-1", "docent"]) {
      const c = await inloggenAls(g);
      const u = await c.from("materiaallijst_status").update({ status: "concept" }).eq("id", true).select();
      expect(u.error !== null || (u.data ?? []).length === 0, g).toBe(true);
    }
    expect((await (await inloggenAls("vd-stuur-logistiek")).rpc("materiaallijst_terugzetten", { p_naam: NAAM })).error).not.toBeNull();
    const { data } = await admin.from("materiaallijst_status").select("status").eq("id", true).single();
    expect(data?.status).toBe("definitief");
  });

  it("daarna lezen stuurgroepen en projectgroepen van alle clusters de lijst; studenten en anonieme bezoekers niet", async () => {
    for (const g of ["vd-groep-1", "vd-groep-2", "vc-groep-1", "vc-stuur-programma", "vd-stuur-programma", "test-groep-1", "vc-stuur-logistiek"]) {
      const { data } = await (await inloggenAls(g)).from("materiaal").select("id");
      expect((data ?? []).length, g).toBeGreaterThanOrEqual(13);
    }
    for (const g of ["vd-student", "vc-student", "test-student"]) {
      expect(((await (await inloggenAls(g)).from("materiaal").select("id")).data ?? []).length, g).toBe(0);
    }
    expect((await anoniem().from("materiaal").select("id")).data ?? []).toHaveLength(0);
  });
});

describe("VC mag alleen materialen toevoegen", () => {
  it("vc-stuur-logistiek voegt toe, maar wijzigt niets en zet niets op inactief", async () => {
    const vc = await inloggenAls("vc-stuur-logistiek");
    const ins = await vc.from("materiaal").insert({ naam: "TestMat VC", voorraad_camping: 3, bijgewerkt_door_naam: NAAM }).select("id, toegevoegd_door_cluster").single();
    expect(ins.error).toBeNull();
    aangemaakteMaterialen.push(ins.data!.id);
    expect(ins.data!.toegevoegd_door_cluster).toBe(VC);
    for (const w of [{ voorraad_camping: 99 }, { actief: false }, { naam: "Anders" }]) {
      const u = await vc.from("materiaal").update(w).eq("id", ins.data!.id).select();
      expect(u.error !== null || (u.data ?? []).length === 0, JSON.stringify(w)).toBe(true);
      const u2 = await vc.from("materiaal").update(w).eq("id", touw).select();
      expect(u2.error !== null || (u2.data ?? []).length === 0, `touw ${JSON.stringify(w)}`).toBe(true);
    }
    // andere VC-rollen en projectgroepen kunnen niets toevoegen
    for (const g of ["vc-stuur-programma", "vc-groep-1", "vc-student"]) {
      expect((await (await inloggenAls(g)).from("materiaal").insert({ naam: `TestMat ${g}` })).error, g).not.toBeNull();
    }
  });
});

describe("Materialen in het AVF", () => {
  it("een projectgroep kiest materiaal in het eigen AVF, met locatie en uit de actieve lijst", async () => {
    await admin.from("avf").update({ locatie_keuze: "camping" }).eq("id", avfVd1);
    const g = await inloggenAls("vd-groep-1");
    const ok = await g.from("avf_materiaal").insert({ avf_id: avfVd1, materiaal_id: touw, aantal: 2, fase: "romp" }).select("id").single();
    expect(ok.error).toBeNull();
    aangemaakteRegels.push(ok.data!.id);
    // dubbel in dezelfde fase mag niet
    expect((await g.from("avf_materiaal").insert({ avf_id: avfVd1, materiaal_id: touw, aantal: 1, fase: "romp" })).error).not.toBeNull();
    // aanvullend materiaal zonder lijst
    const aanv = await g.from("avf_materiaal").insert({ avf_id: avfVd1, omschrijving: "Zelfgemaakte vlaggen", aantal: 4 }).select("id").single();
    expect(aanv.error).toBeNull();
    aangemaakteRegels.push(aanv.data!.id);
    // beide ingevuld of beide leeg mag niet
    expect((await g.from("avf_materiaal").insert({ avf_id: avfVd1, materiaal_id: touw, omschrijving: "x", aantal: 1, fase: "kop" })).error).not.toBeNull();
    // aantal moet minstens 1 zijn
    expect((await g.from("avf_materiaal").insert({ avf_id: avfVd1, materiaal_id: touw, aantal: 0, fase: "staart" })).error).not.toBeNull();
    // aantal wijzigen kan, correctie van de stuurgroep niet
    const upd = await g.from("avf_materiaal").update({ aantal: 3 }).eq("id", ok.data!.id).select("aantal");
    expect(upd.data?.[0]?.aantal).toBe(3);
    expect((await g.from("avf_materiaal").update({ aantal_gecorrigeerd: 1 }).eq("id", ok.data!.id)).error).not.toBeNull();
    expect((await g.from("avf_materiaal").update({ materiaal_id: null }).eq("id", ok.data!.id)).error).not.toBeNull();
  });

  it("zonder locatie kan er geen materiaal worden gekozen, en een inactief materiaal niet", async () => {
    await admin.from("avf").update({ locatie_keuze: null }).eq("id", avfVd3);
    const g3 = await inloggenAls("vd-groep-3");
    const zonder = await g3.from("avf_materiaal").insert({ avf_id: avfVd3, materiaal_id: touw, aantal: 1 });
    expect(zonder.error).not.toBeNull();
    expect(zonder.error?.message).toContain("locatie");

    await admin.from("avf").update({ locatie_keuze: "bivak" }).eq("id", avfVd3);
    const { data: m } = await admin.from("materiaal").insert({ naam: "TestMat inactief", actief: false }).select("id").single();
    aangemaakteMaterialen.push(m!.id);
    expect((await g3.from("avf_materiaal").insert({ avf_id: avfVd3, materiaal_id: m!.id, aantal: 1 })).error).not.toBeNull();
  });

  it("de locatie kan niet leeg worden zolang er materialen zijn gekozen", async () => {
    const res = await (await inloggenAls("vd-groep-1")).from("avf").update({ locatie_keuze: null }).eq("id", avfVd1).select();
    expect(res.error).not.toBeNull();
  });

  it("anderen kunnen geen materialen van dit AVF lezen of schrijven", async () => {
    for (const g of ["vd-groep-2", "vc-groep-1", "vd-student", "test-groep-1"]) {
      const c = await inloggenAls(g);
      expect(((await c.from("avf_materiaal").select("id").eq("avf_id", avfVd1)).data ?? []).length, `${g} lezen`).toBe(0);
      expect((await c.from("avf_materiaal").insert({ avf_id: avfVd1, omschrijving: "Gehackt", aantal: 1 })).error, `${g} schrijven`).not.toBeNull();
      const del = await c.from("avf_materiaal").delete().eq("avf_id", avfVd1).select();
      expect(del.error !== null || (del.data ?? []).length === 0, `${g} verwijderen`).toBe(true);
    }
    // de stuurgroep van het cluster leest wel, maar schrijft niet rechtstreeks
    const stuur = await inloggenAls("vd-stuur-programma");
    expect(((await stuur.from("avf_materiaal").select("id").eq("avf_id", avfVd1)).data ?? []).length).toBeGreaterThanOrEqual(2);
    expect((await stuur.from("avf_materiaal").insert({ avf_id: avfVd1, omschrijving: "Gehackt", aantal: 1 })).error).not.toBeNull();
    const upd = await stuur.from("avf_materiaal").update({ aantal: 50 }).eq("avf_id", avfVd1).select();
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
    expect(((await (await inloggenAls("vc-stuur-programma")).from("avf_materiaal").select("id").eq("avf_id", avfVd1)).data ?? [])).toHaveLength(0);
  });

  it("bij een ingediend AVF is de materiaallijst alleen-lezen voor de groep", async () => {
    await admin.from("avf").update({ status: "ingediend" }).eq("id", avfVd1);
    const g = await inloggenAls("vd-groep-1");
    expect((await g.from("avf_materiaal").insert({ avf_id: avfVd1, omschrijving: "Te laat", aantal: 1 })).error).not.toBeNull();
    const upd = await g.from("avf_materiaal").update({ aantal: 9 }).eq("avf_id", avfVd1).select();
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
    await admin.from("avf").update({ status: origineel[avfVd1].status }).eq("id", avfVd1);
  });
});

describe("Correcties van de stuurgroep", () => {
  it("alleen de stuurgroep van het cluster (en de docent) corrigeert via de functie; gelijk aan het origineel haalt de correctie weg", async () => {
    const { data: rij } = await admin.from("avf_materiaal").select("id, aantal").eq("avf_id", avfVd1).eq("materiaal_id", touw).single();
    const corrigeer = (g: string, aantal: number | null) => inloggenAls(g).then((c) => c.rpc("avf_materiaal_corrigeren", { p_id: rij!.id, p_aantal: aantal, p_naam: NAAM }));
    for (const g of ["vd-groep-1", "vd-groep-2", "vc-stuur-logistiek", "vd-student", "test-stuur"]) {
      expect((await corrigeer(g, 1)).error, g).not.toBeNull();
    }
    expect((await anoniem().rpc("avf_materiaal_corrigeren", { p_id: rij!.id, p_aantal: 1, p_naam: NAAM })).error).not.toBeNull();

    const stuur = await inloggenAls("vd-stuur-programma");
    expect(((await stuur.rpc("avf_materiaal_corrigeren", { p_id: rij!.id, p_aantal: 1, p_naam: " " })).data as R).reden).toBe("naam");
    expect(((await corrigeer("vd-stuur-programma", 1)).data as R).ok).toBe(true);
    const { data: na } = await admin.from("avf_materiaal").select("aantal, aantal_gecorrigeerd, gecorrigeerd_door_naam").eq("id", rij!.id).single();
    expect(na).toEqual({ aantal: 3, aantal_gecorrigeerd: 1, gecorrigeerd_door_naam: NAAM });
    // de projectgroep ziet de correctie
    const { data: groepZiet } = await (await inloggenAls("vd-groep-1")).from("avf_materiaal").select("aantal_gecorrigeerd").eq("id", rij!.id).single();
    expect(groepZiet?.aantal_gecorrigeerd).toBe(1);
    expect(((await corrigeer("docent", rij!.aantal)).data as R).ok).toBe(true);
    const { data: weg } = await admin.from("avf_materiaal").select("aantal_gecorrigeerd").eq("id", rij!.id).single();
    expect(weg?.aantal_gecorrigeerd).toBeNull();
  });
});

describe("Voorraad per locatie en moment", () => {
  it("VD en VC hebben dezelfde tijdvakken (voorwaarde voor de volgende tests)", async () => {
    const { data } = await admin.from("avf").select("id, programma_regel:programma_regel_id(dag, starttijd, eindtijd)").in("id", [avfVd1, avfVc1]);
    const per = Object.fromEntries((data ?? []).map((r) => [r.id, r.programma_regel as unknown as { dag: string; starttijd: string; eindtijd: string }]));
    expect(per[avfVd1]).toEqual(per[avfVc1]);
  });

  it("alleen belevenissen op dezelfde locatie die tegelijk plaatsvinden tellen mee; de groep ziet geen namen", async () => {
    // VD1 gebruikt 3 touwen op de camping (rij uit de vorige test), VC1 gebruikt er 2 en kiest ook camping
    await admin.from("avf").update({ locatie_keuze: "camping" }).eq("id", avfVc1);
    await regel(avfVc1, touw, 2);

    const vd = await inloggenAls("vd-groep-1");
    const { data: voorVd } = await vd.rpc("materiaal_beschikbaar", { p_avf_id: avfVd1 });
    const t = (voorVd as { materiaal_id: string; voorraad: number; anderen: number }[]).find((x) => x.materiaal_id === touw);
    expect(t).toEqual({ materiaal_id: touw, voorraad: 6, anderen: 2 }); // voorraad van de camping, en wat VC tegelijk gebruikt
    const { data: voorVc } = await (await inloggenAls("vc-groep-1")).rpc("materiaal_beschikbaar", { p_avf_id: avfVc1 });
    expect((voorVc as { materiaal_id: string; anderen: number }[]).find((x) => x.materiaal_id === touw)?.anderen).toBe(3);

    // VC kiest het bivak: geen overlap meer, en de voorraad is die van het bivak
    await admin.from("avf").update({ locatie_keuze: "bivak" }).eq("id", avfVc1);
    const { data: ná } = await vd.rpc("materiaal_beschikbaar", { p_avf_id: avfVd1 });
    expect((ná as { materiaal_id: string; anderen: number }[]).find((x) => x.materiaal_id === touw)?.anderen).toBe(0);
    const { data: bivak } = await (await inloggenAls("vc-groep-1")).rpc("materiaal_beschikbaar", { p_avf_id: avfVc1 });
    expect((bivak as { materiaal_id: string; voorraad: number }[]).find((x) => x.materiaal_id === touw)?.voorraad).toBe(4);
  });

  it("een andere belevenis in een ander tijdvak telt niet mee, ook niet op dezelfde locatie", async () => {
    await admin.from("avf").update({ locatie_keuze: "camping" }).eq("id", avfVd2);
    await regel(avfVd2, touw, 5);
    const { data } = await (await inloggenAls("vd-groep-1")).rpc("materiaal_beschikbaar", { p_avf_id: avfVd1 });
    expect((data as { materiaal_id: string; anderen: number }[]).find((x) => x.materiaal_id === touw)?.anderen).toBe(0);
  });

  it("een correctie telt mee in wat anderen gebruiken", async () => {
    await admin.from("avf").update({ locatie_keuze: "camping" }).eq("id", avfVc1);
    const { data: rij } = await admin.from("avf_materiaal").select("id").eq("avf_id", avfVc1).eq("materiaal_id", touw).single();
    expect(((await (await inloggenAls("vc-stuur-programma")).rpc("avf_materiaal_corrigeren", { p_id: rij!.id, p_aantal: 4, p_naam: NAAM })).data as R).ok).toBe(true);
    const { data } = await (await inloggenAls("vd-groep-1")).rpc("materiaal_beschikbaar", { p_avf_id: avfVd1 });
    expect((data as { materiaal_id: string; anderen: number }[]).find((x) => x.materiaal_id === touw)?.anderen).toBe(4);
  });

  it("de fasen volgen op elkaar: de grootste fase telt, plus wat voor de hele belevenis is gekozen", async () => {
    const extra = [await regel(avfVc1, touw, 3, "kop"), await regel(avfVc1, touw, 1, "romp")];
    const { data } = await (await inloggenAls("vd-groep-1")).rpc("materiaal_beschikbaar", { p_avf_id: avfVd1 });
    // hele belevenis 4 (gecorrigeerd) + grootste fase 3
    expect((data as { materiaal_id: string; anderen: number }[]).find((x) => x.materiaal_id === touw)?.anderen).toBe(7);
    await admin.from("avf_materiaal").delete().in("id", extra);
  });

  it("de stuurgroep ziet de context van het eigen cluster, anderen niet", async () => {
    const stuur = await inloggenAls("vd-stuur-programma");
    const { data } = await stuur.rpc("materiaal_context", { p_cluster_id: VD });
    const regelVd1 = (data as { avf_id: string; materiaal_id: string; locatie: string; voorraad: number; anderen: number }[]).find((x) => x.avf_id === avfVd1 && x.materiaal_id === touw);
    expect(regelVd1).toEqual({ avf_id: avfVd1, materiaal_id: touw, locatie: "camping", voorraad: 6, anderen: 4 });
    expect((await stuur.rpc("materiaal_context", { p_cluster_id: VC })).error).not.toBeNull();
    for (const g of ["vd-groep-1", "vd-student", "vc-stuur-programma"]) {
      expect((await (await inloggenAls(g)).rpc("materiaal_context", { p_cluster_id: VD })).error, g).not.toBeNull();
    }
    expect((await (await inloggenAls("docent")).rpc("materiaal_context", { p_cluster_id: VC })).error).toBeNull();
  });

  it("een projectgroep kan de beschikbaarheid van een andere belevenis niet opvragen", async () => {
    for (const g of ["vd-groep-2", "vc-groep-1", "vd-student", "test-groep-1"]) {
      expect((await (await inloggenAls(g)).rpc("materiaal_beschikbaar", { p_avf_id: avfVd1 })).error, g).not.toBeNull();
    }
    expect((await anoniem().rpc("materiaal_beschikbaar", { p_avf_id: avfVd1 })).error).not.toBeNull();
  });
});

describe("Gevolgen voor beoordeling", () => {
  it("een wijziging in de materialen van een goedgekeurd AVF geeft 'Opnieuw te controleren' en zet verzoeken bij sectie F op aangepast; een correctie niet", async () => {
    await admin.from("avf").update({ status: "goedgekeurd", opnieuw_te_controleren: false, locatie_keuze: "camping" }).eq("id", avfTest1);
    await admin.from("verbeterverzoek").insert({ avf_id: avfTest1, sectie: "F", projectgroeprol: "logistiek_materialen", tekst: "Meer touw nodig?", door_naam: NAAM });
    const g = await inloggenAls("test-groep-1");
    const ins = await g.from("avf_materiaal").insert({ avf_id: avfTest1, materiaal_id: touw, aantal: 1 }).select("id").single();
    expect(ins.error).toBeNull();
    aangemaakteRegels.push(ins.data!.id);
    const { data: a } = await admin.from("avf").select("status, opnieuw_te_controleren").eq("id", avfTest1).single();
    expect(a).toEqual({ status: "goedgekeurd", opnieuw_te_controleren: true });
    const { data: v } = await admin.from("verbeterverzoek").select("status").eq("avf_id", avfTest1).eq("sectie", "F").single();
    expect(v?.status).toBe("aangepast");

    // correctie van de stuurgroep: geen nieuwe controle
    await admin.from("avf").update({ opnieuw_te_controleren: false }).eq("id", avfTest1);
    expect(((await (await inloggenAls("test-stuur")).rpc("avf_materiaal_corrigeren", { p_id: ins.data!.id, p_aantal: 2, p_naam: NAAM })).data as R).ok).toBe(true);
    const { data: b } = await admin.from("avf").select("opnieuw_te_controleren").eq("id", avfTest1).single();
    expect(b?.opnieuw_te_controleren).toBe(false);

    // verwijderen telt wel
    expect((await g.from("avf_materiaal").delete().eq("id", ins.data!.id).select("id")).data).toHaveLength(1);
    const { data: c } = await admin.from("avf").select("opnieuw_te_controleren").eq("id", avfTest1).single();
    expect(c?.opnieuw_te_controleren).toBe(true);
  });

  it("de locatiekeuze is een wezenlijke wijziging na goedkeuring", async () => {
    await admin.from("avf").update({ opnieuw_te_controleren: false, status: "goedgekeurd", locatie_keuze: "camping" }).eq("id", avfTest1);
    const res = await (await inloggenAls("test-groep-1")).from("avf").update({ locatie_keuze: "bivak" }).eq("id", avfTest1).select("id");
    expect(res.data).toHaveLength(1);
    const { data } = await admin.from("avf").select("opnieuw_te_controleren").eq("id", avfTest1).single();
    expect(data?.opnieuw_te_controleren).toBe(true);
  });

  it("de controle bij indienen vraagt om de locatie", async () => {
    await admin.from("avf").update({ locatie_keuze: null }).eq("id", avfTest1);
    const res = await admin.rpc("avf_ontbrekend", { p_avf_id: avfTest1 });
    expect(res.data).toContain("Locatie: camping of bivak");
    await admin.from("avf").update({ locatie_keuze: "camping" }).eq("id", avfTest1);
    expect((await admin.rpc("avf_ontbrekend", { p_avf_id: avfTest1 })).data).toEqual([]);
  });
});
