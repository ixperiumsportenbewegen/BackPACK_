/**
 * Rolweergave van de stuurgroep: de rollen staan in één rij die zijwaarts scrolt (niet in vijf rijen onder elkaar)
 * en de gekozen rol is altijd in beeld. Leest alleen.
 */
import { expect, test } from "@playwright/test";
import { nieuweSessie } from "./helpers";

test("de rollen staan in één scrollbare rij en de gekozen rol is in beeld", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-stuur-veiligheid");
  const p = s.page;
  await p.goto("/stuurgroep/rol/projectleiding");
  const balk = p.getByTestId("rollenbalk");
  await expect(balk).toBeVisible();

  const links = balk.getByRole("link");
  await expect(links).toHaveCount(7); // zes rollen en Overzicht
  const ys = await links.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(ys).size).toBe(1); // alles op één regel

  // op een telefoon past het niet naast elkaar, dus de rij scrolt zijwaarts
  const scrolt = await balk.evaluate((e) => e.scrollWidth > e.clientWidth);
  expect(scrolt).toBe(true);

  // de gekozen rol (Projectleiding staat achteraan) is naar binnen gescrold
  await expect(balk.locator('[aria-current="page"]')).toBeInViewport();
  await s.ctx.close();
});
