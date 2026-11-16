/**
 * Rolverdeling (PGR-01), namen per stuurgroeprol (één naam per veld) en de namen op het startscherm en onder Meer.
 * Draait op het cluster TEST (niet op VD of VC, want de test vult namen in) en zet de namen daarna terug.
 */
import { expect, test, type Page } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

async function groepId(nummer: number) {
  const TEST = await clusterId("TEST");
  const { data } = await admin.from("projectgroep").select("id").eq("cluster_id", TEST).eq("nummer", nummer).single();
  return data!.id as string;
}

async function namenVan(nummer: number, rol: string) {
  return (await admin.from("projectgroep_rol").select("namen").eq("projectgroep_id", await groepId(nummer)).eq("rol", rol).single()).data?.namen ?? null;
}

let origineleRollen: { projectgroep_id: string; rol: string; namen: string | null }[] = [];
let origineleStudenten: { id: string; studenten: string | null }[] = [];

test.beforeAll(async () => {
  const TEST = await clusterId("TEST");
  const { data: g } = await admin.from("projectgroep").select("id").eq("cluster_id", TEST);
  const { data: r } = await admin.from("projectgroep_rol").select("projectgroep_id, rol, namen").in("projectgroep_id", g!.map((x) => x.id));
  origineleRollen = r ?? [];
  const { data: s } = await admin.from("stuurgroeprol").select("id, studenten").eq("cluster_id", TEST);
  origineleStudenten = s ?? [];
});

test.afterAll(async () => {
  for (const r of origineleRollen) {
    await admin.from("projectgroep_rol").update({ namen: r.namen }).eq("projectgroep_id", r.projectgroep_id).eq("rol", r.rol);
  }
  for (const s of origineleStudenten) {
    await admin.from("stuurgroeprol").update({ studenten: s.studenten }).eq("id", s.id);
  }
});

function veld(page: Page, label: string, nummer: number) {
  return page.getByLabel(`${label}, naam ${nummer}`, { exact: true });
}

test("een projectgroep vult per naam een veld in; er komt steeds een leeg veld bij", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-groep-2");
  await s.page.goto("/meer");
  await s.page.getByRole("link", { name: /Rolverdeling van jullie projectgroep/ }).click();
  await expect(s.page.getByRole("heading", { name: "Rolverdeling" })).toBeVisible();

  // Eerst één leeg veld; zodra je typt komt er een tweede bij.
  await expect(veld(s.page, "Catering", 1)).toHaveValue("");
  await expect(veld(s.page, "Catering", 2)).toHaveCount(0);
  await veld(s.page, "Catering", 1).fill("Mila");
  await expect(veld(s.page, "Catering", 2)).toBeVisible();
  await veld(s.page, "Catering", 2).fill("Daan");
  await veld(s.page, "Catering", 2).blur();
  await expect(s.page.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();
  await expect(veld(s.page, "Catering", 3)).toBeVisible();
  expect(await namenVan(2, "catering")).toBe("Mila, Daan");

  await s.page.reload();
  await expect(veld(s.page, "Catering", 1)).toHaveValue("Mila");
  await expect(veld(s.page, "Catering", 2)).toHaveValue("Daan");
  await expect(veld(s.page, "Catering", 3)).toHaveValue("");

  // Een naam verwijderen met het kruisje
  await s.page.getByRole("button", { name: "Verwijder Mila" }).click();
  await expect.poll(() => namenVan(2, "catering")).toBe("Daan");

  // Een komma werkt niet als scheiding in één veld: één naam per veld
  await veld(s.page, "Catering", 1).fill("Eva, Sem");
  await veld(s.page, "Catering", 1).blur();
  await expect.poll(() => namenVan(2, "catering")).toBe("Eva Sem");

  // Een andere groep ziet dit niet in het eigen formulier
  const andere = await nieuweSessie(browser, "test-groep-1");
  await andere.page.goto("/meer/rolverdeling");
  await expect(andere.page.locator('input[value="Eva Sem"]')).toHaveCount(0);
  await Promise.all([s.ctx.close(), andere.ctx.close()]);
});

test("gelijktijdig dezelfde rol wijzigen geeft een waarschuwing", async ({ browser }) => {
  const a = await nieuweSessie(browser, "test-groep-2");
  const b = await nieuweSessie(browser, "test-groep-2");
  await a.page.goto("/meer/rolverdeling");
  await b.page.goto("/meer/rolverdeling");

  const vB = veld(b.page, "Projectleider", 1);
  await vB.fill("Fleur");
  await vB.blur();
  await expect(b.page.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();

  const vA = veld(a.page, "Projectleider", 1);
  await vA.fill("Jesse");
  await vA.blur();
  await expect(a.page.getByText(/Iemand anders heeft dit net gewijzigd/).first()).toBeVisible();
  expect(await namenVan(2, "projectleider")).toBe("Fleur"); // niets ongemerkt overschreven

  await a.page.getByRole("button", { name: "Mijn versie bewaren" }).click();
  await expect.poll(() => namenVan(2, "projectleider")).toBe("Jesse");
  await Promise.all([a.ctx.close(), b.ctx.close()]);
});

test("een student en de stuurgroep zien de rolverdeling-pagina van een projectgroep niet", async ({ browser }) => {
  for (const gebruiker of ["test-student", "test-stuur"]) {
    const s = await nieuweSessie(browser, gebruiker);
    await s.page.goto("/meer/rolverdeling");
    await expect(s.page).toHaveURL(/\/meer$/);
    await s.ctx.close();
  }
});

test("de stuurgroep past alleen de namen bij de eigen rol aan, ook per naam in een eigen veld", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur"); // rol Projectleiding
  await s.page.goto("/stuurgroep?alle=1");

  await veld(s.page, "Projectleiding", 1).fill("Anna");
  await veld(s.page, "Projectleiding", 2).fill("Bram");
  await veld(s.page, "Projectleiding", 2).blur();
  await expect(s.page.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();
  const TEST = await clusterId("TEST");
  const opgeslagen = async () =>
    (await admin.from("stuurgroeprol").select("studenten").eq("cluster_id", TEST).eq("code", "projectleiding").single()).data?.studenten;
  await expect.poll(opgeslagen).toBe("Anna, Bram");
  await s.page.reload();
  await expect(veld(s.page, "Projectleiding", 1)).toHaveValue("Anna");
  await expect(veld(s.page, "Projectleiding", 2)).toHaveValue("Bram");

  // Andere rollen zijn alleen-lezen: geen invoerveld
  await expect(s.page.locator("input#namen-beleving-thema")).toHaveCount(0);
  await expect(s.page.locator("p#namen-beleving-thema")).toBeVisible();
  await s.ctx.close();

  // De docent kan alle rollen aanpassen
  const d = await nieuweSessie(browser, "docent");
  await d.page.goto("/stuurgroep?alle=1");
  await expect(d.page.locator("input#namen-beleving-thema")).toHaveCount(1);
  await d.ctx.close();
});

test("iedereen in het cluster ziet de namen van de groepsleden op het startscherm", async ({ browser }) => {
  // Na de eerste test staat bij Testgroep 2 onder meer "Eva Sem"
  for (const gebruiker of ["test-student", "test-groep-1", "test-stuur"]) {
    const s = await nieuweSessie(browser, gebruiker);
    await s.page.goto("/");
    const kaart = s.page.locator("main article", { hasText: "Testgroep 2" });
    await expect(kaart).toContainText("Eva Sem");
    await expect(kaart).toContainText(/\d+ (persoon|personen):/);
    await s.ctx.close();
  }
});

test("Meer heeft voor iedereen een overzicht van de stuurgroep met de namen van de leden", async ({ browser }) => {
  for (const gebruiker of ["test-student", "test-groep-1", "test-stuur"]) {
    const s = await nieuweSessie(browser, gebruiker);
    await s.page.goto("/meer");
    await s.page.getByRole("link", { name: "Stuurgroep: onderwerpen en leden" }).click();
    await expect(s.page.getByRole("heading", { name: "Stuurgroep", level: 1 })).toBeVisible();
    await expect(s.page.locator("main li", { hasText: "Projectleiding" })).toContainText("2 personen: Anna, Bram");
    await expect(s.page.locator("main li h2")).toHaveCount(6);
    await s.ctx.close();
  }
});

test("startscherm: zes belevenissenkaarten; stand per rol alleen voor stuurgroep en docent", async ({ browser }) => {
  const groep = await nieuweSessie(browser, "vd-groep-1");
  await expect(groep.page.locator("main article")).toHaveCount(6);
  await expect(groep.page.getByRole("heading", { name: "Stand van zaken per rol" })).toHaveCount(0);
  await expect(groep.page.getByRole("link", { name: /Rolverdeling (invullen|bekijken)/ })).toBeVisible();
  await groep.ctx.close();

  const student = await nieuweSessie(browser, "vd-student");
  await expect(student.page.locator("main article")).toHaveCount(6);
  await expect(student.page.getByRole("heading", { name: "Stand van zaken per rol" })).toHaveCount(0);
  await student.ctx.close();

  const stuur = await nieuweSessie(browser, "vd-stuur-veiligheid");
  await expect(stuur.page.locator("main article")).toHaveCount(6);
  await expect(stuur.page.getByRole("heading", { name: "Stand van zaken per rol" })).toBeVisible();
  await expect(stuur.page.getByText("Nog niets te melden")).toHaveCount(2);
  await stuur.ctx.close();
});
