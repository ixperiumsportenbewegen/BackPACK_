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
let ingevuldeLeeg: { id: string; voorraad_camping: number | null; voorraad_bivak: number | null }[] = [];

async function herstelLeeg() {
  for (const m of ingevuldeLeeg) {
    await admin.from("materiaal").update({ voorraad_camping: m.voorraad_camping, voorraad_bivak: m.voorraad_bivak }).eq("id", m.id);
  }
  ingevuldeLeeg = [];
}

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
  // materialen zonder voorraad tijdelijk op 0, zodat de lijst definitief kan worden
  const { data: leeg } = await admin.from("materiaal").select("id, voorraad_camping, voorraad_bivak").or("voorraad_camping.is.null,voorraad_bivak.is.null");
  ingevuldeLeeg = leeg ?? [];
  for (const m of ingevuldeLeeg) await admin.from("materiaal").update({ voorraad_camping: m.voorraad_camping ?? 0, voorraad_bivak: m.voorraad_bivak ?? 0 }).eq("id", m.id);
  await admin.from("materiaal").insert({ naam: "TestMat Touw", categorie: "Touwen en stokken", voorraad_camping: 6, voorraad_bivak: 4, bijgewerkt_door_naam: NAAM });
  await admin.from("materiaallijst_status").update({ status: "concept", definitief_op: null, definitief_door_naam: null, definitief_door_cluster: null }).eq("id", true);
  await admin.from("avf").update({ locatie_keuze: "camping", status: "in_ontwikkeling" }).eq("id", avfTest2);
});

test.afterAll(async () => {
  await opschonen(); // zet eerst de status terug op concept (anders mag de voorraad niet meer leeg)
  await herstelLeeg();
});

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
  await expect(l.getByRole("heading", { name: "Concept: voorraad nog in te schatten" })).toBeVisible();
  await l.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  await l.getByText("Materiaal toevoegen", { exact: true }).click();
  const toevoegen = l.locator("form").filter({ has: l.getByLabel("Voorraad camping", { exact: true }) });
  await toevoegen.getByLabel("Naam").fill("TestMat UI");
  await toevoegen.getByLabel("Voorraad camping").fill("8");
  await toevoegen.getByLabel("Voorraad bivak").fill("1");
  await toevoegen.getByRole("button", { name: "Toevoegen" }).click();
  await expect(l.getByText("TestMat UI", { exact: true })).toBeVisible();
  // de voorraad staat in een tabel en is direct aan te passen
  const camping = l.getByLabel("Voorraad camping TestMat UI");
  await camping.fill("9");
  await camping.blur();
  await expect.poll(async () => (await admin.from("materiaal").select("voorraad_camping").eq("naam", "TestMat UI").single()).data?.voorraad_camping).toBe(9);
  await expect(l.getByText(/van \d+ materialen ingeschat/)).toBeVisible();
  await l.getByRole("button", { name: "Lijst definitief maken" }).click();
  await expect(l.getByText("Zijn de inschattingen voor camping en bivak klaar?")).toBeVisible();
  await l.getByRole("button", { name: "Ja, definitief maken" }).click();
  await expect(l.getByRole("heading", { name: "De lijst is definitief" })).toBeVisible();

  // het totaaloverzicht om af te drukken of als PDF op te slaan
  await l.goto("/stuurgroep/materialen/afdrukken");
  await expect(l.getByRole("heading", { name: "Materialenlijst", level: 1 })).toBeVisible();
  await expect(l.getByText("TestMat Touw")).toBeVisible();
  await expect(l.getByText(/Definitief, gemaakt door/)).toBeVisible();

  // 3. De groep kiest touw voor de romp: er is genoeg
  await g.goto("/avf/F");
  await g.getByLabel("Wie werkt hier?").fill(NAAM);
  await expect(g.getByText("Locatie: Camping")).toBeVisible();
  const kiezen = g.locator("form").filter({ has: g.getByRole("heading", { name: "Materiaal kiezen" }) });
  await kiezen.getByLabel("Materiaal").selectOption({ label: "TestMat Touw (6 beschikbaar)" });
  await kiezen.getByLabel("Waarvoor").selectOption("romp");
  await kiezen.getByLabel("Aantal").fill("2");
  await kiezen.getByRole("button", { name: "Toevoegen" }).click();
  await expect(g.getByLabel("Aantal TestMat Touw")).toHaveValue("2");

  // 4. Te veel vragen geeft een tekortwaarschuwing
  const aantal = g.getByLabel("Aantal TestMat Touw");
  await aantal.fill("9");
  await aantal.blur();
  await expect(g.getByText(/Tekort van 3\. Op de camping ligt 6/)).toBeVisible();

  // 5. De stuurgroep ziet het tekort en corrigeert het aantal; de groep ziet dat
  const stuur = await nieuweSessie(browser, "test-stuur");
  const s = stuur.page;
  await s.goto("/stuurgroep/materialen/behoefte");
  await expect(s.getByText("TestMat Touw: tekort van 3")).toBeVisible();
  await s.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  const correctie = s.getByLabel("Gecorrigeerd aantal TestMat Touw romp");
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
  await expect(vc.page.getByText("Materiaal toevoegen", { exact: true })).toBeVisible();
  await expect(vc.page.getByRole("button", { name: "Opslaan", exact: true })).toHaveCount(0);
  await expect(vc.page.getByText("TestMat Touw").first()).toBeVisible();
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
