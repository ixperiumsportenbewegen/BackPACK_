/**
 * Calamiteitenplan: lezen voor iedereen in het eigen cluster, schrijven alleen voor de stuurgroep van dat cluster en de
 * docent, alles via functies; per veld opslaan met een waarschuwing bij gelijktijdig wijzigen; logboek; groepsapp-link;
 * overnemen door de docent. Alle gegevens worden op het cluster TEST aangemaakt; VD en VC worden alleen gelezen of
 * krijgen verboden schrijfpogingen (die moeten mislukken).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anoniem, clusterId, inloggenAls } from "./helpers";

type R = { ok: boolean; reden?: string; huidig?: string | null; id?: string; velden?: number; regels?: number };

const naam = "Plantester";
let TEST: string, VD: string, VC: string;
let origineleLink: string | null = null;

const rpc = async (gebruiker: string, functie: string, args: Record<string, unknown>) => {
  const res = await (await inloggenAls(gebruiker)).rpc(functie, args);
  return { ...res, r: res.data as R };
};
const zetVeld = (gebruiker: string, cluster: string, sleutel: string, oud: string | null, nieuw: string | null) =>
  rpc(gebruiker, "calamiteit_veld_opslaan", { p_cluster_id: cluster, p_sleutel: sleutel, p_oud: oud, p_nieuw: nieuw, p_naam: naam });
const voegItemToe = (gebruiker: string, cluster: string, lijst: string) =>
  rpc(gebruiker, "calamiteit_item_toevoegen", { p_cluster_id: cluster, p_lijst: lijst, p_naam: naam });

async function opschonen() {
  await admin.from("calamiteit_veld").delete().eq("cluster_id", TEST);
  await admin.from("calamiteit_item").delete().eq("cluster_id", TEST);
  await admin.from("cluster").update({ whatsapp_link: origineleLink }).eq("id", TEST);
  await admin.from("wijziging").delete().eq("cluster_id", TEST).eq("naam", naam);
}

beforeAll(async () => {
  TEST = await clusterId("TEST");
  VD = await clusterId("VD");
  VC = await clusterId("VC");
  origineleLink = (await admin.from("cluster").select("whatsapp_link").eq("id", TEST).single()).data?.whatsapp_link ?? null;
  await opschonen();
});

afterAll(opschonen);

describe("Afscherming: lezen binnen het eigen cluster, schrijven alleen door de stuurgroep en de docent", () => {
  it("iedereen in het cluster leest het plan; een ander cluster en anoniem niet", async () => {
    await admin.from("calamiteit_veld").insert({ cluster_id: TEST, sleutel: "noodnummer", tekst: "Leestest", bijgewerkt_door_naam: naam });
    await admin.from("calamiteit_item").insert({ cluster_id: TEST, lijst: "contactpersonen", volgorde: 1, velden: { naam: "Leestest" }, bijgewerkt_door_naam: naam });
    for (const gebruiker of ["test-groep-1", "test-groep-2", "test-student", "test-stuur", "docent"]) {
      const c = await inloggenAls(gebruiker);
      expect((await c.from("calamiteit_veld").select("sleutel").eq("cluster_id", TEST)).data, gebruiker).toHaveLength(1);
      expect((await c.from("calamiteit_item").select("id").eq("cluster_id", TEST)).data, gebruiker).toHaveLength(1);
    }
    for (const gebruiker of ["vd-student", "vd-groep-1", "vd-stuur-programma", "vc-student", "vc-stuur-programma"]) {
      const c = await inloggenAls(gebruiker);
      expect((await c.from("calamiteit_veld").select("sleutel").eq("cluster_id", TEST)).data ?? [], gebruiker).toHaveLength(0);
      expect((await c.from("calamiteit_item").select("id").eq("cluster_id", TEST)).data ?? [], gebruiker).toHaveLength(0);
    }
    expect((await anoniem().from("calamiteit_veld").select("sleutel")).data ?? []).toHaveLength(0);
    expect((await anoniem().from("calamiteit_item").select("id")).data ?? []).toHaveLength(0);
    await opschonen();
  });

  it("niemand kan de tabellen rechtstreeks beschrijven", async () => {
    for (const gebruiker of ["test-groep-1", "test-student", "test-stuur", "docent", "vd-stuur-veiligheid"]) {
      const c = await inloggenAls(gebruiker);
      const ins = await c.from("calamiteit_veld").insert({ cluster_id: TEST, sleutel: "gehackt", tekst: "x" });
      const insItem = await c.from("calamiteit_item").insert({ cluster_id: TEST, lijst: "gehackt", volgorde: 1 });
      const upd = await c.from("calamiteit_veld").update({ tekst: "x" }).eq("cluster_id", TEST).select();
      const del = await c.from("calamiteit_item").delete().eq("cluster_id", TEST).select();
      expect(ins.error, `${gebruiker} insert veld`).not.toBeNull();
      expect(insItem.error, `${gebruiker} insert item`).not.toBeNull();
      expect(upd.error !== null || (upd.data ?? []).length === 0, `${gebruiker} update`).toBe(true);
      expect(del.error !== null || (del.data ?? []).length === 0, `${gebruiker} delete`).toBe(true);
    }
    expect((await admin.from("calamiteit_veld").select("sleutel").eq("cluster_id", TEST)).data).toHaveLength(0);
  });

  it("alleen de stuurgroep van het cluster en de docent kunnen via de functies schrijven", async () => {
    for (const gebruiker of ["test-groep-1", "test-groep-2", "test-student", "vd-stuur-veiligheid", "vc-stuur-programma", "vd-groep-1"]) {
      const veld = await zetVeld(gebruiker, TEST, "noodnummer", null, "Gehackt");
      const item = await voegItemToe(gebruiker, TEST, "contactpersonen");
      const link = await rpc(gebruiker, "cluster_whatsapp_link_zetten", { p_cluster_id: TEST, p_link: "https://chat.whatsapp.com/gehackt", p_naam: naam });
      expect(veld.error, `${gebruiker} veld`).not.toBeNull();
      expect(item.error, `${gebruiker} item`).not.toBeNull();
      expect(link.error, `${gebruiker} link`).not.toBeNull();
    }
    // de stuurgroep van TEST mag niet schrijven in een ander cluster
    for (const cluster of [VD, VC]) {
      expect((await zetVeld("test-stuur", cluster, "noodnummer", null, "Gehackt")).error).not.toBeNull();
      expect((await voegItemToe("test-stuur", cluster, "contactpersonen")).error).not.toBeNull();
      expect((await rpc("test-stuur", "cluster_whatsapp_link_zetten", { p_cluster_id: cluster, p_link: "https://chat.whatsapp.com/gehackt", p_naam: naam })).error).not.toBeNull();
    }
    expect((await anoniem().rpc("calamiteit_veld_opslaan", { p_cluster_id: TEST, p_sleutel: "noodnummer", p_oud: null, p_nieuw: "x", p_naam: naam })).error).not.toBeNull();
    expect((await admin.from("calamiteit_veld").select("sleutel").eq("cluster_id", TEST)).data).toHaveLength(0);
    expect((await admin.from("calamiteit_item").select("id").eq("cluster_id", TEST)).data).toHaveLength(0);
    expect((await admin.from("cluster").select("whatsapp_link").eq("id", TEST).single()).data?.whatsapp_link ?? null).toBe(origineleLink);
  });
});

describe("Tekstvelden: per veld opslaan met een waarschuwing bij gelijktijdig wijzigen", () => {
  it("slaat een veld op voor stuurgroep en docent en legt naam en wijziging vast", async () => {
    const res = await zetVeld("test-stuur", TEST, "noodnummer", null, "  Eerste tekst  ");
    expect(res.r).toEqual({ ok: true });
    const { data } = await admin.from("calamiteit_veld").select("tekst, bijgewerkt_door_naam").eq("cluster_id", TEST).eq("sleutel", "noodnummer").single();
    expect(data).toEqual({ tekst: "Eerste tekst", bijgewerkt_door_naam: naam });
    const docent = await zetVeld("docent", TEST, "noodnummer", "Eerste tekst", "Tweede tekst");
    expect(docent.r).toEqual({ ok: true });
    const { data: log } = await admin.from("wijziging").select("details, actie").eq("cluster_id", TEST).eq("naam", naam).eq("actie", "calamiteit_veld_gewijzigd").order("created_at");
    expect(log).toHaveLength(2);
    expect(log?.[1].details).toEqual({ sleutel: "noodnummer", oud: "Eerste tekst", nieuw: "Tweede tekst" });
  });

  it("geeft een conflict met de huidige waarde als iemand anders het veld net wijzigde, en overschrijft niets", async () => {
    const res = await zetVeld("test-stuur", TEST, "noodnummer", "Een oude waarde", "Mijn versie");
    expect(res.r).toMatchObject({ ok: false, reden: "conflict", huidig: "Tweede tekst" });
    const { data } = await admin.from("calamiteit_veld").select("tekst").eq("cluster_id", TEST).eq("sleutel", "noodnummer").single();
    expect(data?.tekst).toBe("Tweede tekst");
  });

  it("een lege waarde wist het veld, en een nog niet bestaand veld heeft een lege beginwaarde", async () => {
    expect((await zetVeld("test-stuur", TEST, "noodnummer", "Tweede tekst", "   ")).r).toEqual({ ok: true });
    expect((await admin.from("calamiteit_veld").select("tekst").eq("cluster_id", TEST).eq("sleutel", "noodnummer").single()).data?.tekst).toBeNull();
    expect((await zetVeld("test-stuur", TEST, "melden", "niet leeg", "x")).r).toMatchObject({ ok: false, reden: "conflict", huidig: null });
    expect((await zetVeld("test-stuur", TEST, "melden", null, "Melden in de groepsapp")).r).toEqual({ ok: true });
  });

  it("vraagt een naam en weigert een ongeldige sleutel of een te lange tekst", async () => {
    const args = (sleutel: string, nieuw: string, n = naam) => ({ p_cluster_id: TEST, p_sleutel: sleutel, p_oud: null, p_nieuw: nieuw, p_naam: n });
    expect((await rpc("test-stuur", "calamiteit_veld_opslaan", args("extern", "x", "  "))).r).toMatchObject({ ok: false, reden: "naam" });
    expect((await rpc("test-stuur", "calamiteit_veld_opslaan", args("Slechte Sleutel!", "x"))).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await rpc("test-stuur", "calamiteit_veld_opslaan", args("extern", "x".repeat(4001)))).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await admin.from("calamiteit_veld").select("sleutel").eq("cluster_id", TEST).eq("sleutel", "extern")).data).toHaveLength(0);
  });
});

describe("Lijsten: regels toevoegen, wijzigen, verplaatsen en verwijderen", () => {
  let ids: string[] = [];
  const volgorde = async () => (await admin.from("calamiteit_item").select("id, volgorde").eq("cluster_id", TEST).eq("lijst", "contactpersonen").order("volgorde")).data!;

  it("voegt regels achteraan toe met oplopende volgorde", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await voegItemToe(i === 1 ? "docent" : "test-stuur", TEST, "contactpersonen");
      expect(res.r.ok).toBe(true);
      ids.push(res.r.id!);
    }
    expect((await volgorde()).map((r) => r.id)).toEqual(ids);
    expect((await volgorde()).map((r) => r.volgorde)).toEqual([1, 2, 3]);
  });

  it("slaat een veld van een regel op, met een conflict bij een verouderde waarde", async () => {
    const zet = (oud: string | null, nieuw: string | null, veld = "naam") =>
      rpc("test-stuur", "calamiteit_item_veld_opslaan", { p_id: ids[0], p_veld: veld, p_oud: oud, p_nieuw: nieuw, p_naam: naam });
    expect((await zet(null, "Eerste contact")).r).toEqual({ ok: true });
    expect((await zet(null, "Mijn versie")).r).toMatchObject({ ok: false, reden: "conflict", huidig: "Eerste contact" });
    expect((await zet(null, "x", "Slecht Veld!")).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await zet(null, "0612345678", "telefoon")).r).toEqual({ ok: true });
    const { data } = await admin.from("calamiteit_item").select("velden").eq("id", ids[0]).single();
    expect(data?.velden).toEqual({ naam: "Eerste contact", telefoon: "0612345678" });
    // een veld leegmaken haalt het uit de regel
    expect((await zet("0612345678", " ", "telefoon")).r).toEqual({ ok: true });
    expect((await admin.from("calamiteit_item").select("velden").eq("id", ids[0]).single()).data?.velden).toEqual({ naam: "Eerste contact" });
  });

  it("verplaatst een regel omhoog en omlaag; bovenaan of onderaan gebeurt niets", async () => {
    const verplaats = (id: string, omhoog: boolean) => rpc("test-stuur", "calamiteit_item_verplaatsen", { p_id: id, p_omhoog: omhoog, p_naam: naam });
    expect((await verplaats(ids[2], true)).r.ok).toBe(true);
    expect((await volgorde()).map((r) => r.id)).toEqual([ids[0], ids[2], ids[1]]);
    expect((await verplaats(ids[0], true)).r.ok).toBe(true);
    expect((await verplaats(ids[1], false)).r.ok).toBe(true);
    expect((await volgorde()).map((r) => r.id)).toEqual([ids[0], ids[2], ids[1]]);
    expect((await verplaats(ids[0], false)).r.ok).toBe(true);
    expect((await volgorde()).map((r) => r.id)).toEqual([ids[2], ids[0], ids[1]]);
  });

  it("de stuurgroep van een ander cluster en een projectgroep kunnen een regel niet wijzigen, verplaatsen of verwijderen", async () => {
    for (const gebruiker of ["vd-stuur-veiligheid", "test-groep-1", "test-student"]) {
      expect((await rpc(gebruiker, "calamiteit_item_veld_opslaan", { p_id: ids[0], p_veld: "naam", p_oud: "Eerste contact", p_nieuw: "Gehackt", p_naam: naam })).error, gebruiker).not.toBeNull();
      expect((await rpc(gebruiker, "calamiteit_item_verplaatsen", { p_id: ids[0], p_omhoog: true, p_naam: naam })).error, gebruiker).not.toBeNull();
      expect((await rpc(gebruiker, "calamiteit_item_verwijderen", { p_id: ids[0], p_naam: naam })).error, gebruiker).not.toBeNull();
    }
    expect((await volgorde()).map((r) => r.id)).toEqual([ids[2], ids[0], ids[1]]);
  });

  it("verwijdert een regel en bewaart de inhoud in het logboek", async () => {
    expect((await rpc("test-stuur", "calamiteit_item_verwijderen", { p_id: ids[0], p_naam: naam })).r.ok).toBe(true);
    expect((await volgorde()).map((r) => r.id)).toEqual([ids[2], ids[1]]);
    const { data } = await admin.from("wijziging").select("details").eq("cluster_id", TEST).eq("naam", naam).eq("actie", "calamiteit_item_verwijderd");
    expect(data).toHaveLength(1);
    expect(data?.[0].details).toMatchObject({ lijst: "contactpersonen", velden: { naam: "Eerste contact" } });
    expect((await rpc("test-stuur", "calamiteit_item_verwijderen", { p_id: ids[0], p_naam: naam })).r).toMatchObject({ ok: false, reden: "ongeldig" });
  });

  it("een lijst heeft een maximum van 50 regels en een ongeldige lijstnaam wordt geweigerd", async () => {
    const rijen = Array.from({ length: 47 }, (_, i) => ({ cluster_id: TEST, lijst: "contactpersonen", volgorde: 100 + i, velden: {} }));
    await admin.from("calamiteit_item").insert(rijen);
    expect((await voegItemToe("test-stuur", TEST, "contactpersonen")).r.ok).toBe(true); // 2 + 47 = 49 regels, dus dit is de 50e
    expect((await voegItemToe("test-stuur", TEST, "contactpersonen")).r).toMatchObject({ ok: false, reden: "te_veel" });
    expect((await voegItemToe("test-stuur", TEST, "Slechte Lijst!")).r).toMatchObject({ ok: false, reden: "ongeldig" });
    ids = [];
  });
});

describe("Groepsapp-link", () => {
  it("de stuurgroep en de docent stellen een https-link in; ongeldige links worden geweigerd", async () => {
    const zet = (gebruiker: string, link: string | null) =>
      rpc(gebruiker, "cluster_whatsapp_link_zetten", { p_cluster_id: TEST, p_link: link, p_naam: naam });
    expect((await zet("test-stuur", "https://chat.whatsapp.com/abc123")).r.ok).toBe(true);
    expect((await admin.from("cluster").select("whatsapp_link").eq("id", TEST).single()).data?.whatsapp_link).toBe("https://chat.whatsapp.com/abc123");
    for (const slecht of ["http://chat.whatsapp.com/abc", "chat.whatsapp.com/abc", "https://chat whatsapp.com/abc", "javascript:alert(1)"]) {
      expect((await zet("docent", slecht)).r, slecht).toMatchObject({ ok: false, reden: "ongeldig" });
    }
    expect((await admin.from("cluster").select("whatsapp_link").eq("id", TEST).single()).data?.whatsapp_link).toBe("https://chat.whatsapp.com/abc123");
    expect((await zet("docent", "")).r.ok).toBe(true);
    expect((await admin.from("cluster").select("whatsapp_link").eq("id", TEST).single()).data?.whatsapp_link).toBeNull();
    expect((await zet("test-stuur", "https://chat.whatsapp.com/abc")).r.ok).toBe(true);
  });

  it("niemand kan de link rechtstreeks wijzigen", async () => {
    for (const gebruiker of ["test-stuur", "test-groep-1", "test-student"]) {
      const upd = await (await inloggenAls(gebruiker)).from("cluster").update({ whatsapp_link: "https://gehackt.example" }).eq("id", TEST).select();
      expect(upd.error !== null || (upd.data ?? []).length === 0, gebruiker).toBe(true);
    }
    expect((await admin.from("cluster").select("whatsapp_link").eq("id", TEST).single()).data?.whatsapp_link).toBe("https://chat.whatsapp.com/abc");
  });

  it("alle accounts in het cluster zien de link", async () => {
    for (const gebruiker of ["test-groep-1", "test-student", "test-stuur", "docent"]) {
      const { data } = await (await inloggenAls(gebruiker)).from("cluster").select("whatsapp_link").eq("id", TEST).single();
      expect(data?.whatsapp_link, gebruiker).toBe("https://chat.whatsapp.com/abc");
    }
  });
});

describe("Overnemen: de docent kopieert het plan van het ene cluster naar het andere", () => {
  it("alleen de docent mag het, en niet naar hetzelfde cluster", async () => {
    for (const gebruiker of ["test-stuur", "test-groep-1", "test-student", "vd-stuur-veiligheid"]) {
      expect((await rpc(gebruiker, "calamiteitenplan_overnemen", { p_van: VD, p_naar: TEST, p_naam: naam })).error, gebruiker).not.toBeNull();
    }
    expect((await anoniem().rpc("calamiteitenplan_overnemen", { p_van: VD, p_naar: TEST, p_naam: naam })).error).not.toBeNull();
    expect((await rpc("docent", "calamiteitenplan_overnemen", { p_van: TEST, p_naar: TEST, p_naam: naam })).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await rpc("docent", "calamiteitenplan_overnemen", { p_van: TEST, p_naar: TEST, p_naam: " " })).r).toMatchObject({ ok: false, reden: "naam" });
  });

  it("vervangt de inhoud van het doelcluster door die van het bron-cluster en laat het bron-cluster ongemoeid", async () => {
    // het plan van TEST bevat nu meerdere velden en regels; VD wordt alleen gelezen
    const tel = async (cluster: string) => ({
      velden: (await admin.from("calamiteit_veld").select("sleutel").eq("cluster_id", cluster)).data!.length,
      regels: (await admin.from("calamiteit_item").select("id").eq("cluster_id", cluster)).data!.length,
    });
    const voorTest = await tel(TEST);
    expect(voorTest.velden).toBeGreaterThan(0);
    expect(voorTest.regels).toBeGreaterThan(0);
    const voorVd = await tel(VD);
    const res = await rpc("docent", "calamiteitenplan_overnemen", { p_van: VD, p_naar: TEST, p_naam: naam });
    expect(res.r).toMatchObject({ ok: true, velden: voorVd.velden, regels: voorVd.regels });
    expect(await tel(TEST)).toEqual(voorVd);
    expect(await tel(VD)).toEqual(voorVd);
    // de groepsapp-link van TEST blijft staan: die wordt niet meegekopieerd
    expect((await admin.from("cluster").select("whatsapp_link").eq("id", TEST).single()).data?.whatsapp_link).toBe("https://chat.whatsapp.com/abc");
    const { data: log } = await admin.from("wijziging").select("details").eq("cluster_id", TEST).eq("naam", naam).eq("actie", "calamiteitenplan_overgenomen");
    expect(log).toHaveLength(1);
    expect(log?.[0].details).toMatchObject({ van: VD, velden: voorVd.velden, regels: voorVd.regels });
  });
});
