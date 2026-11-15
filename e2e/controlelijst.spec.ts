/**
 * Controlelijst bij Indienen: een samenvatting bovenaan, secties die inklappen als er veel openstaat,
 * en elk punt als link naar de plek waar je het invult. Leest alleen (vd-groep-2 heeft een leeg AVF).
 */
import { expect, test } from "@playwright/test";
import { nieuweSessie } from "./helpers";

test("de controlelijst toont een samenvatting en linkt elk punt naar de juiste plek", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-2");
  const p = s.page;
  await p.goto("/avf/indienen");

  await expect(p.getByTestId("controle-samenvatting")).toHaveText(/Nog \d+ punten open in \d+ secties/);

  // Sectie D heeft veel openstaande punten en staat dichtgeklapt; sectie A klapt open als er hooguit drie zijn
  const sectieD = p.locator("details").filter({ hasText: /Sectie D · Kop, romp en staart/ });
  await expect(sectieD).toBeVisible();
  await expect(sectieD).not.toHaveAttribute("open", "");
  await expect(sectieD.locator("summary")).toContainText(/\d+ open/);

  await sectieD.locator("summary").click();
  await expect(sectieD).toHaveAttribute("open", "");
  const kop = sectieD.getByRole("link", { name: /Kop: organisatievorm/ });
  await expect(kop).toHaveAttribute("href", "/avf/D?fase=kop");
  await expect(sectieD.getByRole("link", { name: /Staart: organisatievorm/ })).toHaveAttribute("href", "/avf/D?fase=staart");

  // de rolverdeling staat onder Meer
  await expect(p.getByRole("link", { name: /Rolverdeling: elke van de zes rollen/ })).toHaveAttribute("href", "/meer/rolverdeling");

  await kop.click();
  await expect(p).toHaveURL(/\/avf\/D\?fase=kop/);
  await s.ctx.close();
});
