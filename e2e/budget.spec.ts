/**
 * Budget (opdracht 5, deel B), op telefoonformaat: het financieel plan in sectie F, een losse aanvraag na goedkeuring,
 * het besluit van de stuurgroep en de resterende ruimte. Draait op twee VC-groepen die geen andere test gebruikt;
 * alles wordt daarna opgeruimd.
 */
import { expect, test } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

const NAAM = "Testpersoon";
const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
let VC = "";
let avfPlan = ""; // vc-groep-5: financieel plan in sectie F
let avfLos = ""; // vc-groep-3: goedgekeurd AVF met losse aanvraag
let origineleStatus = "in_ontwikkeling";

async function avfId(nummer: number): Promise<string> {
  const { data } = await admin.from("avf").select("id, projectgroep:projectgroep_id!inner(nummer)").eq("cluster_id", VC).eq("projectgroep.nummer", nummer).single();
  return data!.id;
}

async function opschonen() {
  if (!avfLos) return;
  await admin.from("budgetaanvraag").delete().eq("avf_id", avfLos).eq("soort", "los");
  await admin.from("budgetaanvraag").update({
    status: "concept", regels: [], omschrijving: null, toelichting: null, bedrag_toegekend: null, besluit_toelichting: null,
    besluit_door_naam: null, besluit_op: null, besteed: null, ingediend_door_naam: null, ingediend_op: null,
  }).in("avf_id", [avfPlan, avfLos]).eq("soort", "avf");
  await admin.from("avf").update({ status: origineleStatus }).eq("id", avfLos);
  await admin.from("wijziging").delete().eq("naam", NAAM).eq("tabel", "budgetaanvraag");
  await admin.from("wijziging").delete().eq("naam", NAAM).in("record_id", [avfPlan, avfLos]);
}

test.beforeAll(async () => {
  VC = await clusterId("VC");
  [avfPlan, avfLos] = await Promise.all([avfId(5), avfId(3)]);
  const { data } = await admin.from("avf").select("status").eq("id", avfLos).single();
  origineleStatus = data!.status;
  await opschonen();
  await admin.from("avf").update({ status: "goedgekeurd" }).eq("id", avfLos);
});

test.afterAll(opschonen);

test("het financieel plan in sectie F: regels, totaal en automatisch opslaan", async ({ browser }) => {
  const groep = await nieuweSessie(browser, "vc-groep-5");
  const p = groep.page;
  await p.goto("/avf/F");
  await p.getByLabel("Wie werkt hier?").fill(NAAM);
  await expect(p.getByRole("heading", { name: "Financieel plan", level: 2 })).toBeVisible();
  await p.getByRole("button", { name: "Regel toevoegen" }).click();
  await p.getByLabel("Omschrijving regel 1").fill("Verf");
  await p.getByLabel("Bedrag regel 1").fill("12,50");
  await p.getByLabel("Bedrag regel 1").blur();
  await expect(p.getByText("Opgeslagen", { exact: true })).toBeVisible();
  await expect.poll(async () => Number((await admin.from("budgetaanvraag").select("bedrag_aangevraagd").eq("avf_id", avfPlan).eq("soort", "avf").single()).data?.bedrag_aangevraagd)).toBe(12.5);
  await p.getByRole("button", { name: "Regel toevoegen" }).click();
  await p.getByLabel("Omschrijving regel 2").fill("Prijzen");
  await p.getByLabel("Bedrag regel 2").fill("7,50");
  await p.getByLabel("Bedrag regel 2").blur();
  await expect(p.getByText(euro.format(20))).toBeVisible();
  await expect.poll(async () => Number((await admin.from("budgetaanvraag").select("bedrag_aangevraagd").eq("avf_id", avfPlan).eq("soort", "avf").single()).data?.bedrag_aangevraagd)).toBe(20);
  // een regel zonder omschrijving wordt niet opgeslagen en geeft een hint
  await p.getByRole("button", { name: "Regel toevoegen" }).click();
  await p.getByLabel("Bedrag regel 3").fill("5");
  await p.getByLabel("Bedrag regel 3").blur();
  await expect(p.getByText("Elke regel heeft een omschrijving en een bedrag nodig")).toBeVisible();
  await p.reload();
  await expect(p.getByLabel("Omschrijving regel 1")).toHaveValue("Verf");
  await expect(p.getByLabel("Bedrag regel 2")).toHaveValue("7,5");
  await groep.ctx.close();
});

test("losse aanvraag, besluit van de stuurgroep en de resterende ruimte", async ({ browser }) => {
  const groep = await nieuweSessie(browser, "vc-groep-3");
  const g = groep.page;
  const stuur = await nieuweSessie(browser, "vc-stuur-financien");
  const s = stuur.page;

  const resterendVoor = async () => {
    const { data: b } = await admin.from("cluster_budget").select("budget_totaal").eq("cluster_id", VC).single();
    const { data: t } = await admin.from("budgetaanvraag").select("bedrag_toegekend").eq("cluster_id", VC).eq("status", "toegekend");
    return Number(b!.budget_totaal) - (t ?? []).reduce((som, r) => som + Number(r.bedrag_toegekend), 0);
  };
  const voor = await resterendVoor();

  // 1. De groep ziet de ruimte van het cluster en start een losse aanvraag (het AVF is goedgekeurd)
  await g.goto("/budget");
  await expect(g.getByText("Nog te verdelen in")).toBeVisible();
  await expect(g.getByText(euro.format(voor)).first()).toBeVisible();
  await g.getByLabel("Wie werkt hier? (jouw naam)").first().fill(NAAM);
  await g.getByLabel("Waarvoor?").fill("Extra materiaal romp");
  await g.getByRole("button", { name: "Losse aanvraag starten" }).click();
  await expect(g.getByRole("heading", { name: "Extra materiaal romp", level: 3 })).toBeVisible();
  await g.getByLabel("Wie werkt hier? (jouw naam)").last().fill(NAAM);
  await g.getByRole("button", { name: "Regel toevoegen" }).click();
  await g.getByLabel("Omschrijving regel 1").fill("Touw en pionnen");
  await g.getByLabel("Bedrag regel 1").fill("60");
  await g.getByLabel("Bedrag regel 1").blur();
  await expect(g.getByText("Opgeslagen", { exact: true })).toBeVisible();
  await g.getByRole("button", { name: "Aanvraag indienen" }).click();
  await expect(g.getByText(/Aangevraagd: .*60,00.*De stuurgroep beslist hierover/)).toBeVisible();

  // 2. De stuurgroep opent Budget via Communicatie & Financiën en kent € 50 toe met een toelichting
  await s.goto("/stuurgroep");
  await expect(s).toHaveURL(/rol\/projectleiding$|rol\/communicatie_financien$/);
  await s.goto("/stuurgroep/rol/communicatie_financien");
  await s.getByRole("link", { name: /Budget en aanvragen/ }).click();
  await expect(s.getByRole("heading", { name: /Aanvragen om te beoordelen/ })).toBeVisible();
  await s.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  const kaart = s.locator("li").filter({ hasText: "Extra materiaal romp" });
  await expect(kaart.getByText(euro.format(60)).first()).toBeVisible();
  await kaart.getByLabel("Toe te kennen bedrag (€)").fill("50");
  await kaart.getByRole("button", { name: "Toekennen" }).click();
  await expect(s.getByText("Je hebt toelichting nodig")).toHaveCount(0);
  await expect(kaart.getByRole("alert")).toContainText("toelichting");
  await kaart.getByLabel(/Toelichting aan de groep/).fill("Pionnen hebben we al.");
  await kaart.getByRole("button", { name: "Toekennen" }).click();
  await expect(s.getByText("Er zijn geen aanvragen die op een besluit wachten.")).toBeVisible();

  // 3. De groep ziet het besluit, de toelichting en de nieuwe resterende ruimte
  await g.reload();
  await expect(g.getByText(/Toegekend: .*50,00/)).toBeVisible();
  await expect(g.getByText("Toelichting: Pionnen hebben we al.")).toBeVisible();
  await expect(g.getByText(euro.format(voor - 50)).first()).toBeVisible();

  // 4. Een andere groep ziet de aanvraag niet, wel de resterende ruimte
  const ander = await nieuweSessie(browser, "vc-groep-4");
  await ander.page.goto("/budget");
  await expect(ander.page.getByText("Extra materiaal romp")).toHaveCount(0);
  await expect(ander.page.getByText(euro.format(voor - 50)).first()).toBeVisible();
  await ander.ctx.close();

  await groep.ctx.close();
  await stuur.ctx.close();
});

test("een projectgroep ziet de budgetpagina van de stuurgroep niet", async ({ browser }) => {
  const groep = await nieuweSessie(browser, "vc-groep-4");
  await groep.page.goto("/stuurgroep/budget");
  await expect(groep.page).toHaveURL(/\/$/);
  await groep.ctx.close();
});
