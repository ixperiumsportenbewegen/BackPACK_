/**
 * Beoordeelpagina (stuurgroep): het AVF staat eerst, het besluit en de themachecks eronder, met een sprong
 * bovenaan. De naam die je op één plek invult, staat ook op de andere plekken. Gebruikt het AVF van vd-groep-5
 * (cluster VD, door geen andere test gebruikt), zet het tijdelijk op "ingediend" en daarna terug.
 */
import { expect, test } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

let avfId = "";
let begin: { status: string; versie: number; ingediend_op: string | null; ingediend_door_naam: string | null } | null = null;

test.beforeAll(async () => {
  const VD = await clusterId("VD");
  const { data } = await admin
    .from("avf").select("id, status, versie, ingediend_op, ingediend_door_naam, projectgroep:projectgroep_id!inner(nummer)")
    .eq("cluster_id", VD).eq("projectgroep.nummer", 5).single();
  avfId = data!.id;
  begin = { status: data!.status, versie: data!.versie, ingediend_op: data!.ingediend_op, ingediend_door_naam: data!.ingediend_door_naam };
  await admin.from("avf").update({ status: "ingediend", versie: 1, ingediend_op: new Date().toISOString(), ingediend_door_naam: "Testpersoon" }).eq("id", avfId);
});

test.afterAll(async () => {
  if (avfId && begin) await admin.from("avf").update(begin).eq("id", avfId);
});

test("het AVF staat boven het besluit en er is een sprong naar beoordelen", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-stuur-programma");
  const p = s.page;
  await p.goto(`/belevenissen/${avfId}`);

  const sprong = p.getByTestId("naar-beoordelen");
  await expect(sprong).toContainText(/Beoordelen · \d+ open/);
  const inhoud = p.getByRole("heading", { name: /^A · Basisgegevens/ }).first();
  const paneel = p.getByRole("region", { name: "Beoordelen" });
  await expect(inhoud).toBeVisible();
  const inhoudBox = (await inhoud.boundingBox())!;
  const paneelBox = (await paneel.boundingBox())!;
  expect(inhoudBox.y).toBeLessThan(paneelBox.y);

  await sprong.click();
  await expect(paneel).toBeInViewport();
  await s.ctx.close();
});

test("de naam die je invult, staat ook bij de themachecks", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-stuur-programma");
  const p = s.page;
  await p.goto(`/belevenissen/${avfId}`);
  await p.evaluate(() => localStorage.removeItem("backpack_beoordelaarnaam"));
  await p.reload();

  await p.getByLabel("Wie beoordeelt? (jouw naam)").fill("Sanne");
  await expect(p.getByLabel("Jouw naam", { exact: true })).toHaveValue("Sanne");
  await s.ctx.close();
});

test("na het indienen ziet de groep een samenvatting en kan het AVF lezen", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-5");
  const p = s.page;
  await p.goto("/avf/indienen");
  const kaart = p.getByTestId("indiening-samenvatting");
  await expect(kaart).toContainText("Testpersoon");
  await expect(kaart).toContainText("Versie");
  await kaart.getByRole("link", { name: /Jullie AVF lezen/ }).click();
  await expect(p).toHaveURL(new RegExp(`/belevenissen/${avfId}`));
  await s.ctx.close();
});
