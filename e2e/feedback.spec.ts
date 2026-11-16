/**
 * Tussentijds indienen ter feedback, op telefoonformaat tegen het cluster TEST (test-groep-2 met een leeg AVF):
 * de groep dient een onvolledig AVF in, de stuurgroep ziet dat het ter feedback is ingediend en kan het niet
 * goedkeuren maar wel teruggeven (ook zonder verbeterverzoek), en de groep gaat verder en dient opnieuw in.
 * Daarna wordt alles teruggezet.
 */
import { expect, test } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

let avfId = "";
const NAAM = "Feedbacktester";

async function opschonen() {
  if (!avfId) return;
  await admin.from("verbeterverzoek").delete().eq("avf_id", avfId);
  await admin.from("themacheck").delete().eq("avf_id", avfId);
  await admin.from("avf_versie").delete().eq("avf_id", avfId);
  await admin.from("avf").update({
    status: "in_ontwikkeling", versie: 0, tussentijds: false, opnieuw_te_controleren: false, ingediend_op: null, ingediend_door_naam: null,
    goedgekeurd_op: null, goedgekeurd_door_naam: null, goedgekeurd_door_account: null,
  }).eq("id", avfId);
  await admin.from("wijziging").delete().eq("record_id", avfId).eq("naam", NAAM);
}

test.beforeAll(async () => {
  const TEST = await clusterId("TEST");
  const { data } = await admin.from("avf").select("id, projectgroep:projectgroep_id!inner(nummer)").eq("cluster_id", TEST).eq("projectgroep.nummer", 2).single();
  avfId = data!.id;
  await opschonen();
});

test.afterAll(opschonen);

test("een onvolledig AVF ter feedback indienen, feedback teruggeven en opnieuw indienen", async ({ browser }) => {
  const groep = await nieuweSessie(browser, "test-groep-2");
  const stuur = await nieuweSessie(browser, "test-stuur");
  const g = groep.page;
  const s = stuur.page;
  const status = async () => (await admin.from("avf").select("status, tussentijds, versie").eq("id", avfId).single()).data;

  // 1. Definitief indienen kan nog niet; ter feedback wel, maar alleen met naam en toelichting
  await g.goto("/avf/indienen");
  await expect(g.getByText(/Voor definitief indienen moet alles zijn ingevuld/)).toBeVisible();
  await expect(g.getByRole("button", { name: /Dien het AVF in/ })).toBeDisabled();
  await g.getByRole("button", { name: "Dien ter feedback in (versie 1)" }).click();
  await expect(g.getByText("Vul eerst je naam in.")).toBeVisible();
  await g.getByLabel("Wie dient in? (jouw naam)").fill(NAAM);
  await g.getByRole("button", { name: "Dien ter feedback in (versie 1)" }).click();
  await expect(g.getByText(/Beschrijf kort wat jullie hebben ingevuld of aangepast en waar jullie feedback op willen/)).toBeVisible();
  await g.getByLabel("Wat hebben jullie ingevuld?").fill("Alleen sectie A is af. Graag feedback op de titel.");
  await g.getByRole("button", { name: "Dien ter feedback in (versie 1)" }).click();
  await expect(g.getByText(/ter feedback ingediend \(versie 1\)/)).toBeVisible();
  expect(await status()).toMatchObject({ status: "ingediend", tussentijds: true, versie: 1 });

  // 2. De groep ziet op het overzicht dat het AVF ter feedback is ingediend en dat het nu vergrendeld is
  await g.goto("/avf");
  await expect(g.getByText("Ter feedback ingediend", { exact: true }).first()).toBeVisible();
  await expect(g.getByText(/ter feedback ingediend en kan nu niet worden gewijzigd/)).toBeVisible();

  // 3. De stuurgroep ziet het label, kan niet goedkeuren en geeft de feedback terug zonder verbeterverzoek
  await s.goto(`/belevenissen/${avfId}`);
  await expect(s.getByText("Ter feedback ingediend", { exact: true }).first()).toBeVisible();
  await expect(s.getByText(/Goedkeuren kan pas na een definitieve indiening/)).toBeVisible();
  await expect(s.getByRole("button", { name: "Goedkeuren", exact: true })).toHaveCount(0);
  await s.getByLabel("Wie beoordeelt? (jouw naam)").fill(NAAM);
  await s.getByRole("button", { name: "Feedback teruggeven" }).click();
  await expect.poll(async () => (await status())?.status).toBe("aanpassing_gevraagd");

  // 4. De groep ziet de feedback en kan weer bewerken
  await g.goto("/avf");
  await expect(g.getByText("Feedback teruggegeven", { exact: true }).first()).toBeVisible();
  await expect(g.getByText(/De stuurgroep heeft feedback gegeven/)).toBeVisible();
  await g.goto("/avf/G");
  await expect(g.getByLabel("Bijdrage aan het meerdaagsethema")).toBeEnabled();

  // 5. Opnieuw ter feedback indienen kan zo vaak als nodig, steeds met een toelichting
  await g.goto("/avf/indienen");
  await g.getByLabel("Wie dient in? (jouw naam)").fill(NAAM);
  await g.getByRole("button", { name: "Dien ter feedback in (versie 2)" }).click();
  await expect(g.getByText(/Beschrijf kort wat jullie hebben ingevuld of aangepast/)).toBeVisible();
  await g.getByLabel("Wat hebben jullie aangepast?").fill("Titel aangepast en sectie B ingevuld.");
  await g.getByRole("button", { name: "Dien ter feedback in (versie 2)" }).click();
  await expect(g.getByText(/ter feedback ingediend \(versie 2\)/)).toBeVisible();

  // 6. De stuurgroep ziet beide versies met het label "Ter feedback" in de lijst met versies
  await s.goto(`/belevenissen/${avfId}?tab=versies`);
  await expect(s.getByText("Titel aangepast en sectie B ingevuld.")).toBeVisible();
  await expect(s.getByText("Ter feedback", { exact: true })).toHaveCount(2);

  await groep.ctx.close();
  await stuur.ctx.close();
});
