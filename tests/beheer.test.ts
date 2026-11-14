/**
 * Opdracht 5, deel C: beheer. Links per cluster, blijf-actief, sessies intrekken, de markering voor de livegang
 * en de export (JSON en Excel). Draait tegen het echte Supabase-project; wat een test wijzigt wordt teruggezet.
 */
import { spawnSync } from "node:child_process";
import ExcelJS from "exceljs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXPORT_TABELLEN, exporteerAlles } from "../src/lib/exporteren";
import { exportNaarExcel } from "../src/lib/exporterenExcel";
import { admin, anoniem, clusterId, inloggenAls } from "./helpers";

type R = { ok: boolean; reden?: string };

let VD: string, VC: string;
let beginLinks: Record<string, { teams_link: string | null; forms_link: string | null }> = {};
const NAAM = "Testpersoon";

beforeAll(async () => {
  VD = await clusterId("VD");
  VC = await clusterId("VC");
  const { data } = await admin.from("cluster").select("id, teams_link, forms_link").in("id", [VD, VC]);
  beginLinks = Object.fromEntries((data ?? []).map((c) => [c.id, { teams_link: c.teams_link, forms_link: c.forms_link }]));
});

afterAll(async () => {
  for (const [id, links] of Object.entries(beginLinks)) await admin.from("cluster").update(links).eq("id", id);
  await admin.from("wijziging").delete().eq("naam", NAAM).eq("actie", "forms_link_gewijzigd");
});

const zetForms = (g: string, cluster: string, link: string | null) =>
  inloggenAls(g).then((c) => c.rpc("cluster_forms_link_zetten", { p_cluster_id: cluster, p_link: link as string, p_naam: NAAM }));

describe("Forms-link per cluster", () => {
  it("Communicatie & Financiën stelt de link van het eigen cluster in; VD en VC afzonderlijk", async () => {
    const vd = await zetForms("vd-stuur-financien", VD, "https://forms.office.com/r/vd-test");
    expect((vd.data as R).ok).toBe(true);
    const vc = await zetForms("vc-stuur-financien", VC, "https://forms.office.com/r/vc-test");
    expect((vc.data as R).ok).toBe(true);
    const { data } = await admin.from("cluster").select("id, forms_link").in("id", [VD, VC]);
    const per = Object.fromEntries((data ?? []).map((c) => [c.id, c.forms_link]));
    expect(per[VD]).toBe("https://forms.office.com/r/vd-test");
    expect(per[VC]).toBe("https://forms.office.com/r/vc-test");
  });

  it("niet voor het andere cluster, niet voor andere stuurgroeprollen, projectgroepen of studenten", async () => {
    expect((await zetForms("vd-stuur-financien", VC, "https://forms.office.com/r/gehackt")).error).not.toBeNull();
    expect((await zetForms("vc-stuur-financien", VD, "https://forms.office.com/r/gehackt")).error).not.toBeNull();
    for (const g of ["vd-stuur-programma", "vd-stuur-logistiek", "vd-groep-1", "vd-student", "test-stuur"]) {
      expect((await zetForms(g, VD, "https://forms.office.com/r/gehackt")).error, g).not.toBeNull();
    }
    expect((await anoniem().rpc("cluster_forms_link_zetten", { p_cluster_id: VD, p_link: "https://x.nl", p_naam: NAAM })).error).not.toBeNull();
    const { data } = await admin.from("cluster").select("forms_link").eq("id", VD).single();
    expect(data?.forms_link).toBe("https://forms.office.com/r/vd-test");
  });

  it("de docent past elke link aan; een link moet https zijn, zonder spaties, en een naam is verplicht; leeg haalt de link weg", async () => {
    expect(((await zetForms("docent", VD, "https://forms.office.com/r/docent")).data as R).ok).toBe(true);
    for (const slecht of ["http://forms.office.com/x", "forms.office.com/x", "https://forms.office.com/een link", "javascript:alert(1)", `https://${"a".repeat(1001)}`]) {
      expect(((await zetForms("vd-stuur-financien", VD, slecht)).data as R).reden, slecht.slice(0, 30)).toBe("ongeldig");
    }
    const zonderNaam = await (await inloggenAls("vd-stuur-financien")).rpc("cluster_forms_link_zetten", { p_cluster_id: VD, p_link: "https://x.nl/a", p_naam: " " });
    expect((zonderNaam.data as R).reden).toBe("naam");
    expect(((await zetForms("vd-stuur-financien", VD, null)).data as R).ok).toBe(true);
    expect((await admin.from("cluster").select("forms_link").eq("id", VD).single()).data?.forms_link).toBeNull();
    // de wijziging staat in het logboek
    const { data } = await admin.from("wijziging").select("actie, cluster_id").eq("tabel", "cluster").eq("naam", NAAM).eq("actie", "forms_link_gewijzigd");
    expect((data ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("de Teams-link past alleen de docent aan; stuurgroepen en groepen lezen hem alleen", async () => {
    for (const g of ["vd-stuur-financien", "vd-groep-1", "vd-student"]) {
      const c = await inloggenAls(g);
      const u = await c.from("cluster").update({ teams_link: "https://teams.microsoft.com/gehackt" }).eq("id", VD).select();
      expect(u.error !== null || (u.data ?? []).length === 0, g).toBe(true);
    }
    const docent = await (await inloggenAls("docent")).from("cluster").update({ teams_link: "https://teams.microsoft.com/l/team/test" }).eq("id", VD).select("teams_link");
    expect(docent.data?.[0]?.teams_link).toBe("https://teams.microsoft.com/l/team/test");
    // een link zonder https wordt door de database geweigerd
    const fout = await (await inloggenAls("docent")).from("cluster").update({ teams_link: "http://onveilig.nl" }).eq("id", VD);
    expect(fout.error).not.toBeNull();
    // de projectgroep leest hem wel
    const { data } = await (await inloggenAls("vd-groep-1")).from("cluster").select("teams_link").eq("id", VD).single();
    expect(data?.teams_link).toBe("https://teams.microsoft.com/l/team/test");
  });
});

describe("Blijf-actief, sessies en markering", () => {
  it("blijf_actief is zonder inloggen aan te roepen en geeft alleen een aantal terug", async () => {
    const { data, error } = await anoniem().rpc("blijf_actief");
    expect(error).toBeNull();
    expect(Number(data)).toBeGreaterThanOrEqual(1);
  });

  it("sessies intrekken kan alleen de server (service role), niemand anders", async () => {
    const { data: acc } = await admin.from("account").select("id").eq("gebruikersnaam", "vd-student").single();
    for (const g of ["docent", "vd-groep-1", "vd-student"]) {
      expect((await (await inloggenAls(g)).rpc("account_sessies_verwijderen", { p_user_id: acc!.id })).error, g).not.toBeNull();
    }
    expect((await anoniem().rpc("account_sessies_verwijderen", { p_user_id: acc!.id })).error).not.toBeNull();
  });

  it("de markering voor de livegang is voor clients niet te lezen of te schrijven", async () => {
    for (const g of ["docent", "vd-stuur-financien", "vd-groep-1"]) {
      const c = await inloggenAls(g);
      expect((await c.from("systeem_instelling").select("sleutel")).data ?? [], g).toHaveLength(0);
      expect((await c.from("systeem_instelling").insert({ sleutel: "livegang_op", waarde: "x" })).error, g).not.toBeNull();
    }
    expect((await anoniem().from("systeem_instelling").select("sleutel")).data ?? []).toHaveLength(0);
  });
});

describe("Export", () => {
  it("de docent kan alle tabellen in de export lezen: evenveel rijen als de service role", async () => {
    const docent = await exporteerAlles(await inloggenAls("docent"));
    const volledig = await exporteerAlles(admin);
    expect(Object.keys(docent.tabellen)).toEqual(EXPORT_TABELLEN.map((t) => t.naam));
    expect(docent.aantallen).toEqual(volledig.aantallen);
    expect(docent.aantallen.account).toBeGreaterThanOrEqual(31);
    expect(docent.aantallen.avf).toBeGreaterThanOrEqual(14);
  });

  it("een projectgroep ziet in een export alleen de eigen gegevens (de beheerpagina en de route zijn daarom ook alleen voor de docent)", async () => {
    const groep = await exporteerAlles(await inloggenAls("vd-groep-1"));
    expect(groep.aantallen.avf).toBe(1);
    expect(groep.aantallen.wijziging).toBeLessThan((await exporteerAlles(admin)).aantallen.wijziging);
  });

  it("de Excel-export heeft een tabblad per tabel met de juiste kolommen en een overzicht", async () => {
    const data = await exporteerAlles(admin);
    const buffer = await exportNaarExcel(data);
    const werkmap = new ExcelJS.Workbook();
    await werkmap.xlsx.load(buffer as unknown as ArrayBuffer);
    const namen = werkmap.worksheets.map((w) => w.name);
    expect(namen).toEqual(["Overzicht", ...EXPORT_TABELLEN.map((t) => t.naam)]);
    const avf = werkmap.getWorksheet("avf")!;
    const kop = (avf.getRow(1).values as (string | undefined)[]).filter(Boolean);
    expect(kop).toEqual(expect.arrayContaining(["id", "titel", "status", "beginsituatie"]));
    expect(avf.rowCount).toBe(data.aantallen.avf + 1);
    // lijsten (jsonb) staan als tekst
    const idx = (avf.getRow(1).values as string[]).indexOf("beginsituatie");
    const eerste = avf.getRow(2).getCell(idx).value;
    expect(typeof eerste === "string" || eerste === null).toBe(true);
  });
});

describe("Livegangscript: de droge run", () => {
  it("laat zien wat er zou gebeuren en wijzigt niets", async () => {
    const voor = await exporteerAlles(admin);
    const res = spawnSync("npx", ["tsx", "scripts/livegang.ts", "--droog"], { encoding: "utf8", shell: true });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("DROGE RUN");
    expect(res.stdout).toContain("Droge run klaar. Er is niets gewijzigd.");
    expect(res.stdout).toContain("Blijft staan: de materialenlijst");
    const na = await exporteerAlles(admin);
    expect(na.aantallen).toEqual(voor.aantallen);
  }, 120000);

  it("weigert een onbekend cluster en stopt zonder de bevestiging", async () => {
    const onbekend = spawnSync("npx", ["tsx", "scripts/livegang.ts", "--cluster=XX", "--droog"], { encoding: "utf8", shell: true });
    expect(onbekend.status).not.toBe(0);
    // een verkeerd bevestigingswoord stopt voordat er iets gebeurt
    const voor = await exporteerAlles(admin);
    const fout = spawnSync("npx", ["tsx", "scripts/livegang.ts", "--cluster=TEST", "--bevestig=ja"], { encoding: "utf8", shell: true });
    expect(fout.stdout).toContain("Gestopt. Er is niets gewijzigd.");
    expect((await exporteerAlles(admin)).aantallen).toEqual(voor.aantallen);
  }, 120000);
});
