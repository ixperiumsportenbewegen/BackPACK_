/**
 * Persoonlijke paklijst: lezen voor iedereen in het eigen cluster, schrijven alleen voor de stuurgroep van dat cluster en de
 * docent, via functies; categorieën en items met opslaan per veld, volgorde, plakken van een lijst en overnemen door de docent.
 * Alles wordt op het cluster TEST aangemaakt (en op een tijdelijk bron-cluster voor het overnemen); VD en VC worden alleen
 * gelezen of krijgen verboden schrijfpogingen (die moeten mislukken). Na afloop staat TEST weer op de vaste categorieën.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anoniem, clusterId, inloggenAls } from "./helpers";

type R = { ok: boolean; reden?: string; huidig?: string | null; id?: string; aantal?: number; aantal_spullen?: number; categorieen?: number; spullen?: number };

const naam = "Paklijsttester";
let TEST: string, VD: string, VC: string;

const rpc = async (gebruiker: string, functie: string, args: Record<string, unknown>) => {
  const res = await (await inloggenAls(gebruiker)).rpc(functie, args);
  return { ...res, r: res.data as R };
};
const nieuweCategorie = (gebruiker: string, cluster: string, blok: string, categorie: string) =>
  rpc(gebruiker, "paklijst_categorie_toevoegen", { p_cluster_id: cluster, p_blok: blok, p_categorie: categorie, p_naam: naam });
const nieuwSpul = (gebruiker: string, categorie: string, bovenliggend: string | null = null) =>
  rpc(gebruiker, "paklijst_item_toevoegen", { p_categorie_id: categorie, p_bovenliggend_id: bovenliggend, p_naam: naam });
const zetVeld = (gebruiker: string, id: string, veld: string, oud: string | null, nieuw: string | null) =>
  rpc(gebruiker, "paklijst_item_veld_opslaan", { p_id: id, p_veld: veld, p_oud: oud, p_nieuw: nieuw, p_naam: naam });

async function herstel() {
  await admin.from("paklijst_categorie").delete().eq("cluster_id", TEST); // de spullen gaan mee
  await admin.rpc("paklijst_standaard_categorieen", { p_cluster_id: TEST });
  await admin.from("wijziging").delete().eq("cluster_id", TEST).eq("naam", naam);
}

const categorieen = async (cluster: string, blok?: string) => {
  let q = admin.from("paklijst_categorie").select("id, blok, naam, volgorde").eq("cluster_id", cluster).order("volgorde");
  if (blok) q = q.eq("blok", blok);
  return (await q).data!;
};
const eersteCategorie = async (cluster: string, blok = "persoon") => (await categorieen(cluster, blok))[0];

beforeAll(async () => {
  TEST = await clusterId("TEST");
  VD = await clusterId("VD");
  VC = await clusterId("VC");
  await herstel();
});

afterAll(herstel);

describe("Vaste categorieën", () => {
  it("elk cluster heeft de vaste categorieën; TEST precies, zonder spullen", async () => {
    const persoon = ["Documenten en verzekering", "Rugzak en slapen", "Kleding", "Schoenen", "Toilettas en verzorging", "Eten en drinken", "Verlichting en elektronica", "Overig"];
    const groepje = ["Koken en eten", "EHBO en verzorging", "Overig"];
    expect((await categorieen(TEST, "persoon")).map((c) => c.naam)).toEqual(persoon);
    expect((await categorieen(TEST, "groepje")).map((c) => c.naam)).toEqual(groepje);
    expect((await admin.from("paklijst_item").select("id").eq("cluster_id", TEST)).data).toHaveLength(0);
    for (const cluster of [VD, VC]) {
      const namen = (await categorieen(cluster)).map((c) => c.naam);
      for (const n of [...persoon, ...groepje]) expect(namen, n).toContain(n);
    }
  });

  it("de vaste categorieën worden niet nog eens aangemaakt als er al categorieën zijn", async () => {
    await admin.rpc("paklijst_standaard_categorieen", { p_cluster_id: TEST });
    expect(await categorieen(TEST)).toHaveLength(11);
  });
});

describe("Afscherming: lezen binnen het eigen cluster, schrijven alleen door de stuurgroep en de docent", () => {
  it("iedereen in het cluster leest de lijst; een ander cluster en anoniem niet", async () => {
    const cat = await eersteCategorie(TEST);
    await admin.from("paklijst_item").insert({ cluster_id: TEST, categorie_id: cat.id, naam: "Leestest", volgorde: 1 });
    for (const gebruiker of ["test-groep-1", "test-groep-2", "test-student", "test-stuur", "docent"]) {
      const c = await inloggenAls(gebruiker);
      expect((await c.from("paklijst_categorie").select("id").eq("cluster_id", TEST)).data, gebruiker).toHaveLength(11);
      expect((await c.from("paklijst_item").select("id").eq("cluster_id", TEST)).data, gebruiker).toHaveLength(1);
    }
    for (const gebruiker of ["vd-student", "vd-groep-1", "vd-stuur-programma", "vc-student", "vc-stuur-programma"]) {
      const c = await inloggenAls(gebruiker);
      expect((await c.from("paklijst_categorie").select("id").eq("cluster_id", TEST)).data ?? [], gebruiker).toHaveLength(0);
      expect((await c.from("paklijst_item").select("id").eq("cluster_id", TEST)).data ?? [], gebruiker).toHaveLength(0);
    }
    expect((await anoniem().from("paklijst_categorie").select("id")).data ?? []).toHaveLength(0);
    expect((await anoniem().from("paklijst_item").select("id")).data ?? []).toHaveLength(0);
    await admin.from("paklijst_item").delete().eq("cluster_id", TEST);
  });

  it("niemand kan de tabellen rechtstreeks beschrijven", async () => {
    const cat = await eersteCategorie(TEST);
    for (const gebruiker of ["test-groep-1", "test-student", "test-stuur", "docent", "vd-stuur-veiligheid"]) {
      const c = await inloggenAls(gebruiker);
      const ins = await c.from("paklijst_item").insert({ cluster_id: TEST, categorie_id: cat.id, naam: "Gehackt", volgorde: 1 });
      const insCat = await c.from("paklijst_categorie").insert({ cluster_id: TEST, blok: "persoon", naam: "Gehackt", volgorde: 99 });
      const upd = await c.from("paklijst_categorie").update({ naam: "Gehackt" }).eq("cluster_id", TEST).select();
      const del = await c.from("paklijst_categorie").delete().eq("cluster_id", TEST).select();
      expect(ins.error, `${gebruiker} insert spul`).not.toBeNull();
      expect(insCat.error, `${gebruiker} insert categorie`).not.toBeNull();
      expect(upd.error !== null || (upd.data ?? []).length === 0, `${gebruiker} update`).toBe(true);
      expect(del.error !== null || (del.data ?? []).length === 0, `${gebruiker} delete`).toBe(true);
    }
    expect(await categorieen(TEST)).toHaveLength(11);
  });

  it("alleen de stuurgroep van het cluster en de docent kunnen via de functies schrijven", async () => {
    const cat = await eersteCategorie(TEST);
    const vdCat = await eersteCategorie(VD);
    for (const gebruiker of ["test-groep-1", "test-groep-2", "test-student", "vd-stuur-veiligheid", "vc-stuur-programma", "vd-groep-1"]) {
      expect((await nieuweCategorie(gebruiker, TEST, "persoon", "Gehackt")).error, `${gebruiker} categorie`).not.toBeNull();
      expect((await nieuwSpul(gebruiker, cat.id)).error, `${gebruiker} spul`).not.toBeNull();
      expect((await rpc(gebruiker, "paklijst_items_plakken", { p_categorie_id: cat.id, p_tekst: "Gehackt", p_naam: naam })).error, `${gebruiker} plakken`).not.toBeNull();
      expect((await rpc(gebruiker, "paklijst_categorie_hernoemen", { p_id: cat.id, p_oud: cat.naam, p_nieuw: "Gehackt", p_naam: naam })).error, `${gebruiker} hernoemen`).not.toBeNull();
    }
    // de stuurgroep van TEST mag niet schrijven in een ander cluster
    expect((await nieuweCategorie("test-stuur", VD, "persoon", "Gehackt")).error).not.toBeNull();
    expect((await nieuweCategorie("test-stuur", VC, "persoon", "Gehackt")).error).not.toBeNull();
    expect((await nieuwSpul("test-stuur", vdCat.id)).error).not.toBeNull();
    expect((await anoniem().rpc("paklijst_categorie_toevoegen", { p_cluster_id: TEST, p_blok: "persoon", p_categorie: "x", p_naam: naam })).error).not.toBeNull();
    expect(await categorieen(TEST)).toHaveLength(11);
    expect((await admin.from("paklijst_item").select("id").eq("cluster_id", TEST)).data).toHaveLength(0);
  });
});

describe("Categorieën", () => {
  it("voegt toe, hernoemt met een waarschuwing bij een conflict, verplaatst en verwijdert", async () => {
    const nieuw = await nieuweCategorie("test-stuur", TEST, "groepje", "Muziek");
    expect(nieuw.r.ok).toBe(true);
    const id = nieuw.r.id!;
    expect((await categorieen(TEST, "groepje")).map((c) => c.naam)).toEqual(["Koken en eten", "EHBO en verzorging", "Overig", "Muziek"]);

    const hernoem = (oud: string, n: string, gebruiker = "docent") => rpc(gebruiker, "paklijst_categorie_hernoemen", { p_id: id, p_oud: oud, p_nieuw: n, p_naam: naam });
    expect((await hernoem("Muziek", "Spelletjes")).r).toEqual({ ok: true });
    expect((await hernoem("Muziek", "Mijn versie", "test-stuur")).r).toMatchObject({ ok: false, reden: "conflict", huidig: "Spelletjes" });
    expect((await hernoem("Spelletjes", "   ")).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await hernoem("Spelletjes", "x".repeat(81))).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await categorieen(TEST, "groepje")).at(-1)!.naam).toBe("Spelletjes");

    const verplaats = (omhoog: boolean) => rpc("test-stuur", "paklijst_categorie_verplaatsen", { p_id: id, p_omhoog: omhoog, p_naam: naam });
    expect((await verplaats(true)).r.ok).toBe(true);
    expect((await categorieen(TEST, "groepje")).map((c) => c.naam)).toEqual(["Koken en eten", "EHBO en verzorging", "Spelletjes", "Overig"]);
    expect((await verplaats(false)).r.ok).toBe(true);
    expect((await verplaats(false)).r.ok).toBe(true); // onderaan: gebeurt niets
    expect((await categorieen(TEST, "groepje")).at(-1)!.naam).toBe("Spelletjes");
    // de volgorde binnen het andere blok blijft ongemoeid
    expect((await categorieen(TEST, "persoon"))[0].naam).toBe("Documenten en verzekering");

    expect((await rpc("test-stuur", "paklijst_categorie_verwijderen", { p_id: id, p_naam: naam })).r).toMatchObject({ ok: true, aantal_spullen: 0 });
    expect(await categorieen(TEST, "groepje")).toHaveLength(3);
  });

  it("verwijderen neemt de spullen mee en bewaart ze in het logboek; er zijn maximaal 30 categorieën per blok", async () => {
    const nieuw = await nieuweCategorie("test-stuur", TEST, "persoon", "Tijdelijk");
    const cat = nieuw.r.id!;
    const a = await nieuwSpul("test-stuur", cat);
    await zetVeld("test-stuur", a.r.id!, "naam", null, "Spul in tijdelijke categorie");
    expect((await rpc("test-stuur", "paklijst_categorie_verwijderen", { p_id: cat, p_naam: naam })).r).toMatchObject({ ok: true, aantal_spullen: 1 });
    expect((await admin.from("paklijst_item").select("id").eq("id", a.r.id!)).data).toHaveLength(0);
    const { data: log } = await admin.from("wijziging").select("details").eq("cluster_id", TEST).eq("naam", naam).eq("actie", "paklijst_categorie_verwijderd");
    expect(log?.at(-1)?.details).toMatchObject({ categorie: "Tijdelijk", spullen: ["Spul in tijdelijke categorie"] });

    const aanwezig = (await categorieen(TEST, "persoon")).length;
    const rijen = Array.from({ length: 30 - aanwezig }, (_, i) => ({ cluster_id: TEST, blok: "persoon", naam: `Vul ${i}`, volgorde: 100 + i }));
    await admin.from("paklijst_categorie").insert(rijen);
    expect((await nieuweCategorie("test-stuur", TEST, "persoon", "Een te veel")).r).toMatchObject({ ok: false, reden: "te_veel" });
    expect((await nieuweCategorie("test-stuur", TEST, "persoon", " ")).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await nieuweCategorie("test-stuur", TEST, "onbekend", "x")).r).toMatchObject({ ok: false, reden: "ongeldig" });
    await herstel();
  });
});

describe("Spullen en onderdelen", () => {
  let cat: string, andere: string, spul: string, onderdeel: string;

  it("voegt een spul en een onderdeel toe; een onderdeel van een onderdeel kan niet", async () => {
    cat = (await eersteCategorie(TEST, "persoon")).id;
    andere = (await categorieen(TEST, "persoon"))[1].id;
    const s = await nieuwSpul("test-stuur", cat);
    expect(s.r.ok).toBe(true);
    spul = s.r.id!;
    const o = await nieuwSpul("docent", cat, spul);
    expect(o.r.ok).toBe(true);
    onderdeel = o.r.id!;
    expect((await nieuwSpul("test-stuur", cat, onderdeel)).r).toMatchObject({ ok: false, reden: "ongeldig" }); // één niveau diep
    expect((await nieuwSpul("test-stuur", andere, spul)).r).toMatchObject({ ok: false, reden: "ongeldig" }); // ander categorie
    expect((await nieuwSpul("test-stuur", cat, "00000000-0000-0000-0000-000000000000")).r).toMatchObject({ ok: false, reden: "ongeldig" });
    const { data } = await admin.from("paklijst_item").select("id, bovenliggend_id, volgorde").eq("categorie_id", cat).order("volgorde");
    expect(data).toHaveLength(2);
  });

  it("slaat naam, aantal, toelichting en optioneel per veld op, met een conflict bij een verouderde waarde", async () => {
    expect((await zetVeld("test-stuur", spul, "naam", null, "  Slaapzak ")).r).toEqual({ ok: true });
    expect((await zetVeld("test-stuur", spul, "aantal", null, "1")).r).toEqual({ ok: true });
    expect((await zetVeld("docent", spul, "toelichting", null, "Warm genoeg voor een koele nacht")).r).toEqual({ ok: true });
    expect((await zetVeld("test-stuur", spul, "optioneel", null, "ja")).r).toEqual({ ok: true });
    const { data } = await admin.from("paklijst_item").select("naam, aantal, toelichting, optioneel").eq("id", spul).single();
    expect(data).toEqual({ naam: "Slaapzak", aantal: "1", toelichting: "Warm genoeg voor een koele nacht", optioneel: true });

    expect((await zetVeld("test-stuur", spul, "naam", "Oude naam", "Mijn versie")).r).toMatchObject({ ok: false, reden: "conflict", huidig: "Slaapzak" });
    expect((await zetVeld("test-stuur", spul, "optioneel", null, "ja")).r).toMatchObject({ ok: false, reden: "conflict", huidig: "ja" });
    expect((await zetVeld("test-stuur", spul, "optioneel", "ja", "")).r).toEqual({ ok: true });
    expect((await admin.from("paklijst_item").select("optioneel").eq("id", spul).single()).data?.optioneel).toBe(false);
    // een aantal leegmaken
    expect((await zetVeld("test-stuur", spul, "aantal", "1", "  ")).r).toEqual({ ok: true });
    expect((await admin.from("paklijst_item").select("aantal").eq("id", spul).single()).data?.aantal).toBeNull();

    expect((await zetVeld("test-stuur", spul, "kleur", null, "rood")).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await zetVeld("test-stuur", spul, "naam", "Slaapzak", "x".repeat(151))).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await zetVeld("test-stuur", spul, "aantal", null, "x".repeat(41))).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await zetVeld("test-stuur", spul, "toelichting", null, "x".repeat(501))).r).toMatchObject({ ok: false, reden: "ongeldig" });
    const zonderNaam = await rpc("test-stuur", "paklijst_item_veld_opslaan", { p_id: spul, p_veld: "naam", p_oud: "Slaapzak", p_nieuw: "x", p_naam: " " });
    expect(zonderNaam.r).toMatchObject({ ok: false, reden: "naam" });
    expect((await admin.from("paklijst_item").select("naam").eq("id", spul).single()).data?.naam).toBe("Slaapzak");
    const { data: log } = await admin.from("wijziging").select("details").eq("cluster_id", TEST).eq("naam", naam).eq("actie", "paklijst_item_gewijzigd").order("created_at");
    expect(log?.length).toBeGreaterThanOrEqual(6);
    expect(log?.[0].details).toEqual({ veld: "naam", oud: null, nieuw: "Slaapzak" });
  });

  it("verplaatst spullen alleen binnen hun eigen niveau en categorie", async () => {
    const tweede = (await nieuwSpul("test-stuur", cat)).r.id!;
    await zetVeld("test-stuur", tweede, "naam", null, "Kussen");
    const volgorde = async () => (await admin.from("paklijst_item").select("id").eq("categorie_id", cat).is("bovenliggend_id", null).order("volgorde")).data!.map((r) => r.id);
    expect(await volgorde()).toEqual([spul, tweede]);
    expect((await rpc("test-stuur", "paklijst_item_verplaatsen", { p_id: tweede, p_omhoog: true, p_naam: naam })).r.ok).toBe(true);
    expect(await volgorde()).toEqual([tweede, spul]);
    expect((await rpc("test-stuur", "paklijst_item_verplaatsen", { p_id: tweede, p_omhoog: true, p_naam: naam })).r.ok).toBe(true); // bovenaan
    expect(await volgorde()).toEqual([tweede, spul]);
    // het onderdeel is de enige in zijn niveau: verplaatsen verandert niets
    expect((await rpc("test-stuur", "paklijst_item_verplaatsen", { p_id: onderdeel, p_omhoog: false, p_naam: naam })).r.ok).toBe(true);
    expect((await admin.from("paklijst_item").select("bovenliggend_id").eq("id", onderdeel).single()).data?.bovenliggend_id).toBe(spul);
  });

  it("niemand anders kan een spul wijzigen, verplaatsen of verwijderen", async () => {
    for (const gebruiker of ["vd-stuur-veiligheid", "test-groep-1", "test-student"]) {
      expect((await zetVeld(gebruiker, spul, "naam", "Slaapzak", "Gehackt")).error, gebruiker).not.toBeNull();
      expect((await rpc(gebruiker, "paklijst_item_verplaatsen", { p_id: spul, p_omhoog: true, p_naam: naam })).error, gebruiker).not.toBeNull();
      expect((await rpc(gebruiker, "paklijst_item_verwijderen", { p_id: spul, p_naam: naam })).error, gebruiker).not.toBeNull();
    }
    expect((await admin.from("paklijst_item").select("naam").eq("id", spul).single()).data?.naam).toBe("Slaapzak");
  });

  it("verwijdert een spul met zijn onderdelen en bewaart de inhoud in het logboek", async () => {
    await zetVeld("test-stuur", onderdeel, "naam", null, "Hoes");
    expect((await rpc("test-stuur", "paklijst_item_verwijderen", { p_id: spul, p_naam: naam })).r.ok).toBe(true);
    expect((await admin.from("paklijst_item").select("id").in("id", [spul, onderdeel])).data).toHaveLength(0);
    const { data } = await admin.from("wijziging").select("details").eq("cluster_id", TEST).eq("naam", naam).eq("actie", "paklijst_item_verwijderd");
    expect(data).toHaveLength(1);
    expect(data?.[0].details).toMatchObject({ spul: "Slaapzak", onderdelen: ["Hoes"] });
    expect((await rpc("test-stuur", "paklijst_item_verwijderen", { p_id: spul, p_naam: naam })).r).toMatchObject({ ok: false, reden: "ongeldig" });
  });

  it("er zijn maximaal 100 spullen per categorie en 30 onderdelen per spul", async () => {
    const leeg = (await categorieen(TEST, "persoon"))[2].id;
    const rijen = Array.from({ length: 100 }, (_, i) => ({ cluster_id: TEST, categorie_id: leeg, naam: `S${i}`, volgorde: i + 1 }));
    await admin.from("paklijst_item").insert(rijen);
    expect((await nieuwSpul("test-stuur", leeg)).r).toMatchObject({ ok: false, reden: "te_veel" });
    const ouder = (await admin.from("paklijst_item").select("id").eq("categorie_id", leeg).eq("naam", "S0").single()).data!.id;
    await admin.from("paklijst_item").insert(Array.from({ length: 30 }, (_, i) => ({ cluster_id: TEST, categorie_id: leeg, bovenliggend_id: ouder, naam: `O${i}`, volgorde: i + 1 })));
    expect((await nieuwSpul("test-stuur", leeg, ouder)).r).toMatchObject({ ok: false, reden: "te_veel" });
    await admin.from("paklijst_item").delete().eq("categorie_id", leeg);
  });
});

describe("Een lijst plakken", () => {
  let cat: string;
  const plak = (tekst: string, gebruiker = "test-stuur") => rpc(gebruiker, "paklijst_items_plakken", { p_categorie_id: cat, p_tekst: tekst, p_naam: naam });
  const boom = async () => {
    const { data } = await admin.from("paklijst_item").select("id, naam, aantal, toelichting, bovenliggend_id, volgorde").eq("categorie_id", cat).order("volgorde");
    const top = data!.filter((i) => !i.bovenliggend_id);
    return top.map((t) => ({
      naam: t.naam, aantal: t.aantal, toelichting: t.toelichting,
      onderdelen: data!.filter((o) => o.bovenliggend_id === t.id).map((o) => ({ naam: o.naam, aantal: o.aantal })),
    }));
  };

  it("maakt van elke regel een spul; streepjes en inspringen maken onderdelen; | scheidt naam, aantal en toelichting", async () => {
    cat = (await categorieen(TEST, "persoon"))[3].id;
    const tekst = [
      "- Begint met een streepje maar heeft nog geen spul erboven",
      "Slaapzak | 1 | warm genoeg",
      "Toilettas",
      "  - Tandenborstel",
      "- Tandpasta | 1",
      "    Zeep",
      "",
      "   ",
      "Regenhoes",
      "Lucifers | | in een zakje | en nog iets",
      "•  Een bolletje als streepje onder lucifers",
    ].join("\r\n");
    const res = await plak(tekst);
    expect(res.r).toMatchObject({ ok: true, aantal: 9 });
    expect(await boom()).toEqual([
      { naam: "Begint met een streepje maar heeft nog geen spul erboven", aantal: null, toelichting: null, onderdelen: [] },
      { naam: "Slaapzak", aantal: "1", toelichting: "warm genoeg", onderdelen: [] },
      { naam: "Toilettas", aantal: null, toelichting: null, onderdelen: [{ naam: "Tandenborstel", aantal: null }, { naam: "Tandpasta", aantal: "1" }, { naam: "Zeep", aantal: null }] },
      { naam: "Regenhoes", aantal: null, toelichting: null, onderdelen: [] },
      { naam: "Lucifers", aantal: null, toelichting: "in een zakje | en nog iets", onderdelen: [{ naam: "Een bolletje als streepje onder lucifers", aantal: null }] },
    ]);
  });

  it("plakken voegt achteraan toe aan wat er al staat", async () => {
    expect((await plak("Nog een spul")).r.ok).toBe(true);
    const namen = (await boom()).map((b) => b.naam);
    expect(namen.at(-1)).toBe("Nog een spul");
    expect(namen).toHaveLength(6);
  });

  it("een lege tekst, te veel regels of een naamloze plak voegt niets toe; een ander cluster mag niet plakken", async () => {
    const voor = (await admin.from("paklijst_item").select("id").eq("categorie_id", cat)).data!.length;
    expect((await plak("  \n \n")).r).toMatchObject({ ok: false, reden: "leeg" });
    expect((await plak(Array.from({ length: 151 }, (_, i) => `Spul ${i}`).join("\n"))).r).toMatchObject({ ok: false, reden: "te_veel" });
    expect((await plak(["Ouder", ...Array.from({ length: 31 }, (_, i) => `- Onderdeel ${i}`)].join("\n"))).r).toMatchObject({ ok: false, reden: "te_veel" });
    expect((await rpc("test-stuur", "paklijst_items_plakken", { p_categorie_id: cat, p_tekst: "x", p_naam: " " })).r).toMatchObject({ ok: false, reden: "naam" });
    expect((await plak("Gehackt", "vd-stuur-veiligheid")).error).not.toBeNull();
    expect((await admin.from("paklijst_item").select("id").eq("categorie_id", cat)).data!.length).toBe(voor);
    const { data: log } = await admin.from("wijziging").select("details").eq("cluster_id", TEST).eq("naam", naam).eq("actie", "paklijst_items_geplakt");
    expect(log).toHaveLength(2);
  });
});

describe("Overnemen: de docent kopieert de lijst van het ene cluster naar het andere", () => {
  it("alleen de docent mag het, en niet naar hetzelfde cluster of zonder naam", async () => {
    for (const gebruiker of ["test-stuur", "test-groep-1", "test-student", "vd-stuur-veiligheid"]) {
      expect((await rpc(gebruiker, "paklijst_overnemen", { p_van: VD, p_naar: TEST, p_naam: naam })).error, gebruiker).not.toBeNull();
    }
    expect((await anoniem().rpc("paklijst_overnemen", { p_van: VD, p_naar: TEST, p_naam: naam })).error).not.toBeNull();
    expect((await rpc("docent", "paklijst_overnemen", { p_van: TEST, p_naar: TEST, p_naam: naam })).r).toMatchObject({ ok: false, reden: "ongeldig" });
    expect((await rpc("docent", "paklijst_overnemen", { p_van: VD, p_naar: TEST, p_naam: " " })).r).toMatchObject({ ok: false, reden: "naam" });
  });

  it("kopieert categorieën, spullen en onderdelen met hun volgorde en vervangt wat er stond (tijdelijk bron-cluster)", async () => {
    const { data: editie } = await admin.from("editie").insert({ naam: "Paklijsttest", startdatum: "2030-01-01", einddatum: "2030-01-03" }).select("id").single();
    const { data: bron } = await admin.from("cluster").insert({ editie_id: editie!.id, code: "TEST", naam: "Bron voor de test" }).select("id").single();
    try {
      const { data: cats } = await admin.from("paklijst_categorie").insert([
        { cluster_id: bron!.id, blok: "persoon", naam: "Bron A", volgorde: 1 },
        { cluster_id: bron!.id, blok: "groepje", naam: "Bron B", volgorde: 1 },
      ]).select("id, naam");
      const a = cats!.find((c) => c.naam === "Bron A")!.id;
      const b = cats!.find((c) => c.naam === "Bron B")!.id;
      const { data: ouder } = await admin.from("paklijst_item").insert({ cluster_id: bron!.id, categorie_id: a, naam: "Toilettas", aantal: "1", toelichting: "Klein", optioneel: true, volgorde: 1 }).select("id").single();
      await admin.from("paklijst_item").insert([
        { cluster_id: bron!.id, categorie_id: a, bovenliggend_id: ouder!.id, naam: "Zeep", volgorde: 1 },
        { cluster_id: bron!.id, categorie_id: a, bovenliggend_id: ouder!.id, naam: "Tandpasta", volgorde: 2 },
        { cluster_id: bron!.id, categorie_id: a, naam: "Regenhoes", volgorde: 2 },
        { cluster_id: bron!.id, categorie_id: b, naam: "Gasstel", aantal: "1 per groepje", volgorde: 1 },
      ]);
      // in TEST staat iets eigens dat vervangen moet worden
      const eerste = await eersteCategorie(TEST);
      await admin.from("paklijst_item").insert({ cluster_id: TEST, categorie_id: eerste.id, naam: "Moet verdwijnen", volgorde: 1 });

      const res = await rpc("docent", "paklijst_overnemen", { p_van: bron!.id, p_naar: TEST, p_naam: naam });
      expect(res.r).toEqual({ ok: true, categorieen: 2, spullen: 5 });

      expect((await categorieen(TEST)).map((c) => `${c.blok}:${c.naam}`).sort()).toEqual(["groepje:Bron B", "persoon:Bron A"]);
      const { data: items } = await admin.from("paklijst_item").select("id, naam, aantal, toelichting, optioneel, bovenliggend_id, volgorde, categorie_id, cluster_id").eq("cluster_id", TEST).order("volgorde");
      expect(items!.map((i) => i.naam).sort()).toEqual(["Gasstel", "Regenhoes", "Tandpasta", "Toilettas", "Zeep"]);
      const toilettas = items!.find((i) => i.naam === "Toilettas")!;
      expect(toilettas).toMatchObject({ aantal: "1", toelichting: "Klein", optioneel: true, bovenliggend_id: null });
      const kinderen = items!.filter((i) => i.bovenliggend_id === toilettas.id).sort((x, y) => x.volgorde - y.volgorde);
      expect(kinderen.map((k) => k.naam)).toEqual(["Zeep", "Tandpasta"]);
      expect(kinderen.every((k) => k.categorie_id === toilettas.categorie_id)).toBe(true);
      expect(items!.find((i) => i.naam === "Gasstel")).toMatchObject({ aantal: "1 per groepje" });
      // de nieuwe rijen zijn kopieën met eigen id's; het bron-cluster blijft ongemoeid
      const { data: bronItems } = await admin.from("paklijst_item").select("id").eq("cluster_id", bron!.id);
      expect(bronItems).toHaveLength(5);
      expect(items!.some((i) => bronItems!.some((b2) => b2.id === i.id))).toBe(false);
      const { data: log } = await admin.from("wijziging").select("details").eq("cluster_id", TEST).eq("naam", naam).eq("actie", "paklijst_overgenomen");
      expect(log).toHaveLength(1);
      expect(log?.[0].details).toMatchObject({ van: bron!.id, categorieen: 2, spullen: 5 });
    } finally {
      await admin.from("cluster").delete().eq("id", bron!.id);
      await admin.from("editie").delete().eq("id", editie!.id);
    }
  });

  it("het overnemen van VD verandert VD niet", async () => {
    const tel = async (cluster: string) => ({
      categorieen: (await admin.from("paklijst_categorie").select("id").eq("cluster_id", cluster)).data!.length,
      spullen: (await admin.from("paklijst_item").select("id").eq("cluster_id", cluster)).data!.length,
    });
    const voorVd = await tel(VD);
    const res = await rpc("docent", "paklijst_overnemen", { p_van: VD, p_naar: TEST, p_naam: naam });
    expect(res.r).toMatchObject({ ok: true, categorieen: voorVd.categorieen, spullen: voorVd.spullen });
    expect(await tel(TEST)).toEqual(voorVd);
    expect(await tel(VD)).toEqual(voorVd);
  });
});
