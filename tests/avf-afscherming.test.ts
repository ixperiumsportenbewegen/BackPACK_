/**
 * Afschermingstests 1, 2 en (het deel dat nu kan van) 4 en 10 uit docs/rechtenmatrix.md,
 * plus programma, planning en de functies die één veld tegelijk opslaan.
 * Draait tegen het echte Supabase-project; elke test zet wat hij wijzigt terug.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anoniem, clusterId, inloggenAls } from "./helpers";

type Resultaat = { ok: boolean; reden?: string; door?: string; huidig?: unknown; item?: { id: string } };

let VD: string, VC: string, TEST: string;
const avf: Record<number, string> = {}; // VD-projectgroep 1..6 -> avf-id
const groep: Record<number, string> = {}; // VD-projectgroep 1..6 -> projectgroep-id
const origineleRegel: Record<number, string | null> = {};

beforeAll(async () => {
  VD = await clusterId("VD");
  VC = await clusterId("VC");
  TEST = await clusterId("TEST");
  const { data } = await admin.from("avf").select("id, projectgroep_id, programma_regel_id, projectgroep:projectgroep_id(nummer)").eq("cluster_id", VD);
  for (const r of data ?? []) {
    const nr = (r.projectgroep as unknown as { nummer: number }).nummer;
    avf[nr] = r.id;
    groep[nr] = r.projectgroep_id;
    origineleRegel[nr] = r.programma_regel_id;
  }
  expect(Object.keys(avf)).toHaveLength(6);
});

afterAll(async () => {
  // zet tijdvakken terug zoals ze waren
  for (const nr of [1, 2, 3, 4, 5, 6]) await admin.from("avf").update({ programma_regel_id: null }).eq("id", avf[nr]);
  for (const nr of [1, 2, 3, 4, 5, 6]) await admin.from("avf").update({ programma_regel_id: origineleRegel[nr] }).eq("id", avf[nr]);
  await admin.from("avf").update({ status: "in_ontwikkeling" }).eq("cluster_id", VD);
});

const PUBLIEKE_KOLOMMEN = [
  "cluster_id", "dag", "eindtijd", "id", "programma_regel_id", "projectgroep_id", "projectgroep_naam",
  "projectgroep_nummer", "publieke_samenvatting", "starttijd", "status", "titel", "verschijningsvorm",
].sort();

describe("Test 1: vd-groep-1 kan het AVF van vd-groep-2 niet lezen", () => {
  it("ziet alleen het eigen AVF in avf, avf_fase en avf_onderdeel", async () => {
    const client = await inloggenAls("vd-groep-1");
    const { data } = await client.from("avf").select("id");
    expect(data?.map((r) => r.id)).toEqual([avf[1]]);

    const ander = await client.from("avf").select("id").eq("id", avf[2]);
    expect(ander.data ?? []).toHaveLength(0);

    const { data: fasen } = await client.from("avf_fase").select("avf_id");
    expect(new Set(fasen?.map((f) => f.avf_id))).toEqual(new Set([avf[1]]));
    expect(fasen).toHaveLength(3);

    // een onderdeel van groep 2 blijft onzichtbaar
    const { data: onderdeel } = await admin.from("avf_onderdeel").insert({ avf_id: avf[2], fase: "romp", volgorde: 1, naam: "Geheim" }).select("id").single();
    const gezien = await client.from("avf_onderdeel").select("id").eq("id", onderdeel!.id);
    expect(gezien.data ?? []).toHaveLength(0);
    await admin.from("avf_onderdeel").delete().eq("id", onderdeel!.id);
  });

  it("kan geen bestand van het AVF van vd-groep-2 lezen", async () => {
    const pad = `cluster/${VD}/avf/${avf[2]}/geheim.png`;
    await admin.storage.from("avf").upload(pad, Buffer.from("x"), { contentType: "image/png", upsert: true });
    const { error } = await (await inloggenAls("vd-groep-1")).storage.from("avf").download(pad);
    expect(error).not.toBeNull();
    const lijst = await (await inloggenAls("vd-groep-1")).storage.from("avf").list(`cluster/${VD}/avf/${avf[2]}`);
    expect(lijst.data ?? []).toHaveLength(0);
    await admin.storage.from("avf").remove([pad]);
  });

  it("studenten en andere clusters zien geen AVF", async () => {
    for (const naam of ["vd-student", "vc-groep-1", "vc-stuur-beleving", "test-groep-1", "test-student"]) {
      const { data } = await (await inloggenAls(naam)).from("avf").select("id").eq("cluster_id", VD);
      expect(data ?? [], naam).toHaveLength(0);
    }
    const { data } = await (await inloggenAls("vd-student")).from("avf").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("de stuurgroep van VD ziet alle zes AVF's van VD, en niets van VC", async () => {
    const { data } = await (await inloggenAls("vd-stuur-programma")).from("avf").select("cluster_id");
    expect(data).toHaveLength(6);
    expect(new Set(data?.map((r) => r.cluster_id))).toEqual(new Set([VD]));
  });
});

describe("Test 2: andere groepen zien alleen de velden van avf_publiek", () => {
  it("vd-groep-1 ziet zes belevenissen met alleen publieke kolommen", async () => {
    const client = await inloggenAls("vd-groep-1");
    const { data, error } = await client.from("avf_publiek").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(6);
    for (const rij of data ?? []) {
      expect(Object.keys(rij).sort()).toEqual(PUBLIEKE_KOLOMMEN);
      expect(rij.cluster_id).toBe(VD);
    }
  });

  it("verborgen kolommen zijn niet op te vragen via de weergave", async () => {
    const client = await inloggenAls("vd-groep-1");
    for (const kolom of ["beginsituatie", "veiligheid", "locatie_tekst", "organiserende_studenten", "doelgroep"]) {
      const { error } = await client.from("avf_publiek").select(kolom);
      expect(error, kolom).not.toBeNull();
    }
  });

  it("studenten zien dezelfde zes publieke kaarten", async () => {
    const { data } = await (await inloggenAls("vd-student")).from("avf_publiek").select("id");
    expect(data).toHaveLength(6);
  });

  it("elk cluster ziet alleen de eigen belevenissen; de docent ziet alles", async () => {
    const cases: [string, string, number][] = [["vc-groep-3", VC, 6], ["vc-student", VC, 6], ["test-student", TEST, 2], ["test-stuur", TEST, 2]];
    for (const [naam, cluster, aantal] of cases) {
      const { data } = await (await inloggenAls(naam)).from("avf_publiek").select("cluster_id");
      expect(data, naam).toHaveLength(aantal);
      expect(new Set(data?.map((r) => r.cluster_id)), naam).toEqual(new Set([cluster]));
    }
    const { data } = await (await inloggenAls("docent")).from("avf_publiek").select("id");
    expect(data).toHaveLength(14);
  });

  it("niet ingelogd kan niets lezen", async () => {
    for (const tabel of ["avf_publiek", "avf", "avf_fase", "avf_onderdeel", "programma_regel"]) {
      const { data, error } = await anoniem().from(tabel).select("*");
      expect(error !== null || (data ?? []).length === 0, tabel).toBe(true);
    }
  });
});

describe("Test 4: eigen AVF wijzigen, maar nooit tijdvak, locatie of status", () => {
  it("de projectgroep kan eigen inhoud wijzigen en andermans AVF niet", async () => {
    const client = await inloggenAls("vd-groep-1");
    const { data: voor } = await admin.from("avf").select("titel").eq("id", avf[1]).single();
    const ok = await client.from("avf").update({ titel: "Testtitel" }).eq("id", avf[1]).select("titel");
    expect(ok.data?.[0]?.titel).toBe("Testtitel");
    await admin.from("avf").update({ titel: voor!.titel }).eq("id", avf[1]);

    const nee = await client.from("avf").update({ titel: "Gehackt" }).eq("id", avf[2]).select();
    expect(nee.data ?? []).toHaveLength(0);
  });

  it("de projectgroep kiest zelf camping of bivak (en niets anders) en schrijft er waar precies", async () => {
    const client = await inloggenAls("vd-groep-1");
    const { data: voor } = await admin.from("avf").select("locatie_keuze, locatie_detail").eq("id", avf[1]).single();
    const zet = (w: Record<string, unknown>) => client.from("avf").update(w).eq("id", avf[1]).select("locatie_keuze, locatie_detail");
    expect((await zet({ locatie_keuze: "bivak", locatie_detail: "Bij de rivier" })).data?.[0]).toEqual({ locatie_keuze: "bivak", locatie_detail: "Bij de rivier" });
    for (const fout of ["anders", "Camping", "", "veld"]) expect((await zet({ locatie_keuze: fout })).error, fout).not.toBeNull();
    expect((await zet({ locatie_detail: "x".repeat(201) })).error).not.toBeNull();
    // andermans AVF niet
    const ander = await client.from("avf").update({ locatie_keuze: "camping" }).eq("id", avf[2]).select();
    expect(ander.data ?? []).toHaveLength(0);
    await admin.from("avf").update(voor!).eq("id", avf[1]);
  });

  it("de projectgroep kan tijdvak, locatie, status, versie en goedkeuring niet wijzigen", async () => {
    const client = await inloggenAls("vd-groep-1");
    const { data: regel } = await admin.from("programma_regel").select("id").eq("cluster_id", VD).eq("soort", "belevenis").limit(1).single();
    const wijzigingen: Record<string, unknown>[] = [
      { programma_regel_id: regel!.id },
      { programma_regel_id: null },
      { locatie_tekst: "Gehackt" },
      { status: "goedgekeurd" },
      { versie: 9 },
      { opnieuw_te_controleren: true },
      { goedgekeurd_op: new Date().toISOString() },
      { projectgroep_id: groep[2] },
      { cluster_id: VC },
    ];
    for (const w of wijzigingen) {
      const res = await client.from("avf").update(w).eq("id", avf[1]).select();
      expect(res.error, JSON.stringify(w)).not.toBeNull();
    }
    const { data: na } = await admin.from("avf").select("status, versie, locatie_tekst, programma_regel_id, projectgroep_id").eq("id", avf[1]).single();
    expect(na?.status).toBe("in_ontwikkeling");
    expect(na?.versie).toBe(0);
    expect(na?.projectgroep_id).toBe(groep[1]);
    expect(na?.programma_regel_id).toBe(origineleRegel[1]);
  });

  it("de projectgroep kan geen AVF aanmaken of verwijderen", async () => {
    const client = await inloggenAls("vd-groep-1");
    const ins = await client.from("avf").insert({ projectgroep_id: groep[1] });
    expect(ins.error).not.toBeNull();
    const del = await client.from("avf").delete().eq("id", avf[1]).select();
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
    const { data } = await admin.from("avf").select("id").eq("id", avf[1]);
    expect(data).toHaveLength(1);
  });

  it("een ingediend AVF is voor de projectgroep alleen-lezen", async () => {
    await admin.from("avf").update({ status: "ingediend" }).eq("id", avf[1]);
    try {
      const client = await inloggenAls("vd-groep-1");
      const titel = await client.from("avf").update({ titel: "Te laat" }).eq("id", avf[1]).select();
      expect(titel.data ?? []).toHaveLength(0);
      const fase = await client.from("avf_fase").update({ organisatievorm: "Te laat" }).eq("avf_id", avf[1]).select();
      expect(fase.data ?? []).toHaveLength(0);
      const ins = await client.from("avf_onderdeel").insert({ avf_id: avf[1], fase: "kop", volgorde: 1 });
      expect(ins.error).not.toBeNull();
      const rpc = await client.rpc("avf_veld_opslaan", { p_avf_id: avf[1], p_sectie: "doelen", p_pad: ["motorisch"], p_oud: null, p_nieuw: "x" });
      expect((rpc.data as Resultaat).ok).toBe(false);
      const lees = await client.from("avf").select("status").eq("id", avf[1]).single();
      expect(lees.data?.status).toBe("ingediend"); // lezen blijft kunnen
    } finally {
      await admin.from("avf").update({ status: "in_ontwikkeling" }).eq("id", avf[1]);
    }
  });
});

describe("Test 10: de stuurgroep wijzigt geen AVF-inhoud", () => {
  it("een stuurgroepaccount kan titel, fasen en onderdelen niet wijzigen", async () => {
    const client = await inloggenAls("vd-stuur-programma");
    const titel = await client.from("avf").update({ titel: "Gehackt" }).eq("id", avf[1]).select();
    expect(titel.data ?? []).toHaveLength(0);
    const fase = await client.from("avf_fase").update({ organisatievorm: "Gehackt" }).eq("avf_id", avf[1]).select();
    expect(fase.data ?? []).toHaveLength(0);
    const ins = await client.from("avf_onderdeel").insert({ avf_id: avf[1], fase: "kop", volgorde: 1 });
    expect(ins.error).not.toBeNull();
    const rpc = await client.rpc("avf_veld_opslaan", { p_avf_id: avf[1], p_sectie: "doelen", p_pad: ["motorisch"], p_oud: null, p_nieuw: "x" });
    expect((rpc.data as Resultaat).ok).toBe(false);
    const { data } = await admin.from("avf").select("doelen").eq("id", avf[1]).single();
    expect(JSON.stringify(data?.doelen)).not.toContain('"x"');
  });

  it("een student kan niets schrijven", async () => {
    const client = await inloggenAls("vd-student");
    const titel = await client.from("avf").update({ titel: "Gehackt" }).eq("id", avf[1]).select();
    expect(titel.data ?? []).toHaveLength(0);
    const rpc = await client.rpc("avf_veld_opslaan", { p_avf_id: avf[1], p_sectie: "doelen", p_pad: ["motorisch"], p_oud: null, p_nieuw: "x" });
    expect((rpc.data as Resultaat | null)?.ok ?? false).toBe(false);
  });
});

describe("Opslaan per veld (jsonb-secties)", () => {
  // Deze tests gebruiken het lege AVF van vd-groep-3, zodat het voorbeeld-AVF van vd-groep-1 intact blijft.
  const sleutel = (pad: string[]) => ({ p_avf_id: avf[3], p_sectie: "veiligheid", p_pad: pad });

  afterAll(async () => {
    await admin.from("avf").update({ veiligheid: {}, doelen: {} }).eq("id", avf[3]);
  });

  it("twee velden in dezelfde sectie blijven allebei bewaard", async () => {
    const a = await inloggenAls("vd-groep-3");
    const r1 = await a.rpc("avf_veld_opslaan", { ...sleutel(["weer", "onweer", "maatregel"]), p_oud: null, p_nieuw: "Naar binnen" });
    const r2 = await a.rpc("avf_veld_opslaan", { ...sleutel(["weer", "zeer_warm", "maatregel"]), p_oud: null, p_nieuw: "Drinkpauze" });
    expect((r1.data as Resultaat).ok).toBe(true);
    expect((r2.data as Resultaat).ok).toBe(true);
    const { data } = await admin.from("avf").select("veiligheid").eq("id", avf[3]).single();
    expect(data?.veiligheid).toMatchObject({ weer: { onweer: { maatregel: "Naar binnen" }, zeer_warm: { maatregel: "Drinkpauze" } } });
  });

  it("een veld dat intussen is gewijzigd wordt niet overschreven", async () => {
    const a = await inloggenAls("vd-groep-3");
    const res = await a.rpc("avf_veld_opslaan", { ...sleutel(["weer", "onweer", "maatregel"]), p_oud: "iets anders", p_nieuw: "Overschreven" });
    const r = res.data as Resultaat;
    expect(r.ok).toBe(false);
    expect(r.reden).toBe("gewijzigd");
    expect(r.huidig).toBe("Naar binnen");
    const { data } = await admin.from("avf").select("veiligheid").eq("id", avf[3]).single();
    expect(JSON.stringify(data?.veiligheid)).toContain("Naar binnen");
  });

  it("lijstitems worden per id bijgewerkt, toegevoegd en verwijderd", async () => {
    const a = await inloggenAls("vd-groep-3");
    const t1 = (await a.rpc("avf_lijst_toevoegen", { p_avf_id: avf[3], p_sectie: "veiligheid", p_pad: ["risicos"], p_item: { risico: "Vallen" } })).data as Resultaat;
    const t2 = (await a.rpc("avf_lijst_toevoegen", { p_avf_id: avf[3], p_sectie: "veiligheid", p_pad: ["risicos"], p_item: { risico: "Verbranden" } })).data as Resultaat;
    expect(t1.ok && t2.ok).toBe(true);
    expect(t1.item?.id).not.toBe(t2.item?.id);

    const upd = (await a.rpc("avf_veld_opslaan", { ...sleutel(["risicos", t2.item!.id, "maatregel"]), p_oud: null, p_nieuw: "Blusdeken" })).data as Resultaat;
    expect(upd.ok).toBe(true);

    const del = (await a.rpc("avf_lijst_verwijderen", { p_avf_id: avf[3], p_sectie: "veiligheid", p_pad: ["risicos"], p_item_id: t1.item!.id })).data as Resultaat;
    expect(del.ok).toBe(true);
    const { data } = await admin.from("avf").select("veiligheid").eq("id", avf[3]).single();
    const risicos = (data?.veiligheid as { risicos: { id: string; risico: string; maatregel?: string }[] }).risicos;
    expect(risicos).toHaveLength(1);
    expect(risicos[0]).toMatchObject({ risico: "Verbranden", maatregel: "Blusdeken" });

    // wijzigen van een intussen verwijderd item meldt dat het verdwenen is
    const weg = (await a.rpc("avf_veld_opslaan", { ...sleutel(["risicos", t1.item!.id, "maatregel"]), p_oud: null, p_nieuw: "x" })).data as Resultaat;
    expect(weg.ok).toBe(false);
    expect(weg.reden).toBe("verdwenen");
  });

  it("een onbekende sectie wordt geweigerd", async () => {
    const res = await (await inloggenAls("vd-groep-3")).rpc("avf_veld_opslaan", { p_avf_id: avf[3], p_sectie: "status", p_pad: [], p_oud: null, p_nieuw: "goedgekeurd" });
    expect(res.error).not.toBeNull();
  });
});

describe("Onderdelen", () => {
  const aangemaakt: string[] = [];
  afterAll(async () => {
    // alleen wat deze test zelf heeft aangemaakt; het voorbeeld-AVF blijft staan
    if (aangemaakt.length) await admin.from("avf_onderdeel").delete().in("id", aangemaakt);
  });

  it("toevoegen aan het einde, verschuiven en verwijderen", async () => {
    const a = await inloggenAls("vd-groep-1");
    const o1 = await a.rpc("avf_onderdeel_toevoegen", { p_avf_id: avf[1], p_fase: "romp" });
    const o2 = await a.rpc("avf_onderdeel_toevoegen", { p_avf_id: avf[1], p_fase: "romp" });
    expect(o1.error).toBeNull();
    aangemaakt.push(o1.data.id, o2.data.id);
    // nieuwe onderdelen komen achter de bestaande onderdelen van de romp
    expect(o2.data.volgorde).toBe(o1.data.volgorde + 1);

    const omhoog = await a.rpc("avf_onderdeel_verplaatsen", { p_onderdeel_id: o2.data.id, p_richting: -1 });
    expect(omhoog.data).toBe(true);
    const { data } = await a.from("avf_onderdeel").select("id, volgorde").eq("avf_id", avf[1]).eq("fase", "romp").order("volgorde");
    const ids = data?.map((r) => r.id) ?? [];
    expect(ids.indexOf(o2.data.id)).toBe(ids.indexOf(o1.data.id) - 1);

    const del = await a.from("avf_onderdeel").delete().eq("id", o1.data.id).select();
    expect(del.data).toHaveLength(1);
  });

  it("een andere projectgroep kan geen onderdeel aan dit AVF toevoegen", async () => {
    const res = await (await inloggenAls("vd-groep-2")).rpc("avf_onderdeel_toevoegen", { p_avf_id: avf[1], p_fase: "kop" });
    expect(res.error).not.toBeNull();
  });
});

describe("Programma", () => {
  it("elk account ziet het programma van het eigen cluster (18 regels, zes belevenisvakken)", async () => {
    for (const naam of ["vd-groep-1", "vd-student", "vd-stuur-logistiek"]) {
      const { data } = await (await inloggenAls(naam)).from("programma_regel").select("cluster_id, soort");
      expect(data, naam).toHaveLength(18);
      expect(new Set(data?.map((r) => r.cluster_id)), naam).toEqual(new Set([VD]));
      expect(data?.filter((r) => r.soort === "belevenis"), naam).toHaveLength(6);
    }
    const { data } = await (await inloggenAls("vc-groep-1")).from("programma_regel").select("cluster_id");
    expect(new Set(data?.map((r) => r.cluster_id))).toEqual(new Set([VC]));
  });

  it("niemand kan het programma rechtstreeks wijzigen", async () => {
    for (const naam of ["vd-groep-1", "vd-student", "vd-stuur-programma"]) {
      const client = await inloggenAls(naam);
      const upd = await client.from("programma_regel").update({ titel: "Gehackt" }).eq("cluster_id", VD).select();
      expect(upd.error !== null || (upd.data ?? []).length === 0, naam).toBe(true);
      const del = await client.from("programma_regel").delete().eq("cluster_id", VD).select();
      expect(del.error !== null || (del.data ?? []).length === 0, naam).toBe(true);
    }
    const { data } = await admin.from("programma_regel").select("id").eq("cluster_id", VD);
    expect(data).toHaveLength(18);
  });

  it("elk tijdvak voor een belevenis heeft precies één groep", async () => {
    const { data } = await admin.from("avf").select("programma_regel_id").eq("cluster_id", VD).not("programma_regel_id", "is", null);
    const ids = data?.map((r) => r.programma_regel_id);
    expect(new Set(ids).size).toBe(ids?.length);
    const dubbel = await admin.from("avf").update({ programma_regel_id: origineleRegel[2] }).eq("id", avf[1]);
    expect(dubbel.error).not.toBeNull(); // uniek: één groep per tijdvak
  });

  it("alleen de stuurgroep van het cluster en de docent kunnen een regel wijzigen", async () => {
    const { data: regel } = await admin.from("programma_regel").select("*").eq("cluster_id", VD).eq("volgorde", 1).single();
    const args = (verwacht: string, titel = "Verzamelen (aangepast)") => ({
      p_id: regel!.id, p_titel: titel, p_omschrijving: regel!.omschrijving, p_locatie: regel!.locatie,
      p_dag: regel!.dag, p_start: regel!.starttijd, p_eind: regel!.eindtijd,
      p_deelnemers: regel!.deelnemers, p_rocks_rivers: regel!.rocks_rivers_groepen,
      p_verwacht: verwacht, p_naam: "Testpersoon",
    });
    for (const naam of ["vd-groep-1", "vd-student", "vc-stuur-programma", "test-stuur"]) {
      const res = await (await inloggenAls(naam)).rpc("programma_regel_wijzigen", args(regel!.updated_at));
      expect(res.error, naam).not.toBeNull();
    }
    expect((await anoniem().rpc("programma_regel_wijzigen", args(regel!.updated_at))).error).not.toBeNull();

    const stuur = await inloggenAls("vd-stuur-programma");
    const ok = (await stuur.rpc("programma_regel_wijzigen", args(regel!.updated_at))).data as Resultaat & { updated_at: string };
    expect(ok.ok).toBe(true);

    // met het oude tijdstip is de regel intussen gewijzigd
    const stale = (await stuur.rpc("programma_regel_wijzigen", args(regel!.updated_at, "Overschreven"))).data as Resultaat;
    expect(stale.ok).toBe(false);
    expect(stale.reden).toBe("gewijzigd");

    // terugzetten
    const terug = (await stuur.rpc("programma_regel_wijzigen", args(ok.updated_at, regel!.titel))).data as Resultaat;
    expect(terug.ok).toBe(true);
    const { data: na } = await admin.from("programma_regel").select("titel").eq("id", regel!.id).single();
    expect(na?.titel).toBe(regel!.titel);
  });

  it("een nieuwe tijd van een tijdvak is direct zichtbaar bij de toegewezen belevenis (match)", async () => {
    const { data: regel } = await admin.from("programma_regel").select("*").eq("id", origineleRegel[1]!).single();
    const stuur = await inloggenAls("vd-stuur-programma");
    const res = (await stuur.rpc("programma_regel_wijzigen", {
      p_id: regel!.id, p_titel: regel!.titel, p_omschrijving: regel!.omschrijving, p_locatie: regel!.locatie,
      p_dag: regel!.dag, p_start: "20:00", p_eind: "21:30",
      p_deelnemers: regel!.deelnemers, p_rocks_rivers: regel!.rocks_rivers_groepen,
      p_verwacht: regel!.updated_at, p_naam: "Testpersoon",
    })).data as Resultaat & { updated_at: string };
    expect(res.ok).toBe(true);

    for (const naam of ["vd-groep-2", "vd-student"]) {
      const { data } = await (await inloggenAls(naam)).from("avf_publiek").select("starttijd, eindtijd").eq("id", avf[1]).single();
      expect(data, naam).toEqual({ starttijd: "20:00:00", eindtijd: "21:30:00" });
    }
    const terug = (await stuur.rpc("programma_regel_wijzigen", {
      p_id: regel!.id, p_titel: regel!.titel, p_omschrijving: regel!.omschrijving, p_locatie: regel!.locatie,
      p_dag: regel!.dag, p_start: regel!.starttijd, p_eind: regel!.eindtijd,
      p_deelnemers: regel!.deelnemers, p_rocks_rivers: regel!.rocks_rivers_groepen,
      p_verwacht: res.updated_at, p_naam: "Testpersoon",
    })).data as Resultaat;
    expect(terug.ok).toBe(true);
  });

  it("ongeldige tijden of groepsnummers worden geweigerd en veranderen niets", async () => {
    // Let op: dit test op een belevenisvak en een vaste activiteit; de uitkomst is altijd "geweigerd", dus er verandert niets.
    const { data: regels } = await admin.from("programma_regel").select("*").eq("cluster_id", VD).in("volgorde", [2, 6]).order("volgorde");
    const stuur = await inloggenAls("vd-stuur-programma");
    for (const regel of regels ?? []) {
      const basis = {
        p_id: regel.id, p_titel: regel.titel, p_omschrijving: null, p_locatie: null,
        p_dag: regel.dag, p_start: "10:00", p_eind: "09:00",
        p_deelnemers: [], p_rocks_rivers: [], p_verwacht: regel.updated_at, p_naam: "Testpersoon",
      };
      const tijd = (await stuur.rpc("programma_regel_wijzigen", basis)).data as Resultaat;
      expect(tijd.ok, "eindtijd voor starttijd").toBe(false);
      const groepen = (await stuur.rpc("programma_regel_wijzigen", { ...basis, p_start: "08:00", p_eind: "09:00", p_deelnemers: [7] })).data as Resultaat;
      expect(groepen.ok, "groepsnummer 7").toBe(false);
      const rr = (await stuur.rpc("programma_regel_wijzigen", { ...basis, p_start: "08:00", p_eind: "09:00", p_rocks_rivers: [0] })).data as Resultaat;
      expect(rr.ok, "groepsnummer 0").toBe(false);
      const { data: na } = await admin.from("programma_regel").select("starttijd, eindtijd, updated_at").eq("id", regel.id).single();
      expect(na).toEqual({ starttijd: regel.starttijd, eindtijd: regel.eindtijd, updated_at: regel.updated_at });
    }
  });
});

describe("Planning toewijzen", () => {
  const toewijzen = (client: Awaited<ReturnType<typeof inloggenAls>>, avfId: string, regelId: string | null, locatie: string | null = null, naam = "Testpersoon") =>
    client.rpc("avf_planning_toewijzen", { p_avf_id: avfId, p_regel_id: regelId, p_locatie: locatie, p_naam: naam });

  it("een projectgroep, student of ander cluster kan niets toewijzen", async () => {
    for (const naam of ["vd-groep-1", "vd-student", "vc-stuur-programma", "test-stuur"]) {
      const res = await toewijzen(await inloggenAls(naam), avf[1], origineleRegel[1]);
      expect(res.error, naam).not.toBeNull();
    }
    expect((await toewijzen(anoniem(), avf[1], origineleRegel[1])).error).not.toBeNull();
    const wissel = await (await inloggenAls("vd-groep-1")).rpc("avf_planning_wisselen", { p_avf_a: avf[1], p_avf_b: avf[2], p_naam: "x" });
    expect(wissel.error).not.toBeNull();
  });

  it("een bezet tijdvak wordt geweigerd met de naam van de groep die het heeft", async () => {
    const stuur = await inloggenAls("vd-stuur-programma");
    const res = (await toewijzen(stuur, avf[1], origineleRegel[2])).data as Resultaat;
    expect(res.ok).toBe(false);
    expect(res.reden).toBe("bezet");
    expect(res.door).toBe("Projectgroep 2");
    const { data } = await admin.from("avf").select("programma_regel_id").eq("id", avf[1]).single();
    expect(data?.programma_regel_id).toBe(origineleRegel[1]);
  });

  it("een vast programmaonderdeel of tijdvak van een ander cluster is geen geldig tijdvak", async () => {
    const stuur = await inloggenAls("vd-stuur-programma");
    const { data: vast } = await admin.from("programma_regel").select("id").eq("cluster_id", VD).eq("soort", "vast").limit(1).single();
    expect(((await toewijzen(stuur, avf[1], vast!.id)).data as Resultaat).reden).toBe("ongeldig_tijdvak");
    const { data: vc } = await admin.from("programma_regel").select("id").eq("cluster_id", VC).eq("soort", "belevenis").limit(1).single();
    expect(((await toewijzen(stuur, avf[1], vc!.id)).data as Resultaat).reden).toBe("ongeldig_tijdvak");
  });

  it("een naam is verplicht", async () => {
    const res = (await toewijzen(await inloggenAls("vd-stuur-programma"), avf[1], origineleRegel[1], null, " ")).data as Resultaat;
    expect(res.ok).toBe(false);
    expect(res.reden).toBe("naam");
  });

  it("losmaken, opnieuw toewijzen met locatie en wisselen; alles komt in het logboek", async () => {
    const stuur = await inloggenAls("vd-stuur-programma");
    // losmaken
    expect(((await toewijzen(stuur, avf[1], null)).data as Resultaat).ok).toBe(true);
    const { data: leeg } = await admin.from("avf").select("programma_regel_id").eq("id", avf[1]).single();
    expect(leeg?.programma_regel_id).toBeNull();
    // opnieuw toewijzen met locatie
    expect(((await toewijzen(stuur, avf[1], origineleRegel[1], "Veld naast de camping")).data as Resultaat).reden).toBe("ongeldig_locatie");
    expect(((await toewijzen(stuur, avf[1], origineleRegel[1], "Bivak")).data as Resultaat).ok).toBe(true);
    const { data: met } = await admin.from("avf").select("programma_regel_id, locatie_keuze").eq("id", avf[1]).single();
    expect(met).toEqual({ programma_regel_id: origineleRegel[1], locatie_keuze: "bivak" });

    // wisselen
    const wissel = (await stuur.rpc("avf_planning_wisselen", { p_avf_a: avf[1], p_avf_b: avf[2], p_naam: "Testpersoon" })).data as Resultaat;
    expect(wissel.ok).toBe(true);
    const { data: na } = await admin.from("avf").select("id, programma_regel_id").in("id", [avf[1], avf[2]]);
    const per = Object.fromEntries((na ?? []).map((r) => [r.id, r.programma_regel_id]));
    expect(per[avf[1]]).toBe(origineleRegel[2]);
    expect(per[avf[2]]).toBe(origineleRegel[1]);
    const terug = (await stuur.rpc("avf_planning_wisselen", { p_avf_a: avf[1], p_avf_b: avf[2], p_naam: "Testpersoon" })).data as Resultaat;
    expect(terug.ok).toBe(true);

    // logboek: zichtbaar voor de stuurgroep van het cluster en de eigen projectgroep, niet voor anderen
    const { data: log } = await stuur.from("wijziging").select("actie, naam").eq("tabel", "avf").eq("record_id", avf[1]);
    expect(log?.map((l) => l.actie)).toEqual(expect.arrayContaining(["planning_toegewezen", "planning_gewisseld"]));
    // andere testruns kunnen ook regels hebben achtergelaten; deze test controleert alleen de eigen regels
    expect(log?.some((l) => l.naam === "Testpersoon" && l.actie === "planning_gewisseld")).toBe(true);
    expect(log?.some((l) => l.naam === "Testpersoon" && l.actie === "planning_toegewezen")).toBe(true);
    const eigen = await (await inloggenAls("vd-groep-1")).from("wijziging").select("id").eq("record_id", avf[1]);
    expect((eigen.data ?? []).length).toBeGreaterThan(0);
    const ander = await (await inloggenAls("vd-groep-3")).from("wijziging").select("id").eq("record_id", avf[1]);
    expect(ander.data ?? []).toHaveLength(0);
    const vc = await (await inloggenAls("vc-stuur-programma")).from("wijziging").select("id").eq("record_id", avf[1]);
    expect(vc.data ?? []).toHaveLength(0);
  });

  it("de docent kan in elk cluster toewijzen", async () => {
    const res = (await toewijzen(await inloggenAls("docent"), avf[1], origineleRegel[1], "Camping")).data as Resultaat;
    expect(res.ok).toBe(true);
    // een lege locatie laat de keuze van de projectgroep staan
    expect(((await toewijzen(await inloggenAls("docent"), avf[1], origineleRegel[1], null)).data as Resultaat).ok).toBe(true);
    const { data: na } = await admin.from("avf").select("locatie_keuze").eq("id", avf[1]).single();
    expect(na?.locatie_keuze).toBe("camping");
  });
});

describe("Storage avf", () => {
  const eigenPad = (naam: string) => `cluster/${VD}/avf/${avf[1]}/${naam}`;
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const opgeruimd: string[] = [];

  afterAll(async () => {
    await admin.storage.from("avf").remove(opgeruimd);
  });

  it("de projectgroep uploadt en leest in het eigen AVF; de stuurgroep leest mee", async () => {
    const pad = eigenPad("tekening.png");
    opgeruimd.push(pad);
    const a = await inloggenAls("vd-groep-1");
    const up = await a.storage.from("avf").upload(pad, PNG, { contentType: "image/png", upsert: true });
    expect(up.error).toBeNull();
    expect((await a.storage.from("avf").download(pad)).error).toBeNull();
    expect((await (await inloggenAls("vd-stuur-veiligheid")).storage.from("avf").download(pad)).error).toBeNull();
    expect((await (await inloggenAls("docent")).storage.from("avf").download(pad)).error).toBeNull();
  });

  it("anderen kunnen het bestand niet lezen of schrijven", async () => {
    const pad = eigenPad("tekening.png");
    for (const naam of ["vd-groep-2", "vd-student", "vc-groep-1", "vc-stuur-programma", "test-groep-1"]) {
      const { error } = await (await inloggenAls(naam)).storage.from("avf").download(pad);
      expect(error, naam).not.toBeNull();
    }
    for (const naam of ["vd-groep-2", "vd-stuur-programma", "vd-student"]) {
      const { error } = await (await inloggenAls(naam)).storage.from("avf").upload(eigenPad(`ongewenst-${naam}.png`), PNG, { contentType: "image/png" });
      expect(error, naam).not.toBeNull();
    }
    expect((await anoniem().storage.from("avf").download(pad)).error).not.toBeNull();
  });

  it("een pad dat niet bij het AVF en het cluster past wordt geweigerd", async () => {
    const a = await inloggenAls("vd-groep-1");
    const fout = [
      `cluster/${VC}/avf/${avf[1]}/fout.png`,
      `cluster/${VD}/avf/${avf[2]}/fout.png`,
      `cluster/${VD}/avf/${avf[1]}/map/fout.png`,
      `losse-map/fout.png`,
    ];
    for (const pad of fout) {
      opgeruimd.push(pad);
      const { error } = await a.storage.from("avf").upload(pad, PNG, { contentType: "image/png" });
      expect(error, pad).not.toBeNull();
    }
  });

  it("bij een ingediend AVF kan de projectgroep niets meer uploaden of verwijderen", async () => {
    const pad = eigenPad("tekening.png");
    await admin.from("avf").update({ status: "ingediend" }).eq("id", avf[1]);
    try {
      const a = await inloggenAls("vd-groep-1");
      const up = await a.storage.from("avf").upload(eigenPad("laat.png"), PNG, { contentType: "image/png" });
      expect(up.error).not.toBeNull();
      await a.storage.from("avf").remove([pad]);
      expect((await admin.storage.from("avf").download(pad)).error).toBeNull(); // bestand staat er nog
      expect((await a.storage.from("avf").download(pad)).error).toBeNull(); // lezen mag nog
    } finally {
      await admin.from("avf").update({ status: "in_ontwikkeling" }).eq("id", avf[1]);
    }
  });

  it("alleen afbeeldingen zijn toegestaan", async () => {
    const pad = eigenPad("script.html");
    opgeruimd.push(pad);
    const { error } = await (await inloggenAls("vd-groep-1")).storage.from("avf")
      .upload(pad, Buffer.from("<script>alert(1)</script>"), { contentType: "text/html" });
    expect(error).not.toBeNull();
  });

  it("de projectgroep kan het eigen bestand verwijderen zolang het AVF open is", async () => {
    const pad = eigenPad("tekening.png");
    const { error } = await (await inloggenAls("vd-groep-1")).storage.from("avf").remove([pad]);
    expect(error).toBeNull();
    expect((await admin.storage.from("avf").download(pad)).error).not.toBeNull();
  });
});

describe("Opruimen en niet van toepassing", () => {
  // Deze tests gebruiken het voorbeeld-AVF van test-groep-1 in het cluster TEST. VD en VC blijven leeg (zie de livegang).
  let avfT1: string;
  beforeAll(async () => {
    const TEST = await clusterId("TEST");
    const { data } = await admin.from("avf").select("id, projectgroep:projectgroep_id!inner(nummer)").eq("cluster_id", TEST).eq("projectgroep.nummer", 1).single();
    avfT1 = data!.id as string;
  });

  it("één W-veld van opruimen opslaan zonder de andere te overschrijven, met controle op eigenaar", async () => {
    const a = await inloggenAls("test-groep-1");
    const { data: voor } = await admin.from("avf_fase").select("opruimen").eq("avf_id", avfT1).eq("fase", "romp").single();
    const oudWie = (voor!.opruimen as Record<string, string>).wie;
    const rpc = (client: typeof a, oud: string | null, nieuw: string, id = avfT1, sleutel = "wie") =>
      client.rpc("avf_fase_opruimen_opslaan", { p_avf_id: id, p_fase: "romp", p_sleutel: sleutel, p_oud: oud, p_nieuw: nieuw });

    expect(((await rpc(a, oudWie, "Test-wie")).data as Resultaat).ok).toBe(true);
    const verouderd = (await rpc(a, oudWie, "Overschreven")).data as Resultaat;
    expect(verouderd.ok).toBe(false);
    expect(verouderd.reden).toBe("gewijzigd");
    const { data: na } = await admin.from("avf_fase").select("opruimen").eq("avf_id", avfT1).eq("fase", "romp").single();
    expect(na!.opruimen).toMatchObject({ wie: "Test-wie", wat: (voor!.opruimen as Record<string, string>).wat });

    expect(((await rpc(await inloggenAls("test-groep-2"), "Test-wie", "x")).data as Resultaat).ok).toBe(false);
    expect(((await rpc(await inloggenAls("test-stuur"), "Test-wie", "x")).data as Resultaat).ok).toBe(false);
    expect((await rpc(a, null, "x", avfT1, "onbekend")).error).not.toBeNull();
    await admin.from("avf_fase").update({ opruimen: voor!.opruimen }).eq("avf_id", avfT1).eq("fase", "romp");
  });

  it("een veld als niet van toepassing markeren en weer vrijgeven; de fysieke veiligheid kan dat niet", async () => {
    const a = await inloggenAls("test-groep-1");
    const { data: o } = await admin.from("avf_onderdeel").select("id").eq("avf_id", avfT1).eq("fase", "romp").limit(1).single();
    const zet = (client: typeof a, veld: string, aan: boolean) => client.rpc("avf_onderdeel_nvt_zetten", { p_onderdeel_id: o!.id, p_veld: veld, p_aan: aan });

    expect((await zet(a, "usv_uitdagend", true)).data).toBe(true);
    expect((await zet(a, "usv_uitdagend", true)).data).toBe(true); // twee keer is niet dubbel
    const { data: aan } = await admin.from("avf_onderdeel").select("niet_van_toepassing").eq("id", o!.id).single();
    expect(aan!.niet_van_toepassing).toEqual(["usv_uitdagend"]);
    expect((await zet(a, "usv_uitdagend", false)).data).toBe(true);
    const { data: uit } = await admin.from("avf_onderdeel").select("niet_van_toepassing").eq("id", o!.id).single();
    expect(uit!.niet_van_toepassing).toEqual([]);

    expect((await zet(a, "fysieke_veiligheid", true)).error).not.toBeNull();
    expect((await zet(await inloggenAls("test-groep-2"), "usv_uitdagend", true)).data).toBe(false);
    expect((await zet(await inloggenAls("test-stuur"), "usv_uitdagend", true)).data).toBe(false);
  });
});

describe("Programma per cluster", () => {
  it("VC heeft een gespiegeld programma: bivak eerst, dinsdagavond naar de camping", async () => {
    const vc = await (await inloggenAls("vc-groep-1")).from("programma_regel").select("volgorde, titel, locatie, soort").order("volgorde");
    expect(vc.data).toHaveLength(18);
    expect(vc.data?.filter((r) => r.soort === "belevenis")).toHaveLength(6);
    const titels = vc.data?.map((r) => r.titel);
    expect(titels).toContain("Bivak inrichten en avondeten");
    expect(titels).toContain("Diner en lopen naar camping");
    expect(titels).not.toContain("Camping inrichten en avondeten");
    expect(vc.data?.find((r) => r.volgorde === 6)?.locatie).toBe("Bivak"); // maandagavond
    expect(vc.data?.find((r) => r.volgorde === 12)?.locatie).toBe("Camping"); // dinsdagavond

    const vd = await (await inloggenAls("vd-groep-1")).from("programma_regel").select("volgorde, titel, locatie").order("volgorde");
    expect(vd.data?.map((r) => r.titel)).toContain("Camping inrichten en avondeten");
    expect(vd.data?.find((r) => r.volgorde === 6)?.locatie).toBe("Camping");
  });

  it("elk cluster heeft zes toegewezen tijdvakken, één groep per tijdvak (VC en VD)", async () => {
    for (const code of ["VD", "VC"]) {
      const cl = await clusterId(code);
      const { data } = await admin.from("avf").select("programma_regel_id").eq("cluster_id", cl);
      const ids = (data ?? []).map((r) => r.programma_regel_id);
      expect(ids.filter(Boolean), code).toHaveLength(6);
      expect(new Set(ids).size, code).toBe(6);
    }
  });
});

describe("Verschijningsvorm", () => {
  it("alleen de zes opties zijn toegestaan, meerdere gescheiden door een komma", async () => {
    const client = await inloggenAls("vd-groep-1");
    const { data: voor } = await admin.from("avf").select("verschijningsvorm").eq("id", avf[1]).single();
    const zet = (w: string | null) => client.from("avf").update({ verschijningsvorm: w }).eq("id", avf[1]).select("verschijningsvorm");

    expect((await zet("Spel, Show")).data?.[0]?.verschijningsvorm).toBe("Spel, Show");
    expect((await zet("Avontuur")).data?.[0]?.verschijningsvorm).toBe("Avontuur");
    expect((await zet(null)).error).toBeNull();
    for (const fout of ["Tocht", "Workshop", "Anders", "Spel, Tocht", "spel", ""]) {
      const res = await zet(fout);
      expect(res.error, fout).not.toBeNull();
    }
    await admin.from("avf").update({ verschijningsvorm: voor!.verschijningsvorm }).eq("id", avf[1]);
  });
});
