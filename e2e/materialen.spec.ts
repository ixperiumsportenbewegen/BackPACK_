/**
 * Materialen (opdracht 5, deel A), op telefoonformaat: de lijst bouwen en definitief maken, materiaal kiezen in sectie F
 * met een tekortwaarschuwing, de stuurgroep corrigeert, en VC mag alleen toevoegen.
 * Het materiaal wordt gekozen door test-groep-2 (cluster TEST); alles wordt daarna opgeruimd.
 */
import { expect, test } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

const NAAM = "Testpersoon";
let avfTest2 = "";
let beginStatus: Record<string, unknown> = {};
let origineleLocatie: string | null = null;
let origineleStatus = "in_ontwikkeling";

async function opschonen() {
  if (!avfTest2) return;
  await admin.from("avf_materiaal").delete().eq("avf_id", avfTest2);
  await admin.from("materiaal").delete().ilike("naam", "TestMat%");
  await admin.from("avf").update({ locatie_keuze: origineleLocatie, status: origineleStatus }).eq("id", avfTest2);
  await admin.from("wijziging").delete().eq("naam", NAAM).in("tabel", ["materiaal", "materiaallijst_status"]);
  await admin.from("wijziging").delete().eq("naam", NAAM).eq("record_id", avfTest2);
  await admin.from("materiaallijst_status").update({
    status: beginStatus.status, definitief_op: beginStatus.definitief_op, definitief_door_naam: beginStatus.definitief_door_naam,
    definitief_door_cluster: beginStatus.definitief_door_cluster,
  }).eq("id", true);
}

test.beforeAll(async () => {
  const TEST = await clusterId("TEST");
  const { data } = await admin.from("avf").select("id, locatie_keuze, status, projectgroep:projectgroep_id!inner(nummer)").eq("cluster_id", TEST).eq("projectgroep.nummer", 2).single();
  avfTest2 = data!.id;
  origineleLocatie = data!.locatie_keuze;
  origineleStatus = data!.status;
  const { data: s } = await admin.from("materiaallijst_status").select("*").eq("id", true).single();
  beginStatus = s!;
  await opschonen();
  await admin.from("materiaallijst_status").update({ status: "concept", definitief_op: null, definitief_door_naam: null, definitief_door_cluster: null }).eq("id", true);
  await admin.from("avf").update({ locatie_keuze: "camping", status: "in_ontwikkeling" }).eq("id", avfTest2);
});

test.afterAll(opschonen);

test("de lijst bouwen, definitief maken, kiezen, tekort zien en corrigeren", async ({ browser }) => {
  const groep = await nieuweSessie(browser, "test-groep-2");
  const logistiek = await nieuweSessie(browser, "vd-stuur-logistiek");
  const g = groep.page;
  const l = logistiek.page;

  // 1. Zolang de lijst concept is, kunnen groepen nog niets kiezen
  await g.goto("/avf/F");
  await expect(g.getByText("De materialenlijst is nog niet klaar")).toBeVisible();

  // 2. Logistiek & Facilitair opent de lijst via zijn eigen rol, voegt iets toe en maakt de lijst definitief
  await l.goto("/stuurgroep");
  await expect(l).toHaveURL(/rol\/logistiek_facilitair$/);
  await l.getByRole("link", { name: /Materialenlijst/ }).first().click();
  await expect(l.getByRole("heading", { name: "De lijst is nog een concept" })).toBeVisible();
  await l.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  const toevoegen = l.locator("form").filter({ has: l.getByRole("heading", { name: "Materiaal toevoegen" }) });
  await toevoegen.getByLabel("Naam").fill("TestMat UI");
  await toevoegen.getByLabel("Categorie").fill("Test");
  await toevoegen.getByLabel("Voorraad camping").fill("8");
  await toevoegen.getByLabel("Voorraad bivak").fill("1");
  await toevoegen.getByRole("button", { name: "Toevoegen" }).click();
  await expect(l.getByText("Alle materialen (14)")).toBeVisible();
  await l.getByRole("button", { name: "Lijst definitief maken" }).click();
  await expect(l.getByText("Weet je zeker dat de voorraad op de camping en het bivak klopt?")).toBeVisible();
  await l.getByRole("button", { name: "Ja, definitief maken" }).click();
  await expect(l.getByRole("heading", { name: "De lijst is definitief" })).toBeVisible();

  // 3. De groep kiest touw voor de romp: er is genoeg
  await g.goto("/avf/F");
  await g.getByLabel("Wie werkt hier?").fill(NAAM);
  await expect(g.getByText("Locatie: Camping")).toBeVisible();
  const kiezen = g.locator("form").filter({ has: g.getByRole("heading", { name: "Materiaal kiezen" }) });
  await kiezen.getByLabel("Materiaal").selectOption({ label: "Touw (10 m) (6 beschikbaar)" });
  await kiezen.getByLabel("Waarvoor").selectOption("romp");
  await kiezen.getByLabel("Aantal").fill("2");
  await kiezen.getByRole("button", { name: "Toevoegen" }).click();
  await expect(g.getByLabel("Aantal Touw (10 m)")).toHaveValue("2");

  // 4. Te veel vragen geeft een tekortwaarschuwing
  const aantal = g.getByLabel("Aantal Touw (10 m)");
  await aantal.fill("9");
  await aantal.blur();
  await expect(g.getByText(/Tekort van 3\. Op de camping ligt 6/)).toBeVisible();

  // 5. De stuurgroep ziet het tekort en corrigeert het aantal; de groep ziet dat
  const stuur = await nieuweSessie(browser, "test-stuur");
  const s = stuur.page;
  await s.goto("/stuurgroep/materialen/behoefte");
  await expect(s.getByText("Touw (10 m): tekort van 3")).toBeVisible();
  await s.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  const correctie = s.getByLabel("Gecorrigeerd aantal Touw (10 m) romp");
  await correctie.fill("5");
  await correctie.blur();
  await expect(s.getByText("Geen tekorten.")).toBeVisible();
  await g.reload();
  await expect(g.getByText("De stuurgroep heeft dit aantal aangepast naar 5.")).toBeVisible();
  await stuur.ctx.close();

  // 6. VC ziet de lijst en kan alleen toevoegen
  const vc = await nieuweSessie(browser, "vc-stuur-logistiek");
  await vc.page.goto("/stuurgroep/materialen");
  await expect(vc.page.getByRole("heading", { name: "De lijst is definitief" })).toBeVisible();
  await expect(vc.page.getByRole("heading", { name: "Materiaal toevoegen" })).toBeVisible();
  await expect(vc.page.getByRole("button", { name: "Opslaan", exact: true })).toHaveCount(0);
  await expect(vc.page.getByText("Touw (10 m)").first()).toBeVisible();
  await vc.ctx.close();

  // 7. Een projectgroep ziet de beheerpagina niet
  await g.goto("/stuurgroep/materialen");
  await expect(g).toHaveURL(/\/$/);

  await groep.ctx.close();
  await logistiek.ctx.close();
});

test("zonder locatie kunnen groepen geen materiaal kiezen", async ({ browser }) => {
  await admin.from("avf_materiaal").delete().eq("avf_id", avfTest2);
  await admin.from("avf").update({ locatie_keuze: null }).eq("id", avfTest2);
  const groep = await nieuweSessie(browser, "test-groep-2");
  await groep.page.goto("/avf/F");
  await expect(groep.page.getByRole("heading", { name: "Kies eerst de locatie" })).toBeVisible();
  await expect(groep.page.getByRole("heading", { name: "Materiaal kiezen" })).toHaveCount(0);
  await groep.page.getByRole("link", { name: "Naar sectie A" }).click();
  await expect(groep.page.getByRole("radiogroup", { name: "Op welke locatie vindt de belevenis plaats?" })).toBeVisible();
  await groep.ctx.close();
});
