/**
 * Opdracht 5, deel B: budget. Afschermingstests 5 en 6 uit docs/rechtenmatrix.md, het financieel plan,
 * aanvragen, besluiten, resterende ruimte en het scenario uit PRD 12 (€ 60 aangevraagd, € 50 toegekend).
 * Draait op het cluster TEST (test-groep-1, test-groep-2 en test-stuur); VD en VC blijven onaangeroerd.
 * Elke test zet na afloop terug wat hij wijzigt.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anoniem, clusterId, inloggenAls } from "./helpers";

type R = { ok: boolean; reden?: string; updated_at?: string; bedrag?: number; id?: string; boven_resterend?: boolean };

const NAAM = "Testpersoon";
let VD: string, TEST: string;
let avf1: string, avf2: string; // test-groep-1 (voorbeeld-AVF, compleet) en test-groep-2 (leeg)
let aanvraag1: string, aanvraag2: string; // het financieel plan van elk AVF
let beginBudget: number;
let beginAvf: Record<string, unknown>;
const losse: string[] = [];

async function avfId(cluster: string, nummer: number): Promise<string> {
  const { data } = await admin.from("avf").select("id, projectgroep:projectgroep_id!inner(nummer)").eq("cluster_id", cluster).eq("projectgroep.nummer", nummer).single();
  return data!.id;
}

async function planId(avf: string): Promise<string> {
  const { data } = await admin.from("budgetaanvraag").select("id").eq("avf_id", avf).eq("soort", "avf").single();
  return data!.id;
}

const rpc = async (gebruiker: string, functie: string, args: Record<string, unknown>) => {
  const res = await (await inloggenAls(gebruiker)).rpc(functie, args);
  return { ...res, r: res.data as R };
};
const regelsArgs = (id: string, regels: unknown, verwacht: string, extra: Record<string, unknown> = {}) => ({
  p_id: id, p_regels: regels, p_omschrijving: null, p_toelichting: null, p_naam: NAAM, p_verwacht: verwacht, ...extra,
});
const besluit = (gebruiker: string, id: string, soort: string, bedrag: number | null, toelichting: string | null = null) =>
  rpc(gebruiker, "budget_besluit", { p_id: id, p_besluit: soort, p_bedrag: bedrag, p_toelichting: toelichting, p_naam: NAAM });
const tijdstip = async (id: string) => (await admin.from("budgetaanvraag").select("updated_at").eq("id", id).single()).data!.updated_at as string;

async function opschonen() {
  if (losse.length) await admin.from("budgetaanvraag").delete().in("id", losse);
  await admin.from("budgetaanvraag").delete().in("avf_id", [avf1, avf2]).eq("soort", "los");
  await admin.from("budgetaanvraag").update({
    status: "concept", regels: [], omschrijving: null, toelichting: null, bedrag_toegekend: null, besluit_toelichting: null,
    besluit_door_naam: null, besluit_op: null, besteed: null, ingediend_door_naam: null, ingediend_op: null,
  }).in("avf_id", [avf1, avf2]).eq("soort", "avf");
  await admin.from("avf_versie").delete().in("avf_id", [avf1, avf2]);
  await admin.from("verbeterverzoek").delete().in("avf_id", [avf1, avf2]);
  if (beginAvf) {
    await admin.from("avf").update({
      status: beginAvf.status, versie: beginAvf.versie, opnieuw_te_controleren: beginAvf.opnieuw_te_controleren, ingediend_op: beginAvf.ingediend_op,
      ingediend_door_naam: beginAvf.ingediend_door_naam, goedgekeurd_op: null, goedgekeurd_door_naam: null, goedgekeurd_door_account: null,
    }).eq("id", avf1);
  }
  await admin.from("avf").update({ status: "in_ontwikkeling", versie: 0 }).eq("id", avf2);
  await admin.from("wijziging").delete().eq("naam", NAAM).in("record_id", [avf1, avf2]);
  await admin.from("wijziging").delete().eq("naam", NAAM).eq("tabel", "budgetaanvraag");
  if (beginBudget !== undefined) await admin.from("cluster_budget").update({ budget_totaal: beginBudget }).eq("cluster_id", TEST);
}

beforeAll(async () => {
  VD = await clusterId("VD");
  TEST = await clusterId("TEST");
  [avf1, avf2] = await Promise.all([avfId(TEST, 1), avfId(TEST, 2)]);
  [aanvraag1, aanvraag2] = await Promise.all([planId(avf1), planId(avf2)]);
  const { data: b } = await admin.from("cluster_budget").select("budget_totaal").eq("cluster_id", TEST).single();
  beginBudget = Number(b!.budget_totaal);
  const { data: a } = await admin.from("avf").select("status, versie, opnieuw_te_controleren, ingediend_op, ingediend_door_naam").eq("id", avf1).single();
  beginAvf = a!;
  await opschonen();
  await admin.from("cluster_budget").update({ budget_totaal: 250 }).eq("cluster_id", TEST); // voor het scenario uit PRD 12
});

afterAll(opschonen);

describe("Elk AVF heeft een aanvraag voor het financieel plan; de afscherming", () => {
  it("de startwaarde van het clusterbudget is € 150", async () => {
    const { data } = await admin.from("cluster_budget").select("budget_totaal").eq("cluster_id", VD).single();
    expect(Number(data!.budget_totaal)).toBe(150);
  });

  it("elk AVF heeft een lege aanvraag van soort 'avf'", async () => {
    const { data } = await admin.from("budgetaanvraag").select("status, bedrag_aangevraagd, soort").eq("avf_id", avf1);
    expect(data).toEqual([{ status: "concept", bedrag_aangevraagd: 0, soort: "avf" }]);
    const { data: alle } = await admin.from("avf").select("id");
    const { data: plannen } = await admin.from("budgetaanvraag").select("avf_id").eq("soort", "avf");
    expect(plannen).toHaveLength(alle!.length);
  });

  it("Test 6: een projectgroep leest alleen eigen aanvragen; stuurgroep van het cluster en docent lezen alles van het cluster", async () => {
    for (const g of ["test-groep-1", "test-stuur", "docent"]) {
      expect(((await (await inloggenAls(g)).from("budgetaanvraag").select("id").eq("id", aanvraag1)).data ?? []).length, g).toBe(1);
    }
    for (const g of ["test-groep-2", "test-student", "vd-groep-1", "vd-stuur-programma", "vc-stuur-programma", "vd-student"]) {
      expect(((await (await inloggenAls(g)).from("budgetaanvraag").select("id").eq("id", aanvraag1)).data ?? []).length, g).toBe(0);
    }
    const { data } = await (await inloggenAls("test-groep-2")).from("budgetaanvraag").select("avf_id");
    expect(new Set(data?.map((r) => r.avf_id))).toEqual(new Set([avf2]));
    expect((await anoniem().from("budgetaanvraag").select("id")).data ?? []).toHaveLength(0);
  });

  it("Test 6: een projectgroep ziet wel de resterende ruimte van het eigen cluster, niet van een ander cluster", async () => {
    const eigen = await (await inloggenAls("test-groep-2")).rpc("budget_resterend", { p_cluster_id: TEST });
    expect(Number(eigen.data)).toBe(250);
    expect((await (await inloggenAls("vd-groep-1")).rpc("budget_resterend", { p_cluster_id: TEST })).error).not.toBeNull();
    expect((await (await inloggenAls("test-groep-2")).rpc("budget_resterend", { p_cluster_id: VD })).error).not.toBeNull();
    expect((await (await inloggenAls("docent")).rpc("budget_resterend", { p_cluster_id: VD })).error).toBeNull();
    // het totaalbedrag zelf is voor projectgroepen en studenten niet te lezen
    for (const g of ["test-groep-1", "test-student"]) {
      expect(((await (await inloggenAls(g)).from("cluster_budget").select("budget_totaal")).data ?? []), g).toHaveLength(0);
    }
  });

  it("Test 5: niemand schrijft rechtstreeks in budgetaanvraag", async () => {
    for (const g of ["test-groep-1", "test-stuur", "docent", "test-student"]) {
      const c = await inloggenAls(g);
      expect((await c.from("budgetaanvraag").insert({ avf_id: avf1, soort: "los", omschrijving: "x" })).error, `${g} insert`).not.toBeNull();
      const u = await c.from("budgetaanvraag").update({ status: "toegekend", bedrag_toegekend: 99 }).eq("id", aanvraag1).select();
      expect(u.error !== null || (u.data ?? []).length === 0, `${g} update`).toBe(true);
      const d = await c.from("budgetaanvraag").delete().eq("id", aanvraag1).select();
      expect(d.error !== null || (d.data ?? []).length === 0, `${g} delete`).toBe(true);
    }
    const { data } = await admin.from("budgetaanvraag").select("status, bedrag_toegekend").eq("id", aanvraag1).single();
    expect(data).toEqual({ status: "concept", bedrag_toegekend: null });
  });

  it("alleen de stuurgroep van het cluster of de docent past het clusterbudget aan", async () => {
    const wijzig = (g: string, bedrag: number) => inloggenAls(g).then((c) => c.from("cluster_budget").update({ budget_totaal: bedrag }).eq("cluster_id", TEST).select("budget_totaal"));
    for (const g of ["test-groep-1", "test-student", "vd-stuur-programma"]) {
      const r = await wijzig(g, 1);
      expect(r.error !== null || (r.data ?? []).length === 0, g).toBe(true);
    }
    expect((await wijzig("test-stuur", 260)).data).toHaveLength(1);
    expect((await wijzig("docent", 250)).data).toHaveLength(1);
  });
});

describe("Het financieel plan", () => {
  it("de eigen projectgroep slaat regels op; het bedrag is de som; niemand anders kan dat", async () => {
    const t0 = await tijdstip(aanvraag1);
    const regels = [{ omschrijving: "Tent huren", bedrag: 20 }, { omschrijving: "Verf", bedrag: 30 }, { omschrijving: "Prijzen", bedrag: 10 }];
    for (const g of ["test-groep-2", "test-stuur", "test-student", "vd-groep-1"]) {
      expect((await rpc(g, "budget_regels_opslaan", regelsArgs(aanvraag1, regels, t0))).error, g).not.toBeNull();
    }
    expect((await anoniem().rpc("budget_regels_opslaan", regelsArgs(aanvraag1, regels, t0))).error).not.toBeNull();
    expect(((await rpc("test-groep-1", "budget_regels_opslaan", regelsArgs(aanvraag1, regels, t0, { p_naam: " " }))).r).reden).toBe("naam");
    const ok = await rpc("test-groep-1", "budget_regels_opslaan", regelsArgs(aanvraag1, regels, t0));
    expect(ok.r.ok).toBe(true);
    expect(Number(ok.r.bedrag)).toBe(60);
    const { data } = await admin.from("budgetaanvraag").select("bedrag_aangevraagd, status").eq("id", aanvraag1).single();
    expect(Number(data!.bedrag_aangevraagd)).toBe(60);
    expect(data!.status).toBe("concept");
  });

  it("een veroudert tijdstip geeft een waarschuwing en overschrijft niets; ongeldige regels worden geweigerd", async () => {
    const oud = (await tijdstip(aanvraag1));
    const verouderd = await rpc("test-groep-1", "budget_regels_opslaan", regelsArgs(aanvraag1, [{ omschrijving: "X", bedrag: 1 }], "2020-01-01T00:00:00Z"));
    expect(verouderd.r.reden).toBe("gewijzigd");
    expect(await tijdstip(aanvraag1)).toBe(oud);
    for (const slecht of [
      [{ omschrijving: "", bedrag: 5 }], [{ omschrijving: "X", bedrag: -5 }], [{ omschrijving: "X", bedrag: "veel" }],
      [{ omschrijving: "X", bedrag: 100000 }], [{ bedrag: 5 }], "geen lijst", Array.from({ length: 31 }, () => ({ omschrijving: "X", bedrag: 1 })),
    ]) {
      const res = await rpc("test-groep-1", "budget_regels_opslaan", regelsArgs(aanvraag1, slecht, oud));
      expect(res.r?.reden ?? "fout", JSON.stringify(slecht).slice(0, 40)).toBe("ongeldig");
    }
    const { data } = await admin.from("budgetaanvraag").select("bedrag_aangevraagd").eq("id", aanvraag1).single();
    expect(Number(data!.bedrag_aangevraagd)).toBe(60);
  });

  it("na goedkeuring van het AVF ligt het plan vast (zonder teruggeven); in een ander AVF kan dat nog niet", async () => {
    await admin.from("avf").update({ status: "goedgekeurd" }).eq("id", avf2);
    const res = await rpc("test-groep-2", "budget_regels_opslaan", regelsArgs(aanvraag2, [{ omschrijving: "Extra", bedrag: 5 }], await tijdstip(aanvraag2)));
    expect(res.r.reden).toBe("vast");
    await admin.from("avf").update({ status: "in_ontwikkeling" }).eq("id", avf2);
  });
});

describe("Indienen en besluiten: het scenario uit PRD 12", () => {
  it("indienen van het AVF zet het financieel plan op 'aangevraagd' en vergrendelt het", async () => {
    const res = await rpc("test-groep-1", "avf_indienen", { p_avf_id: avf1, p_naam: NAAM, p_samenvatting: "Met financieel plan" });
    expect(res.r.ok).toBe(true);
    const { data } = await admin.from("budgetaanvraag").select("status, ingediend_door_naam").eq("id", aanvraag1).single();
    expect(data).toEqual({ status: "aangevraagd", ingediend_door_naam: NAAM });
    const slot = await rpc("test-groep-1", "budget_regels_opslaan", regelsArgs(aanvraag1, [], await tijdstip(aanvraag1)));
    expect(slot.r.reden).toBe("vergrendeld");
  });

  it("Test 5: een projectgroep kan geen budget toekennen; ook de stuurgroep van een ander cluster niet", async () => {
    for (const g of ["test-groep-1", "test-groep-2", "test-student", "vd-stuur-programma", "vc-stuur-logistiek"]) {
      expect((await besluit(g, aanvraag1, "toegekend", 60)).error, g).not.toBeNull();
    }
    expect((await anoniem().rpc("budget_besluit", { p_id: aanvraag1, p_besluit: "toegekend", p_bedrag: 60, p_toelichting: null, p_naam: NAAM })).error).not.toBeNull();
    const { data } = await admin.from("budgetaanvraag").select("status").eq("id", aanvraag1).single();
    expect(data?.status).toBe("aangevraagd");
  });

  it("een lager bedrag vraagt een toelichting; meer dan aangevraagd kan niet; een naam is verplicht", async () => {
    expect((await besluit("test-stuur", aanvraag1, "toegekend", 50)).r.reden).toBe("toelichting");
    expect((await besluit("test-stuur", aanvraag1, "toegekend", 70, "te veel")).r.reden).toBe("bedrag");
    expect((await besluit("test-stuur", aanvraag1, "toegekend", 0, "nul")).r.reden).toBe("bedrag");
    expect((await besluit("test-stuur", aanvraag1, "onzin", 50, "x")).r.reden).toBe("ongeldig");
    const zonderNaam = await rpc("test-stuur", "budget_besluit", { p_id: aanvraag1, p_besluit: "toegekend", p_bedrag: 60, p_toelichting: null, p_naam: " " });
    expect(zonderNaam.r.reden).toBe("naam");
  });

  it("€ 60 aangevraagd, € 50 toegekend: € 200 resterend van € 250; de groep ziet het besluit en de toelichting", async () => {
    const ok = await besluit("test-stuur", aanvraag1, "toegekend", 50, "Verf hoeft niet zo duur");
    expect(ok.r.ok).toBe(true);
    expect(ok.r.boven_resterend).toBe(false);
    const { data } = await admin.from("budgetaanvraag").select("status, bedrag_aangevraagd, bedrag_toegekend, besluit_toelichting, besluit_door_naam").eq("id", aanvraag1).single();
    expect(data).toEqual({ status: "toegekend", bedrag_aangevraagd: 60, bedrag_toegekend: 50, besluit_toelichting: "Verf hoeft niet zo duur", besluit_door_naam: NAAM });
    expect(Number((await (await inloggenAls("test-groep-1")).rpc("budget_resterend", { p_cluster_id: TEST })).data)).toBe(200);
    expect(Number((await (await inloggenAls("test-groep-2")).rpc("budget_resterend", { p_cluster_id: TEST })).data)).toBe(200);
    const eigen = await (await inloggenAls("test-groep-1")).from("budgetaanvraag").select("status, bedrag_toegekend, besluit_toelichting").eq("id", aanvraag1).single();
    expect(eigen.data).toEqual({ status: "toegekend", bedrag_toegekend: 50, besluit_toelichting: "Verf hoeft niet zo duur" });
    // een tweede besluit op dezelfde aanvraag kan niet
    expect((await besluit("test-stuur", aanvraag1, "afgewezen", null, "nee")).r.reden).toBe("status");
  });

  it("het besteed bedrag vult alleen de stuurgroep in, en alleen bij een toegekende aanvraag", async () => {
    const zet = (g: string, id: string, bedrag: number | null) => rpc(g, "budget_besteed_zetten", { p_id: id, p_bedrag: bedrag, p_naam: NAAM });
    for (const g of ["test-groep-1", "test-student", "vd-stuur-programma"]) expect((await zet(g, aanvraag1, 45)).error, g).not.toBeNull();
    expect((await zet("test-stuur", aanvraag2, 5)).r.reden).toBe("status");
    expect((await zet("test-stuur", aanvraag1, -1)).r.reden).toBe("ongeldig");
    expect((await zet("test-stuur", aanvraag1, 45)).r.ok).toBe(true);
    expect(Number((await admin.from("budgetaanvraag").select("besteed").eq("id", aanvraag1).single()).data!.besteed)).toBe(45);
  });

  it("alle besluiten staan in het logboek met naam, en alleen de eigen stuurgroep en groep zien het", async () => {
    const { data } = await admin.from("wijziging").select("actie").eq("tabel", "budgetaanvraag").eq("record_id", aanvraag1).eq("naam", NAAM);
    expect(new Set(data?.map((l) => l.actie))).toEqual(new Set(["budget_toegekend", "budget_besteed"])); // het indienen staat bij het AVF (avf_ingediend)
    expect(((await (await inloggenAls("test-groep-2")).from("wijziging").select("id").eq("record_id", aanvraag1)).data ?? [])).toHaveLength(0);
  });
});

describe("Losse aanvragen, teruggeven en afwijzen", () => {
  it("een losse aanvraag kan pas na goedkeuring van het AVF, alleen door de eigen groep", async () => {
    const maak = (g: string, avf: string, oms: string | null) => rpc(g, "budget_losse_aanvraag_maken", { p_avf_id: avf, p_omschrijving: oms, p_naam: NAAM });
    expect((await maak("test-groep-1", avf1, "Extra tent")).r.reden).toBe("avf_niet_goedgekeurd");
    await admin.from("avf").update({ status: "goedgekeurd" }).eq("id", avf1);
    for (const g of ["test-groep-2", "test-stuur", "test-student", "vd-groep-1"]) expect((await maak(g, avf1, "Extra")).error, g).not.toBeNull();
    expect((await maak("test-groep-1", avf1, " ")).r.reden).toBe("ongeldig");
    const ok = await maak("test-groep-1", avf1, "Extra tent");
    expect(ok.r.ok).toBe(true);
    losse.push(ok.r.id!);
    const { data } = await admin.from("budgetaanvraag").select("soort, status, omschrijving").eq("id", ok.r.id!).single();
    expect(data).toEqual({ soort: "los", status: "concept", omschrijving: "Extra tent" });
  });

  it("indienen vraagt een bedrag; daarna besluit de stuurgroep; een bedrag boven de resterende ruimte mag met een waarschuwing", async () => {
    const id = losse[0];
    const indienen = (g: string, aanvraag: string) => rpc(g, "budget_aanvraag_indienen", { p_id: aanvraag, p_naam: NAAM });
    expect((await indienen("test-groep-1", id)).r.reden).toBe("leeg");
    for (const g of ["test-groep-2", "test-stuur", "test-student"]) expect((await indienen(g, id)).error, g).not.toBeNull();
    expect((await rpc("test-groep-1", "budget_regels_opslaan", regelsArgs(id, [{ omschrijving: "Tent", bedrag: 230 }], await tijdstip(id), { p_omschrijving: "Extra tent" }))).r.ok).toBe(true);
    expect((await indienen("test-groep-1", id)).r.ok).toBe(true);
    // resterend is 200: 230 aanvragen en toekennen mag, met een waarschuwing
    const ok = await besluit("test-stuur", id, "toegekend", 230);
    expect(ok.r.ok).toBe(true);
    expect(ok.r.boven_resterend).toBe(true);
    expect(Number((await (await inloggenAls("test-groep-2")).rpc("budget_resterend", { p_cluster_id: TEST })).data)).toBe(-30);
  });

  it("teruggegeven: de groep past aan en dient opnieuw in; afwijzen vraagt een toelichting", async () => {
    const maak = await rpc("test-groep-1", "budget_losse_aanvraag_maken", { p_avf_id: avf1, p_omschrijving: "Prijzen", p_naam: NAAM });
    const id = maak.r.id!;
    losse.push(id);
    await rpc("test-groep-1", "budget_regels_opslaan", regelsArgs(id, [{ omschrijving: "Bekers", bedrag: 15 }], await tijdstip(id), { p_omschrijving: "Prijzen" }));
    await rpc("test-groep-1", "budget_aanvraag_indienen", { p_id: id, p_naam: NAAM });
    expect((await besluit("test-stuur", id, "teruggegeven", null)).r.reden).toBe("toelichting");
    expect((await besluit("test-stuur", id, "teruggegeven", null, "Kan het goedkoper?")).r.ok).toBe(true);
    const gezien = await (await inloggenAls("test-groep-1")).from("budgetaanvraag").select("status, besluit_toelichting").eq("id", id).single();
    expect(gezien.data).toEqual({ status: "teruggegeven", besluit_toelichting: "Kan het goedkoper?" });
    // aanpassen en opnieuw indienen
    expect((await rpc("test-groep-1", "budget_regels_opslaan", regelsArgs(id, [{ omschrijving: "Bekers", bedrag: 10 }], await tijdstip(id), { p_omschrijving: "Prijzen" }))).r.ok).toBe(true);
    expect((await rpc("test-groep-1", "budget_aanvraag_indienen", { p_id: id, p_naam: NAAM })).r.ok).toBe(true);
    expect((await besluit("test-stuur", id, "afgewezen", null)).r.reden).toBe("toelichting");
    expect((await besluit("test-stuur", id, "afgewezen", null, "Geen budget meer")).r.ok).toBe(true);
    // toegekend telt mee, afgewezen en teruggegeven niet
    expect(Number((await (await inloggenAls("test-groep-2")).rpc("budget_resterend", { p_cluster_id: TEST })).data)).toBe(-30);
  });

  it("na 'teruggegeven' kan het financieel plan van het AVF zelf weer worden aangepast en ingediend, ook als het AVF goedgekeurd is", async () => {
    await admin.from("budgetaanvraag").update({ status: "aangevraagd", bedrag_toegekend: null, besluit_toelichting: null }).eq("id", aanvraag1);
    expect((await besluit("test-stuur", aanvraag1, "teruggegeven", null, "Eerst het aantal controleren")).r.ok).toBe(true);
    expect((await rpc("test-groep-1", "budget_regels_opslaan", regelsArgs(aanvraag1, [{ omschrijving: "Tent huren", bedrag: 20 }], await tijdstip(aanvraag1)))).r.ok).toBe(true);
    expect((await rpc("test-groep-1", "budget_aanvraag_indienen", { p_id: aanvraag1, p_naam: NAAM })).r.ok).toBe(true);
    expect(Number((await admin.from("budgetaanvraag").select("bedrag_aangevraagd").eq("id", aanvraag1).single()).data!.bedrag_aangevraagd)).toBe(20);
  });
});
