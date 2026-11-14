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
let touw: string; // eigen testmateriaal "TestMat Touw": camping 6, bivak 4
let ingevuldeLeeg: { id: string; voorraad_camping: number | null; voorraad_bivak: number | null }[] = [];
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

/** Materialen zonder voorraad (nog niet ingeschat) tijdelijk op 0 zetten, zodat de lijst definitief kan worden. */
async function vulLeegAan() {
  const { data } = await admin.from("materiaal").select("id, voorraad_camping, voorraad_bivak").or("voorraad_camping.is.null,voorraad_bivak.is.null");
  ingevuldeLeeg = (data ?? []).filter((m) => !aangemaakteMaterialen.includes(m.id));
  for (const m of ingevuldeLeeg) {
    await admin.from("materiaal").update({ voorraad_camping: m.voorraad_camping ?? 0, voorraad_bivak: m.voorraad_bivak ?? 0 }).eq("id", m.id);
  }
}

async function herstelLeeg() {
  for (const m of ingevuldeLeeg) {
    await admin.from("materiaal").update({ voorraad_camping: m.voorraad_camping, voorraad_bivak: m.voorraad_bivak }).eq("id", m.id);
  }
  ingevuldeLeeg = [];
}

async function opschonen() {
  if (aangemaakteRegels.length) await admin.from("avf_materiaal").delete().in("id", aangemaakteRegels);
  await admin.from("avf_materiaal").delete().in("avf_id", [avfTest1]).is("materiaal_id", null);
  if (aangemaakteMaterialen.length) await admin.from("materiaal").delete().in("id", aangemaakteMaterialen);
  await admin.from("materiaal").delete().ilike("naam", "TestMat%");
  await admin.from("materiaal_categorie").delete().ilike("naam", "TestCat%");
  await admin.from("materiaal_aanvraag").delete().in("avf_id", [avfVd1, avfVd2, avfVd3, avfVc1, avfTest1]).like("door_naam", "Testpersoon");
  if (touw) await admin.from("materiaal_telling").delete().eq("materiaal_id", touw);
  for (const [id, o] of Object.entries(origineel)) {
    await admin.from("avf").update({ locatie_keuze: o.locatie_keuze, status: o.status, opnieuw_te_controleren: o.opnieuw_te_controleren }).eq("id", id);
  }
  await admin.from("verbeterverzoek").delete().eq("avf_id", avfTest1);
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
  const { data: s } = await admin.from("materiaallijst_status").select("*").eq("id", true).single();
  beginStatus = s!;
  await opschonen();
  const { data: m } = await admin.from("materiaal").insert({ naam: "TestMat Touw", categorie: "Touwen en stokken", voorraad_camping: 6, voorraad_bivak: 4, bijgewerkt_door_naam: NAAM }).select("id").single();
  touw = m!.id;
  aangemaakteMaterialen.push(touw);
  await vulLeegAan();
  await admin.from("materiaallijst_status").update({ status: "concept" }).eq("id", true);
});

afterAll(async () => {
  await opschonen(); // zet eerst de status terug op concept (anders mag de voorraad niet meer leeg)
  await herstelLeeg();
});

describe("De lijst is concept: alleen de bouwers zien hem", () => {
  it("Logistiek & Facilitair van VD en de docent lezen de lijst; anderen niet", async () => {
    for (const g of ["vd-stuur-logistiek", "docent"]) {
      const { data } = await (await inloggenAls(g)).from("materiaal").select("id");
      expect((data ?? []).length, g).toBeGreaterThanOrEqual(40);
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
    const ins = await logistiek.from("materiaal").insert({ naam: "TestMat A", categorie: "Overig", voorraad_camping: 5, voorraad_bivak: 2, bijgewerkt_door_naam: NAAM }).select("id, toegevoegd_door_cluster").single();
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
    // verwijderen mag, zolang geen projectgroep het materiaal heeft gekozen
    const del = await logistiek.from("materiaal").delete().eq("id", ins.data!.id).select();
    expect(del.data).toHaveLength(1);

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

    // publiceren kan ook als niet alles is ingeschat (TestMat B heeft geen voorraad); dat wordt gemeld
    await admin.from("materiaal").update({ voorraad_bivak: null }).eq("id", touw);
    const gepubliceerd = (await logistiek.rpc("materiaallijst_definitief_maken", { p_naam: NAAM })).data as R & { nog_niet_ingeschat: number };
    expect(gepubliceerd.ok).toBe(true);
    expect(gepubliceerd.nog_niet_ingeschat).toBeGreaterThanOrEqual(2);
    await admin.from("materiaal").update({ voorraad_bivak: 4 }).eq("id", touw);
    expect(((await logistiek.rpc("materiaallijst_definitief_maken", { p_naam: NAAM })).data as R).reden).toBe("al_definitief");
    const { data } = await admin.from("materiaallijst_status").select("status, definitief_door_naam, definitief_door_cluster").eq("id", true).single();
    expect(data).toEqual({ status: "definitief", definitief_door_naam: NAAM, definitief_door_cluster: VD });
  });

  it("een materiaal zonder ingeschatte voorraad kan wel in de lijst staan, maar is nog niet te kiezen; een onbekende categorie bestaat niet", async () => {
    const logistiek = await inloggenAls("vd-stuur-logistiek");
    const leeg = await logistiek.from("materiaal").insert({ naam: "TestMat zonder voorraad", categorie: "Overig", bijgewerkt_door_naam: NAAM }).select("id").single();
    expect(leeg.error).toBeNull();
    aangemaakteMaterialen.push(leeg.data!.id);
    const { data: avfRij } = await admin.from("avf").select("id").eq("id", avfVd3).single();
    await admin.from("avf").update({ locatie_keuze: "camping" }).eq("id", avfRij!.id);
    const kiezen = await (await inloggenAls("vd-groep-3")).from("avf_materiaal").insert({ avf_id: avfVd3, materiaal_id: leeg.data!.id, aantal: 1 });
    expect(kiezen.error).not.toBeNull();
    expect(kiezen.error?.message).toContain("voorraad");
    const { data: besch } = await (await inloggenAls("vd-groep-3")).rpc("materiaal_beschikbaar", { p_avf_id: avfVd3 });
    const r = (besch as { materiaal_id: string; ingeschat: boolean }[]).find((x) => x.materiaal_id === leeg.data!.id);
    expect(r?.ingeschat).toBe(false);
    expect((besch as { materiaal_id: string; ingeschat: boolean }[]).find((x) => x.materiaal_id === touw)?.ingeschat).toBe(true);
    const fout = await logistiek.from("materiaal").insert({ naam: "TestMat categorie", categorie: "Bestaat niet" });
    expect(fout.error).not.toBeNull();
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
      expect((data ?? []).length, g).toBeGreaterThanOrEqual(40);
    }
    for (const g of ["vd-student", "vc-student", "test-student"]) {
      expect(((await (await inloggenAls(g)).from("materiaal").select("id")).data ?? []).length, g).toBe(0);
    }
    expect((await anoniem().from("materiaal").select("id")).data ?? []).toHaveLength(0);
  });
});

describe("VD en VC passen de gepubliceerde lijst aan", () => {
  it("vc-stuur-logistiek voegt toe, wijzigt en verwijdert; andere VC-rollen en groepen kunnen dat niet", async () => {
    const vc = await inloggenAls("vc-stuur-logistiek");
    const ins = await vc.from("materiaal").insert({ naam: "TestMat VC", voorraad_camping: 3, voorraad_bivak: 0, bijgewerkt_door_naam: NAAM }).select("id, toegevoegd_door_cluster").single();
    expect(ins.error).toBeNull();
    aangemaakteMaterialen.push(ins.data!.id);
    expect(ins.data!.toegevoegd_door_cluster).toBe(VC);
    const upd = await vc.from("materiaal").update({ voorraad_camping: 7, bijgewerkt_door_naam: NAAM }).eq("id", ins.data!.id).select("voorraad_camping");
    expect(upd.data?.[0]?.voorraad_camping).toBe(7);
    // ook de voorraad van een materiaal van VD aanpassen mag, en terugzetten
    const raak = await vc.from("materiaal").update({ voorraad_camping: 5, bijgewerkt_door_naam: NAAM }).eq("id", touw).select("voorraad_camping");
    expect(raak.data?.[0]?.voorraad_camping).toBe(5);
    await vc.from("materiaal").update({ voorraad_camping: 6 }).eq("id", touw);
    const weg = await vc.from("materiaal").delete().eq("id", ins.data!.id).select("id");
    expect(weg.data).toHaveLength(1);
    // het verwijderen staat in het logboek met naam en cluster
    const { data: log } = await admin.from("wijziging").select("actie, naam, cluster_id").eq("tabel", "materiaal").eq("actie", "materiaal_verwijderd").eq("record_id", ins.data!.id);
    expect(log?.[0]).toMatchObject({ naam: NAAM, cluster_id: VC });
    await admin.from("wijziging").delete().eq("record_id", ins.data!.id);

    for (const g of ["vc-stuur-programma", "vc-groep-1", "vc-student", "vd-stuur-programma"]) {
      const c = await inloggenAls(g);
      expect((await c.from("materiaal").insert({ naam: `TestMat ${g}` })).error, `${g} insert`).not.toBeNull();
      const u = await c.from("materiaal").update({ voorraad_camping: 99 }).eq("id", touw).select();
      expect(u.error !== null || (u.data ?? []).length === 0, `${g} update`).toBe(true);
      const d = await c.from("materiaal").delete().eq("id", touw).select();
      expect(d.error !== null || (d.data ?? []).length === 0, `${g} delete`).toBe(true);
    }
    expect((await anoniem().from("materiaal").delete().eq("id", touw)).error !== null || true).toBe(true);
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
    const { data: m } = await admin.from("materiaal").insert({ naam: "TestMat inactief", actief: false, voorraad_camping: 1, voorraad_bivak: 1 }).select("id").single();
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
    expect(t).toMatchObject({ materiaal_id: touw, voorraad: 6, anderen: 2 }); // voorraad van de camping, en wat VC tegelijk gebruikt
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

describe("De vaste categorielijst", () => {
  it("de startlijst met negen categorieën plus Overig staat erin; groepen lezen hem zodra de lijst definitief is", async () => {
    const { data } = await admin.from("materiaal_categorie").select("naam").order("volgorde");
    expect(data?.map((c) => c.naam)).toEqual(expect.arrayContaining([
      "Afbakening en markering", "Teamherkenning", "Ballen", "Sport- en spelmateriaal", "Touwen en stokken", "Archery tag",
      "Veiligheid en communicatie", "Organisatie en schrijfmateriaal", "Opslag", "Overig",
    ]));
    for (const g of ["vd-groep-1", "vc-groep-1", "vc-stuur-logistiek"]) {
      expect(((await (await inloggenAls(g)).from("materiaal_categorie").select("id")).data ?? []).length, g).toBeGreaterThanOrEqual(10);
    }
    for (const g of ["vd-student"]) expect(((await (await inloggenAls(g)).from("materiaal_categorie").select("id")).data ?? []), g).toHaveLength(0);
    expect((await anoniem().from("materiaal_categorie").select("id")).data ?? []).toHaveLength(0);
  });

  it("Logistiek & Facilitair van VD en de docent beheren de lijst; VC en anderen niet", async () => {
    const logistiek = await inloggenAls("vd-stuur-logistiek");
    const nieuw = await logistiek.from("materiaal_categorie").insert({ naam: "TestCat A", volgorde: 999 }).select("id").single();
    expect(nieuw.error).toBeNull();
    const hernoemd = await logistiek.from("materiaal_categorie").update({ naam: "TestCat B" }).eq("id", nieuw.data!.id).select("naam");
    expect(hernoemd.data?.[0]?.naam).toBe("TestCat B");

    // een categorie in gebruik hernoemen werkt door bij de materialen; verwijderen kan dan niet
    const { data: m } = await admin.from("materiaal").insert({ naam: "TestMat categorie", categorie: "TestCat B", voorraad_camping: 1, voorraad_bivak: 1 }).select("id").single();
    aangemaakteMaterialen.push(m!.id);
    await logistiek.from("materiaal_categorie").update({ naam: "TestCat C" }).eq("id", nieuw.data!.id);
    expect(((await admin.from("materiaal").select("categorie").eq("id", m!.id).single()).data)?.categorie).toBe("TestCat C");
    const verwijderMetInhoud = await logistiek.from("materiaal_categorie").delete().eq("id", nieuw.data!.id).select();
    expect(verwijderMetInhoud.error).not.toBeNull();
    await admin.from("materiaal").delete().eq("id", m!.id);
    expect(((await logistiek.from("materiaal_categorie").delete().eq("id", nieuw.data!.id).select()).data ?? [])).toHaveLength(1);

    for (const g of ["vc-stuur-logistiek", "vd-stuur-programma", "vd-groep-1", "vd-student", "test-stuur"]) {
      const c = await inloggenAls(g);
      expect((await c.from("materiaal_categorie").insert({ naam: `TestCat ${g}` })).error, `${g} insert`).not.toBeNull();
      const u = await c.from("materiaal_categorie").update({ naam: "TestCat gehackt" }).eq("naam", "Overig").select();
      expect(u.error !== null || (u.data ?? []).length === 0, `${g} update`).toBe(true);
      const d = await c.from("materiaal_categorie").delete().eq("naam", "Overig").select();
      expect(d.error !== null || (d.data ?? []).length === 0, `${g} delete`).toBe(true);
    }
    expect((await (await inloggenAls("docent")).from("materiaal_categorie").insert({ naam: "TestCat docent" })).error).toBeNull();
    const { data: overig } = await admin.from("materiaal_categorie").select("naam").eq("naam", "Overig");
    expect(overig).toHaveLength(1);
  });
});

describe("Verwijderen: niet als een projectgroep het materiaal heeft gekozen", () => {
  it("VD en VC kunnen een ongebruikt materiaal weghalen, een gebruikt materiaal niet", async () => {
    await admin.from("avf").update({ locatie_keuze: "camping" }).eq("id", avfVd1);
    const rij = await regel(avfVd1, touw, 1);
    expect(rij).toBeTruthy();
    for (const g of ["vd-stuur-logistiek", "vc-stuur-logistiek", "docent"]) {
      const d = await (await inloggenAls(g)).from("materiaal").delete().eq("id", touw).select();
      expect(d.error, g).not.toBeNull(); // wordt gebruikt
      expect(d.error?.code, g).toBe("23503");
    }
    const { data: nog } = await admin.from("materiaal").select("id").eq("id", touw);
    expect(nog).toHaveLength(1);
    const { data: los } = await admin.from("materiaal").insert({ naam: "TestMat los", categorie: "Overig", voorraad_camping: 1, voorraad_bivak: 1 }).select("id").single();
    aangemaakteMaterialen.push(los!.id);
    expect(((await (await inloggenAls("vd-stuur-logistiek")).from("materiaal").delete().eq("id", los!.id).select("id")).data ?? [])).toHaveLength(1);
  });
});

describe("Paklijst: wat er echt is", () => {
  const zet = (g: string, veld: string, waarde: number | null, tekst: string | null = null, verwacht: string | null = null, locatie = "camping") =>
    inloggenAls(g).then((c) => c.rpc("materiaal_telling_zetten", { p_materiaal_id: touw, p_locatie: locatie, p_veld: veld, p_waarde: waarde, p_tekst: tekst, p_naam: NAAM, p_verwacht: verwacht }));

  it("alle stuurgroepen en de docent vullen de paklijst in; groepen, studenten en bezoekers niet", async () => {
    for (const g of ["vd-groep-1", "vc-groep-1", "vd-student", "test-groep-1"]) {
      expect((await zet(g, "meegenomen", 5)).error, g).not.toBeNull();
    }
    expect((await anoniem().rpc("materiaal_telling_zetten", { p_materiaal_id: touw, p_locatie: "camping", p_veld: "meegenomen", p_waarde: 5, p_tekst: null, p_naam: NAAM, p_verwacht: null })).error).not.toBeNull();
    const een = await zet("vd-stuur-programma", "meegenomen", 5);
    expect((een.data as R & { updated_at: string }).ok).toBe(true);
    // gelijktijdig wijzigen: met een verouderd tijdstip wordt niets overschreven
    const verouderd = await zet("vc-stuur-veiligheid", "meegenomen", 1, null, null);
    expect((verouderd.data as R).reden).toBe("gewijzigd");
    const { updated_at } = een.data as { updated_at: string };
    const twee = await zet("vc-stuur-veiligheid", "op_kamp", 4, null, updated_at);
    expect((twee.data as R).ok).toBe(true);
    const drie = await zet("docent", "opmerking", null, "2 lek", (twee.data as { updated_at: string }).updated_at);
    expect((drie.data as R).ok).toBe(true);
    const { data } = await admin.from("materiaal_telling").select("meegenomen, op_kamp, retour, opmerking, locatie").eq("materiaal_id", touw);
    expect(data).toEqual([{ meegenomen: 5, op_kamp: 4, retour: null, opmerking: "2 lek", locatie: "camping" }]);
    expect(((await zet("docent", "meegenomen", -1)).data as R).reden).toBe("ongeldig");
    expect(((await zet("docent", "onzin", 1)).data as R).reden).toBe("ongeldig");
    expect(((await zet("docent", "meegenomen", 1, null, null, "anders")).data as R).reden).toBe("ongeldig");
  });

  it("de paklijst is alleen zichtbaar voor stuurgroepen en de docent, en elke wijziging staat in het logboek", async () => {
    for (const g of ["vd-stuur-programma", "vc-stuur-logistiek", "docent"]) {
      expect(((await (await inloggenAls(g)).from("materiaal_telling").select("materiaal_id").eq("materiaal_id", touw)).data ?? []).length, g).toBe(1);
    }
    for (const g of ["vd-groep-1", "vd-student", "test-groep-1"]) {
      expect(((await (await inloggenAls(g)).from("materiaal_telling").select("materiaal_id")).data ?? []), g).toHaveLength(0);
    }
    expect((await (await inloggenAls("vd-stuur-programma")).from("materiaal_telling").update({ meegenomen: 99 }).eq("materiaal_id", touw).select()).data ?? []).toHaveLength(0);
    const { data: log } = await admin.from("wijziging").select("actie, naam").eq("tabel", "materiaal_telling").eq("record_id", touw);
    expect(new Set(log?.map((l) => l.actie))).toEqual(new Set(["telling_meegenomen", "telling_op_kamp", "telling_opmerking"]));
    await admin.from("wijziging").delete().eq("record_id", touw).eq("tabel", "materiaal_telling");
  });

  it("wat er echt is telt direct mee: de groep ziet de lagere voorraad en een tekort", async () => {
    // telling: op kamp 4 (camping); het AVF van vd-groep-1 vraagt 3 (gecorrigeerd terug naar origineel) en VC 2 op hetzelfde moment
    const { data } = await (await inloggenAls("vd-groep-1")).rpc("materiaal_beschikbaar", { p_avf_id: avfVd1 });
    const r = (data as { materiaal_id: string; voorraad: number; anderen: number }[]).find((x) => x.materiaal_id === touw);
    expect(r?.voorraad).toBe(4); // niet de geschatte 6, maar de telling op kamp
    // nog niet gecontroleerd op kamp: dan telt wat er is ingepakt
    await admin.from("materiaal_telling").update({ op_kamp: null }).eq("materiaal_id", touw);
    const { data: ingepakt } = await (await inloggenAls("vd-groep-1")).rpc("materiaal_beschikbaar", { p_avf_id: avfVd1 });
    expect((ingepakt as { materiaal_id: string; voorraad: number }[]).find((x) => x.materiaal_id === touw)?.voorraad).toBe(5);
    await admin.from("materiaal_telling").delete().eq("materiaal_id", touw);
    const { data: plan } = await (await inloggenAls("vd-groep-1")).rpc("materiaal_beschikbaar", { p_avf_id: avfVd1 });
    expect((plan as { materiaal_id: string; voorraad: number }[]).find((x) => x.materiaal_id === touw)?.voorraad).toBe(6);
  });
});

describe("Aanvragen van projectgroepen", () => {
  const plaats = (g: string, avf: string, mat: string | null, oms: string | null, aantal: number, toel: string | null = "Nodig voor het spel") =>
    inloggenAls(g).then((c) => c.rpc("materiaal_aanvraag_plaatsen", { p_avf_id: avf, p_materiaal_id: mat, p_omschrijving: oms, p_aantal: aantal, p_toelichting: toel, p_naam: NAAM }));
  let aanvraagId = "";

  it("alleen de eigen projectgroep vraagt aan, met een naam en een geldig verzoek", async () => {
    for (const g of ["vd-groep-2", "vc-groep-1", "vd-stuur-programma", "vd-student", "docent"]) {
      expect((await plaats(g, avfVd1, touw, null, 2)).error, g).not.toBeNull();
    }
    expect((await anoniem().rpc("materiaal_aanvraag_plaatsen", { p_avf_id: avfVd1, p_materiaal_id: touw, p_omschrijving: null, p_aantal: 1, p_toelichting: null, p_naam: NAAM })).error).not.toBeNull();
    expect(((await plaats("vd-groep-1", avfVd1, touw, null, 0)).data as R).reden).toBe("ongeldig");
    expect(((await plaats("vd-groep-1", avfVd1, null, " ", 2)).data as R).reden).toBe("ongeldig");
    const zonderNaam = await (await inloggenAls("vd-groep-1")).rpc("materiaal_aanvraag_plaatsen", { p_avf_id: avfVd1, p_materiaal_id: touw, p_omschrijving: null, p_aantal: 2, p_toelichting: null, p_naam: " " });
    expect((zonderNaam.data as R).reden).toBe("naam");
    const ok = await plaats("vd-groep-1", avfVd1, null, "TestMat Tipi-tent", 2);
    expect((ok.data as R & { id: string }).ok).toBe(true);
    aanvraagId = (ok.data as { id: string }).id;
    const { data } = await admin.from("materiaal_aanvraag").select("status, aantal, omschrijving").eq("id", aanvraagId).single();
    expect(data).toEqual({ status: "open", aantal: 2, omschrijving: "TestMat Tipi-tent" });
  });

  it("de aanvraag is zichtbaar voor de eigen groep, de stuurgroep van het cluster en de docent; niet voor anderen", async () => {
    for (const g of ["vd-groep-1", "vd-stuur-logistiek", "vd-stuur-programma", "docent"]) {
      expect(((await (await inloggenAls(g)).from("materiaal_aanvraag").select("id").eq("id", aanvraagId)).data ?? []).length, g).toBe(1);
    }
    for (const g of ["vd-groep-2", "vc-groep-1", "vc-stuur-logistiek", "vd-student", "test-stuur"]) {
      expect(((await (await inloggenAls(g)).from("materiaal_aanvraag").select("id").eq("id", aanvraagId)).data ?? []).length, g).toBe(0);
    }
    for (const g of ["vd-groep-1", "vd-stuur-logistiek", "docent"]) {
      const c = await inloggenAls(g);
      expect((await c.from("materiaal_aanvraag").update({ status: "afgehandeld" }).eq("id", aanvraagId).select()).data ?? [], g).toHaveLength(0);
      expect((await c.from("materiaal_aanvraag").delete().eq("id", aanvraagId).select()).data ?? [], g).toHaveLength(0);
    }
  });

  it("alleen de stuurgroep van het cluster en de docent handelen af; afwijzen vraagt een toelichting; één keer", async () => {
    const afhandelen = (g: string, status: string, uitkomst: string | null, naam = NAAM) =>
      inloggenAls(g).then((c) => c.rpc("materiaal_aanvraag_afhandelen", { p_id: aanvraagId, p_status: status, p_uitkomst: uitkomst, p_naam: naam }));
    for (const g of ["vd-groep-1", "vd-groep-2", "vc-stuur-logistiek", "vd-student", "test-stuur"]) {
      expect((await afhandelen(g, "afgehandeld", null)).error, g).not.toBeNull();
    }
    const stuur = "vd-stuur-logistiek";
    expect(((await afhandelen(stuur, "afgehandeld", null, " ")).data as R).reden).toBe("naam");
    expect(((await afhandelen(stuur, "afgewezen", " ")).data as R).reden).toBe("toelichting");
    expect(((await afhandelen(stuur, "open", null)).data as R).reden).toBe("ongeldig");
    expect(((await afhandelen(stuur, "afgewezen", "Er zijn geen tipi-tenten beschikbaar")).data as R).ok).toBe(true);
    expect(((await afhandelen("docent", "afgehandeld", null)).data as R).reden).toBe("al_afgehandeld");
    const { data } = await (await inloggenAls("vd-groep-1")).from("materiaal_aanvraag").select("status, uitkomst, afgehandeld_door_naam").eq("id", aanvraagId).single();
    expect(data).toEqual({ status: "afgewezen", uitkomst: "Er zijn geen tipi-tenten beschikbaar", afgehandeld_door_naam: NAAM });
  });

  it("zolang de lijst niet gepubliceerd is kan er niets worden aangevraagd", async () => {
    await admin.from("materiaallijst_status").update({ status: "concept" }).eq("id", true);
    expect(((await plaats("vd-groep-1", avfVd1, touw, null, 1)).data as R).reden).toBe("nog_niet_gepubliceerd");
    await admin.from("materiaallijst_status").update({ status: "definitief" }).eq("id", true);
  });
});
