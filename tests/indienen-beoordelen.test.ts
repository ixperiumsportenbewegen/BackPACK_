/**
 * Opdracht 4: indienen en beoordelen. Afschermingstests 4, 5 en 10 uit docs/rechtenmatrix.md
 * voor de nieuwe tabellen en functies, plus de hele keten: verzoek, aanpassen, opnieuw indienen, goedkeuren.
 * De keten draait op het cluster TEST (test-groep-1 en test-stuur), zodat VD en VC onaangeroerd blijven.
 * Elke test zet na afloop terug wat hij wijzigt.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { alleOntbrekend, voortgangPerSectie, type AvfInhoud } from "../src/lib/avfVoortgang";
import { admin, anoniem, clusterId, inloggenAls } from "./helpers";

type R = { ok: boolean; reden?: string; ontbrekend?: string[]; verzoeken?: { id: string }[]; aantal?: number; versie?: number; id?: string };

let VD: string, TEST: string;
let avfTest1: string; // test-groep-1: voorbeeld-AVF
let avfTest2: string; // test-groep-2: leeg AVF
let avfVd1: string;
let origineel: Record<string, unknown>;
let onderdeelId: string;
let origineleFysiek: string | null;

const naam = "Testpersoon";
const rpc = async (gebruiker: string, functie: string, args: Record<string, unknown>) => {
  const res = await (await inloggenAls(gebruiker)).rpc(functie, args);
  return { ...res, r: res.data as R };
};

async function avfId(cluster: string, nummer: number): Promise<string> {
  const { data } = await admin.from("avf").select("id, projectgroep:projectgroep_id!inner(nummer)").eq("cluster_id", cluster).eq("projectgroep.nummer", nummer).single();
  return data!.id;
}

async function opschonen() {
  await admin.from("verbeterverzoek").delete().in("avf_id", [avfTest1, avfTest2]);
  await admin.from("themacheck").delete().in("avf_id", [avfTest1, avfTest2]);
  await admin.from("avf_versie").delete().in("avf_id", [avfTest1, avfTest2]);
  await admin.from("avf").update({
    status: "in_ontwikkeling", versie: 0, opnieuw_te_controleren: false, ingediend_op: null, ingediend_door_naam: null,
    goedgekeurd_op: null, goedgekeurd_door_naam: null, goedgekeurd_door_account: null,
    verschijningsvorm: origineel.verschijningsvorm, veiligheid: origineel.veiligheid, titel: origineel.titel,
  }).eq("id", avfTest1);
  if (onderdeelId) await admin.from("avf_onderdeel").update({ fysieke_veiligheid: origineleFysiek }).eq("id", onderdeelId);
  // het logboek van deze tests (alleen de regels met de testnaam)
  await admin.from("wijziging").delete().in("record_id", [avfTest1, avfTest2]).eq("naam", naam);
}

beforeAll(async () => {
  VD = await clusterId("VD");
  TEST = await clusterId("TEST");
  avfTest1 = await avfId(TEST, 1);
  avfTest2 = await avfId(TEST, 2);
  avfVd1 = await avfId(VD, 1);
  const { data } = await admin.from("avf").select("*").eq("id", avfTest1).single();
  origineel = data!;
  const { data: o } = await admin.from("avf_onderdeel").select("id, fysieke_veiligheid").eq("avf_id", avfTest1).eq("fase", "romp").order("volgorde").limit(1).single();
  onderdeelId = o!.id;
  origineleFysiek = o!.fysieke_veiligheid;
  await opschonen();
});

afterAll(async () => {
  await opschonen();
});

describe("Controle van verplichte velden: database en schermen zijn het eens", () => {
  it("het lege AVF mist veel, het voorbeeld-AVF is compleet", async () => {
    const leeg = await admin.rpc("avf_ontbrekend", { p_avf_id: avfTest2 });
    expect((leeg.data as string[]).length).toBeGreaterThan(10);
    const vol = await admin.rpc("avf_ontbrekend", { p_avf_id: avfTest1 });
    expect(vol.data).toEqual([]);
  });

  it("de controle in de database en die in src/lib/avfVoortgang.ts geven voor elk AVF dezelfde uitkomst", async () => {
    const { data: lijst } = await admin.from("avf").select("id, projectgroep_id, cluster_id").in("cluster_id", [VD, TEST]);
    for (const a of lijst ?? []) {
      const [{ data: rij }, { data: fasen }, { data: onderdelen }, { data: rollen }] = await Promise.all([
        admin.from("avf").select("*").eq("id", a.id).single(),
        admin.from("avf_fase").select("*").eq("avf_id", a.id),
        admin.from("avf_onderdeel").select("*").eq("avf_id", a.id).order("volgorde"),
        admin.from("projectgroep_rol").select("namen").eq("projectgroep_id", a.projectgroep_id),
      ]);
      const inhoud = {
        titel: rij!.titel, verschijningsvorm: rij!.verschijningsvorm, publieke_samenvatting: rij!.publieke_samenvatting,
        organiserende_studenten: rij!.organiserende_studenten, doelgroep: rij!.doelgroep, aantal_deelnemers: rij!.aantal_deelnemers,
        contactpersoon: rij!.contactpersoon, beginsituatie: rij!.beginsituatie, doelen: rij!.doelen, veiligheid: rij!.veiligheid,
        organisatie: rij!.organisatie, communicatie: rij!.communicatie, fasen: fasen ?? [], onderdelen: onderdelen ?? [],
        rollenIngevuld: (rollen ?? []).filter((r) => (r.namen ?? "").trim() !== "").length,
      } as unknown as AvfInhoud;
      const ts = alleOntbrekend(voortgangPerSectie(inhoud)).length;
      const db = ((await admin.rpc("avf_ontbrekend", { p_avf_id: a.id })).data as string[]).length;
      expect(db > 0, `AVF ${a.id}`).toBe(ts > 0);
    }
  });
});

describe("Test 5 en 10: status en beoordeling lopen alleen via functies", () => {
  it("niemand kan de nieuwe tabellen rechtstreeks beschrijven", async () => {
    for (const gebruiker of ["vd-groep-1", "vd-stuur-programma", "docent", "vd-student"]) {
      const c = await inloggenAls(gebruiker);
      const v = await c.from("verbeterverzoek").insert({ avf_id: avfVd1, sectie: "A", projectgroeprol: "projectleider", tekst: "x", door_naam: "x" });
      const t = await c.from("themacheck").insert({ avf_id: avfVd1, stuurgroeprol_code: "projectleiding", oordeel: "akkoord", door_naam: "x" });
      const ver = await c.from("avf_versie").insert({ avf_id: avfVd1, versie: 9, inhoud: {}, ingediend_door_naam: "x" });
      expect(v.error, `${gebruiker} verbeterverzoek`).not.toBeNull();
      expect(t.error, `${gebruiker} themacheck`).not.toBeNull();
      expect(ver.error, `${gebruiker} avf_versie`).not.toBeNull();
    }
    const { data } = await admin.from("verbeterverzoek").select("id").eq("avf_id", avfVd1);
    expect(data).toHaveLength(0);
  });

  it("de projectgroep kan niet goedkeuren, geen aanpassing vragen en geen verzoek plaatsen", async () => {
    const goed = await rpc("vd-groep-1", "avf_goedkeuren", { p_avf_id: avfVd1, p_naam: naam });
    const vraag = await rpc("vd-groep-1", "avf_aanpassing_vragen", { p_avf_id: avfVd1, p_naam: naam });
    const plaats = await rpc("vd-groep-1", "verbeterverzoek_plaatsen", { p_avf_id: avfVd1, p_sectie: "A", p_onderdeel_id: null, p_veld_sleutel: null, p_rol: "projectleider", p_tekst: "x", p_naam: naam });
    const check = await rpc("vd-groep-1", "themacheck_zetten", { p_avf_id: avfVd1, p_rol: "projectleiding", p_oordeel: "akkoord", p_toelichting: null, p_naam: naam });
    for (const res of [goed, vraag, plaats, check]) expect(res.error).not.toBeNull();
    const { data } = await admin.from("avf").select("status").eq("id", avfVd1).single();
    expect(data?.status).toBe("in_ontwikkeling");
  });

  it("alleen de eigen projectgroep kan indienen", async () => {
    for (const gebruiker of ["vd-groep-2", "vd-stuur-programma", "docent", "vd-student", "vc-groep-1", "test-groep-1"]) {
      const res = await rpc(gebruiker, "avf_indienen", { p_avf_id: avfVd1, p_naam: naam, p_samenvatting: null });
      expect(res.error, gebruiker).not.toBeNull();
    }
    expect((await anoniem().rpc("avf_indienen", { p_avf_id: avfVd1, p_naam: naam, p_samenvatting: null })).error).not.toBeNull();
    const { data } = await admin.from("avf").select("status, versie").eq("id", avfVd1).single();
    expect(data).toEqual({ status: "in_ontwikkeling", versie: 0 });
  });

  it("stuurgroep van een ander cluster, student en projectgroep kunnen niets beoordelen", async () => {
    for (const gebruiker of ["vc-stuur-programma", "test-stuur", "vd-student", "vd-groep-2"]) {
      const res = await rpc(gebruiker, "verbeterverzoek_plaatsen", { p_avf_id: avfVd1, p_sectie: "A", p_onderdeel_id: null, p_veld_sleutel: null, p_rol: "projectleider", p_tekst: "x", p_naam: naam });
      expect(res.error, gebruiker).not.toBeNull();
      const goed = await rpc(gebruiker, "avf_goedkeuren", { p_avf_id: avfVd1, p_naam: naam });
      expect(goed.error, gebruiker).not.toBeNull();
    }
  });

  it("de nieuwe tabellen zijn alleen zichtbaar voor de eigen groep, de stuurgroep van het cluster en de docent", async () => {
    // verzoek en themacheck op het voorbeeld-AVF van TEST aanmaken met de service role (alleen om te lezen)
    await admin.from("verbeterverzoek").insert({ avf_id: avfTest1, sectie: "A", projectgroeprol: "projectleider", tekst: "Zichtbaarheid", door_naam: naam });
    await admin.from("themacheck").insert({ avf_id: avfTest1, stuurgroeprol_code: "projectleiding", oordeel: "akkoord", door_naam: naam });
    for (const gebruiker of ["test-groep-1", "test-stuur", "docent"]) {
      const c = await inloggenAls(gebruiker);
      expect((await c.from("verbeterverzoek").select("id").eq("avf_id", avfTest1)).data, gebruiker).toHaveLength(1);
      expect((await c.from("themacheck").select("avf_id").eq("avf_id", avfTest1)).data, gebruiker).toHaveLength(1);
    }
    for (const gebruiker of ["test-groep-2", "test-student", "vd-groep-1", "vd-stuur-programma", "vc-stuur-programma", "vd-student"]) {
      const c = await inloggenAls(gebruiker);
      expect((await c.from("verbeterverzoek").select("id").eq("avf_id", avfTest1)).data ?? [], gebruiker).toHaveLength(0);
      expect((await c.from("themacheck").select("avf_id").eq("avf_id", avfTest1)).data ?? [], gebruiker).toHaveLength(0);
    }
    expect((await anoniem().from("verbeterverzoek").select("id")).data ?? []).toHaveLength(0);
    await opschonen();
  });
});

describe("De hele keten: indienen, verzoek, aanpassen, opnieuw indienen, goedkeuren", () => {
  let verzoekSectie: string;
  let verzoekOnderdeel: string;

  it("indienen weigert een leeg AVF met de lijst van ontbrekende velden", async () => {
    const res = await rpc("test-groep-2", "avf_indienen", { p_avf_id: avfTest2, p_naam: naam, p_samenvatting: null });
    expect(res.r.ok).toBe(false);
    expect(res.r.reden).toBe("ontbreekt");
    expect(res.r.ontbrekend!.length).toBeGreaterThan(10);
    const { data } = await admin.from("avf").select("status, versie").eq("id", avfTest2).single();
    expect(data).toEqual({ status: "in_ontwikkeling", versie: 0 });
  });

  it("indienen vraagt een naam en zet daarna de status op ingediend met versie 1", async () => {
    expect((await rpc("test-groep-1", "avf_indienen", { p_avf_id: avfTest1, p_naam: " ", p_samenvatting: null })).r.reden).toBe("naam");
    const res = await rpc("test-groep-1", "avf_indienen", { p_avf_id: avfTest1, p_naam: naam, p_samenvatting: null });
    expect(res.r).toMatchObject({ ok: true, versie: 1 });
    const { data } = await admin.from("avf").select("status, versie, ingediend_door_naam").eq("id", avfTest1).single();
    expect(data).toEqual({ status: "ingediend", versie: 1, ingediend_door_naam: naam });
    const { data: versies } = await admin.from("avf_versie").select("versie, inhoud, wijzigingssamenvatting").eq("avf_id", avfTest1);
    expect(versies).toHaveLength(1);
    expect(Object.keys(versies![0].inhoud)).toEqual(expect.arrayContaining(["avf", "fasen", "onderdelen", "rolverdeling"]));
    // een tweede keer indienen kan niet; het AVF is vergrendeld
    expect((await rpc("test-groep-1", "avf_indienen", { p_avf_id: avfTest1, p_naam: naam, p_samenvatting: null })).r.reden).toBe("status");
    const wijzig = await (await inloggenAls("test-groep-1")).from("avf").update({ titel: "Te laat" }).eq("id", avfTest1).select();
    expect(wijzig.data ?? []).toHaveLength(0);
  });

  it("de versie is zichtbaar voor de eigen groep en de stuurgroep, niet voor anderen", async () => {
    for (const gebruiker of ["test-groep-1", "test-stuur", "docent"]) {
      expect(((await (await inloggenAls(gebruiker)).from("avf_versie").select("id").eq("avf_id", avfTest1)).data ?? []).length, gebruiker).toBe(1);
    }
    for (const gebruiker of ["test-groep-2", "test-student", "vd-stuur-programma"]) {
      expect(((await (await inloggenAls(gebruiker)).from("avf_versie").select("id").eq("avf_id", avfTest1)).data ?? []).length, gebruiker).toBe(0);
    }
  });

  it("aanpassing vragen kan alleen met een open verbeterverzoek", async () => {
    const zonder = await rpc("test-stuur", "avf_aanpassing_vragen", { p_avf_id: avfTest1, p_naam: naam });
    expect(zonder.r).toMatchObject({ ok: false, reden: "geen_open_verzoek" });

    const plaats = (sectie: string, onderdeel: string | null, tekst: string) =>
      rpc("test-stuur", "verbeterverzoek_plaatsen", { p_avf_id: avfTest1, p_sectie: sectie, p_onderdeel_id: onderdeel, p_veld_sleutel: null, p_rol: "veiligheid_ehbo", p_tekst: tekst, p_naam: naam });
    const a = await plaats("E", null, "Maak het weerplan concreter");
    const b = await plaats("D", onderdeelId, "Beschrijf de veiligheid van dit onderdeel beter");
    expect(a.r.ok && b.r.ok).toBe(true);
    verzoekSectie = a.r.id!;
    verzoekOnderdeel = b.r.id!;
    expect((await plaats("Z", null, "x")).r.reden).toBe("ongeldig");
    expect((await plaats("E", null, " ")).r.reden).toBe("ongeldig");
    expect((await plaats("E", onderdeelId.replace(/.$/, "0"), "x")).r.reden).toBe("ongeldig");

    const vraag = await rpc("test-stuur", "avf_aanpassing_vragen", { p_avf_id: avfTest1, p_naam: naam });
    expect(vraag.r.ok).toBe(true);
    const { data } = await admin.from("avf").select("status").eq("id", avfTest1).single();
    expect(data?.status).toBe("aanpassing_gevraagd");
  });

  it("een themacheck met aandachtspunt vraagt een toelichting en blokkeert niets", async () => {
    const zonder = await rpc("test-stuur", "themacheck_zetten", { p_avf_id: avfTest1, p_rol: "beleving_thema", p_oordeel: "aandachtspunt", p_toelichting: "", p_naam: naam });
    expect(zonder.r.reden).toBe("toelichting");
    const ok = await rpc("test-stuur", "themacheck_zetten", { p_avf_id: avfTest1, p_rol: "beleving_thema", p_oordeel: "aandachtspunt", p_toelichting: "Past nog niet bij het thema", p_naam: naam });
    expect(ok.r.ok).toBe(true);
    const nogmaals = await rpc("test-stuur", "themacheck_zetten", { p_avf_id: avfTest1, p_rol: "beleving_thema", p_oordeel: "akkoord", p_toelichting: null, p_naam: naam });
    expect(nogmaals.r.ok).toBe(true);
    const { data } = await admin.from("themacheck").select("oordeel").eq("avf_id", avfTest1).eq("stuurgroeprol_code", "beleving_thema");
    expect(data).toEqual([{ oordeel: "akkoord" }]); // één regel per rol, de laatste telt
  });

  it("een wijziging in de sectie zet het verzoek vanzelf op aangepast; het onderdeelverzoek blijft open", async () => {
    const groep = await inloggenAls("test-groep-1");
    const { data: rij } = await admin.from("avf").select("veiligheid").eq("id", avfTest1).single();
    const oud = (rij!.veiligheid as { weer?: { onweer?: { maatregel?: string } } }).weer?.onweer?.maatregel ?? null;
    const res = await groep.rpc("avf_veld_opslaan", { p_avf_id: avfTest1, p_sectie: "veiligheid", p_pad: ["weer", "onweer", "maatregel"], p_oud: oud, p_nieuw: "Aangescherpte maatregel" });
    expect((res.data as R).ok).toBe(true);

    const { data } = await groep.from("verbeterverzoek").select("id, status, aangepast_op").eq("avf_id", avfTest1);
    const per = Object.fromEntries((data ?? []).map((v) => [v.id, v]));
    expect(per[verzoekSectie].status).toBe("aangepast");
    expect(per[verzoekSectie].aangepast_op).not.toBeNull();
    expect(per[verzoekOnderdeel].status).toBe("open");
  });

  it("de projectgroep kan een verzoek niet zelf op aangepast of afgehandeld zetten", async () => {
    const upd = await (await inloggenAls("test-groep-1")).from("verbeterverzoek").update({ status: "afgehandeld" }).eq("id", verzoekOnderdeel).select();
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
    const fn = await rpc("test-groep-1", "verbeterverzoek_status_zetten", { p_id: verzoekOnderdeel, p_status: "afgehandeld", p_naam: naam });
    expect(fn.error).not.toBeNull();
    const { data } = await admin.from("verbeterverzoek").select("status").eq("id", verzoekOnderdeel).single();
    expect(data?.status).toBe("open");
  });

  it("opnieuw indienen: eerst de samenvatting, dan de melding met wat nog openstaat", async () => {
    const zonder = await rpc("test-groep-1", "avf_indienen", { p_avf_id: avfTest1, p_naam: naam, p_samenvatting: " " });
    expect(zonder.r.reden).toBe("samenvatting");

    const open = await rpc("test-groep-1", "avf_indienen", { p_avf_id: avfTest1, p_naam: naam, p_samenvatting: "Weerplan aangescherpt" });
    expect(open.r.ok).toBe(false);
    expect(open.r.reden).toBe("open_verzoeken");
    expect(open.r.verzoeken!.map((v) => v.id)).toEqual([verzoekOnderdeel]); // alleen wat niet is aangepast
    const { data: nog } = await admin.from("avf").select("status, versie").eq("id", avfTest1).single();
    expect(nog).toEqual({ status: "aanpassing_gevraagd", versie: 1 });
  });

  it("een wijziging aan het onderdeel zet ook dat verzoek op aangepast; daarna kan opnieuw ingediend worden", async () => {
    const groep = await inloggenAls("test-groep-1");
    const upd = await groep.from("avf_onderdeel").update({ fysieke_veiligheid: "Aangevuld door de groep" }).eq("id", onderdeelId).select("id");
    expect(upd.data).toHaveLength(1);
    const { data } = await admin.from("verbeterverzoek").select("status").eq("id", verzoekOnderdeel).single();
    expect(data?.status).toBe("aangepast");

    const res = await rpc("test-groep-1", "avf_indienen", { p_avf_id: avfTest1, p_naam: naam, p_samenvatting: "Weerplan en veiligheid aangescherpt" });
    expect(res.r).toMatchObject({ ok: true, versie: 2 });
    const { data: versies } = await admin.from("avf_versie").select("versie, wijzigingssamenvatting").eq("avf_id", avfTest1).order("versie");
    expect(versies).toEqual([{ versie: 1, wijzigingssamenvatting: null }, { versie: 2, wijzigingssamenvatting: "Weerplan en veiligheid aangescherpt" }]);
  });

  it("indienen mag ook als de groep bewust niets aanpast, na bevestiging", async () => {
    // terug naar aanpassing gevraagd met een nieuw verzoek dat de groep niet oppakt
    const plaats = await rpc("test-stuur", "verbeterverzoek_plaatsen", { p_avf_id: avfTest1, p_sectie: "H", p_onderdeel_id: null, p_veld_sleutel: null, p_rol: "corvee_communicatie", p_tekst: "Voeg het verzamelpunt toe", p_naam: naam });
    expect(plaats.r.ok).toBe(true);
    expect((await rpc("test-stuur", "avf_aanpassing_vragen", { p_avf_id: avfTest1, p_naam: naam })).r.ok).toBe(true);
    const zonder = await rpc("test-groep-1", "avf_indienen", { p_avf_id: avfTest1, p_naam: naam, p_samenvatting: "Niets aangepast" });
    expect(zonder.r.reden).toBe("open_verzoeken");
    const met = await rpc("test-groep-1", "avf_indienen", { p_avf_id: avfTest1, p_naam: naam, p_samenvatting: "Niets aangepast", p_open_bevestigd: true });
    expect(met.r).toMatchObject({ ok: true, versie: 3 });
  });

  it("goedkeuren vraagt een naam en een bevestiging bij open verzoeken, en legt alles vast", async () => {
    expect((await rpc("test-stuur", "avf_goedkeuren", { p_avf_id: avfTest1, p_naam: " " })).r.reden).toBe("naam");
    const open = await rpc("test-stuur", "avf_goedkeuren", { p_avf_id: avfTest1, p_naam: naam });
    expect(open.r).toMatchObject({ ok: false, reden: "open_verzoeken", aantal: 1 });
    const ok = await rpc("test-stuur", "avf_goedkeuren", { p_avf_id: avfTest1, p_naam: naam, p_open_bevestigd: true });
    expect(ok.r.ok).toBe(true);

    const { data } = await admin.from("avf").select("status, goedgekeurd_door_naam, goedgekeurd_door_account, goedgekeurd_op, opnieuw_te_controleren").eq("id", avfTest1).single();
    expect(data).toMatchObject({ status: "goedgekeurd", goedgekeurd_door_naam: naam, opnieuw_te_controleren: false });
    expect(data?.goedgekeurd_op).not.toBeNull();
    const { data: stuur } = await admin.from("account").select("id").eq("gebruikersnaam", "test-stuur").single();
    expect(data?.goedgekeurd_door_account).toBe(stuur!.id);
    const { data: verzoeken } = await admin.from("verbeterverzoek").select("status").eq("avf_id", avfTest1);
    expect(new Set(verzoeken?.map((v) => v.status))).toEqual(new Set(["afgehandeld"]));
    // al goedgekeurd en niets gewijzigd: opnieuw goedkeuren kan niet
    expect((await rpc("test-stuur", "avf_goedkeuren", { p_avf_id: avfTest1, p_naam: naam })).r.reden).toBe("status");
  });

  it("een goedgekeurd AVF blijft bewerkbaar; alleen wezenlijke wijzigingen geven 'Opnieuw te controleren'", async () => {
    const groep = await inloggenAls("test-groep-1");
    const vlag = async () => (await admin.from("avf").select("status, opnieuw_te_controleren").eq("id", avfTest1).single()).data;

    // gewone wijziging: titel
    const titel = await groep.from("avf").update({ titel: "Nieuwe titel" }).eq("id", avfTest1).select("titel");
    expect(titel.data).toHaveLength(1);
    expect(await vlag()).toEqual({ status: "goedgekeurd", opnieuw_te_controleren: false });
    await admin.from("avf").update({ titel: origineel.titel }).eq("id", avfTest1);

    // wezenlijk: verschijningsvorm
    const nieuweVorm = origineel.verschijningsvorm === "Show" ? "Spel" : "Show";
    expect((await groep.from("avf").update({ verschijningsvorm: nieuweVorm }).eq("id", avfTest1).select("id")).data).toHaveLength(1);
    expect(await vlag()).toEqual({ status: "goedgekeurd", opnieuw_te_controleren: true });

    // opnieuw goedkeuren haalt het label weg
    expect((await rpc("test-stuur", "avf_goedkeuren", { p_avf_id: avfTest1, p_naam: naam })).r.ok).toBe(true);
    expect(await vlag()).toEqual({ status: "goedgekeurd", opnieuw_te_controleren: false });

    // wezenlijk: fysieke veiligheid van een onderdeel
    expect((await groep.from("avf_onderdeel").update({ fysieke_veiligheid: "Nog een wijziging" }).eq("id", onderdeelId).select("id")).data).toHaveLength(1);
    expect((await vlag())?.opnieuw_te_controleren).toBe(true);
    await rpc("test-stuur", "avf_goedkeuren", { p_avf_id: avfTest1, p_naam: naam });

    // wezenlijk: onderdeel toevoegen en weer verwijderen
    const nieuw = await groep.rpc("avf_onderdeel_toevoegen", { p_avf_id: avfTest1, p_fase: "staart" });
    expect(nieuw.error).toBeNull();
    expect((await vlag())?.opnieuw_te_controleren).toBe(true);
    await rpc("test-stuur", "avf_goedkeuren", { p_avf_id: avfTest1, p_naam: naam });
    expect((await groep.from("avf_onderdeel").delete().eq("id", nieuw.data.id).select("id")).data).toHaveLength(1);
    expect((await vlag())?.opnieuw_te_controleren).toBe(true);
    await rpc("test-stuur", "avf_goedkeuren", { p_avf_id: avfTest1, p_naam: naam });

    // wezenlijk: sectie E
    const { data: rij } = await admin.from("avf").select("veiligheid").eq("id", avfTest1).single();
    const oud = (rij!.veiligheid as { weer?: { koel?: { maatregel?: string } } }).weer?.koel?.maatregel ?? null;
    await groep.rpc("avf_veld_opslaan", { p_avf_id: avfTest1, p_sectie: "veiligheid", p_pad: ["weer", "koel", "maatregel"], p_oud: oud, p_nieuw: "Extra laag" });
    expect((await vlag())?.opnieuw_te_controleren).toBe(true);
    await rpc("test-stuur", "avf_goedkeuren", { p_avf_id: avfTest1, p_naam: naam });

    // niet wezenlijk: beginsituatie
    const { data: b } = await admin.from("avf").select("beginsituatie").eq("id", avfTest1).single();
    const oudB = (b!.beginsituatie as { algemeen?: string }).algemeen ?? null;
    await groep.rpc("avf_veld_opslaan", { p_avf_id: avfTest1, p_sectie: "beginsituatie", p_pad: ["algemeen"], p_oud: oudB, p_nieuw: "Iets anders" });
    expect(await vlag()).toEqual({ status: "goedgekeurd", opnieuw_te_controleren: false });
    await admin.from("avf").update({ beginsituatie: b!.beginsituatie }).eq("id", avfTest1);
  });

  it("indienen, aanpassing vragen en goedkeuren staan in het logboek", async () => {
    const { data } = await (await inloggenAls("test-stuur")).from("wijziging").select("actie, naam").eq("record_id", avfTest1).eq("naam", naam);
    const acties = new Set(data?.map((l) => l.actie));
    for (const actie of ["avf_ingediend", "aanpassing_gevraagd", "avf_goedgekeurd", "verbeterverzoek_geplaatst", "themacheck"]) {
      expect(acties.has(actie), actie).toBe(true);
    }
    const { data: auto } = await admin.from("wijziging").select("actie").eq("record_id", avfTest1).eq("actie", "opnieuw_te_controleren");
    expect((auto ?? []).length).toBeGreaterThan(0);
    // een andere groep ziet het logboek niet
    const ander = await (await inloggenAls("test-groep-2")).from("wijziging").select("id").eq("record_id", avfTest1);
    expect(ander.data ?? []).toHaveLength(0);
  });
});
