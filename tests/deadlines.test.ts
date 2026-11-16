/**
 * Deadlines: de stuurgroep stelt per cluster een deadline in voor elk deel van het AVF.
 * Afscherming: alle accounts van het cluster lezen, alleen de stuurgroep van het cluster en de docent stellen in,
 * en niets gaat zonder de functies (geen losse inserts of updates). Draait op het cluster TEST (en VD voor de
 * afscherming tussen clusters); elke test ruimt op wat hij aanmaakt.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anoniem, clusterId, inloggenAls } from "./helpers";

type R = {
  ok: boolean; reden?: string; updated_at?: string; verschoven?: boolean; ongewijzigd?: boolean;
  huidig_moment?: string | null; huidige_toelichting?: string | null; door?: string | null;
};

const NAAM = "Testpersoon";
const MOMENT = "2026-12-04T16:00:00Z"; // vrijdag 4 december 2026, 17:00 Nederlandse tijd
const LATER = "2026-12-11T16:00:00Z";
let TEST: string, VD: string;

const zet = async (gebruiker: string, cluster: string, onderdeel: string, moment: string | null, verwacht: string | null = null, extra: Record<string, unknown> = {}) => {
  const res = await (await inloggenAls(gebruiker)).rpc("deadline_zetten", {
    p_cluster_id: cluster, p_onderdeel: onderdeel, p_moment: moment, p_toelichting: null, p_naam: NAAM, p_verwacht: verwacht, ...extra,
  });
  return { ...res, r: res.data as R };
};
const wis = async (gebruiker: string, cluster: string, onderdeel: string, verwacht: string | null) => {
  const res = await (await inloggenAls(gebruiker)).rpc("deadline_wissen", { p_cluster_id: cluster, p_onderdeel: onderdeel, p_naam: NAAM, p_verwacht: verwacht });
  return { ...res, r: res.data as R };
};
const rij = async (cluster: string, onderdeel: string) =>
  (await admin.from("deadline").select("*").eq("cluster_id", cluster).eq("onderdeel", onderdeel).maybeSingle()).data;
const logboek = async (actie: string) =>
  (await admin.from("wijziging").select("naam, details, cluster_id").eq("tabel", "deadline").eq("actie", actie).eq("naam", NAAM)).data ?? [];

// Er kunnen al deadlines staan (bijvoorbeeld van een collega die test): die zetten we eerst opzij en daarna terug,
// zodat deze test ze nooit overschrijft of verwijdert.
let bewaard: Record<string, unknown>[] = [];

async function opschonen() {
  await admin.from("deadline").delete().in("cluster_id", [TEST, VD]);
  await admin.from("wijziging").delete().eq("tabel", "deadline").eq("naam", NAAM);
}

async function terugzetten() {
  await opschonen();
  if (bewaard.length) await admin.from("deadline").insert(bewaard);
}

beforeAll(async () => {
  TEST = await clusterId("TEST");
  VD = await clusterId("VD");
  bewaard = (await admin.from("deadline").select("*").in("cluster_id", [TEST, VD])).data ?? [];
  await opschonen();
});
afterAll(terugzetten);

describe("instellen: alleen de stuurgroep van het cluster en de docent", () => {
  it("de stuurgroep van het cluster stelt een deadline in; die staat in de database en in het logboek", async () => {
    const { r, error } = await zet("test-stuur", TEST, "A", MOMENT);
    expect(error).toBeNull();
    expect(r.ok).toBe(true);
    const d = await rij(TEST, "A");
    expect(new Date(d!.moment).toISOString()).toBe("2026-12-04T16:00:00.000Z");
    expect(d!.gezet_door_naam).toBe(NAAM);
    const log = await logboek("deadline_gezet");
    expect(log.length).toBe(1);
    expect(log[0].cluster_id).toBe(TEST);
  });

  it("de docent stelt in elk cluster in", async () => {
    const { r } = await zet("docent", VD, "H", MOMENT);
    expect(r.ok).toBe(true);
    expect((await rij(VD, "H"))?.gezet_door_naam).toBe(NAAM);
  });

  it("projectgroep, student, anonieme bezoeker en de stuurgroep van een ander cluster kunnen niets instellen of wissen", async () => {
    for (const gebruiker of ["test-groep-1", "test-student", "vd-groep-1", "vd-student"]) {
      const res = await zet(gebruiker, TEST, "B", MOMENT);
      expect(res.error?.code, gebruiker).toBe("42501");
    }
    const vd = await zet("vd-stuur-programma", TEST, "B", MOMENT); // stuurgroep van een ander cluster
    expect(vd.error?.code).toBe("42501");
    const tegenover = await zet("test-stuur", VD, "B", MOMENT); // en andersom
    expect(tegenover.error?.code).toBe("42501");
    const anon = await anoniem().rpc("deadline_zetten", { p_cluster_id: TEST, p_onderdeel: "B", p_moment: MOMENT, p_toelichting: null, p_naam: NAAM, p_verwacht: null });
    expect(anon.error).not.toBeNull();
    expect(await rij(TEST, "B")).toBeNull();

    const gewist = await wis("test-groep-1", TEST, "A", null);
    expect(gewist.error?.code).toBe("42501");
    expect(await rij(TEST, "A")).not.toBeNull();
  });

  it("losse inserts, updates en deletes op de tabel mogen niet, voor niemand", async () => {
    for (const gebruiker of ["test-stuur", "docent", "test-groep-1"]) {
      const client = await inloggenAls(gebruiker);
      const ins = await client.from("deadline").insert({ cluster_id: TEST, onderdeel: "C", moment: MOMENT, gezet_door_naam: NAAM });
      expect(ins.error, gebruiker).not.toBeNull();
      const upd = await client.from("deadline").update({ moment: LATER }).eq("cluster_id", TEST).eq("onderdeel", "A");
      expect(upd.error, gebruiker).not.toBeNull();
      const del = await client.from("deadline").delete().eq("cluster_id", TEST).eq("onderdeel", "A");
      expect(del.error, gebruiker).not.toBeNull();
    }
    expect(await rij(TEST, "C")).toBeNull();
    expect(new Date((await rij(TEST, "A"))!.moment).toISOString()).toBe("2026-12-04T16:00:00.000Z");
  });
});

describe("lezen: alle accounts van het cluster, de docent overal", () => {
  it("projectgroep, student en stuurgroep van TEST zien de deadline; andere clusters en anonieme bezoekers niet", async () => {
    for (const gebruiker of ["test-groep-1", "test-groep-2", "test-student", "test-stuur", "docent"]) {
      const { data, error } = await (await inloggenAls(gebruiker)).from("deadline").select("onderdeel").eq("cluster_id", TEST);
      expect(error, gebruiker).toBeNull();
      expect((data ?? []).map((x) => x.onderdeel), gebruiker).toContain("A");
    }
    for (const gebruiker of ["vd-groep-1", "vd-student", "vd-stuur-programma", "vc-groep-1"]) {
      const { data } = await (await inloggenAls(gebruiker)).from("deadline").select("onderdeel").eq("cluster_id", TEST);
      expect(data ?? [], gebruiker).toEqual([]);
    }
    const anon = await anoniem().from("deadline").select("onderdeel");
    expect(anon.data ?? []).toEqual([]);
  });

  it("de docent ziet beide clusters, een stuurgroep alleen het eigen cluster", async () => {
    const docent = await (await inloggenAls("docent")).from("deadline").select("cluster_id").in("cluster_id", [TEST, VD]);
    expect(new Set((docent.data ?? []).map((x) => x.cluster_id))).toEqual(new Set([TEST, VD]));
    const eigen = await (await inloggenAls("vd-stuur-programma")).from("deadline").select("cluster_id");
    expect((eigen.data ?? []).every((x) => x.cluster_id === VD)).toBe(true);
    expect((eigen.data ?? []).length).toBeGreaterThanOrEqual(1);
  });
});

describe("verschuiven, waarschuwen en wissen", () => {
  it("verschuiven kan met de updated_at die je zag, en komt als 'verschoven van … naar …' in het logboek", async () => {
    const eerst = (await rij(TEST, "A"))!;
    const { r } = await zet("test-stuur", TEST, "A", LATER, eerst.updated_at, { p_toelichting: "Na de herfstvakantie." });
    expect(r.ok).toBe(true);
    expect(r.verschoven).toBe(true);
    const nu = (await rij(TEST, "A"))!;
    expect(new Date(nu.moment).toISOString()).toBe("2026-12-11T16:00:00.000Z");
    expect(nu.toelichting).toBe("Na de herfstvakantie.");
    const log = (await logboek("deadline_verschoven"))[0];
    expect(new Date(log.details.van).toISOString()).toBe("2026-12-04T16:00:00.000Z");
    expect(new Date(log.details.naar).toISOString()).toBe("2026-12-11T16:00:00.000Z");
  });

  it("alleen de toelichting aanpassen telt niet als verschuiven", async () => {
    const eerst = (await rij(TEST, "A"))!;
    const { r } = await zet("test-stuur", TEST, "A", LATER, eerst.updated_at, { p_toelichting: "Andere uitleg." });
    expect(r.ok).toBe(true);
    expect(r.verschoven).toBe(false);
    expect((await logboek("deadline_toelichting")).length).toBe(1);
  });

  it("wijziging op de oude versie geeft een waarschuwing en overschrijft niets", async () => {
    const oud = new Date(Date.parse((await rij(TEST, "A"))!.updated_at) - 60_000).toISOString();
    const { r } = await zet("test-stuur", TEST, "A", MOMENT, oud);
    expect(r.ok).toBe(false);
    expect(r.reden).toBe("conflict");
    expect(r.door).toBe(NAAM);
    expect(new Date(r.huidig_moment!).toISOString()).toBe("2026-12-11T16:00:00.000Z");
    expect(new Date((await rij(TEST, "A"))!.moment).toISOString()).toBe("2026-12-11T16:00:00.000Z");
    // zonder te weten dat er al een deadline is, mag je hem ook niet zomaar overschrijven
    const nieuw = await zet("test-stuur", TEST, "A", MOMENT, null);
    expect(nieuw.r.reden).toBe("conflict");
  });

  it("een naam is verplicht en onzinnige invoer wordt geweigerd", async () => {
    const zonderNaam = await (await inloggenAls("test-stuur")).rpc("deadline_zetten", {
      p_cluster_id: TEST, p_onderdeel: "C", p_moment: MOMENT, p_toelichting: null, p_naam: "  ", p_verwacht: null,
    });
    expect((zonderNaam.data as R).reden).toBe("naam");
    expect((await zet("test-stuur", TEST, "Z", MOMENT)).r.reden).toBe("ongeldig");
    expect((await zet("test-stuur", TEST, "C", "2099-01-01T00:00:00Z")).r.reden).toBe("moment");
    expect((await zet("test-stuur", TEST, "C", "2020-01-01T00:00:00Z")).r.reden).toBe("moment");
    expect((await zet("test-stuur", TEST, "C", null)).r.reden).toBe("moment");
    expect((await zet("test-stuur", TEST, "C", MOMENT, null, { p_toelichting: "x".repeat(201) })).r.reden).toBe("toelichting");
    expect(await rij(TEST, "C")).toBeNull();
  });

  it("een deadlinemoment in het verleden mag (het is een afspraak, geen slot)", async () => {
    const { r } = await zet("test-stuur", TEST, "D", "2026-02-01T10:00:00Z");
    expect(r.ok).toBe(true);
  });

  it("wissen kan met de juiste versie, niet met een oude, en komt in het logboek", async () => {
    const d = (await rij(TEST, "D"))!;
    const oud = await wis("test-stuur", TEST, "D", new Date(Date.parse(d.updated_at) - 60_000).toISOString());
    expect(oud.r.reden).toBe("conflict");
    expect(await rij(TEST, "D")).not.toBeNull();
    const goed = await wis("test-stuur", TEST, "D", d.updated_at);
    expect(goed.r.ok).toBe(true);
    expect(await rij(TEST, "D")).toBeNull();
    expect((await logboek("deadline_gewist")).length).toBe(1);
  });

  it("elke combinatie van cluster en onderdeel bestaat maar één keer", async () => {
    const dubbel = await admin.from("deadline").insert({ cluster_id: TEST, onderdeel: "A", moment: MOMENT, gezet_door_naam: NAAM });
    expect(dubbel.error?.code).toBe("23505");
  });
});
