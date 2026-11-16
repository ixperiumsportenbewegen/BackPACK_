/**
 * Materialen (opdracht 5, deel A), op telefoonformaat: de lijst bouwen en publiceren, materiaal kiezen in sectie F
 * met een tekortwaarschuwing, aanvragen van een projectgroep, de stuurgroep corrigeert, de paklijst telt mee,
 * en VD en VC passen de lijst aan (verwijderen kan niet als een groep het heeft gekozen).
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
  await admin.from("materiaal_aanvraag").delete().eq("avf_id", avfTest2);
  await admin.from("avf_materiaal").delete().eq("avf_id", avfTest2);
  await admin.from("materiaal").delete().ilike("naam", "TestMat%");
  await admin.from("avf").update({ locatie_keuze: origineleLocatie, status: origineleStatus }).eq("id", avfTest2);
  await admin.from("wijziging").delete().eq("naam", NAAM).in("tabel", ["materiaal", "materiaallijst_status", "materiaal_telling"]);
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
  await admin.from("materiaal").insert({ naam: "TestMat Touw", categorie: "Touwen en stokken", voorraad_camping: 6, voorraad_bivak: 4, bijgewerkt_door_naam: NAAM });
  await admin.from("materiaallijst_status").update({ status: "concept", definitief_op: null, definitief_door_naam: null, definitief_door_cluster: null }).eq("id", true);
  await admin.from("avf").update({ locatie_keuze: "camping", status: "in_ontwikkeling" }).eq("id", avfTest2);
});

test.afterAll(opschonen);

test("de lijst bouwen, publiceren, kiezen, aanvragen, tekort zien, corrigeren en tellen", async ({ browser }) => {
  const groep = await nieuweSessie(browser, "test-groep-2");
  const logistiek = await nieuweSessie(browser, "vd-stuur-logistiek");
  const g = groep.page;
  const l = logistiek.page;

  // 1. Zolang de lijst concept is, kunnen groepen nog niets kiezen
  await g.goto("/avf/F");
  await expect(g.getByText("De materialenlijst is nog niet klaar")).toBeVisible();

  // 2. Logistiek & Facilitair voegt iets toe en vult de voorraad in een tabel in, met een totaal per materiaal
  await l.goto("/stuurgroep");
  await expect(l).toHaveURL(/rol\/logistiek_facilitair$/);
  await l.getByRole("link", { name: /Materialenlijst/ }).first().click();
  await expect(l.getByRole("heading", { name: "Concept: nog niet gepubliceerd" })).toBeVisible();
  await l.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  await l.getByText("Materiaal toevoegen", { exact: true }).click();
  const toevoegen = l.locator("form").filter({ has: l.getByLabel("Voorraad camping", { exact: true }) });
  await toevoegen.getByLabel("Naam").fill("TestMat UI");
  await toevoegen.getByLabel("Voorraad camping").fill("8");
  await toevoegen.getByLabel("Voorraad bivak").fill("1");
  await toevoegen.getByRole("button", { name: "Toevoegen" }).click();
  await expect(l.getByText("TestMat UI", { exact: true })).toBeVisible();
  const camping = l.getByLabel("Voorraad camping TestMat UI");
  await camping.fill("9");
  await camping.blur();
  await expect.poll(async () => (await admin.from("materiaal").select("voorraad_camping").eq("naam", "TestMat UI").single()).data?.voorraad_camping).toBe(9);
  const rij = l.locator("tr").filter({ has: l.getByLabel("Voorraad camping TestMat UI") });
  await expect(rij.getByText("10", { exact: true })).toBeVisible(); // totaal 9 + 1

  // 3. Materiaal verwijderen kan makkelijk (zolang geen groep het heeft gekozen)
  await l.getByRole("button", { name: "Wijzig TestMat UI" }).click();
  await l.getByRole("button", { name: "Verwijderen uit de lijst" }).click();
  await l.getByRole("button", { name: "Ja, verwijderen" }).click();
  await expect(l.getByText("TestMat UI", { exact: true })).toHaveCount(0);

  // 4. Publiceren, ook als niet alles is ingeschat
  await l.getByRole("button", { name: "Lijst publiceren" }).click();
  await expect(l.getByText("De lijst publiceren?")).toBeVisible();
  await expect(l.getByText(/de voorraad nog niet ingeschat/)).toBeVisible();
  await l.getByRole("button", { name: "Ja, publiceren" }).click();
  await expect(l.getByRole("heading", { name: "De lijst is gepubliceerd" })).toBeVisible();

  // het totaaloverzicht om af te drukken of als PDF op te slaan
  await l.goto("/stuurgroep/materialen/afdrukken");
  await expect(l.getByRole("heading", { name: "Materialenlijst", level: 1 })).toBeVisible();
  await expect(l.getByText("TestMat Touw")).toBeVisible();
  await expect(l.getByText(/Gepubliceerd door/)).toBeVisible();

  // 5. De groep kiest touw voor de romp: er is genoeg. Een materiaal zonder voorraad is nog niet te kiezen
  await g.goto("/avf/F");
  await g.getByLabel("Wie werkt hier?").fill(NAAM);
  await expect(g.getByText("Locatie: Camping")).toBeVisible();
  const kiezen = g.locator("form").filter({ has: g.getByRole("heading", { name: "Materiaal kiezen" }) });
  await expect(kiezen.getByRole("option", { name: /voorraad volgt/ }).first()).toBeDisabled();
  await kiezen.getByLabel("Materiaal").selectOption({ label: "TestMat Touw (6 beschikbaar)" });
  await kiezen.getByLabel("Waarvoor").selectOption("romp");
  await kiezen.getByLabel("Aantal").fill("2");
  await kiezen.getByRole("button", { name: "Toevoegen" }).click();
  await expect(g.getByLabel("Aantal TestMat Touw")).toHaveValue("2");

  // 6. Te veel vragen geeft een tekortwaarschuwing
  const aantal = g.getByLabel("Aantal TestMat Touw");
  await aantal.fill("9");
  await aantal.blur();
  await expect(g.getByText(/Tekort van 3\. Op de camping ligt 6/)).toBeVisible();

  // 7. De groep vraagt iets aan dat niet in de lijst staat; de stuurgroep handelt het af
  const aanvraag = g.locator("form").filter({ has: g.getByLabel("Hoeveel hebben jullie in totaal nodig?") });
  await aanvraag.getByLabel("Wat hebben jullie nodig?").fill("TestMat grote tent");
  await aanvraag.getByLabel("Hoeveel hebben jullie in totaal nodig?").fill("2");
  await aanvraag.getByLabel("Waarvoor? (kort)").fill("Schuilplaats bij regen");
  await aanvraag.getByRole("button", { name: "Aanvraag versturen" }).click();
  await expect(g.getByRole("list", { name: "Jullie aanvragen" }).getByText("Open", { exact: true })).toBeVisible();

  const stuur = await nieuweSessie(browser, "test-stuur");
  const s = stuur.page;
  await s.goto("/stuurgroep/materialen/aanvragen");
  await expect(s.getByText("TestMat grote tent: 2 nodig (niet in de lijst)")).toBeVisible();
  await s.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  await s.getByLabel("Antwoord aan de groep (verplicht bij afwijzen)").fill("Er komt een tent bij.");
  await s.getByRole("button", { name: "Afgehandeld", exact: true }).click();
  await expect(s.getByText("Er zijn geen open aanvragen.")).toBeVisible();
  await g.reload();
  await expect(g.getByText("Antwoord van de stuurgroep: Er komt een tent bij.")).toBeVisible();

  // 8. De stuurgroep ziet het tekort en corrigeert het aantal; de groep ziet dat
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

  // 9. Materiaalcontrole: bij het inpakken blijkt dat er minder is; de groep krijgt direct een melding
  await l.goto("/stuurgroep/materialen/paklijst");
  await l.getByLabel("Wie telt er? (jouw naam)").fill(NAAM);
  await expect(l.getByRole("button", { name: "Inpakken", exact: true })).toHaveAttribute("aria-pressed", "true");
  const mee = l.getByLabel("Mee TestMat Touw");
  await l.getByRole("button", { name: "TestMat Touw: klopt" }).click();
  await expect(mee).toHaveValue("6");
  await mee.fill("4");
  await mee.blur();
  await expect.poll(async () => (await admin.from("materiaal_telling").select("meegenomen").eq("locatie", "camping").not("meegenomen", "is", null).limit(1).maybeSingle()).data?.meegenomen).toBe(4);
  await expect(l.locator("tr").filter({ has: mee }).getByText("-2")).toBeVisible();
  await g.reload();
  await expect(g.getByText(/Tekort van 1\. Op de camping ligt 4/)).toBeVisible();
  await g.goto("/avf");
  await expect(g.getByRole("heading", { name: "Let op bij jullie materialen" })).toBeVisible();

  // de papieren materiaalcontrole voor op de camping
  await l.getByRole("link", { name: /Papieren lijst camping/ }).click();
  await expect(l.getByRole("heading", { name: "Materiaalcontrole camping" })).toBeVisible();

  // 10. VC past de lijst aan na publicatie, maar kan een gekozen materiaal niet verwijderen
  const vc = await nieuweSessie(browser, "vc-stuur-logistiek");
  const v = vc.page;
  await v.goto("/stuurgroep/materialen");
  await expect(v.getByRole("heading", { name: "De lijst is gepubliceerd" })).toBeVisible();
  await v.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  await v.getByRole("button", { name: "Wijzig TestMat Touw" }).click();
  await v.getByRole("button", { name: "Verwijderen uit de lijst" }).click();
  await v.getByRole("button", { name: "Ja, verwijderen" }).click();
  await expect(v.getByText(/al gekozen door een projectgroep en kan niet worden verwijderd/)).toBeVisible();
  await expect(v.getByText("TestMat Touw").first()).toBeVisible();
  await vc.ctx.close();

  // 11. Een projectgroep ziet de beheerpagina niet
  await g.goto("/stuurgroep/materialen");
  await expect(g).toHaveURL(/\/$/);

  await groep.ctx.close();
  await logistiek.ctx.close();
});

test("zonder locatie kunnen groepen geen materiaal kiezen", async ({ browser }) => {
  await admin.from("materiaal_aanvraag").delete().eq("avf_id", avfTest2);
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
