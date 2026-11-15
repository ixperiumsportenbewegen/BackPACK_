/**
 * Deadlines (opdracht deadlines), op telefoonformaat tegen het cluster TEST:
 * de stuurgroep stelt in, verschuift en verwijdert, krijgt een waarschuwing bij een gelijktijdige wijziging en bij een
 * datum die niet logisch is, en een projectgroep kan niets instellen. Alles wordt daarna opgeruimd.
 */
import { expect, test } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

const NAAM = "Testpersoon";
let TEST = "";

async function opschonen() {
  if (!TEST) return;
  await admin.from("deadline").delete().eq("cluster_id", TEST).eq("gezet_door_naam", NAAM);
  await admin.from("wijziging").delete().eq("tabel", "deadline").eq("naam", NAAM);
}

const rij = async (onderdeel: string) =>
  (await admin.from("deadline").select("*").eq("cluster_id", TEST).eq("onderdeel", onderdeel).maybeSingle()).data;

test.beforeAll(async () => {
  TEST = await clusterId("TEST");
  await opschonen();
});
test.afterAll(opschonen);

test("de stuurgroep stelt een deadline in, verschuift hem en verwijdert hem", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  await p.goto("/stuurgroep/deadlines");
  await expect(p.getByRole("heading", { name: "Deadlines", level: 1 })).toBeVisible();
  await p.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);

  const a = p.getByTestId("deadline-rij-A");
  // zonder datum kun je niet opslaan
  await expect(a.getByRole("button", { name: "Opslaan" })).toBeDisabled();
  await a.getByLabel("Datum", { exact: true }).fill("2026-12-18");
  await expect(a.getByLabel("Tijd", { exact: true })).toHaveValue("17:00"); // standaardtijd
  await a.getByLabel(/Waarom deze datum/).fill("Daarna beoordeelt de stuurgroep.");
  await a.getByRole("button", { name: "Opslaan" }).click();
  await expect(a.getByText("Opgeslagen", { exact: true })).toBeVisible();

  const d = (await rij("A"))!;
  expect(new Date(d.moment).toISOString()).toBe("2026-12-18T16:00:00.000Z"); // 17:00 Nederlandse tijd
  expect(d.toelichting).toBe("Daarna beoordeelt de stuurgroep.");
  expect(d.gezet_door_naam).toBe(NAAM);
  // er staat nu ook hoe lang het nog duurt
  await expect(a.locator("[data-niveau]")).toBeVisible();

  // verschuiven, met een aangepaste tijd
  await a.getByLabel("Datum", { exact: true }).fill("2027-01-08");
  await a.getByLabel("Tijd", { exact: true }).fill("12:30");
  await a.getByRole("button", { name: "Opslaan" }).click();
  await expect(a.getByText(/deadline is verschoven/)).toBeVisible();
  expect(new Date((await rij("A"))!.moment).toISOString()).toBe("2027-01-08T11:30:00.000Z");
  const { data: log } = await admin.from("wijziging").select("actie").eq("tabel", "deadline").eq("naam", NAAM).eq("actie", "deadline_verschoven");
  expect(log?.length).toBe(1);

  // verwijderen
  await a.getByRole("button", { name: "Verwijderen" }).click();
  await expect(a.getByText("Deadline verwijderd")).toBeVisible();
  expect(await rij("A")).toBeNull();
  await s.ctx.close();
});

test("een datum in het verleden of na de start van de meerdaagse geeft een waarschuwing, maar blokkeert niets", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  await p.goto("/stuurgroep/deadlines");
  await p.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  const b = p.getByTestId("deadline-rij-B");

  await b.getByLabel("Datum", { exact: true }).fill("2026-01-05");
  await expect(b.getByText(/Dit moment is al voorbij/)).toBeVisible();
  await b.getByLabel("Datum", { exact: true }).fill("2027-07-01");
  await expect(b.getByText(/start van de meerdaagse/)).toBeVisible();
  // opslaan kan gewoon
  await b.getByRole("button", { name: "Opslaan" }).click();
  await expect(b.getByText(/Opgeslagen/)).toBeVisible();
  expect(await rij("B")).not.toBeNull();
  await s.ctx.close();
});

test("als iemand anders dezelfde deadline net wijzigde, volgt een waarschuwing en wordt niets overschreven", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  await p.goto("/stuurgroep/deadlines");
  await p.getByLabel("Wie werkt hier? (jouw naam)").fill(NAAM);
  const b = p.getByTestId("deadline-rij-B");

  // iemand anders verschuift B terwijl deze pagina openstaat
  await admin.from("deadline").update({ moment: "2026-12-11T16:00:00Z" }).eq("cluster_id", TEST).eq("onderdeel", "B");
  await b.getByLabel("Datum", { exact: true }).fill("2026-12-30");
  await b.getByRole("button", { name: "Opslaan" }).click();
  await expect(b.getByRole("alert")).toContainText("heeft dit net gewijzigd");
  expect(new Date((await rij("B"))!.moment).toISOString()).toBe("2026-12-11T16:00:00.000Z");

  // hun versie houden: het scherm toont hun deadline
  await b.getByRole("button", { name: "Hun versie houden" }).click();
  await expect(b.getByLabel("Datum", { exact: true })).toHaveValue("2026-12-11");
  // en nu kan een nieuwe wijziging wel
  await b.getByLabel("Datum", { exact: true }).fill("2026-12-30");
  await b.getByRole("button", { name: "Opslaan" }).click();
  await expect(b.getByText(/verschoven/)).toBeVisible();
  expect(new Date((await rij("B"))!.moment).toISOString()).toBe("2026-12-30T16:00:00.000Z");
  await s.ctx.close();
});

test("een projectgroep en een student kunnen niets instellen", async ({ browser }) => {
  for (const gebruiker of ["test-groep-1", "test-student"]) {
    const s = await nieuweSessie(browser, gebruiker);
    await s.page.goto("/stuurgroep/deadlines");
    await expect(s.page).toHaveURL("/");
    await s.ctx.close();
  }
});

// ------------------------------------------------------------------ het startscherm

const UNIEK = "E2E-deadline-test";
const dagenVanNu = (dagen: number) => new Date(Date.now() + dagen * 86_400_000).toISOString();

async function zetDeadlines() {
  await opschonen();
  const rijen = [
    ["B", dagenVanNu(-3)], // drie dagen te laat
    ["D", dagenVanNu(5)], // nog 5 dagen
    ["E", dagenVanNu(1)], // morgen
    ["indienen", dagenVanNu(10)],
  ] as const;
  for (const [onderdeel, moment] of rijen) {
    await admin.from("deadline").insert({ cluster_id: TEST, onderdeel, moment, toelichting: UNIEK, gezet_door_naam: NAAM });
  }
}

test("de kaart op het startscherm toont hoe lang het nog duurt, in volgorde en met kleur, icoon en tekst", async ({ browser }) => {
  await zetDeadlines();
  const s = await nieuweSessie(browser, "test-student");
  const p = s.page;
  await p.goto("/");
  const kaart = p.getByTestId("deadlines-kaart");
  await expect(kaart).toBeVisible();

  const b = kaart.getByTestId("deadline-B");
  await expect(b).toContainText("Sectie B · Beginsituatie");
  await expect(b).toContainText("3 dagen te laat");
  await expect(b.locator("[data-niveau]")).toHaveAttribute("data-niveau", "verstreken");
  await expect(kaart.getByTestId("deadline-E")).toContainText("morgen");
  await expect(kaart.getByTestId("deadline-E").locator("[data-niveau]")).toHaveAttribute("data-niveau", "dringend");
  await expect(kaart.getByTestId("deadline-D")).toContainText("nog 5 dagen");
  await expect(kaart.getByTestId("deadline-D").locator("[data-niveau]")).toHaveAttribute("data-niveau", "binnenkort");
  await expect(kaart.getByTestId("deadline-indienen")).toContainText("nog 10 dagen");
  await expect(kaart.getByTestId("deadline-indienen").locator("[data-niveau]")).toHaveAttribute("data-niveau", "ruim");

  // op volgorde van datum: B (voorbij), E (morgen), D (5 dagen), indienen (10 dagen)
  const volgorde = await kaart.locator("li[data-testid^='deadline-']").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(volgorde).toEqual(["deadline-B", "deadline-E", "deadline-D", "deadline-indienen"]);

  // een student ziet geen eigen stand en geen knop om in te stellen
  await expect(kaart.getByText(/Jullie stand/)).toHaveCount(0);
  await expect(kaart.getByRole("link", { name: "Deadlines beheren" })).toHaveCount(0);
  await s.ctx.close();
});

test("een projectgroep ziet de eigen stand; wat klaar is staat apart", async ({ browser }) => {
  // test-groep-1 heeft een compleet voorbeeld-AVF, test-groep-2 een leeg AVF
  const g1 = await nieuweSessie(browser, "test-groep-1");
  await g1.page.goto("/");
  const k1 = g1.page.getByTestId("deadlines-kaart");
  // B, D en E zijn compleet: staan onder "klaar"; indienen is nog open
  await expect(k1.getByTestId("deadline-B")).toHaveCount(0);
  await expect(k1.getByTestId("deadline-indienen")).toContainText("nog niet ingediend");
  await k1.getByText(/klaar$/).click();
  await expect(k1.getByTestId("deadline-klaar-B")).toBeVisible();
  await g1.ctx.close();

  const g2 = await nieuweSessie(browser, "test-groep-2");
  await g2.page.goto("/");
  const k2 = g2.page.getByTestId("deadlines-kaart");
  await expect(k2.getByTestId("deadline-D")).toContainText(/Jullie stand: \d+ punten open/);
  await expect(k2.getByTestId("deadline-D").getByRole("link", { name: /Jullie stand/ })).toHaveAttribute("href", "/avf/D");
  await expect(k2.getByTestId("deadline-indienen").getByRole("link", { name: /Jullie stand/ })).toHaveAttribute("href", "/avf/indienen");
  await g2.ctx.close();
});

test("de stuurgroep ziet hoeveel groepen klaar zijn en wie nog open staat", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  await s.page.goto("/");
  const d = s.page.getByTestId("deadlines-kaart").getByTestId("deadline-D");
  await expect(d).toContainText("1 van 2 groepen klaar");
  await expect(d).toContainText("Nog open: Testgroep 2");
  await expect(s.page.getByTestId("deadlines-kaart").getByRole("link", { name: "Deadlines beheren" })).toBeVisible();
  await s.ctx.close();
});

test("de deadlines van een cluster zijn niet te zien in een ander cluster", async ({ browser }) => {
  for (const gebruiker of ["vd-groep-2", "vd-stuur-programma"]) {
    const s = await nieuweSessie(browser, gebruiker);
    await s.page.goto("/");
    await expect(s.page.getByRole("heading", { name: "Belevenissen", level: 2 })).toBeVisible();
    await expect(s.page.getByText(UNIEK)).toHaveCount(0);
    await s.ctx.close();
  }
});

test("bij het AVF zelf staat een kleine deadlineregel, en die verdwijnt als de sectie klaar is", async ({ browser }) => {
  const g = await nieuweSessie(browser, "test-groep-2");
  await g.page.goto("/avf/D");
  await expect(g.page.getByTestId("sectie-deadline")).toContainText("nog 5 dagen");
  await expect(g.page.getByTestId("sectie-deadline")).toContainText(UNIEK);
  await g.page.goto("/avf");
  await expect(g.page.getByTestId("deadline-label").first()).toBeVisible();
  await g.ctx.close();

  // test-groep-1 is compleet voor sectie D: daar staat geen regel meer
  const g1 = await nieuweSessie(browser, "test-groep-1");
  await g1.page.goto("/avf/D");
  await expect(g1.page.getByRole("heading", { name: "Kop, romp en staart", level: 1 })).toBeVisible();
  await expect(g1.page.getByTestId("sectie-deadline")).toHaveCount(0);
  await g1.ctx.close();
});

test("na de deadline kan een groep gewoon doorwerken: een deadline blokkeert niets", async ({ browser }) => {
  // B is drie dagen voorbij
  const g = await nieuweSessie(browser, "test-groep-2");
  const { data: voor } = await admin.from("avf").select("id, projectgroep:projectgroep_id!inner(nummer)").eq("cluster_id", TEST).eq("projectgroep.nummer", 2).single();
  try {
    await g.page.goto("/avf/B");
    await expect(g.page.getByTestId("sectie-deadline")).toContainText("3 dagen te laat");
    await g.page.getByLabel("Wie werkt hier?").fill(NAAM);
    const veld = g.page.getByLabel("Algemene omschrijving van de groep");
    await expect(veld).toBeEnabled();
    await veld.fill("Na de deadline nog aangevuld.");
    await veld.blur();
    await expect.poll(async () => (await admin.from("avf").select("beginsituatie").eq("id", voor!.id).single()).data?.beginsituatie?.algemeen).toBe("Na de deadline nog aangevuld.");
    // en het indienen is ook niet geblokkeerd door een verlopen deadline
    await g.page.goto("/avf/indienen");
    await expect(g.page.getByRole("heading", { name: "AVF indienen" })).toBeVisible();
    await expect(g.page.getByRole("heading", { name: "Controlelijst" })).toBeVisible();
  } finally {
    const { data: begin } = await admin.from("avf").select("beginsituatie").eq("id", voor!.id).single();
    const rest = { ...(begin?.beginsituatie ?? {}) } as Record<string, unknown>;
    delete rest.algemeen;
    await admin.from("avf").update({ beginsituatie: rest }).eq("id", voor!.id);
    await g.ctx.close();
  }
});

test("zonder deadlines ziet de stuurgroep een uitnodiging en een groep niets", async ({ browser }) => {
  await opschonen();
  const s = await nieuweSessie(browser, "test-stuur");
  await s.page.goto("/");
  await expect(s.page.getByTestId("deadlines-kaart")).toContainText("Er zijn nog geen deadlines");
  await expect(s.page.getByRole("link", { name: "Deadlines instellen" })).toBeVisible();
  await s.ctx.close();

  const g = await nieuweSessie(browser, "test-groep-2");
  await g.page.goto("/");
  await expect(g.page.getByTestId("deadlines-kaart")).toHaveCount(0);
  await g.ctx.close();
});
