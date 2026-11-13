/**
 * Rolverdeling (PGR-01), namen per stuurgroeprol en het startscherm (OVZ-01, OVZ-02).
 * Draait tegen het echte Supabase-project en zet de namen daarna terug.
 */
import { expect, test, type Page } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

async function groepId(nummer: number) {
  const VD = await clusterId("VD");
  const { data } = await admin.from("projectgroep").select("id").eq("cluster_id", VD).eq("nummer", nummer).single();
  return data!.id as string;
}

let origineleRollen: { projectgroep_id: string; rol: string; namen: string | null }[] = [];
let origineleStudenten: { id: string; studenten: string | null }[] = [];

test.beforeAll(async () => {
  const VD = await clusterId("VD");
  const { data: g } = await admin.from("projectgroep").select("id").eq("cluster_id", VD);
  const { data: r } = await admin.from("projectgroep_rol").select("projectgroep_id, rol, namen").in("projectgroep_id", g!.map((x) => x.id));
  origineleRollen = r ?? [];
  const { data: s } = await admin.from("stuurgroeprol").select("id, studenten").eq("cluster_id", VD);
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

async function veld(page: Page, label: string) {
  return page.getByLabel(label, { exact: true });
}

test("een projectgroep vult de rolverdeling in en ziet die terug na verversen", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-2");
  await s.page.goto("/meer");
  await s.page.getByRole("link", { name: /Rolverdeling van jullie projectgroep/ }).click();
  await expect(s.page.getByRole("heading", { name: "Rolverdeling" })).toBeVisible();

  const catering = await veld(s.page, "Catering");
  await catering.fill("Mila en Daan");
  await catering.blur();
  await expect(s.page.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();

  await s.page.reload();
  await expect(await veld(s.page, "Catering")).toHaveValue("Mila en Daan");

  // Andere groep ziet dit niet in het eigen formulier
  const andere = await nieuweSessie(browser, "vd-groep-3");
  await andere.page.goto("/meer/rolverdeling");
  await expect(await veld(andere.page, "Catering")).toHaveValue("");
  await Promise.all([s.ctx.close(), andere.ctx.close()]);
});

test("gelijktijdig dezelfde rol wijzigen geeft een waarschuwing", async ({ browser }) => {
  const a = await nieuweSessie(browser, "vd-groep-4");
  const b = await nieuweSessie(browser, "vd-groep-4");
  await a.page.goto("/meer/rolverdeling");
  await b.page.goto("/meer/rolverdeling");

  const vB = await veld(b.page, "Projectleider");
  await vB.fill("Fleur");
  await vB.blur();
  await expect(b.page.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();

  const vA = await veld(a.page, "Projectleider");
  await vA.fill("Jesse");
  await vA.blur();
  await expect(a.page.getByText(/Iemand anders heeft dit net gewijzigd/).first()).toBeVisible();

  const { data } = await admin.from("projectgroep_rol").select("namen").eq("projectgroep_id", await groepId(4)).eq("rol", "projectleider").single();
  expect(data?.namen).toBe("Fleur"); // niets ongemerkt overschreven

  await a.page.getByRole("button", { name: "Mijn versie bewaren" }).click();
  await expect.poll(async () =>
    (await admin.from("projectgroep_rol").select("namen").eq("projectgroep_id", await groepId(4)).eq("rol", "projectleider").single()).data?.namen,
  ).toBe("Jesse");
  await Promise.all([a.ctx.close(), b.ctx.close()]);
});

test("een student en de stuurgroep zien de rolverdeling-pagina van een projectgroep niet", async ({ browser }) => {
  for (const gebruiker of ["vd-student", "vd-stuur-programma"]) {
    const s = await nieuweSessie(browser, gebruiker);
    await s.page.goto("/meer/rolverdeling");
    await expect(s.page).toHaveURL(/\/meer$/);
    await s.ctx.close();
  }
});

test("de stuurgroep past alleen de namen bij de eigen rol aan", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-stuur-programma");
  await s.page.goto("/stuurgroep?alle=1");

  const eigen = await veld(s.page, "Programma & Kwaliteit");
  await eigen.fill("Anna en Bram");
  await eigen.blur();
  await expect(s.page.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();
  await s.page.reload();
  await expect(await veld(s.page, "Programma & Kwaliteit")).toHaveValue("Anna en Bram");

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

test("startscherm: zes belevenissenkaarten; stand per rol alleen voor stuurgroep en docent", async ({ browser }) => {
  const groep = await nieuweSessie(browser, "vd-groep-1");
  await expect(groep.page.locator("main article")).toHaveCount(6);
  await expect(groep.page.getByRole("heading", { name: "Stand van zaken per rol" })).toHaveCount(0);
  await expect(groep.page.getByRole("link", { name: /Rolverdeling invullen/ })).toBeVisible();
  await groep.ctx.close();

  const student = await nieuweSessie(browser, "vd-student");
  await expect(student.page.locator("main article")).toHaveCount(6);
  await expect(student.page.getByRole("heading", { name: "Stand van zaken per rol" })).toHaveCount(0);
  await student.ctx.close();

  const stuur = await nieuweSessie(browser, "vd-stuur-veiligheid");
  await expect(stuur.page.locator("main article")).toHaveCount(6);
  await expect(stuur.page.getByRole("heading", { name: "Stand van zaken per rol" })).toBeVisible();
  await expect(stuur.page.getByText("Nog niets te melden")).toHaveCount(4);
  await stuur.ctx.close();
});
