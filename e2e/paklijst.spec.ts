/**
 * Persoonlijke paklijst op telefoonformaat tegen het cluster TEST: de stuurgroep vult items in (ook door een lijst te
 * plakken), iedereen in het cluster leest de lijst en vinkt af op de eigen telefoon, en een ander cluster ziet niets.
 * Na afloop staat TEST weer op de vaste categorieën zonder items.
 */
import { expect, test, type Page } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

const NAAM = "Paklijst e2e-tester";
let TEST = "";

async function herstel() {
  if (!TEST) return;
  await admin.from("paklijst_categorie").delete().eq("cluster_id", TEST);
  await admin.rpc("paklijst_standaard_categorieen", { p_cluster_id: TEST });
  await admin.from("wijziging").delete().eq("cluster_id", TEST).eq("naam", NAAM);
}

const spullenNamen = async () => (await admin.from("paklijst_item").select("naam").eq("cluster_id", TEST)).data!.map((r) => r.naam).sort();

/** Een categorie in het bewerkscherm openklappen. */
async function open(p: Page, categorie: string) {
  await p.locator("details > summary").filter({ has: p.getByText(categorie, { exact: true }) }).first().click();
}

test.beforeAll(async () => {
  TEST = await clusterId("TEST");
  await herstel();
});

test.afterAll(herstel);

test("Meer heeft kopjes en voor iedereen een knop naar de persoonlijke paklijst; een lege lijst zegt dat de stuurgroep hem maakt", async ({ browser }) => {
  for (const gebruiker of ["test-student", "test-groep-1", "test-stuur"]) {
    const s = await nieuweSessie(browser, gebruiker);
    await s.page.goto("/meer");
    await expect(s.page.getByRole("heading", { name: "Praktisch voor iedereen" })).toBeVisible();
    await expect(s.page.getByRole("link", { name: "Persoonlijke paklijst" })).toBeVisible();
    if (gebruiker === "test-stuur") await expect(s.page.getByRole("heading", { name: "Voor de stuurgroep" })).toBeVisible();
    else await expect(s.page.getByRole("heading", { name: "Voor de stuurgroep" })).toHaveCount(0);
    await s.page.getByRole("link", { name: "Persoonlijke paklijst" }).click();
    await expect(s.page.getByRole("heading", { name: "Persoonlijke paklijst", level: 1 })).toBeVisible();
    await expect(s.page.getByText(/wordt gemaakt door de stuurgroep/)).toBeVisible();
    const bewerk = s.page.getByRole("link", { name: "De paklijst bewerken" });
    if (gebruiker === "test-stuur") await expect(bewerk).toBeVisible();
    else {
      await expect(bewerk).toHaveCount(0);
      await s.page.goto("/meer/paklijst/bewerken");
      await expect(s.page).toHaveURL(/\/meer\/paklijst$/);
    }
    await s.ctx.close();
  }
});

test("de stuurgroep vult spullen in, plakt een lijst en voegt een categorie toe", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  await p.goto("/meer/paklijst/bewerken");
  await expect(p.getByRole("heading", { name: "Paklijst bewerken", level: 1 })).toBeVisible();
  // de vaste categorieën staan er al, zonder items
  await expect(p.getByText("Nog geen items").first()).toBeVisible();
  await p.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);

  await open(p, "Kleding");
  await p.getByRole("button", { name: "Item toevoegen aan Kleding" }).click();
  await expect(p.getByLabel("Kleding, item 1, naam")).toBeVisible();
  await p.getByLabel("Kleding, item 1, naam").fill("Broek");
  await p.getByLabel("Kleding, item 1, aantal").fill("2");
  await p.getByLabel("Kleding, item 1, aantal").blur();
  await expect.poll(async () => (await admin.from("paklijst_item").select("naam, aantal").eq("cluster_id", TEST)).data).toEqual([{ naam: "Broek", aantal: "2" }]);

  await p.getByRole("button", { name: "Item toevoegen aan Kleding" }).click();
  await expect(p.getByLabel("Kleding, item 2, naam")).toBeVisible();
  await p.getByLabel("Kleding, item 2, naam").fill("Muts");
  await p.getByLabel("Kleding, item 2, toelichting").fill("Voor de koude ochtenden");
  await p.getByLabel("Kleding, item 2, toelichting").blur();
  await p.locator("li", { has: p.getByLabel("Kleding, item 2, naam") }).getByLabel("Optioneel").first().check();
  await expect.poll(async () => (await admin.from("paklijst_item").select("optioneel").eq("cluster_id", TEST).eq("naam", "Muts").single()).data?.optioneel).toBe(true);

  // een item verplaatsen: Muts boven Broek
  await p.getByRole("button", { name: "Kleding, item 2 omhoog" }).click();
  await expect(p.getByLabel("Kleding, item 1, naam")).toHaveValue("Muts");

  // een lijst plakken in een andere categorie
  await open(p, "Toilettas en verzorging");
  await p.locator("details > summary", { hasText: "Plak een lijst in Toilettas en verzorging" }).click();
  await p.getByLabel("Lijst voor Toilettas en verzorging").fill("Toilettas\n- Tandenborstel\n- Zeep | 1\nLucifers | 1 | in een zakje");
  await p.getByRole("button", { name: "Toevoegen aan Toilettas en verzorging", exact: true }).click();
  await expect(p.getByText("4 regels toegevoegd.")).toBeVisible();
  await expect.poll(spullenNamen).toEqual(["Broek", "Lucifers", "Muts", "Tandenborstel", "Toilettas", "Zeep"]);

  // een nieuwe categorie
  await p.getByLabel("Nieuwe categorie in Per persoon").fill("Fietsspullen");
  await p.getByRole("button", { name: "Categorie toevoegen aan Per persoon" }).click();
  await expect.poll(async () => (await admin.from("paklijst_categorie").select("naam").eq("cluster_id", TEST).eq("naam", "Fietsspullen")).data).toHaveLength(1);
  await expect(p.getByText("Fietsspullen", { exact: true }).first()).toBeVisible();

  // een item verwijderen vraagt een bevestiging
  await p.getByRole("button", { name: "Kleding, item 1 verwijderen" }).click();
  await p.getByRole("button", { name: "Annuleren" }).click();
  expect(await spullenNamen()).toContain("Muts");
  await p.getByRole("button", { name: "Kleding, item 1 verwijderen" }).click();
  await p.getByRole("button", { name: "Ja, verwijderen" }).click();
  await expect.poll(spullenNamen).not.toContain("Muts");
  await expect(p.getByLabel("Kleding, item 2, naam")).toHaveCount(0); // wacht tot het scherm de verwijdering toont
  // en weer een optioneel item toevoegen voor de leesweergave
  await p.getByRole("button", { name: "Item toevoegen aan Kleding" }).click();
  await expect(p.getByLabel("Kleding, item 2, naam")).toBeVisible();
  await p.getByLabel("Kleding, item 2, naam").fill("Muts");
  await p.getByLabel("Kleding, item 2, naam").blur();
  await p.locator("li", { has: p.getByLabel("Kleding, item 2, naam") }).getByLabel("Optioneel").first().check();
  await expect.poll(async () => (await admin.from("paklijst_item").select("optioneel").eq("cluster_id", TEST).eq("naam", "Muts").single()).data?.optioneel).toBe(true);
  await s.ctx.close();
});

test("iedereen in het cluster leest de lijst en vinkt af op de eigen telefoon", async ({ browser }) => {
  for (const gebruiker of ["test-student", "test-groep-1"]) {
    const s = await nieuweSessie(browser, gebruiker);
    const p = s.page;
    await p.goto("/meer/paklijst");
    await expect(p.getByRole("heading", { name: "Per persoon" })).toBeVisible();
    await expect(p.getByRole("heading", { name: "Kleding" })).toBeVisible();
    await expect(p.getByText("Broek")).toBeVisible();
    await expect(p.getByText("· 2")).toBeVisible();
    await expect(p.getByText("Optioneel", { exact: true })).toBeVisible();
    await expect(p.getByText("in een zakje")).toBeVisible();
    // categorieën zonder items staan er niet
    await expect(p.getByRole("heading", { name: "Schoenen" })).toHaveCount(0);
    await expect(p.getByRole("heading", { name: "Fietsspullen" })).toHaveCount(0);

    // Toilettas, Tandenborstel, Zeep, Lucifers en Broek tellen mee; Muts is optioneel en telt niet mee
    await expect(p.getByTestId("voortgang")).toContainText("0 van 5 ingepakt");
    await p.getByLabel("Broek").check();
    await p.getByLabel("Zeep").check();
    await expect(p.getByTestId("voortgang")).toContainText("2 van 5 ingepakt");
    await p.getByLabel("Muts").check();
    await expect(p.getByTestId("voortgang")).toContainText("2 van 5 ingepakt");
    await p.reload();
    await expect(p.getByTestId("voortgang")).toContainText("2 van 5 ingepakt");
    await expect(p.getByLabel("Broek")).toBeChecked();
    await p.getByRole("button", { name: "Alles uitvinken" }).click();
    await expect(p.getByTestId("voortgang")).toContainText("0 van 5 ingepakt");
    await expect(p.getByRole("button", { name: /Afdrukken of opslaan als PDF/ })).toBeVisible();
    await s.ctx.close();
  }
});

test("de werkpagina van Logistiek & Facilitair linkt naar de paklijst met een uitroepteken zolang hij niet af is", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  const link = p.getByRole("link", { name: /Persoonlijke paklijst/ });
  // per persoon staan er items, maar nog niets om te delen met een groepje
  await p.goto("/stuurgroep/rol/logistiek_facilitair");
  await expect(link).toHaveAttribute("href", "/meer/paklijst");
  await expect(link.getByTestId("uitroepteken")).toBeVisible();
  await expect(link).toContainText("Nog niet af: er staan nog geen items bij om met een groepje te delen.");

  const { data: cat } = await admin.from("paklijst_categorie").select("id").eq("cluster_id", TEST).eq("blok", "groepje").order("volgorde").limit(1).single();
  await admin.from("paklijst_item").insert({ cluster_id: TEST, categorie_id: cat!.id, naam: "Gasstel", volgorde: 1 });
  await p.reload();
  await expect(link).toHaveAttribute("href", "/meer/paklijst");
  await expect(link.getByTestId("uitroepteken")).toHaveCount(0);
  await expect(link).not.toContainText("Nog niet af");

  // de rol Veiligheid & Welzijn heeft deze link niet
  await p.goto("/stuurgroep/rol/veiligheid_welzijn");
  await expect(p.getByRole("link", { name: /Persoonlijke paklijst/ })).toHaveCount(0);
  await s.ctx.close();
});

test("een ander cluster ziet de paklijst van TEST niet", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-student");
  await s.page.goto("/meer/paklijst");
  await expect(s.page.getByText("Broek")).toHaveCount(0);
  await expect(s.page.getByText("Tandenborstel")).toHaveCount(0);
  await s.ctx.close();
});
