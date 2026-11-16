/**
 * Navigatie door het AVF en de rest van de app: vorige en volgende, de sectiebalk, terugknoppen
 * en het hoofdmenu dat bij onderliggende schermen de juiste knop markeert.
 */
import { expect, test } from "@playwright/test";
import { nieuweSessie } from "./helpers";

test("door alle secties van het AVF met vorige en volgende, in de juiste volgorde", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-groep-1");
  const p = s.page;
  await p.goto("/avf/A");

  const volgorde: [string, RegExp][] = [
    ["/avf/B", /Beginsituatie/],
    ["/avf/C", /Doelen/],
    ["/avf/D?fase=kop", /Kop/],
    ["/avf/D?fase=romp", /Romp/],
    ["/avf/D?fase=staart", /Staart/],
    ["/avf/E", /Veiligheid, EHBO en weer/],
    ["/avf/F", /Materialen en financiën/],
    ["/avf/G", /Thema en organisatie/],
    ["/avf/H", /Communicatie/],
  ];
  for (const [href, naam] of volgorde) {
    await p.getByRole("link", { name: /Volgende/ }).click();
    await expect(p).toHaveURL(new RegExp(href.replace("?", "\\?")));
    await expect(p.getByRole("heading", { level: 1 })).toContainText(/.+/);
    void naam;
  }

  // Op de laatste sectie staat "Klaar" met een link naar het overzicht
  await expect(p.getByRole("link", { name: /Klaar/ })).toBeVisible();

  // Terug: van H naar G, en zo verder terug
  await p.getByRole("link", { name: /Vorige/ }).click();
  await expect(p).toHaveURL(/\/avf\/G$/);
  await p.goto("/avf/E");
  await p.getByRole("link", { name: /Vorige/ }).click();
  await expect(p).toHaveURL(/\/avf\/D\?fase=staart$/);

  // Op de eerste sectie brengt "Terug" je naar het overzicht
  await p.goto("/avf/A");
  await p.getByRole("navigation", { name: "Vorige en volgende" }).getByRole("link", { name: /Terug/ }).first().click();
  await expect(p).toHaveURL(/\/avf$/);
  await s.ctx.close();
});

test("de sectiebalk toont waar je bent en brengt je met één tik naar elke sectie", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-groep-1");
  const p = s.page;
  await p.goto("/avf/B");
  const balk = p.getByRole("navigation", { name: "Secties van het AVF" });
  await expect(balk).toBeVisible();
  await expect(balk.getByRole("link", { name: /Sectie B/ })).toHaveAttribute("aria-current", "page");
  await expect(balk.getByRole("link", { name: /Sectie A/ })).not.toHaveAttribute("aria-current", "page");
  await expect(balk.getByRole("link")).toHaveCount(9); // overzicht + A t/m H

  // De voortgang staat in het label (het voorbeeld is compleet; F komt later)
  await expect(balk.getByRole("link", { name: "Sectie A, Basisgegevens, compleet" })).toBeVisible();

  await balk.getByRole("link", { name: /Sectie G/ }).click();
  await expect(p).toHaveURL(/\/avf\/G$/);
  await expect(p.getByRole("navigation", { name: "Secties van het AVF" }).getByRole("link", { name: /Sectie G/ })).toHaveAttribute("aria-current", "page");

  await p.getByRole("navigation", { name: "Secties van het AVF" }).getByRole("link", { name: /Overzicht/ }).click();
  await expect(p).toHaveURL(/\/avf$/);
  await expect(p.getByRole("navigation", { name: "Secties van het AVF" })).toHaveCount(0); // het overzicht is zelf de lijst

  // Sectie D: de balk blijft staan, ook op een onderdeelscherm
  await p.goto("/avf/D?fase=romp");
  await p.locator('a[href^="/avf/onderdeel/"]').first().click();
  await expect(p).toHaveURL(/\/avf\/onderdeel\//);
  await expect(p.getByRole("navigation", { name: "Secties van het AVF" }).getByRole("link", { name: /Sectie D/ })).toHaveAttribute("aria-current", "page");
  await s.ctx.close();
});

test("van onderdeel naar onderdeel binnen een fase, en terug naar de fase", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-groep-1");
  const p = s.page;
  await p.goto("/avf/D?fase=romp");
  await p.locator('a[href^="/avf/onderdeel/"]').first().click();
  await expect(p.getByRole("heading", { level: 1 })).toHaveText("Verspringen");
  const nav = p.getByRole("navigation", { name: "Vorige en volgende" });

  // Eerste onderdeel: geen vorige onderdeel, wel een terugknop naar de fase
  await expect(nav.getByRole("link", { name: /Volgende/ })).toContainText("2. Speerwerpen");
  await nav.getByRole("link", { name: /Volgende/ }).click();
  await expect(p.getByRole("heading", { level: 1 })).toHaveText("Speerwerpen");
  await expect(nav.getByRole("link", { name: /Vorige/ })).toContainText("1. Verspringen");
  await nav.getByRole("link", { name: /Volgende/ }).click();
  await expect(p.getByRole("heading", { level: 1 })).toHaveText("Touwtrekken");

  // Laatste onderdeel: klaar, terug naar de romp
  await expect(nav.getByRole("link", { name: /Klaar/ })).toContainText("Klaar: naar de romp");
  await nav.getByRole("link", { name: /Terug naar de romp/ }).click();
  await expect(p).toHaveURL(/\/avf\/D\?fase=romp$/);
  await s.ctx.close();
});

test("het hoofdmenu markeert bij onderliggende schermen de juiste knop", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-groep-1");
  const p = s.page;
  const menu = p.getByRole("navigation", { name: "Hoofdmenu" });
  const huidig = async (pad: string) => {
    await p.goto(pad);
    return menu.locator('a[aria-current="page"]').innerText();
  };
  expect(await huidig("/")).toContain("Onze meerdaagse");
  expect(await huidig("/programma")).toContain("Onze meerdaagse");
  expect(await huidig("/belevenissen")).toContain("Belevenissen");
  expect(await huidig("/avf")).toContain("Belevenissen");
  expect(await huidig("/avf/D?fase=romp")).toContain("Belevenissen");
  expect(await huidig("/budget")).toContain("Budget");
  expect(await huidig("/meer")).toContain("Meer");
  expect(await huidig("/meer/rolverdeling")).toContain("Meer");
  await s.ctx.close();

  const stuur = await nieuweSessie(browser, "test-stuur");
  const sm = stuur.page.getByRole("navigation", { name: "Hoofdmenu" });
  await stuur.page.goto("/stuurgroep/programma");
  await expect(sm.locator('a[aria-current="page"]')).toContainText("Stuurgroep");
  await stuur.ctx.close();
});

test("terugknoppen en doorverwijzingen op de overzichtsschermen", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-groep-1");
  const p = s.page;

  await p.goto("/avf");
  await p.getByRole("main").getByRole("link", { name: "Belevenissen" }).first().click();
  await expect(p).toHaveURL(/\/belevenissen$/);

  await p.goto("/programma");
  await p.getByRole("main").getByRole("link", { name: "Onze meerdaagse" }).click();
  await expect(p).toHaveURL(/\/$/);

  // Het logo brengt je naar het startscherm
  await p.goto("/meer");
  await p.getByRole("link", { name: "Naar Onze meerdaagse" }).click();
  await expect(p).toHaveURL(/\/$/);

  // Vanuit Meer kom je bij het programma en bij het AVF
  await p.goto("/meer");
  await p.getByRole("link", { name: "Programma van de meerdaagse" }).click();
  await expect(p).toHaveURL(/\/programma$/);
  await p.goto("/meer");
  await p.getByRole("link", { name: "Jullie AVF" }).click();
  await expect(p).toHaveURL(/\/avf$/);

  // Op de afdrukweergave zijn de navigatieknoppen verborgen
  await p.goto("/avf/B");
  await p.emulateMedia({ media: "print" });
  await expect(p.getByRole("navigation", { name: "Secties van het AVF" })).toBeHidden();
  await expect(p.getByRole("navigation", { name: "Vorige en volgende" })).toBeHidden();
  await s.ctx.close();
});

test("de stuurgroep bladert van belevenis naar belevenis; de projectgroep leest alleen het eigen AVF", async ({ browser }) => {
  const stuur = await nieuweSessie(browser, "test-stuur");
  const p = stuur.page;
  await p.goto("/belevenissen");
  await p.getByRole("link", { name: "Het hele AVF lezen" }).first().click();
  await expect(p.getByRole("heading", { level: 1 })).toContainText("Oer-Olympische Spelen");
  const nav = p.getByRole("navigation", { name: "Vorige en volgende" });
  await expect(nav.getByRole("link", { name: /Volgende/ })).toContainText("Testgroep 2");
  await nav.getByRole("link", { name: /Volgende/ }).click();
  await expect(p.getByText("Ardennen-meerdaagse · 28–30 juni 2027").first()).toBeVisible();
  await expect(nav.getByRole("link", { name: /Vorige/ })).toContainText("Testgroep 1");
  await nav.getByRole("link", { name: /Terug naar alle belevenissen/ }).click();
  await expect(p).toHaveURL(/\/belevenissen$/);
  await stuur.ctx.close();

  const groep = await nieuweSessie(browser, "test-groep-1");
  await groep.page.goto("/avf");
  await groep.page.getByRole("link", { name: /Het hele AVF lezen of afdrukken/ }).click();
  const gnav = groep.page.getByRole("navigation", { name: "Vorige en volgende" });
  await expect(gnav.getByRole("link", { name: /Volgende/ })).toHaveCount(0); // geen volgende belevenis voor een projectgroep
  await expect(gnav.getByRole("link", { name: /Terug naar alle belevenissen/ })).toBeVisible();
  await groep.ctx.close();
});
