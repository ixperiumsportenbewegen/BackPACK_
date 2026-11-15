/**
 * Beheer (opdracht 5, deel C), op telefoonformaat: de beheerpagina van de docent (links, wachtwoord resetten, export),
 * de Forms-link door Communicatie & Financiën en de blijf-actief-route. Wachtwoorden worden op het fictieve cluster TEST
 * getest en daarna teruggezet.
 */
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { admin, clusterId } from "../tests/helpers";
import { inloggen, nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

const wachtwoorden: Record<string, string> = JSON.parse(readFileSync("seed/wachtwoorden.local.json", "utf8"));
let TEST = "";
let VC = "";
let beginLinks: Record<string, unknown> = {};
let beginVcForms: string | null = null;

test.beforeAll(async () => {
  TEST = await clusterId("TEST");
  VC = await clusterId("VC");
  const { data } = await admin.from("cluster").select("teams_link, forms_link").eq("id", TEST).single();
  beginLinks = data!;
  const { data: vc } = await admin.from("cluster").select("forms_link").eq("id", VC).single();
  beginVcForms = vc!.forms_link;
});

test.afterAll(async () => {
  await admin.from("cluster").update(beginLinks).eq("id", TEST);
  await admin.from("cluster").update({ forms_link: beginVcForms }).eq("id", VC);
  await admin.from("wijziging").delete().eq("naam", "Docent").eq("tabel", "account").eq("actie", "wachtwoord_gereset");
  await admin.from("wijziging").delete().eq("naam", "Docent").eq("actie", "forms_link_gewijzigd");
  await admin.from("wijziging").delete().eq("naam", "Testpersoon").eq("actie", "forms_link_gewijzigd");
});

test("de docent beheert de links van een cluster en exporteert alles", async ({ browser }) => {
  const docent = await nieuweSessie(browser, "docent");
  const p = docent.page;
  await p.getByRole("link", { name: "Meer", exact: true }).click();
  await p.getByRole("link", { name: /Beheer: wachtwoorden, links en export/ }).click();
  await expect(p.getByRole("heading", { name: "Beheer", level: 1 })).toBeVisible();

  const sectie = p.locator("section").filter({ has: p.getByRole("heading", { name: /Oefencluster/ }) });
  await sectie.getByLabel("Teams-link").fill("https://teams.microsoft.com/l/team/e2e-test");
  await sectie.getByLabel(/Forms-link voor declaraties/).fill("https://forms.office.com/r/e2e-test");
  await sectie.getByRole("button", { name: "Links opslaan" }).click();
  await expect(sectie.getByText("Opgeslagen", { exact: true })).toBeVisible();
  const { data } = await admin.from("cluster").select("teams_link, forms_link").eq("id", TEST).single();
  expect(data).toEqual({ teams_link: "https://teams.microsoft.com/l/team/e2e-test", forms_link: "https://forms.office.com/r/e2e-test" });

  // een link zonder https wordt geweigerd
  await sectie.getByLabel("Teams-link").fill("teams.microsoft.com/zonder-https");
  await sectie.getByRole("button", { name: "Links opslaan" }).click();
  await expect(sectie.getByRole("alert")).toContainText("https://");

  // export: JSON en Excel
  const json = await p.request.get("/api/export?formaat=json");
  expect(json.status()).toBe(200);
  expect(json.headers()["content-disposition"]).toContain("backpack-export");
  const inhoud = await json.json();
  expect(Object.keys(inhoud.tabellen)).toEqual(expect.arrayContaining(["avf", "budgetaanvraag", "materiaal", "wijziging", "account"]));
  expect(inhoud.aantallen.account).toBeGreaterThanOrEqual(31);
  const excel = await p.request.get("/api/export?formaat=excel");
  expect(excel.status()).toBe(200);
  expect(excel.headers()["content-type"]).toContain("spreadsheetml");
  expect((await excel.body()).byteLength).toBeGreaterThan(5000);
  await docent.ctx.close();
});

test("alleen de docent kan exporteren en de beheerpagina openen", async ({ browser }) => {
  for (const gebruiker of ["vd-stuur-financien", "vd-groep-1", "vd-student"]) {
    const s = await nieuweSessie(browser, gebruiker);
    const res = await s.page.request.get("/api/export");
    expect(res.status(), gebruiker).toBe(403);
    await s.page.goto("/beheer");
    await expect(s.page).toHaveURL(/\/$/);
    await s.ctx.close();
  }
  const zonder = await browser.newContext();
  const res = await zonder.request.get("http://localhost:3000/api/export", { maxRedirects: 0 });
  expect([307, 308, 302, 401, 403]).toContain(res.status());
  await zonder.close();
});

test("een wachtwoord resetten: nieuw wachtwoord eenmalig zichtbaar, oude sessies uitgelogd, inloggen werkt, daarna teruggezet", async ({ browser }) => {
  const oud = wachtwoorden["test-student"];
  const { data: acc } = await admin.from("account").select("id").eq("gebruikersnaam", "test-student").single();

  // een student is ingelogd
  const studentCtx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const student = await studentCtx.newPage();
  await inloggen(student, "test-student");

  const docent = await nieuweSessie(browser, "docent");
  const p = docent.page;
  await p.goto("/beheer");
  const sectie = p.locator("section").filter({ has: p.getByRole("heading", { name: /Oefencluster/ }) });
  await sectie.getByText(/Accounts en wachtwoorden/).click();
  const rij = sectie.locator("li").filter({ hasText: "test-student" });
  await rij.getByRole("button", { name: "Wachtwoord resetten" }).click();
  await expect(rij.getByText("Nieuw wachtwoord voor test-student?")).toBeVisible();
  await rij.getByRole("button", { name: "Ja, resetten" }).click();
  const nieuw = (await rij.getByTestId("nieuw-wachtwoord").innerText()).trim();
  expect(nieuw).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  expect(nieuw).not.toBe(oud);
  await expect(rij.getByRole("button", { name: "Kopieer voor Teams" })).toBeVisible();

  try {
    // de student is uitgelogd
    await student.goto("/");
    await expect(student).toHaveURL(/\/login$/);
    // met het oude wachtwoord kan niet meer
    await student.getByLabel("Gebruikersnaam").fill("test-student");
    await student.getByLabel("Wachtwoord").fill(oud);
    await student.getByRole("button", { name: "Inloggen" }).click();
    await expect(student.getByText("Gebruikersnaam of wachtwoord klopt niet.")).toBeVisible();
    // met het nieuwe wel
    await student.getByLabel("Gebruikersnaam").fill("test-student"); // het formulier wordt na een mislukte poging leeggemaakt
    await student.getByLabel("Wachtwoord").fill(nieuw);
    await student.getByRole("button", { name: "Inloggen" }).click();
    await expect(student).toHaveURL("/");
  } finally {
    await admin.auth.admin.updateUserById(acc!.id, { password: oud });
  }
  await studentCtx.close();

  // het docentaccount reset je hier niet, en een projectgroep kan de actie niet gebruiken
  await expect(p.locator("li").filter({ hasText: "docent" }).getByRole("button", { name: "Wachtwoord resetten" })).toHaveCount(0);
  const { data: log } = await admin.from("wijziging").select("actie").eq("tabel", "account").eq("record_id", acc!.id).eq("actie", "wachtwoord_gereset");
  expect((log ?? []).length).toBeGreaterThanOrEqual(1);
  await docent.ctx.close();
});

test("Communicatie & Financiën van VC stelt de Forms-link van het eigen cluster in", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vc-stuur-financien");
  const p = s.page;
  await p.goto("/stuurgroep/budget");
  await p.getByLabel("Wie werkt hier? (jouw naam)").fill("Testpersoon");
  const veld = p.getByLabel(/Link naar het declaratieformulier/);
  await veld.fill("https://forms.office.com/r/vc-e2e");
  await veld.blur();
  await expect(p.getByText("Opgeslagen", { exact: true })).toBeVisible();
  await expect.poll(async () => (await admin.from("cluster").select("forms_link").eq("id", VC).single()).data?.forms_link).toBe("https://forms.office.com/r/vc-e2e");
  await veld.fill("geen-link");
  await veld.blur();
  await expect(p.getByText("Een link begint met https://")).toBeVisible();

  // de projectgroepen van VC zien de link op hun budgetpagina
  const groep = await nieuweSessie(browser, "vc-groep-4");
  await groep.page.goto("/budget");
  await expect(groep.page.getByRole("link", { name: /Open het declaratieformulier/ })).toHaveAttribute("href", "https://forms.office.com/r/vc-e2e");
  await groep.ctx.close();
  await s.ctx.close();
});

test("blijf-actief antwoordt alleen met de geheime sleutel", async ({ request }) => {
  const sleutel = process.env.CRON_SECRET;
  test.skip(!sleutel, "CRON_SECRET staat niet in .env.local");
  expect((await request.get("/api/blijf-actief")).status()).toBe(401);
  expect((await request.get("/api/blijf-actief", { headers: { "x-cron-secret": "fout" } })).status()).toBe(401);
  const ok = await request.get("/api/blijf-actief", { headers: { "x-cron-secret": sleutel! } });
  expect(ok.status()).toBe(200);
  expect(await ok.text()).toBe("ok");
  const bearer = await request.get("/api/blijf-actief", { headers: { authorization: `Bearer ${sleutel}` } });
  expect(bearer.status()).toBe(200);
});

test("Beheer meldt welke links van een cluster nog niet zijn ingesteld", async ({ browser }) => {
  await admin.from("cluster").update({ teams_link: null, forms_link: null }).eq("id", TEST);
  const docent = await nieuweSessie(browser, "docent");
  const p = docent.page;
  await p.goto("/beheer");
  const melding = p.getByTestId("links-ontbreken-TEST");
  await expect(melding).toContainText("Teams-link");
  await expect(melding).toContainText("Forms-link");

  const sectie = p.locator("section").filter({ has: p.getByRole("heading", { name: /Oefencluster/ }) });
  await sectie.getByLabel("Teams-link").fill("https://teams.microsoft.com/l/team/e2e-melding");
  await sectie.getByRole("button", { name: "Links opslaan" }).click();
  await expect(sectie.getByText("Opgeslagen", { exact: true })).toBeVisible();
  // alleen de Forms-link ontbreekt nog
  await expect(melding).not.toContainText("Teams-link");
  await expect(melding).toContainText("Forms-link");
  await docent.ctx.close();
});
