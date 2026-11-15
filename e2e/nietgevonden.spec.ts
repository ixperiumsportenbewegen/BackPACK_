/**
 * Een foute link geeft een gewone pagina in de huisstijl met een knop terug (geen kaal zwart scherm),
 * en Beheer noemt de afkorting van een cluster alleen als die niet al in de naam staat.
 */
import { expect, test } from "@playwright/test";
import { nieuweSessie } from "./helpers";

test("een pagina die niet bestaat toont een nette melding met een knop terug", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-6");
  const p = s.page;
  const res = await p.goto("/deze-pagina-bestaat-niet");
  expect(res?.status()).toBe(404);
  await expect(p.getByRole("heading", { name: "Deze pagina bestaat niet" })).toBeVisible();
  const achtergrond = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(achtergrond).not.toBe("rgb(0, 0, 0)"); // niet het zwarte standaardscherm

  await p.getByRole("link", { name: "Terug naar het begin" }).click();
  await expect(p).toHaveURL("/");
  await s.ctx.close();
});

test("Beheer toont de clusterafkorting alleen als die niet in de naam staat", async ({ browser }) => {
  const s = await nieuweSessie(browser, "docent");
  const p = s.page;
  await p.goto("/beheer");
  await expect(p.getByRole("heading", { name: "Cluster VD", exact: true })).toBeVisible();
  await expect(p.getByRole("heading", { name: "Oefencluster (TEST)", exact: true })).toBeVisible();
  await s.ctx.close();
});
