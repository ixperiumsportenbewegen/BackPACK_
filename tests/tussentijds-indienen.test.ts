/**
 * Tussentijds indienen ter feedback: de projectgroep dient een onvolledig AVF in, de stuurgroep geeft feedback en
 * geeft het terug (ook zonder verbeterverzoek), de projectgroep werkt verder en dient opnieuw in. Goedkeuren kan pas na
 * een definitieve indiening. Draait op het cluster TEST (test-groep-1 met het complete voorbeeld-AVF, test-groep-2 met
 * een leeg AVF) en zet na afloop alles terug.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anoniem, clusterId, inloggenAls } from "./helpers";

type R = { ok: boolean; reden?: string; versie?: number; verzoeken?: { id: string }[] };

const naam = "Tussentijdse Testpersoon";
let TEST: string;
let avfLeeg: string; // test-groep-2
let avfVol: string; // test-groep-1
let budgetVoor: { id: string; status: string; ingediend_door_naam: string | null; ingediend_op: string | null; besluit_toelichting: string | null }[] = [];

const rpc = async (gebruiker: string, functie: string, args: Record<string, unknown>) => {
  const res = await (await inloggenAls(gebruiker)).rpc(functie, args);
  return { ...res, r: res.data as R };
};
const feedback = (gebruiker: string, avf: string, samenvatting: string | null, extra: Record<string, unknown> = {}) =>
  rpc(gebruiker, "avf_ter_feedback_indienen", { p_avf_id: avf, p_naam: naam, p_samenvatting: samenvatting, ...extra });
const status = async (avf: string) => (await admin.from("avf").select("status, versie, tussentijds").eq("id", avf).single()).data!;

async function avfId(nummer: number): Promise<string> {
  const { data } = await admin.from("avf").select("id, projectgroep:projectgroep_id!inner(nummer)").eq("cluster_id", TEST).eq("projectgroep.nummer", nummer).single();
  return data!.id;
}

async function opschonen() {
  const ids = [avfLeeg, avfVol];
  await admin.from("verbeterverzoek").delete().in("avf_id", ids);
  await admin.from("themacheck").delete().in("avf_id", ids);
  await admin.from("avf_versie").delete().in("avf_id", ids);
  await admin.from("avf").update({
    status: "in_ontwikkeling", versie: 0, tussentijds: false, opnieuw_te_controleren: false, ingediend_op: null, ingediend_door_naam: null,
    goedgekeurd_op: null, goedgekeurd_door_naam: null, goedgekeurd_door_account: null,
  }).in("id", ids);
  for (const b of budgetVoor) {
    await admin.from("budgetaanvraag").update({
      status: b.status, ingediend_door_naam: b.ingediend_door_naam, ingediend_op: b.ingediend_op, besluit_toelichting: b.besluit_toelichting,
    }).eq("id", b.id);
  }
  await admin.from("wijziging").delete().in("record_id", ids).eq("naam", naam);
}

beforeAll(async () => {
  TEST = await clusterId("TEST");
  avfLeeg = await avfId(2);
  avfVol = await avfId(1);
  const { data } = await admin.from("budgetaanvraag").select("id, status, ingediend_door_naam, ingediend_op, besluit_toelichting").in("avf_id", [avfLeeg, avfVol]);
  budgetVoor = data ?? [];
  await opschonen();
});

afterAll(async () => {
  await opschonen();
});

describe("Afscherming: alleen de eigen projectgroep dient ter feedback in", () => {
  it("een andere groep, een groep van een ander cluster, de stuurgroep en een student kunnen niet ter feedback indienen", async () => {
    for (const gebruiker of ["test-groep-1", "vd-groep-1", "test-stuur", "test-student", "docent"]) {
      const { error } = await feedback(gebruiker, avfLeeg, "Een samenvatting");
      expect(error, gebruiker).not.toBeNull();
    }
    const { error } = await anoniem().rpc("avf_ter_feedback_indienen", { p_avf_id: avfLeeg, p_naam: naam, p_samenvatting: "x" });
    expect(error).not.toBeNull();
    expect((await status(avfLeeg)).status).toBe("in_ontwikkeling");
  });
});

describe("Een leeg AVF ter feedback indienen en teruggeven", () => {
  it("vraagt een naam en een samenvatting, ook bij de eerste keer", async () => {
    const zonderNaam = await rpc("test-groep-2", "avf_ter_feedback_indienen", { p_avf_id: avfLeeg, p_naam: "  ", p_samenvatting: "iets" });
    expect(zonderNaam.r).toMatchObject({ ok: false, reden: "naam" });
    const zonderSamenvatting = await feedback("test-groep-2", avfLeeg, "   ");
    expect(zonderSamenvatting.r).toMatchObject({ ok: false, reden: "samenvatting" });
    expect((await status(avfLeeg)).status).toBe("in_ontwikkeling");
  });

  it("kan met een onvolledig AVF, zet de status op ingediend ter feedback en bewaart de versie", async () => {
    // een volledige indiening is voor dit lege AVF niet mogelijk
    const volledig = await rpc("test-groep-2", "avf_indienen", { p_avf_id: avfLeeg, p_naam: naam, p_samenvatting: "x" });
    expect(volledig.r).toMatchObject({ ok: false, reden: "ontbreekt" });

    const res = await feedback("test-groep-2", avfLeeg, "Sectie A en B zijn klaar, graag feedback op de beginsituatie.");
    expect(res.r).toMatchObject({ ok: true, versie: 1 });
    expect(await status(avfLeeg)).toMatchObject({ status: "ingediend", versie: 1, tussentijds: true });
    const { data: versie } = await admin.from("avf_versie").select("tussentijds, wijzigingssamenvatting, ingediend_door_naam").eq("avf_id", avfLeeg).eq("versie", 1).single();
    expect(versie).toMatchObject({ tussentijds: true, ingediend_door_naam: naam });
    expect(versie?.wijzigingssamenvatting).toContain("beginsituatie");
  });

  it("tijdens de beoordeling kan de groep niet nog een keer indienen", async () => {
    const nogEens = await feedback("test-groep-2", avfLeeg, "Nog een keer");
    expect(nogEens.r).toMatchObject({ ok: false, reden: "status" });
    const volledig = await rpc("test-groep-2", "avf_indienen", { p_avf_id: avfLeeg, p_naam: naam, p_samenvatting: "x" });
    expect(volledig.r).toMatchObject({ ok: false, reden: "status" });
  });

  it("de stuurgroep kan een indiening ter feedback niet goedkeuren, een andere stuurgroep of de groep zelf ook niet", async () => {
    const res = await rpc("test-stuur", "avf_goedkeuren", { p_avf_id: avfLeeg, p_naam: naam, p_open_bevestigd: true });
    expect(res.r).toMatchObject({ ok: false, reden: "tussentijds" });
    expect((await status(avfLeeg)).status).toBe("ingediend");
    for (const gebruiker of ["test-groep-2", "vd-stuur-programma"]) {
      const { error } = await rpc(gebruiker, "avf_goedkeuren", { p_avf_id: avfLeeg, p_naam: naam });
      expect(error, gebruiker).not.toBeNull();
    }
    expect((await status(avfLeeg)).status).toBe("ingediend");
  });

  it("de stuurgroep kan zonder verbeterverzoek teruggeven; daarna kan de groep verder", async () => {
    const res = await rpc("test-stuur", "avf_aanpassing_vragen", { p_avf_id: avfLeeg, p_naam: naam });
    expect(res.r).toMatchObject({ ok: true });
    expect(await status(avfLeeg)).toMatchObject({ status: "aanpassing_gevraagd", versie: 1 });
    const { data: log } = await admin.from("wijziging").select("details").eq("record_id", avfLeeg).eq("actie", "aanpassing_gevraagd").eq("naam", naam);
    expect(log?.[0]?.details).toMatchObject({ ter_feedback: true });
  });

  it("opnieuw ter feedback indienen kan zo vaak als nodig, steeds met een samenvatting", async () => {
    const zonder = await feedback("test-groep-2", avfLeeg, null);
    expect(zonder.r).toMatchObject({ ok: false, reden: "samenvatting" });
    const tweede = await feedback("test-groep-2", avfLeeg, "Beginsituatie aangepast.");
    expect(tweede.r).toMatchObject({ ok: true, versie: 2 });
    expect((await rpc("test-stuur", "avf_aanpassing_vragen", { p_avf_id: avfLeeg, p_naam: naam })).r.ok).toBe(true);
    const derde = await feedback("test-groep-2", avfLeeg, "Doelen toegevoegd.");
    expect(derde.r).toMatchObject({ ok: true, versie: 3 });
    const { data } = await admin.from("avf_versie").select("versie, tussentijds").eq("avf_id", avfLeeg).order("versie");
    expect(data).toEqual([{ versie: 1, tussentijds: true }, { versie: 2, tussentijds: true }, { versie: 3, tussentijds: true }]);
  });

  it("een open verbeterverzoek geeft dezelfde bevestigingsvraag als bij de definitieve indiening", async () => {
    // de stuurgroep geeft terug met een verzoek; de groep dient in zonder iets aan te passen
    const verzoek = await rpc("test-stuur", "verbeterverzoek_plaatsen", {
      p_avf_id: avfLeeg, p_sectie: "A", p_onderdeel_id: null, p_veld_sleutel: null, p_rol: "projectleider", p_tekst: "Maak de titel specifieker.", p_naam: naam,
    });
    expect(verzoek.r.ok).toBe(true);
    expect((await rpc("test-stuur", "avf_aanpassing_vragen", { p_avf_id: avfLeeg, p_naam: naam })).r.ok).toBe(true);

    const zonderBevestiging = await feedback("test-groep-2", avfLeeg, "Niets aangepast.");
    expect(zonderBevestiging.r).toMatchObject({ ok: false, reden: "open_verzoeken" });
    expect(zonderBevestiging.r.verzoeken).toHaveLength(1);
    const metBevestiging = await feedback("test-groep-2", avfLeeg, "Niets aangepast.", { p_open_bevestigd: true });
    expect(metBevestiging.r).toMatchObject({ ok: true, versie: 4 });
  });
});

describe("Van feedback naar definitief: alleen na een definitieve indiening kan het AVF worden goedgekeurd", () => {
  it("het financieel plan gaat niet mee bij een indiening ter feedback", async () => {
    const voor = (await admin.from("budgetaanvraag").select("id, status").eq("avf_id", avfVol).eq("soort", "avf")).data ?? [];
    const res = await feedback("test-groep-1", avfVol, "Alles is ingevuld, we willen eerst feedback.");
    expect(res.r).toMatchObject({ ok: true, versie: 1 });
    const na = (await admin.from("budgetaanvraag").select("id, status").eq("avf_id", avfVol).eq("soort", "avf")).data ?? [];
    expect(na).toEqual(voor);
  });

  it("een compleet AVF dat ter feedback is ingediend kan ook niet worden goedgekeurd", async () => {
    const res = await rpc("test-stuur", "avf_goedkeuren", { p_avf_id: avfVol, p_naam: naam, p_open_bevestigd: true });
    expect(res.r).toMatchObject({ ok: false, reden: "tussentijds" });
  });

  it("de definitieve indiening haalt de markering ter feedback weg en daarna kan het worden goedgekeurd", async () => {
    expect((await rpc("test-stuur", "avf_aanpassing_vragen", { p_avf_id: avfVol, p_naam: naam })).r.ok).toBe(true);
    const zonderSamenvatting = await rpc("test-groep-1", "avf_indienen", { p_avf_id: avfVol, p_naam: naam, p_samenvatting: "" });
    expect(zonderSamenvatting.r).toMatchObject({ ok: false, reden: "samenvatting" }); // versie 2: samenvatting nodig
    const res = await rpc("test-groep-1", "avf_indienen", { p_avf_id: avfVol, p_naam: naam, p_samenvatting: "Definitief ingediend." });
    expect(res.r).toMatchObject({ ok: true, versie: 2 });
    expect(await status(avfVol)).toMatchObject({ status: "ingediend", versie: 2, tussentijds: false });
    const { data } = await admin.from("avf_versie").select("versie, tussentijds").eq("avf_id", avfVol).order("versie");
    expect(data).toEqual([{ versie: 1, tussentijds: true }, { versie: 2, tussentijds: false }]);

    // bij een definitieve indiening blijft een verbeterverzoek nodig om terug te geven
    const terug = await rpc("test-stuur", "avf_aanpassing_vragen", { p_avf_id: avfVol, p_naam: naam });
    expect(terug.r).toMatchObject({ ok: false, reden: "geen_open_verzoek" });

    const goed = await rpc("test-stuur", "avf_goedkeuren", { p_avf_id: avfVol, p_naam: naam });
    expect(goed.r).toMatchObject({ ok: true });
    expect((await status(avfVol)).status).toBe("goedgekeurd");
  });

  it("de versies zijn zichtbaar voor de eigen groep en de stuurgroep, niet voor andere groepen of clusters", async () => {
    for (const gebruiker of ["test-groep-1", "test-stuur"]) {
      const { data } = await (await inloggenAls(gebruiker)).from("avf_versie").select("versie, tussentijds").eq("avf_id", avfVol);
      expect(data?.length, gebruiker).toBe(2);
    }
    for (const gebruiker of ["test-groep-2", "vd-stuur-programma", "test-student"]) {
      const { data } = await (await inloggenAls(gebruiker)).from("avf_versie").select("versie").eq("avf_id", avfVol);
      expect(data ?? [], gebruiker).toHaveLength(0);
    }
  });

  it("de indieningen staan in het logboek", async () => {
    const { data } = await admin.from("wijziging").select("actie").in("record_id", [avfLeeg, avfVol]).eq("naam", naam);
    const acties = new Set(data?.map((r) => r.actie));
    expect(acties.has("avf_ter_feedback_ingediend")).toBe(true);
    expect(acties.has("avf_ingediend")).toBe(true);
    expect(acties.has("aanpassing_gevraagd")).toBe(true);
    expect(acties.has("avf_goedgekeurd")).toBe(true);
  });
});
