/**
 * Onderdeelscherm (sectie D): naam, duur, beschrijving en veiligheid staan direct zichtbaar;
 * Differentiatie en USV zijn niet verplicht en beginnen dichtgeklapt. Leest alleen (voorbeeld-AVF van vd-groep-1).
 */
import { expect, test } from "@playwright/test";
import { nieuweSessie } from "./helpers";

test("differentiatie en USV klappen in, de verplichte velden niet", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-1");
  const p = s.page;
  await p.goto("/avf/D?fase=kop");
  await p.getByRole("link", { name: /^1\./ }).first().click();
  await expect(p).toHaveURL(/\/avf\/onderdeel\//);

  // de verplichte velden zijn meteen te zien
  await expect(p.getByLabel("Naam van het onderdeel")).toBeVisible();
  await expect(p.getByLabel(/^Beschrijving/)).toBeVisible();
  await expect(p.getByLabel(/^Fysieke veiligheid/)).toBeVisible();

  // de niet verplichte blokken zijn dichtgeklapt
  const diff = p.getByTestId("blok-differentiatie");
  const usv = p.getByTestId("blok-usv");
  await expect(diff).not.toHaveAttribute("open", "");
  await expect(usv).not.toHaveAttribute("open", "");
  await expect(p.getByLabel("Individu: moeilijker maken")).toBeHidden();
  await expect(p.getByLabel("Uitdagend")).toBeHidden();

  // openklappen toont de velden
  await diff.locator("summary").click();
  await expect(diff).toHaveAttribute("open", "");
  await expect(p.getByLabel("Individu: moeilijker maken")).toBeVisible();
  await usv.locator("summary").click();
  await expect(p.getByLabel("Uitdagend")).toBeVisible();
  await s.ctx.close();
});
