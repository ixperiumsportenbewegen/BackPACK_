/**
 * De 10 bergtoppen op telefoonformaat tegen het cluster TEST: de stuurgroep vult in en publiceert, studenten lezen pas na het
 * publiceren, een aanpassing blijft concept tot opnieuw publiceren, en intrekken haalt de afspraken weer weg.
 * Na afloop is TEST weer leeg.
 */
import { expect, test } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

const NAAM = "Bergtoppen e2e-tester";
let TEST = "";
let origineleLink: string | null = null;

async function herstel() {
  if (!TEST) return;
  await admin.from("bergtop_veld").delete().eq("cluster_id", TEST);
  await admin.from("bergtop_publicatie").delete().eq("cluster_id", TEST);
  await admin.from("cluster").update({ inschrijf_link: origineleLink }).eq("id", TEST);
  await admin.from("wijziging").delete().eq("cluster_id", TEST).eq("naam", NAAM);
}

/** Top 2 t/m 10 en de toelichting rechtstreeks in de database zetten, zodat de test alleen top 1 hoeft te typen. */
async function vulRest() {
  const rijen = [];
  for (let i = 2; i <= 10; i++) {
    rijen.push({ cluster_id: TEST, sleutel: `top_${i}_titel`, tekst: `Titel ${i}`, bijgewerkt_door_naam: NAAM });
    rijen.push({ cluster_id: TEST, sleutel: `top_${i}_afspraak`, tekst: `Afspraak ${i}`, bijgewerkt_door_naam: NAAM });
  }
  rijen.push({ cluster_id: TEST, sleutel: "toelichting_titel", tekst: "Het dal", bijgewerkt_door_naam: NAAM });
  rijen.push({ cluster_id: TEST, sleutel: "toelichting", tekst: "Als het even niet gaat, zoeken we elkaar op.", bijgewerkt_door_naam: NAAM });
  await admin.from("bergtop_veld").upsert(rijen);
}

test.beforeAll(async () => {
  TEST = await clusterId("TEST");
  origineleLink = (await admin.from("cluster").select("inschrijf_link").eq("id", TEST).single()).data?.inschrijf_link ?? null;
  await herstel();
});

test.afterAll(herstel);

test("zolang er niets is gepubliceerd zien studenten niets; de stuurgroep ziet een uitroepteken op de werkpagina", async ({ browser }) => {
  const student = await nieuweSessie(browser, "test-student");
  await student.page.goto("/");
  await expect(student.page.getByTestId("bergtoppen-kaart")).toHaveCount(0);
  await student.page.goto("/meer");
  await expect(student.page.getByRole("link", { name: /De 10 bergtoppen/ })).toHaveCount(0);
  await student.page.goto("/bergtoppen");
  await expect(student.page.getByText(/worden voorbereid door de stuurgroep/)).toBeVisible();
  await expect(student.page.getByRole("link", { name: /bergtoppen bewerken|invullen/ })).toHaveCount(0);
  await student.page.goto("/bergtoppen/bewerken"); // geen recht: terug naar de leespagina
  await expect(student.page).toHaveURL(/\/bergtoppen$/);
  await student.ctx.close();

  const stuur = await nieuweSessie(browser, "test-stuur");
  await stuur.page.goto("/stuurgroep/rol/veiligheid_welzijn");
  const link = stuur.page.getByRole("link", { name: /De 10 bergtoppen/ });
  await expect(link).toHaveAttribute("href", "/bergtoppen/bewerken");
  await expect(link.getByTestId("uitroepteken")).toBeVisible();
  await expect(link).toContainText("0 van de 10 toppen ingevuld");
  await stuur.ctx.close();
});

test("de stuurgroep vult in, publiceert pas als alles klaar is; daarna lezen studenten de afspraken", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  await p.goto("/bergtoppen/bewerken");
  await expect(p.getByRole("heading", { name: "Bergtoppen bewerken", level: 1 })).toBeVisible();
  await p.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);

  await p.getByLabel("Titel van top 1", { exact: true }).fill("Zorg voor elkaar");
  await p.getByLabel("Afspraak van top 1", { exact: true }).fill("We helpen elkaar, ook als niemand het ziet.");
  await expect.poll(async () => (await admin.from("bergtop_veld").select("tekst").eq("cluster_id", TEST).eq("sleutel", "top_1_afspraak").maybeSingle()).data?.tekst).toBe("We helpen elkaar, ook als niemand het ziet.");

  // nog niet alles is ingevuld: publiceren kan niet
  await p.reload();
  await expect(p.getByTestId("bergtoppen-status")).toContainText("1 van de 10 toppen");
  const publiceren = p.getByRole("button", { name: /^Publiceren voor/ });
  await expect(publiceren).toBeDisabled();

  // de rest is ingevuld: nu kan het
  await vulRest();
  await p.reload();
  await expect(p.getByTestId("bergtoppen-status")).toContainText("Alles is ingevuld");
  await p.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  await expect(publiceren).toBeEnabled();
  await publiceren.click();
  await expect(p.getByRole("status").filter({ hasText: "Gepubliceerd." })).toBeVisible();
  await expect(p.getByTestId("bergtoppen-status")).toContainText("Gepubliceerd (versie 1)");

  // de werkpagina heeft geen uitroepteken meer
  await p.goto("/stuurgroep/rol/veiligheid_welzijn");
  await expect(p.getByRole("link", { name: /De 10 bergtoppen/ }).getByTestId("uitroepteken")).toHaveCount(0);
  await s.ctx.close();

  // studenten zien de kaart op Onze meerdaagse, de link onder Meer en de afspraken zelf
  for (const gebruiker of ["test-student", "test-groep-1"]) {
    const st = await nieuweSessie(browser, gebruiker);
    await st.page.goto("/");
    const kaart = st.page.getByTestId("bergtoppen-kaart");
    await expect(kaart).toBeVisible();
    await st.page.goto("/meer");
    await expect(st.page.getByRole("link", { name: /De 10 bergtoppen/ })).toBeVisible();
    await st.page.goto("/");
    await kaart.click();
    await expect(st.page.getByRole("heading", { name: "De 10 bergtoppen", level: 1 })).toBeVisible();
    await expect(st.page.getByRole("heading", { name: "Zorg voor elkaar" })).toBeVisible();
    await expect(st.page.getByText("We helpen elkaar, ook als niemand het ziet.")).toBeVisible();
    await expect(st.page.getByRole("heading", { name: "Titel 10" })).toBeVisible();
    await expect(st.page.getByRole("heading", { name: "Het dal" })).toBeVisible();
    await expect(st.page.getByText(/De link daarnaartoe volgt/)).toBeVisible();
    await st.ctx.close();
  }
});

test("de link naar het inschrijfformulier verschijnt bij studenten; een aanpassing blijft concept tot opnieuw publiceren", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  await p.goto("/bergtoppen/bewerken");
  await p.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  await p.getByLabel("Link naar het inschrijfformulier").fill("https://forms.example/inschrijven");
  await expect.poll(async () => (await admin.from("cluster").select("inschrijf_link").eq("id", TEST).single()).data?.inschrijf_link).toBe("https://forms.example/inschrijven");

  await p.getByLabel("Titel van top 1", { exact: true }).fill("Zorg goed voor elkaar");
  await expect.poll(async () => (await admin.from("bergtop_veld").select("tekst").eq("cluster_id", TEST).eq("sleutel", "top_1_titel").single()).data?.tekst).toBe("Zorg goed voor elkaar");
  await p.reload();
  await expect(p.getByTestId("bergtoppen-status")).toContainText("wijkt af");
  // een aanpassing na publicatie: op de werkpagina een notitie, geen uitroepteken
  await p.goto("/stuurgroep/rol/veiligheid_welzijn");
  const werklink = p.getByRole("link", { name: /De 10 bergtoppen/ });
  await expect(werklink).toContainText("nog niet zijn gepubliceerd");
  await expect(werklink.getByTestId("uitroepteken")).toHaveCount(0);

  // de student ziet nog de oude titel, en nu wel de knop naar het inschrijfformulier
  const st = await nieuweSessie(browser, "test-student");
  await st.page.goto("/bergtoppen");
  await expect(st.page.getByRole("heading", { name: "Zorg voor elkaar", exact: true })).toBeVisible();
  await expect(st.page.getByRole("heading", { name: "Zorg goed voor elkaar" })).toHaveCount(0);
  await expect(st.page.getByRole("link", { name: "Ondertekenen via het inschrijfformulier" })).toHaveAttribute("href", "https://forms.example/inschrijven");

  // opnieuw publiceren: nu ziet de student de nieuwe titel
  await p.goto("/bergtoppen/bewerken");
  await p.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  await p.getByRole("button", { name: "Opnieuw publiceren" }).click();
  await expect(p.getByTestId("bergtoppen-status")).toContainText("Gepubliceerd (versie 2)");
  await st.page.reload();
  await expect(st.page.getByRole("heading", { name: "Zorg goed voor elkaar" })).toBeVisible();
  await st.ctx.close();

  // intrekken: studenten zien de afspraken niet meer, de stuurgroep houdt het concept
  await p.getByRole("button", { name: "Intrekken" }).click();
  await expect(p.getByTestId("bergtoppen-status")).toContainText("Ingetrokken");
  const na = await nieuweSessie(browser, "test-student");
  await na.page.goto("/");
  await expect(na.page.getByTestId("bergtoppen-kaart")).toHaveCount(0);
  await na.page.goto("/bergtoppen");
  await expect(na.page.getByText(/worden voorbereid door de stuurgroep/)).toBeVisible();
  await na.ctx.close();
  expect((await admin.from("bergtop_veld").select("sleutel").eq("cluster_id", TEST)).data).toHaveLength(22);
  await s.ctx.close();
});
