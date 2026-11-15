/**
 * Indienen en beoordelen (opdracht 4), op telefoonformaat tegen het cluster TEST:
 * indienen, verbeterverzoek plaatsen, aanpassing vragen, aanpassen (verzoek wordt vanzelf "aangepast"),
 * opnieuw indienen met samenvatting en goedkeuren. Daarna wordt alles teruggezet.
 */
import { expect, test } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

let avfId = "";
let origineel: Record<string, unknown> = {};
const NAAM = "Testpersoon";

async function opschonen() {
  if (!avfId) return;
  await admin.from("verbeterverzoek").delete().eq("avf_id", avfId);
  await admin.from("themacheck").delete().eq("avf_id", avfId);
  await admin.from("avf_versie").delete().eq("avf_id", avfId);
  await admin.from("avf").update({
    status: "in_ontwikkeling", versie: 0, opnieuw_te_controleren: false, ingediend_op: null, ingediend_door_naam: null,
    goedgekeurd_op: null, goedgekeurd_door_naam: null, goedgekeurd_door_account: null, organisatie: origineel.organisatie,
  }).eq("id", avfId);
  await admin.from("wijziging").delete().eq("record_id", avfId).eq("naam", NAAM);
}

test.beforeAll(async () => {
  const TEST = await clusterId("TEST");
  const { data } = await admin.from("avf").select("*, projectgroep:projectgroep_id!inner(nummer)").eq("cluster_id", TEST).eq("projectgroep.nummer", 1).single();
  avfId = data!.id;
  origineel = data!;
  await opschonen();
});

test.afterAll(opschonen);

test("de hele keten: indienen, verzoek, aanpassen, opnieuw indienen en goedkeuren", async ({ browser }) => {
  const groep = await nieuweSessie(browser, "test-groep-1");
  const stuur = await nieuweSessie(browser, "test-stuur");
  const g = groep.page;
  const s = stuur.page;

  // 1. De groep dient in: controlelijst is groen, naam invullen
  await g.goto("/avf/indienen");
  await expect(g.getByRole("heading", { name: "AVF indienen" })).toBeVisible();
  await expect(g.getByText("Alle verplichte velden zijn ingevuld.")).toBeVisible();
  await g.getByLabel("Wie dient in? (jouw naam)").fill(NAAM);
  await g.getByRole("button", { name: /Dien het AVF in/ }).click();
  await expect(g.getByText(/ingediend \(versie 1\)/)).toBeVisible();

  // 2. De stuurgroep opent het AVF via het dashboard-pad en plaatst een verbeterverzoek bij sectie G
  await s.goto(`/belevenissen/${avfId}?sectie=G&rol=programma_beleving&veld=organisatie.bijdrage_thema#verzoek-G`);
  const formulier = s.locator("form").filter({ has: s.getByLabel("Wat moet er beter?") });
  await expect(formulier.getByLabel("Voor welke rol in de projectgroep?")).toHaveValue("programma_beleving");
  await formulier.getByLabel("Wat moet er beter?").fill("Leg beter uit hoe jullie belevenis het thema versterkt.");
  await formulier.getByLabel("Jouw naam").fill(NAAM);
  await formulier.getByRole("button", { name: "Verzoek plaatsen" }).click();
  await expect(s.getByText("Leg beter uit hoe jullie belevenis het thema versterkt.")).toBeVisible();

  // 3. Aanpassing vragen vraagt om een naam
  await s.getByLabel("Wie beoordeelt? (jouw naam)").fill(NAAM);
  await s.getByRole("button", { name: "Aanpassing vragen" }).click();
  await expect.poll(async () => (await admin.from("avf").select("status").eq("id", avfId).single()).data?.status).toBe("aanpassing_gevraagd");

  // 4. De groep ziet het verzoek bij sectie G en op het overzicht
  await g.goto("/avf");
  await expect(g.getByText("De stuurgroep vraagt om aanpassingen")).toBeVisible();
  await g.goto("/avf/G");
  await expect(g.getByText("Verbeterverzoeken van de stuurgroep")).toBeVisible();
  await expect(g.getByText("Open", { exact: true }).first()).toBeVisible();

  // 5. Opnieuw indienen zonder iets aan te passen: melding met wat er nog openstaat, en bevestiging nodig
  await g.goto("/avf/indienen");
  await expect(g.getByText("Hier is nog niets aan aangepast")).toBeVisible();
  await expect(g.getByText("Leg beter uit hoe jullie belevenis het thema versterkt.")).toBeVisible();
  await g.getByLabel("Wie dient in? (jouw naam)").fill(NAAM);
  await g.getByLabel("Wat hebben jullie aangepast?").fill("Nog niets.");
  await g.getByRole("button", { name: /Dien het AVF in/ }).click();
  await expect(g.getByText(/Vink aan dat je toch wilt indienen/)).toBeVisible();

  // 6. De groep past het veld aan: het verzoek wordt vanzelf "aangepast"
  await g.goto("/avf/G");
  const veld = g.getByLabel("Bijdrage aan het meerdaagsethema");
  await veld.fill(`${await veld.inputValue()} Extra uitleg.`);
  await veld.blur();
  await expect(g.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();
  await g.reload();
  await expect(g.getByText("Aangepast", { exact: true }).first()).toBeVisible();

  // 7. Nu is er geen waarschuwing meer; opnieuw indienen vraagt een samenvatting
  await g.goto("/avf/indienen");
  await expect(g.getByText("Hier is nog niets aan aangepast")).toHaveCount(0);
  await g.getByLabel("Wie dient in? (jouw naam)").fill(NAAM);
  await g.getByRole("button", { name: /Dien het AVF in/ }).click();
  await expect(g.getByText(/Beschrijf kort wat jullie hebben aangepast/)).toBeVisible();
  await g.getByLabel("Wat hebben jullie aangepast?").fill("Uitleg bij de bijdrage aan het thema aangevuld.");
  await g.getByRole("button", { name: /Dien het AVF in \(versie 2\)/ }).click();
  await expect(g.getByText(/ingediend \(versie 2\)/)).toBeVisible();

  // 8. De stuurgroep ziet versie 2 met de samenvatting en keurt goed
  await s.goto(`/belevenissen/${avfId}?tab=versies`);
  await expect(s.getByText("Uitleg bij de bijdrage aan het thema aangevuld.")).toBeVisible();
  await expect(s.getByText("Versie 2", { exact: true })).toBeVisible();
  await s.goto(`/belevenissen/${avfId}`);
  await s.getByLabel("Wie beoordeelt? (jouw naam)").fill(NAAM);
  await s.getByRole("button", { name: "Goedkeuren", exact: true }).click();
  await expect(s.getByText(/Goedgekeurd door Testpersoon/)).toBeVisible();

  // 9. De groep ziet dat het goedgekeurd is en kan nog bewerken
  await g.goto("/avf/indienen");
  await expect(g.getByText(/Jullie AVF is goedgekeurd/)).toBeVisible();
  await g.goto("/avf/G");
  await expect(g.getByLabel("Bijdrage aan het meerdaagsethema")).toBeEnabled();

  await groep.ctx.close();
  await stuur.ctx.close();
});

test("een stuurgroepaccount opent het dashboard op de eigen rol; alle rollen zijn te bekijken", async ({ browser }) => {
  const stuur = await nieuweSessie(browser, "vd-stuur-veiligheid");
  const p = stuur.page;
  await p.goto("/stuurgroep");
  await expect(p).toHaveURL(/\/stuurgroep\/rol\/veiligheid_welzijn$/);
  await expect(p.getByRole("heading", { name: "Veiligheid & Welzijn", level: 1 })).toBeVisible();
  await expect(p.getByText("jullie rol", { exact: false }).first()).toBeVisible();
  // zes belevenissen als kaarten
  await expect(p.locator("main ul > li > h3, main li h3")).toHaveCount(6);

  // per belevenis staat een samenvatting; de velden zitten achter een uitklapblok
  await expect(p.locator("summary").filter({ hasText: /\d+ van \d+ velden ingevuld/ })).toHaveCount(6);
  await p.locator("summary").filter({ hasText: /\d+ van \d+ velden ingevuld/ }).first().click();
  // een veld aantikken brengt je bij het AVF met het verbeterverzoek-formulier op de juiste rol
  await p.getByRole("link", { name: /Weer|Fysieke veiligheid|Risico/ }).first().click();
  await expect(p).toHaveURL(/\/belevenissen\/.+sectie=/);

  // ander rol bekijken
  await p.goto("/stuurgroep/rol/communicatie_financien");
  await expect(p.getByRole("heading", { name: "Communicatie & Financiën", level: 1 })).toBeVisible();
  await p.goto("/stuurgroep?alle=1");
  await expect(p.getByRole("heading", { name: "Onze stuurgroep" })).toBeVisible();
  await stuur.ctx.close();
});
