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
