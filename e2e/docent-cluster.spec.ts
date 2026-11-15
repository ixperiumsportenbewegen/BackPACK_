/**
 * Docent: het gekozen cluster staat in de kopbalk op elk scherm, en een tik op het label brengt je naar de clusterkeuze.
 */
import { expect, test } from "@playwright/test";
import { nieuweSessie } from "./helpers";

test("het label van de docent toont het gekozen cluster op elk scherm", async ({ browser }) => {
  const s = await nieuweSessie(browser, "docent");
  const p = s.page;
  await p.goto("/");
  await p.getByRole("button", { name: "TEST", exact: true }).click();
  await expect(p.locator("header").getByText("Docent · TEST")).toBeVisible();

  await p.goto("/belevenissen");
  await expect(p.locator("header").getByText("Docent · TEST")).toBeVisible();

  await p.goto("/");
  await p.getByRole("button", { name: "VC", exact: true }).click();
  await expect(p.locator("header").getByText("Docent · VC")).toBeVisible();
  await p.goto("/meer");
  await expect(p.locator("header").getByText("Docent · VC")).toBeVisible();

  // vanaf een ander scherm kom je met één tik bij de clusterkeuze
  await p.locator("header").getByRole("link", { name: /cluster wisselen/ }).click();
  await expect(p).toHaveURL(/\/#cluster$/);
  await expect(p.getByRole("region", { name: "Cluster kiezen" })).toBeVisible();

  // terug naar VD, de gewone beginstand van de docent
  await p.getByRole("button", { name: "VD", exact: true }).click();
  await expect(p.locator("header").getByText("Docent · VD")).toBeVisible();
  await s.ctx.close();
});

test("andere accounts tonen geen link in het label", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-groep-1");
  await s.page.goto("/");
  await expect(s.page.locator("header").getByText("TEST · ")).toBeVisible();
  await expect(s.page.locator("header").getByRole("link", { name: /cluster wisselen/ })).toHaveCount(0);
  await s.ctx.close();
});
