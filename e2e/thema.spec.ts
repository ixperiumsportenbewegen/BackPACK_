/**
 * Meerdaagsethema (THM-01, THM-02): de stuurgroep van VD stelt het thema in,
 * alle VD-accounts zien het direct, VC ziet niets veranderen.
 * Draait tegen het echte Supabase-project en zet het thema van VD daarna terug.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { admin, clusterId } from "../tests/helpers";

test.describe.configure({ mode: "serial" });

const wachtwoorden: Record<string, string> = JSON.parse(readFileSync("seed/wachtwoorden.local.json", "utf8"));
const ORIGINEEL = {
  naam: null,
  verhaal: null,
  slogan: null,
  accentkleur: null,
  sfeerbeeld_pad: null,
  logo_pad: null,
  bijgewerkt_door_naam: null,
};

async function inloggen(page: Page, gebruiker: string) {
  await page.goto("/login");
  await page.getByLabel("Gebruikersnaam").fill(gebruiker);
  await page.getByLabel("Wachtwoord").fill(wachtwoorden[gebruiker]);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await expect(page).toHaveURL("/");
}

async function nieuweSessie(browser: Browser, gebruiker: string) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await ctx.newPage();
  await inloggen(page, gebruiker);
  return { ctx, page };
}

async function opruimen() {
  const VD = await clusterId("VD");
  await admin.from("meerdaagsethema").update(ORIGINEEL).eq("cluster_id", VD);
  const { data } = await admin.storage.from("thema").list(`cluster/${VD}`);
  const weg = (data ?? []).filter((f) => /^(sfeerbeeld|logo)-/.test(f.name)).map((f) => `cluster/${VD}/${f.name}`);
  if (weg.length) await admin.storage.from("thema").remove(weg);
}

test.beforeAll(opruimen);
test.afterAll(opruimen);

test("de stuurgroep stelt het thema in; VD ziet het direct, VC niet", async ({ browser }) => {
  const stuur = await nieuweSessie(browser, "vd-stuur-beleving");
  const p = stuur.page;
  await p.goto("/stuurgroep/beleving-thema");

  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  const naam = p.getByLabel("Naam van het thema");
  await naam.fill("Ardennen Avontuur");
  await naam.blur();
  await expect(p.getByText("Opgeslagen").first()).toBeVisible();

  await p.getByRole("radio", { name: "Blauw" }).click();
  await expect(p.getByRole("radio", { name: "Blauw" })).toHaveAttribute("aria-checked", "true");
  await expect(p.getByText(/Contrast zwarte tekst/)).toBeVisible();

  // Een andere VD-account ziet de nieuwe naam direct
  const groep = await nieuweSessie(browser, "vd-groep-1");
  await expect(groep.page.getByRole("banner").getByText("Ardennen Avontuur")).toBeVisible();
  await expect(groep.page.getByRole("heading", { name: "Ardennen Avontuur" })).toBeVisible();
  const accent = await groep.page.evaluate(() => getComputedStyle(document.querySelector("header")!).borderBottomColor);
  expect(accent).toBe("rgb(106, 195, 237)"); // #6AC3ED

  // VC ziet niets veranderen
  const vc = await nieuweSessie(browser, "vc-groep-1");
  await expect(vc.page.getByRole("banner").getByText("Ardennen Avontuur")).toHaveCount(0);
  await expect(vc.page.getByRole("heading", { name: "Meerdaagsethema nog niet gekozen" })).toBeVisible();

  // Een projectgroep komt niet op de werkpagina
  await groep.page.goto("/stuurgroep/beleving-thema");
  await expect(groep.page).toHaveURL("/");

  await Promise.all([stuur.ctx.close(), groep.ctx.close(), vc.ctx.close()]);
});

test("een eigen sfeerbeeld uploaden: zichtbaar in VD, niet opvraagbaar vanuit VC", async ({ browser }) => {
  const stuur = await nieuweSessie(browser, "vd-stuur-beleving");
  const p = stuur.page;
  await p.goto("/stuurgroep/beleving-thema");
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");

  const donker = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#203020" } }).png().toBuffer();
  await p.locator('input[type="file"]').first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: donker });
  await expect(p.getByText("Opgeslagen").first()).toBeVisible({ timeout: 15000 });
  await expect(p.getByText(/erg licht/)).toHaveCount(0);

  const VD = await clusterId("VD");
  const { data } = await admin.from("meerdaagsethema").select("sfeerbeeld_pad").eq("cluster_id", VD).single();
  const pad = data!.sfeerbeeld_pad as string;
  expect(pad).toMatch(new RegExp(`^cluster/${VD}/sfeerbeeld-\\d+\\.webp$`));

  const groep = await nieuweSessie(browser, "vd-groep-1");
  const eigen = await groep.page.request.get(`/api/thema/${pad}`);
  expect(eigen.status()).toBe(200);
  expect(eigen.headers()["content-type"]).toContain("image/");

  const vc = await nieuweSessie(browser, "vc-groep-1");
  const vreemd = await vc.page.request.get(`/api/thema/${pad}`);
  expect(vreemd.status()).toBe(404);

  await Promise.all([stuur.ctx.close(), groep.ctx.close(), vc.ctx.close()]);
});

test("een erg licht sfeerbeeld geeft een waarschuwing", async ({ browser }) => {
  const stuur = await nieuweSessie(browser, "vd-stuur-beleving");
  const p = stuur.page;
  await p.goto("/stuurgroep/beleving-thema");
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  const licht = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#ffffff" } }).png().toBuffer();
  await p.locator('input[type="file"]').first().setInputFiles({ name: "licht.png", mimeType: "image/png", buffer: licht });
  await expect(p.getByText(/erg licht/)).toBeVisible({ timeout: 15000 });
  await stuur.ctx.close();
});

test("een outdoorfoto kiezen als sfeerbeeld", async ({ browser }) => {
  const stuur = await nieuweSessie(browser, "vd-stuur-beleving");
  const p = stuur.page;
  await p.goto("/stuurgroep/beleving-thema");
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  await p.getByRole("button", { name: /Vuur in de avond/ }).click();
  await expect(p.getByRole("button", { name: /Vuur in de avond/ })).toHaveAttribute("aria-pressed", "true");
  const VD = await clusterId("VD");
  await expect
    .poll(async () => (await admin.from("meerdaagsethema").select("sfeerbeeld_pad").eq("cluster_id", VD).single()).data?.sfeerbeeld_pad)
    .toBe("fotos/vuur-avond");
  await stuur.ctx.close();
});

test("gelijktijdig wijzigen van hetzelfde veld geeft een waarschuwing", async ({ browser }) => {
  const a = await nieuweSessie(browser, "vd-stuur-beleving");
  const b = await nieuweSessie(browser, "vd-stuur-beleving");
  for (const s of [a, b]) {
    await s.page.goto("/stuurgroep/beleving-thema");
    await s.page.getByLabel("Wie werkt hier?").fill(s === a ? "Persoon A" : "Persoon B");
  }

  const slogA = a.page.getByLabel("Slogan (mag leeg)");
  const slogB = b.page.getByLabel("Slogan (mag leeg)");
  await slogB.fill("Slogan van B");
  await slogB.blur();
  await expect(b.page.getByText("Opgeslagen").first()).toBeVisible();

  await slogA.fill("Slogan van A");
  await slogA.blur();
  await expect(a.page.getByText("Persoon B heeft dit net gewijzigd")).toBeVisible();
  const VD = await clusterId("VD");
  const { data } = await admin.from("meerdaagsethema").select("slogan").eq("cluster_id", VD).single();
  expect(data?.slogan).toBe("Slogan van B"); // niets ongemerkt overschreven

  // Een ander veld blijft gewoon opslaan
  const verhaal = a.page.getByLabel("Korte verhaallijn");
  await verhaal.fill("Nieuw verhaal van A");
  await verhaal.blur();
  await expect(a.page.getByText("Opgeslagen").first()).toBeVisible();

  // "Mijn versie bewaren" overschrijft bewust
  await a.page.getByRole("button", { name: "Mijn versie bewaren" }).click();
  await expect.poll(async () => (await admin.from("meerdaagsethema").select("slogan").eq("cluster_id", VD).single()).data?.slogan).toBe("Slogan van A");
  await Promise.all([a.ctx.close(), b.ctx.close()]);
});
