/**
 * Startscherm van een projectgroep: zolang het meerdaagsethema niet is gekozen, staat het eigen AVF bovenaan
 * en is het thema-blok compact. Gebruikt het fictieve cluster TEST.
 */
import { expect, test } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test("zonder thema staat het eigen AVF boven een compact thema-blok", async ({ browser }) => {
  const TEST = await clusterId("TEST");
  const { data: thema } = await admin.from("meerdaagsethema").select("naam").eq("cluster_id", TEST).maybeSingle();
  test.skip(Boolean(thema?.naam), "TEST heeft een thema; deze test gaat over het scherm zonder thema");

  const s = await nieuweSessie(browser, "test-groep-1");
  await s.page.goto("/");
  const avf = s.page.getByRole("region", { name: "Jullie AVF" });
  const themaBlok = s.page.getByTestId("thema-blok");
  await expect(avf).toBeVisible();
  await expect(themaBlok).toBeVisible();

  const avfBox = (await avf.boundingBox())!;
  const themaBox = (await themaBlok.boundingBox())!;
  expect(avfBox.y).toBeLessThan(themaBox.y);
  // compact: duidelijk lager dan het volledige thema-blok (min-h-56 = 224 px)
  expect(themaBox.height).toBeLessThan(224);
  // het AVF begint binnen het eerste scherm van een telefoon
  expect(avfBox.y).toBeLessThan(400);
  await s.ctx.close();
});

test("een stuurgroep ziet het compacte thema-blok met de knop Thema kiezen", async ({ browser }) => {
  const TEST = await clusterId("TEST");
  const { data: thema } = await admin.from("meerdaagsethema").select("naam").eq("cluster_id", TEST).maybeSingle();
  test.skip(Boolean(thema?.naam), "TEST heeft een thema");

  const s = await nieuweSessie(browser, "test-stuur");
  await s.page.goto("/");
  await expect(s.page.getByRole("link", { name: "Thema kiezen" })).toBeVisible();
  const box = (await s.page.getByTestId("thema-blok").boundingBox())!;
  expect(box.height).toBeLessThan(260);
  await s.ctx.close();
});

test("de knop bij de rolverdeling zegt invullen zolang er een rol zonder naam is, en daarna bekijken", async ({ browser }) => {
  const VD = await clusterId("VD");
  for (const [gebruiker, nummer] of [["vd-groep-1", 1], ["vd-groep-6", 6]] as const) {
    const { data: g } = await admin.from("projectgroep").select("id").eq("cluster_id", VD).eq("nummer", nummer).single();
    const { data: rollen } = await admin.from("projectgroep_rol").select("namen").eq("projectgroep_id", g!.id);
    const volledig = (rollen ?? []).filter((r) => (r.namen ?? "").trim() !== "").length >= 6;

    const s = await nieuweSessie(browser, gebruiker);
    await s.page.goto("/");
    const naam = volledig ? "Rolverdeling bekijken" : "Rolverdeling invullen";
    await expect(s.page.getByRole("link", { name: naam })).toBeVisible();
    await s.ctx.close();
  }
});
