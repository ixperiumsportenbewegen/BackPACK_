/**
 * Onderdeelscherm (sectie D): naam, duur, beschrijving en veiligheid staan direct zichtbaar;
 * Differentiatie en USV zijn niet verplicht en beginnen dichtgeklapt. Leest alleen (voorbeeld-AVF van test-groep-1 (cluster TEST)).
 */
import { expect, test } from "@playwright/test";
import { nieuweSessie } from "./helpers";

test("differentiatie en USV klappen in, de verplichte velden niet", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-groep-1");
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

test("de eigenaar van een veld staat per sectie in een uitklapblok en niet bij elk veld", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-groep-1");
  const p = s.page;
  await p.goto("/avf/A");
  await expect(p.getByRole("heading", { name: "Basisgegevens", level: 1 })).toBeVisible();
  // niet meer bij elk veld
  await expect(p.getByText(/^Eigenaar: /).filter({ hasNotText: "," })).toHaveCount(0);
  // wel per sectie, met de velden per rol
  const blok = p.getByTestId("wie-vult-wat");
  await expect(blok).not.toHaveAttribute("open", "");
  await blok.locator("summary").click();
  await expect(blok).toContainText("Projectleider");
  await expect(blok).toContainText("Titel van de belevenis");
  // sectie F legt uit dat het niet verplicht is
  await p.goto("/avf/F");
  await expect(p.getByText(/Alleen invullen als je materiaal of budget nodig hebt/)).toBeVisible();
  await s.ctx.close();
});

test("sectie A vraagt eerst naar de locatie en legt uit wat het aantal deelnemers is", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-groep-1");
  const p = s.page;
  await p.goto("/avf/A");
  const locatie = p.getByRole("radiogroup", { name: /Op welke locatie vindt de belevenis plaats/ });
  const titel = p.getByLabel("Titel van de belevenis");
  await expect(locatie).toBeVisible();
  const yLocatie = (await locatie.boundingBox())!.y;
  const yTitel = (await titel.boundingBox())!.y;
  expect(yLocatie).toBeLessThan(yTitel);
  await expect(p.getByText(/niet de organiserende studenten van jullie eigen groep/)).toBeVisible();
  await s.ctx.close();
});
