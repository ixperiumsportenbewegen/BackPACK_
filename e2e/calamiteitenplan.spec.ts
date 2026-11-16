/**
 * Calamiteitenplan (incl. EHBO) op telefoonformaat tegen het cluster TEST: de stuurgroep vult het plan in, iedereen in het
 * cluster leest het (met bel- en groepsapp-knoppen), projectgroepen en studenten kunnen het niet bewerken en het AVF verwijst
 * ernaar. Daarna wordt alles teruggezet.
 */
import { expect, test } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

const NAAM = "Plan e2e-tester";
let TEST = "";
let origineleLink: string | null = null;

async function opschonen() {
  if (!TEST) return;
  await admin.from("calamiteit_veld").delete().eq("cluster_id", TEST);
  await admin.from("calamiteit_item").delete().eq("cluster_id", TEST);
  await admin.from("cluster").update({ whatsapp_link: origineleLink }).eq("id", TEST);
  await admin.from("wijziging").delete().eq("cluster_id", TEST).eq("naam", NAAM);
}

test.beforeAll(async () => {
  TEST = await clusterId("TEST");
  origineleLink = (await admin.from("cluster").select("whatsapp_link").eq("id", TEST).single()).data?.whatsapp_link ?? null;
  await opschonen();
});

test.afterAll(opschonen);

test("een lege plan: iedereen ziet de knop onder Meer en de melding dat het plan volgt; alleen de stuurgroep bewerkt", async ({ browser }) => {
  for (const gebruiker of ["test-student", "test-groep-1", "test-stuur"]) {
    const s = await nieuweSessie(browser, gebruiker);
    await s.page.goto("/meer");
    await s.page.getByRole("link", { name: /Calamiteitenplan \(incl\. EHBO\)/ }).click();
    await expect(s.page.getByRole("heading", { name: "Calamiteitenplan", level: 1 })).toBeVisible();
    await expect(s.page.getByText(/wordt ingevuld door de stuurgroep/)).toBeVisible();
    await expect(s.page.getByRole("button", { name: /Afdrukken of opslaan als PDF/ })).toBeVisible();
    const bewerkLink = s.page.getByRole("link", { name: "Het plan bewerken" });
    if (gebruiker === "test-stuur") await expect(bewerkLink).toBeVisible();
    else {
      await expect(bewerkLink).toHaveCount(0);
      await s.page.goto("/meer/calamiteitenplan/bewerken");
      await expect(s.page).toHaveURL(/\/meer\/calamiteitenplan$/);
    }
    await s.ctx.close();
  }
  // het AVF zegt dat het plan volgt zolang er niets in staat
  const g = await nieuweSessie(browser, "test-groep-2");
  await g.page.goto("/avf/H");
  await expect(g.page.getByText(/Het calamiteitenplan volgt/)).toBeVisible();
  await g.ctx.close();
});

test("de stuurgroep vult het plan in: tekstvelden, een lijst en de groepsapp-link slaan direct op", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  await p.goto("/meer/calamiteitenplan/bewerken");
  await expect(p.getByRole("heading", { name: "Plan bewerken", level: 1 })).toBeVisible();
  // zonder naam wordt er niets opgeslagen
  await p.getByLabel("Noodnummer", { exact: true }).fill("112");
  await p.getByLabel("Noodnummer", { exact: true }).blur();
  await expect(p.getByText("Vul bovenaan eerst je naam in.").first()).toBeVisible();
  await p.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  await p.getByLabel("Noodnummer", { exact: true }).fill("112 ");
  await p.getByLabel("Noodnummer", { exact: true }).blur();
  await expect.poll(async () => (await admin.from("calamiteit_veld").select("tekst").eq("cluster_id", TEST).eq("sleutel", "noodnummer").maybeSingle()).data?.tekst).toBe("112");

  await p.getByLabel("De eerste stappen").fill("Let op gevaar.\nGa na wat er is gebeurd.");
  await p.getByLabel("De eerste stappen").blur();
  await expect.poll(async () => (await admin.from("calamiteit_veld").select("tekst").eq("cluster_id", TEST).eq("sleutel", "stappen").maybeSingle()).data?.tekst).toBe("Let op gevaar.\nGa na wat er is gebeurd.");

  await p.getByLabel("Link naar de groepsapp (WhatsApp)").fill("https://chat.whatsapp.com/e2etest");
  await p.getByLabel("Link naar de groepsapp (WhatsApp)").blur();
  await expect.poll(async () => (await admin.from("cluster").select("whatsapp_link").eq("id", TEST).single()).data?.whatsapp_link).toBe("https://chat.whatsapp.com/e2etest");
  // een ongeldige link wordt geweigerd met een melding
  await p.getByLabel("Link naar de groepsapp (WhatsApp)").fill("chat.whatsapp.com/zonder-https");
  await p.getByLabel("Link naar de groepsapp (WhatsApp)").blur();
  await expect(p.getByText(/geen geldige link/)).toBeVisible();
  await p.getByLabel("Link naar de groepsapp (WhatsApp)").fill("https://chat.whatsapp.com/e2etest");
  await p.getByLabel("Link naar de groepsapp (WhatsApp)").blur();

  // een lijst: twee contactpersonen toevoegen, invullen en de volgorde omdraaien
  await p.getByRole("button", { name: "Contactpersoon toevoegen" }).click();
  await expect(p.getByLabel("Contactpersoon 1, Naam")).toBeVisible();
  await p.getByLabel("Contactpersoon 1, Naam").fill("Eerste Contact");
  await p.getByLabel("Contactpersoon 1, Telefoonnummer").fill("+32 82 21 24 11");
  await p.getByLabel("Contactpersoon 1, Telefoonnummer").blur();
  await p.getByRole("button", { name: "Contactpersoon toevoegen" }).click();
  await expect(p.getByLabel("Contactpersoon 2, Naam")).toBeVisible();
  await p.getByLabel("Contactpersoon 2, Naam").fill("Tweede Contact");
  await p.getByLabel("Contactpersoon 2, Naam").blur();
  await p.getByRole("button", { name: "Contactpersoon 2 omhoog" }).click();
  await expect(p.getByLabel("Contactpersoon 1, Naam")).toHaveValue("Tweede Contact");
  const namen = async () => (await admin.from("calamiteit_item").select("velden, volgorde").eq("cluster_id", TEST).eq("lijst", "contactpersonen").order("volgorde")).data!.map((r) => (r.velden as { naam?: string }).naam);
  await expect.poll(namen).toEqual(["Tweede Contact", "Eerste Contact"]);

  // een regel verwijderen vraagt eerst een bevestiging
  await p.getByRole("button", { name: "Contactpersoon 2 verwijderen" }).click();
  await p.getByRole("button", { name: "Annuleren" }).click();
  await expect.poll(namen).toEqual(["Tweede Contact", "Eerste Contact"]);
  await p.getByRole("button", { name: "Contactpersoon 2 verwijderen" }).click();
  await p.getByRole("button", { name: "Ja, verwijderen" }).click();
  await expect.poll(namen).toEqual(["Tweede Contact"]);
  await expect(p.getByLabel("Contactpersoon 2, Naam")).toHaveCount(0); // wacht tot het scherm de verwijdering toont
  await p.getByRole("button", { name: "Contactpersoon toevoegen" }).click();
  await expect(p.getByLabel("Contactpersoon 2, Naam")).toBeVisible();
  await p.getByLabel("Contactpersoon 2, Naam").fill("Eerste Contact");
  await p.getByLabel("Contactpersoon 2, Telefoonnummer").fill("+32 82 21 24 11");
  await p.getByLabel("Contactpersoon 2, Telefoonnummer").blur();
  await expect.poll(namen).toEqual(["Tweede Contact", "Eerste Contact"]);
  await s.ctx.close();
});

test("iedereen in het cluster leest het plan met een belknop, een groepsapp-knop en aantikbare nummers", async ({ browser }) => {
  for (const gebruiker of ["test-student", "test-groep-1", "test-stuur"]) {
    const s = await nieuweSessie(browser, gebruiker);
    const p = s.page;
    await p.goto("/meer/calamiteitenplan");
    await expect(p.getByRole("link", { name: /Bel het noodnummer: 112/ })).toHaveAttribute("href", "tel:112");
    await expect(p.getByRole("link", { name: /Open de groepsapp voor noodmeldingen/ })).toHaveAttribute("href", "https://chat.whatsapp.com/e2etest");
    await expect(p.getByText("Let op gevaar.")).toBeVisible();
    await expect(p.getByRole("heading", { name: "Tweede Contact" })).toBeVisible();
    await expect(p.getByRole("link", { name: "+32 82 21 24 11" })).toHaveAttribute("href", "tel:+3282212411");
    await expect(p.getByText(/Laatst bijgewerkt .* door Plan e2e-tester/)).toBeVisible();
    // onderdelen zonder inhoud staan er wel, met de melding dat ze nog niet zijn ingevuld
    await expect(p.locator("section#ziekenhuizen").getByText("Nog niet ingevuld.")).toBeVisible();
    await s.ctx.close();
  }
});

test("het AVF verwijst naar het plan zodra er iets in staat", async ({ browser }) => {
  const g = await nieuweSessie(browser, "test-groep-2");
  await g.page.goto("/avf/H");
  await g.page.getByRole("link", { name: "Open het calamiteitenplan" }).click();
  await expect(g.page).toHaveURL(/\/meer\/calamiteitenplan$/);
  await expect(g.page.getByText("Let op gevaar.")).toBeVisible();
  await g.ctx.close();
});

test("een ander cluster ziet het plan van TEST niet", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-student");
  await s.page.goto("/meer/calamiteitenplan");
  await expect(s.page.getByText("Let op gevaar.")).toHaveCount(0);
  await expect(s.page.getByText("Tweede Contact")).toHaveCount(0);
  await s.ctx.close();
});
