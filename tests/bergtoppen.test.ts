/**
 * De 10 bergtoppen van de Ardennen (gedragsafspraken): het concept is alleen voor de stuurgroep van het cluster en de docent,
 * de gepubliceerde versie voor iedereen in het cluster; publiceren alleen als alles is ingevuld, met versienummers; intrekken;
 * de link naar het inschrijfformulier; overnemen door de docent. Alles wordt op het cluster TEST aangemaakt (en op een tijdelijk
 * bron-cluster voor het overnemen); VD en VC krijgen alleen verboden schrijfpogingen (die moeten mislukken).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anoniem, clusterId, inloggenAls } from "./helpers";

type R = { ok: boolean; reden?: string; huidig?: string | null; versie?: number; ontbrekend?: string[]; velden?: number };

const naam = "Bergtoppentester";
let TEST: string, VD: string, VC: string;
let origineleLink: string | null = null;

const rpc = async (gebruiker: string, functie: string, args: Record<string, unknown>) => {
  const res = await (await inloggenAls(gebruiker)).rpc(functie, args);
  return { ...res, r: res.data as R };
};
const zet = (gebruiker: string, cluster: string, sleutel: string, oud: string | null, nieuw: string | null) =>
  rpc(gebruiker, "bergtop_veld_opslaan", { p_cluster_id: cluster, p_sleutel: sleutel, p_oud: oud, p_nieuw: nieuw, p_naam: naam });
const publiceer = (gebruiker: string, cluster = TEST) => rpc(gebruiker, "bergtop_publiceren", { p_cluster_id: cluster, p_naam: naam });
const trekIn = (gebruiker: string, cluster = TEST) => rpc(gebruiker, "bergtop_intrekken", { p_cluster_id: cluster, p_naam: naam });

/** Alle 10 toppen en de toelichting rechtstreeks in een cluster zetten (service role), met een eigen tekst per top. */
async function vul(cluster: string, voorvoegsel = "Test") {
  const rijen = Array.from({ length: 10 }, (_, i) => [
    { cluster_id: cluster, sleutel: `top_${i + 1}_titel`, tekst: `${voorvoegsel} titel ${i + 1}`, bijgewerkt_door_naam: naam },
    { cluster_id: cluster, sleutel: `top_${i + 1}_afspraak`, tekst: `  ${voorvoegsel} afspraak ${i + 1}  `, bijgewerkt_door_naam: naam },
  ]).flat();
  rijen.push({ cluster_id: cluster, sleutel: "toelichting_titel", tekst: "Het dal", bijgewerkt_door_naam: naam });
  rijen.push({ cluster_id: cluster, sleutel: "toelichting", tekst: `${voorvoegsel} toelichting`, bijgewerkt_door_naam: naam });
  await admin.from("bergtop_veld").upsert(rijen);
}

async function opschonen() {
  await admin.from("bergtop_veld").delete().eq("cluster_id", TEST);
  await admin.from("bergtop_publicatie").delete().eq("cluster_id", TEST);
  await admin.from("cluster").update({ inschrijf_link: origineleLink }).eq("id", TEST);
  await admin.from("wijziging").delete().eq("cluster_id", TEST).eq("naam", naam);
}

beforeAll(async () => {
  TEST = await clusterId("TEST");
  VD = await clusterId("VD");
  VC = await clusterId("VC");
  origineleLink = (await admin.from("cluster").select("inschrijf_link").eq("id", TEST).single()).data?.inschrijf_link ?? null;
  await opschonen();
});

afterAll(opschonen);

describe("Afscherming: het concept alleen voor de stuurgroep en de docent, de publicatie voor het hele cluster", () => {
  it("het concept is alleen te lezen door de stuurgroep van het cluster en de docent", async () => {
    await vul(TEST);
    for (const gebruiker of ["test-stuur", "docent"]) {
      const { data } = await (await inloggenAls(gebruiker)).from("bergtop_veld").select("sleutel").eq("cluster_id", TEST);
      expect(data, gebruiker).toHaveLength(22);
    }
    for (const gebruiker of ["test-groep-1", "test-groep-2", "test-student", "vd-student", "vd-groep-1", "vd-stuur-programma", "vc-stuur-programma"]) {
      const { data } = await (await inloggenAls(gebruiker)).from("bergtop_veld").select("sleutel").eq("cluster_id", TEST);
      expect(data ?? [], gebruiker).toHaveLength(0);
    }
    expect((await anoniem().from("bergtop_veld").select("sleutel")).data ?? []).toHaveLength(0);
  });

  it("de gepubliceerde versie is voor het hele cluster te lezen zolang hij zichtbaar is, en niet voor een ander cluster", async () => {
    await admin.from("bergtop_publicatie").insert({ cluster_id: TEST, versie: 1, inhoud: { toppen: [] }, gepubliceerd_door_naam: naam });
    for (const gebruiker of ["test-groep-1", "test-groep-2", "test-student", "test-stuur", "docent"]) {
      const { data } = await (await inloggenAls(gebruiker)).from("bergtop_publicatie").select("versie").eq("cluster_id", TEST);
      expect(data, gebruiker).toHaveLength(1);
    }
    for (const gebruiker of ["vd-student", "vd-groep-1", "vd-stuur-programma", "vc-student"]) {
      const { data } = await (await inloggenAls(gebruiker)).from("bergtop_publicatie").select("versie").eq("cluster_id", TEST);
      expect(data ?? [], gebruiker).toHaveLength(0);
    }
    // ingetrokken: studenten en projectgroepen zien hem niet meer, de stuurgroep en de docent wel
    await admin.from("bergtop_publicatie").update({ zichtbaar: false }).eq("cluster_id", TEST);
    for (const gebruiker of ["test-groep-1", "test-student"]) {
      const { data } = await (await inloggenAls(gebruiker)).from("bergtop_publicatie").select("versie").eq("cluster_id", TEST);
      expect(data ?? [], gebruiker).toHaveLength(0);
    }
    for (const gebruiker of ["test-stuur", "docent"]) {
      const { data } = await (await inloggenAls(gebruiker)).from("bergtop_publicatie").select("versie").eq("cluster_id", TEST);
      expect(data, gebruiker).toHaveLength(1);
    }
    expect((await anoniem().from("bergtop_publicatie").select("versie")).data ?? []).toHaveLength(0);
    await opschonen();
  });

  it("niemand kan de tabellen rechtstreeks beschrijven", async () => {
    for (const gebruiker of ["test-groep-1", "test-student", "test-stuur", "docent", "vd-stuur-veiligheid"]) {
      const c = await inloggenAls(gebruiker);
      const ins = await c.from("bergtop_veld").insert({ cluster_id: TEST, sleutel: "toelichting", tekst: "Gehackt" });
      const insPub = await c.from("bergtop_publicatie").insert({ cluster_id: TEST, versie: 1, inhoud: {}, gepubliceerd_door_naam: "x" });
      const upd = await c.from("bergtop_veld").update({ tekst: "Gehackt" }).eq("cluster_id", TEST).select();
      const del = await c.from("bergtop_publicatie").delete().eq("cluster_id", TEST).select();
      expect(ins.error, `${gebruiker} insert veld`).not.toBeNull();
      expect(insPub.error, `${gebruiker} insert publicatie`).not.toBeNull();
      expect(upd.error !== null || (upd.data ?? []).length === 0, `${gebruiker} update`).toBe(true);
      expect(del.error !== null || (del.data ?? []).length === 0, `${gebruiker} delete`).toBe(true);
    }
    expect((await admin.from("bergtop_veld").select("sleutel").eq("cluster_id", TEST)).data).toHaveLength(0);
    expect((await admin.from("bergtop_publicatie").select("cluster_id").eq("cluster_id", TEST)).data).toHaveLength(0);
  });

  it("alleen de stuurgroep van het cluster en de docent kunnen schrijven, publiceren en intrekken", async () => {
    await vul(TEST);
    for (const gebruiker of ["test-groep-1", "test-groep-2", "test-student", "vd-stuur-veiligheid", "vc-stuur-programma", "vd-groep-1"]) {
      expect((await zet(gebruiker, TEST, "top_1_titel", "Test titel 1", "Gehackt")).error, `${gebruiker} veld`).not.toBeNull();
      expect((await publiceer(gebruiker)).error, `${gebruiker} publiceren`).not.toBeNull();
      expect((await trekIn(gebruiker)).error, `${gebruiker} intrekken`).not.toBeNull();
      expect((await rpc(gebruiker, "cluster_inschrijf_link_zetten", { p_cluster_id: TEST, p_link: "https://forms.example/gehackt", p_naam: naam })).error, `${gebruiker} link`).not.toBeNull();
    }
    // de stuurgroep van TEST mag niet schrijven in een ander cluster
    for (const cluster of [VD, VC]) {
      expect((await zet("test-stuur", cluster, "top_1_titel", null, "Gehackt")).error).not.toBeNull();
      expect((await publiceer("test-stuur", cluster)).error).not.toBeNull();
      expect((await rpc("test-stuur", "cluster_inschrijf_link_zetten", { p_cluster_id: cluster, p_link: "https://forms.example/gehackt", p_naam: naam })).error).not.toBeNull();
    }
    expect((await anoniem().rpc("bergtop_publiceren", { p_cluster_id: TEST, p_naam: naam })).error).not.toBeNull();
    expect((await admin.from("bergtop_veld").select("tekst").eq("cluster_id", TEST).eq("sleutel", "top_1_titel").single()).data?.tekst).toBe("Test titel 1");
    expect((await admin.from("bergtop_publicatie").select("cluster_id").eq("cluster_id", TEST)).data).toHaveLength(0);
    await opschonen();
  });
});

describe("Het concept invullen", () => {
  it("slaat een veld per keer op met naam en logboek, en geeft een conflict bij een verouderde waarde", async () => {
    expect((await zet("test-stuur", TEST, "top_1_titel", null, "  Zorg voor elkaar  ")).r).toEqual({ ok: true });
    expect((await zet("docent", TEST, "top_1_afspraak", null, "We helpen elkaar bij alles.")).r).toEqual({ ok: true });
    const { data } = await admin.from("bergtop_veld").select("sleutel, tekst, bijgewerkt_door_naam").eq("cluster_id", TEST).order("sleutel");
    expect(data).toEqual([
      { sleutel: "top_1_afspraak", tekst: "We helpen elkaar bij alles.", bijgewerkt_door_naam: naam },
      { sleutel: "top_1_titel", tekst: "Zorg voor elkaar", bijgewerkt_door_naam: naam },
    ]);
    expect((await zet("test-stuur", TEST, "top_1_titel", "Een oude waarde", "Mijn versie")).r).toMatchObject({ ok: false, reden: "conflict", huidig: "Zorg voor elkaar" });
    expect((await zet("test-stuur", TEST, "top_1_titel", "Zorg voor elkaar", "   ")).r).toEqual({ ok: true });
    expect((await admin.from("bergtop_veld").select("tekst").eq("cluster_id", TEST).eq("sleutel", "top_1_titel").single()).data?.tekst).toBeNull();
    const { data: log } = await admin.from("wijziging").select("details").eq("cluster_id", TEST).eq("naam", naam).eq("actie", "bergtop_veld_gewijzigd").order("created_at");
    expect(log).toHaveLength(3);
    expect(log?.[0].details).toEqual({ sleutel: "top_1_titel", oud: null, nieuw: "Zorg voor elkaar" });
  });

  it("weigert onbekende sleutels (er zijn precies 10 toppen), te lange teksten en een lege naam", async () => {
    for (const sleutel of ["top_0_titel", "top_11_titel", "top_1_foo", "toelichting2", "Top_1_titel", "x"]) {
      expect((await zet("test-stuur", TEST, sleutel, null, "x")).r, sleutel).toMatchObject({ ok: false, reden: "ongeldig" });
    }
    expect((await zet("test-stuur", TEST, "top_2_titel", null, "x".repeat(81))).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await zet("test-stuur", TEST, "top_2_afspraak", null, "x".repeat(301))).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await zet("test-stuur", TEST, "toelichting_titel", null, "x".repeat(81))).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await zet("test-stuur", TEST, "toelichting", null, "x".repeat(3001))).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await zet("test-stuur", TEST, "toelichting", null, "x".repeat(3000))).r).toEqual({ ok: true });
    const zonderNaam = await rpc("test-stuur", "bergtop_veld_opslaan", { p_cluster_id: TEST, p_sleutel: "top_2_titel", p_oud: null, p_nieuw: "x", p_naam: "  " });
    expect(zonderNaam.r).toMatchObject({ ok: false, reden: "naam" });
    expect((await admin.from("bergtop_veld").select("sleutel").eq("cluster_id", TEST).eq("sleutel", "top_2_titel")).data).toHaveLength(0);
  });
});

describe("Publiceren, aanpassen, opnieuw publiceren en intrekken", () => {
  it("publiceren kan pas als alle 10 toppen en de toelichting zijn ingevuld", async () => {
    await opschonen();
    await zet("test-stuur", TEST, "top_1_titel", null, "Alleen een titel");
    await zet("test-stuur", TEST, "top_2_titel", null, "Titel zonder afspraak");
    const res = await publiceer("test-stuur");
    expect(res.r).toMatchObject({ ok: false, reden: "onvolledig" });
    expect(res.r.ontbrekend).toEqual(["top 1", "top 2", "top 3", "top 4", "top 5", "top 6", "top 7", "top 8", "top 9", "top 10", "toelichting"]);
    expect((await admin.from("bergtop_publicatie").select("cluster_id").eq("cluster_id", TEST)).data).toHaveLength(0);
    // een veld met alleen spaties telt niet als ingevuld
    await vul(TEST);
    await admin.from("bergtop_veld").update({ tekst: "   " }).eq("cluster_id", TEST).eq("sleutel", "top_7_afspraak");
    expect((await publiceer("test-stuur")).r).toMatchObject({ ok: false, reden: "onvolledig", ontbrekend: ["top 7"] });
    await admin.from("bergtop_veld").update({ tekst: "Test afspraak 7" }).eq("cluster_id", TEST).eq("sleutel", "top_7_afspraak");
  });

  it("publiceren maakt versie 1 met de 10 toppen en de toelichting; studenten lezen die, maar niet het concept", async () => {
    const res = await publiceer("test-stuur");
    expect(res.r).toEqual({ ok: true, versie: 1 });
    const student = await inloggenAls("test-student");
    const { data } = await student.from("bergtop_publicatie").select("versie, inhoud, gepubliceerd_door_naam, zichtbaar").eq("cluster_id", TEST).single();
    expect(data).toMatchObject({ versie: 1, gepubliceerd_door_naam: naam, zichtbaar: true });
    const inhoud = data!.inhoud as { toppen: { nummer: number; titel: string; afspraak: string }[]; toelichting_titel: string; toelichting: string };
    expect(inhoud.toppen).toHaveLength(10);
    expect(inhoud.toppen.map((t) => t.nummer)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(inhoud.toppen[0]).toEqual({ nummer: 1, titel: "Test titel 1", afspraak: "Test afspraak 1" }); // opgeschoond
    expect(inhoud.toelichting_titel).toBe("Het dal");
    expect(inhoud.toelichting).toBe("Test toelichting");
    expect((await student.from("bergtop_veld").select("sleutel").eq("cluster_id", TEST)).data ?? []).toHaveLength(0);
  });

  it("aanpassen verandert wat studenten lezen pas na opnieuw publiceren (versie 2)", async () => {
    expect((await zet("test-stuur", TEST, "top_1_titel", "Test titel 1", "Aangepaste titel")).r).toEqual({ ok: true });
    const student = await inloggenAls("test-student");
    const lees = async () => (await student.from("bergtop_publicatie").select("versie, inhoud").eq("cluster_id", TEST).single()).data as { versie: number; inhoud: { toppen: { titel: string }[] } };
    expect((await lees()).inhoud.toppen[0].titel).toBe("Test titel 1"); // nog de oude tekst
    expect((await publiceer("docent")).r).toEqual({ ok: true, versie: 2 });
    const nu = await lees();
    expect(nu.versie).toBe(2);
    expect(nu.inhoud.toppen[0].titel).toBe("Aangepaste titel");
  });

  it("intrekken maakt de versie onzichtbaar voor studenten; opnieuw publiceren geeft een volgende versie", async () => {
    expect((await trekIn("test-stuur")).r).toEqual({ ok: true });
    for (const gebruiker of ["test-student", "test-groep-1"]) {
      expect((await (await inloggenAls(gebruiker)).from("bergtop_publicatie").select("versie").eq("cluster_id", TEST)).data ?? [], gebruiker).toHaveLength(0);
    }
    expect((await (await inloggenAls("test-stuur")).from("bergtop_publicatie").select("versie, zichtbaar").eq("cluster_id", TEST).single()).data).toEqual({ versie: 2, zichtbaar: false });
    expect((await trekIn("test-stuur")).r).toMatchObject({ ok: false, reden: "niet_gepubliceerd" });
    expect((await publiceer("test-stuur")).r).toEqual({ ok: true, versie: 3 });
    expect((await (await inloggenAls("test-student")).from("bergtop_publicatie").select("versie").eq("cluster_id", TEST).single()).data?.versie).toBe(3);
  });

  it("publiceren zonder naam kan niet, en alles staat in het logboek", async () => {
    expect((await rpc("test-stuur", "bergtop_publiceren", { p_cluster_id: TEST, p_naam: " " })).r).toMatchObject({ ok: false, reden: "naam" });
    expect((await rpc("test-stuur", "bergtop_intrekken", { p_cluster_id: TEST, p_naam: " " })).r).toMatchObject({ ok: false, reden: "naam" });
    const { data } = await admin.from("wijziging").select("actie").eq("cluster_id", TEST).eq("naam", naam).in("actie", ["bergtoppen_gepubliceerd", "bergtoppen_ingetrokken"]);
    expect(data?.filter((r) => r.actie === "bergtoppen_gepubliceerd")).toHaveLength(3);
    expect(data?.filter((r) => r.actie === "bergtoppen_ingetrokken")).toHaveLength(1);
  });
});

describe("Link naar het inschrijfformulier", () => {
  it("de stuurgroep en de docent stellen een https-link in; alle accounts in het cluster zien hem; niemand kan hem rechtstreeks wijzigen", async () => {
    const zetLink = (gebruiker: string, link: string | null) => rpc(gebruiker, "cluster_inschrijf_link_zetten", { p_cluster_id: TEST, p_link: link, p_naam: naam });
    expect((await zetLink("test-stuur", "https://forms.example/inschrijven")).r.ok).toBe(true);
    for (const slecht of ["http://forms.example/x", "forms.example/x", "https://forms example/x", "javascript:alert(1)"]) {
      expect((await zetLink("docent", slecht)).r, slecht).toMatchObject({ ok: false, reden: "ongeldig" });
    }
    for (const gebruiker of ["test-groep-1", "test-student", "test-stuur", "docent"]) {
      expect((await (await inloggenAls(gebruiker)).from("cluster").select("inschrijf_link").eq("id", TEST).single()).data?.inschrijf_link, gebruiker).toBe("https://forms.example/inschrijven");
    }
    for (const gebruiker of ["test-stuur", "test-groep-1", "test-student"]) {
      const upd = await (await inloggenAls(gebruiker)).from("cluster").update({ inschrijf_link: "https://gehackt.example" }).eq("id", TEST).select();
      expect(upd.error !== null || (upd.data ?? []).length === 0, gebruiker).toBe(true);
    }
    expect((await zetLink("docent", "")).r.ok).toBe(true);
    expect((await admin.from("cluster").select("inschrijf_link").eq("id", TEST).single()).data?.inschrijf_link).toBeNull();
  });
});

describe("Overnemen: de docent kopieert het concept van het ene cluster naar het andere", () => {
  it("alleen de docent mag het, en niet naar hetzelfde cluster of zonder naam", async () => {
    for (const gebruiker of ["test-stuur", "test-groep-1", "test-student", "vd-stuur-veiligheid"]) {
      expect((await rpc(gebruiker, "bergtoppen_overnemen", { p_van: VD, p_naar: TEST, p_naam: naam })).error, gebruiker).not.toBeNull();
    }
    expect((await anoniem().rpc("bergtoppen_overnemen", { p_van: VD, p_naar: TEST, p_naam: naam })).error).not.toBeNull();
    expect((await rpc("docent", "bergtoppen_overnemen", { p_van: TEST, p_naar: TEST, p_naam: naam })).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await rpc("docent", "bergtoppen_overnemen", { p_van: VD, p_naar: TEST, p_naam: " " })).r).toMatchObject({ ok: false, reden: "naam" });
  });

  it("vervangt het concept van het doelcluster en laat de gepubliceerde versie en de link ongemoeid (tijdelijk bron-cluster)", async () => {
    const { data: editie } = await admin.from("editie").insert({ naam: "Bergtoppentest", startdatum: "2030-01-01", einddatum: "2030-01-03" }).select("id").single();
    const { data: bron } = await admin.from("cluster").insert({ editie_id: editie!.id, code: "TEST", naam: "Bron voor de test" }).select("id").single();
    try {
      await admin.from("bergtop_veld").delete().eq("cluster_id", TEST);
      await vul(bron!.id, "Bron");
      await vul(TEST, "Eigen");
      await admin.from("cluster").update({ inschrijf_link: "https://forms.example/eigen" }).eq("id", TEST);
      const publicatieVoor = (await admin.from("bergtop_publicatie").select("versie, inhoud").eq("cluster_id", TEST).single()).data;

      const res = await rpc("docent", "bergtoppen_overnemen", { p_van: bron!.id, p_naar: TEST, p_naam: naam });
      expect(res.r).toEqual({ ok: true, velden: 22 });
      const { data: velden } = await admin.from("bergtop_veld").select("sleutel, tekst").eq("cluster_id", TEST);
      expect(velden).toHaveLength(22);
      expect(velden!.find((v) => v.sleutel === "top_3_titel")?.tekst).toBe("Bron titel 3");
      expect(velden!.every((v) => !v.tekst?.startsWith("Eigen"))).toBe(true);
      // het bron-cluster blijft ongemoeid
      expect((await admin.from("bergtop_veld").select("sleutel").eq("cluster_id", bron!.id)).data).toHaveLength(22);
      // de gepubliceerde versie en de link van het doelcluster niet
      expect((await admin.from("bergtop_publicatie").select("versie, inhoud").eq("cluster_id", TEST).single()).data).toEqual(publicatieVoor);
      expect((await admin.from("cluster").select("inschrijf_link").eq("id", TEST).single()).data?.inschrijf_link).toBe("https://forms.example/eigen");
      const { data: log } = await admin.from("wijziging").select("details").eq("cluster_id", TEST).eq("naam", naam).eq("actie", "bergtoppen_overgenomen");
      expect(log).toHaveLength(1);
      expect(log?.[0].details).toMatchObject({ van: bron!.id, velden: 22 });
    } finally {
      await admin.from("cluster").delete().eq("id", bron!.id);
      await admin.from("editie").delete().eq("id", editie!.id);
    }
  });

  it("het overnemen van VD verandert VD niet", async () => {
    const tel = async (cluster: string) => (await admin.from("bergtop_veld").select("sleutel").eq("cluster_id", cluster)).data!.length;
    const voorVd = await tel(VD);
    expect((await rpc("docent", "bergtoppen_overnemen", { p_van: VD, p_naar: TEST, p_naam: naam })).r).toMatchObject({ ok: true, velden: voorVd });
    expect(await tel(TEST)).toBe(voorVd);
    expect(await tel(VD)).toBe(voorVd);
  });
});
