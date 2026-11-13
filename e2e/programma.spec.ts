/**
 * Programma beheren in de app: dagen met kleur, tijden die automatisch meeschuiven met een uitroepteken,
 * activiteiten toevoegen en verwijderen, en belevenisvakken die vast blijven.
 * Draait op het TEST-cluster (test-stuur, test-student) en zet alles daarna terug.
 */
import { expect, test } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

interface Rij {
  id: string; volgorde: number; dag: string; starttijd: string; eindtijd: string; titel: string;
  omschrijving: string | null; locatie: string | null;
}
let TEST: string;
let begin: Rij[] = [];

async function herstel() {
  const { data } = await admin.from("programma_regel").select("id").eq("cluster_id", TEST);
  const extra = (data ?? []).filter((r) => !begin.some((b) => b.id === r.id)).map((r) => r.id);
  if (extra.length) await admin.from("programma_regel").delete().in("id", extra);
  for (const [i, b] of begin.entries()) await admin.from("programma_regel").update({ volgorde: 1000 + i }).eq("id", b.id);
  for (const b of begin) {
    await admin.from("programma_regel").update({
      volgorde: b.volgorde, dag: b.dag, starttijd: b.starttijd, eindtijd: b.eindtijd, titel: b.titel,
      omschrijving: b.omschrijving, locatie: b.locatie, oorspronkelijke_starttijd: null, oorspronkelijke_eindtijd: null,
    }).eq("id", b.id);
  }
}

test.beforeAll(async () => {
  TEST = await clusterId("TEST");
  const { data } = await admin.from("programma_regel").select("id, volgorde, dag, starttijd, eindtijd, titel, omschrijving, locatie").eq("cluster_id", TEST).order("volgorde");
  begin = (data ?? []) as Rij[];
  expect(begin).toHaveLength(18);
});
test.afterAll(herstel);

test("het beheerscherm toont de dagen in kleur en de belevenisvakken als vast", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  await p.goto("/stuurgroep/programma");
  await p.waitForLoadState("networkidle");

  const kopjes = p.locator("h3[id^='beheer-dag-']");
  await expect(kopjes).toHaveCount(3);
  await expect(kopjes.nth(0)).toContainText(/maandag/i);
  await expect(kopjes.nth(1)).toContainText(/dinsdag/i);
  await expect(kopjes.nth(2)).toContainText(/woensdag/i);
  const kleuren = await kopjes.evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
  expect(new Set(kleuren).size).toBe(3); // elke dag een eigen kleur

  // Een belevenisvak: vast, met de verantwoordelijke projectgroep, zonder verwijderknop
  const vak = p.locator("details").filter({ hasText: "Avondactiviteit" }).first();
  await expect(vak.locator("summary")).toContainText("Testgroep 1 is verantwoordelijk");
  await vak.locator("summary").click();
  await expect(vak.getByText("Belevenisvak: vast.")).toBeVisible();
  await expect(vak.getByRole("button", { name: /verwijderen/i })).toHaveCount(0);

  // Een vaste activiteit: wel te verwijderen
  const vast = p.locator("details").filter({ hasText: "Verzamelen bij Gymnasion" }).first();
  await vast.locator("summary").click();
  await expect(vast.getByRole("button", { name: /Deze activiteit verwijderen/ })).toBeVisible();
  await s.ctx.close();
});

test("een andere eindtijd schuift de volgende activiteiten mee, met een uitroepteken dat iedereen ziet", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  await p.goto("/stuurgroep/programma");
  await p.waitForLoadState("networkidle");
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");

  const eerste = p.locator("details").filter({ hasText: "Verzamelen bij Gymnasion" }).first();
  await eerste.locator("summary").click();
  await eerste.getByLabel("Einde").fill("09:00");

  // vooraf zie je wat er meeschuift
  await expect(eerste.getByText("Zo schuiven de volgende activiteiten mee")).toBeVisible();
  await expect(eerste.getByText(/08:30–11:30 wordt/)).toContainText("09:00–12:00");
  await eerste.getByRole("button", { name: "Opslaan" }).click();
  await expect(p.getByRole("status")).toContainText("5 volgende activiteiten zijn meegeschoven");

  // in het beheer: uitroepteken en de oorspronkelijke tijd
  const nu = p.locator("details").filter({ hasText: "Busreis richting Ardennen" }).first();
  await expect(nu.locator("summary")).toContainText("09:00–12:00");
  await expect(nu.locator("summary")).toContainText("was 08:30–11:30");
  await expect(p.getByText(/6 activiteiten hebben aangepaste tijden|\d activiteiten hebben aangepaste tijden/)).toBeVisible();

  // elke student ziet het in het programma
  const student = await nieuweSessie(browser, "test-student");
  await student.page.goto("/programma");
  await expect(student.page.getByText("Tijd aangepast, was 08:30–11:30")).toBeVisible();
  await expect(student.page.getByText("Tijd aangepast, was 08:00–08:30")).toBeVisible();

  // bevestigen haalt de uitroeptekens weg, de nieuwe tijden blijven
  await p.getByRole("button", { name: "Alles bevestigen" }).click();
  await expect(p.getByRole("status")).toContainText("bevestigd");
  await student.page.reload();
  await expect(student.page.getByText(/Tijd aangepast, was/)).toHaveCount(0);
  await expect(student.page.getByText("09:00–", { exact: false }).first()).toBeVisible();

  await Promise.all([s.ctx.close(), student.ctx.close()]);
  await herstel();
});

test("terug naar de oorspronkelijke tijd haalt het uitroepteken vanzelf weg", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  await p.goto("/stuurgroep/programma");
  await p.waitForLoadState("networkidle");
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");

  const eerste = p.locator("details").filter({ hasText: "Verzamelen bij Gymnasion" }).first();
  await eerste.locator("summary").click();
  await eerste.getByLabel("Einde").fill("09:00");
  await eerste.getByRole("button", { name: "Opslaan" }).click();
  await expect(p.getByRole("status")).toContainText("meegeschoven");

  const opnieuw = p.locator("details").filter({ hasText: "Verzamelen bij Gymnasion" }).first();
  await expect(opnieuw.locator("summary")).toContainText("was 08:00–08:30"); // wachten tot het scherm is ververst
  await opnieuw.locator("summary").click();
  await opnieuw.getByLabel("Einde").fill("08:30");
  await opnieuw.getByRole("button", { name: "Opslaan" }).click();
  await expect.poll(async () => (await admin.from("programma_regel").select("oorspronkelijke_starttijd").eq("cluster_id", TEST).not("oorspronkelijke_starttijd", "is", null)).data?.length).toBe(0);
  await s.ctx.close();
});

test("een activiteit toevoegen en weer verwijderen, met meeschuiven", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  await p.goto("/stuurgroep/programma");
  await p.waitForLoadState("networkidle");
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");

  const tweede = p.locator("details").filter({ hasText: "Busreis richting Ardennen" }).first();
  await tweede.locator("summary").click();
  await tweede.getByRole("button", { name: "Activiteit hierna toevoegen" }).click();
  await tweede.getByLabel("Titel").last().fill("Testactiviteit");
  await tweede.getByLabel("Einde").last().fill("12:00"); // 30 minuten na het einde van de busreis
  await expect(tweede.getByText("Zo schuiven de volgende activiteiten mee")).toBeVisible();
  await tweede.getByRole("button", { name: "Activiteit toevoegen" }).click();
  await expect(p.getByRole("status")).toContainText("Activiteit toegevoegd");
  await expect(p.getByRole("status")).toContainText("4 volgende activiteiten");

  const nieuw = p.locator("details").filter({ hasText: "Testactiviteit" }).first();
  await expect(nieuw.locator("summary")).toContainText("11:30–12:00");
  const { data: dbNieuw } = await admin.from("programma_regel").select("soort, volgorde").eq("cluster_id", TEST).eq("titel", "Testactiviteit").single();
  expect(dbNieuw?.soort).toBe("vast");

  // verwijderen, met de keuze over de tijden
  await nieuw.locator("summary").click();
  await nieuw.getByRole("button", { name: "Deze activiteit verwijderen" }).click();
  await expect(nieuw.getByText("Wat moet er met de tijden van de volgende activiteiten gebeuren?")).toBeVisible();
  await nieuw.getByRole("button", { name: "Verwijderen en volgende activiteiten naar voren schuiven" }).click();
  await expect(p.getByRole("status")).toContainText("Activiteit verwijderd");
  await expect(p.getByText("Testactiviteit")).toHaveCount(0);

  const { data: na } = await admin.from("programma_regel").select("starttijd, eindtijd").eq("id", begin[2].id).single();
  expect(na?.starttijd).toBe(begin[2].starttijd); // de lunch staat weer op de oorspronkelijke tijd
  await s.ctx.close();
  await herstel();
});

test("de tijd van een belevenisvak kan worden aangepast zonder dat de projectgroep haar vak verliest", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-stuur");
  const p = s.page;
  await p.goto("/stuurgroep/programma");
  await p.waitForLoadState("networkidle");
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");

  const vak = p.locator("details").filter({ hasText: "Avondactiviteit" }).first();
  await vak.locator("summary").click();
  await vak.getByLabel("Einde").fill("21:30");
  await vak.getByRole("button", { name: "Opslaan" }).click();
  await expect(p.getByRole("status")).toContainText("Opgeslagen");
  await expect(p.locator("details").filter({ hasText: "Avondactiviteit" }).first().locator("summary")).toContainText("Testgroep 1 is verantwoordelijk");
  await expect(p.locator("details").filter({ hasText: "Avondactiviteit" }).first().locator("summary")).toContainText("was 19:30–21:00");

  // de projectgroep ziet haar tijdvak met het nieuwe einde
  const groep = await nieuweSessie(browser, "test-groep-1");
  await groep.page.goto("/avf");
  await expect(groep.page.getByText("19:30–21:30").first()).toBeVisible();
  await Promise.all([s.ctx.close(), groep.ctx.close()]);
  await herstel();
});

test("in het programma voor iedereen staat bij een belevenisvak duidelijk welke projectgroep verantwoordelijk is", async ({ browser }) => {
  const s = await nieuweSessie(browser, "test-student");
  const p = s.page;
  await p.goto("/programma");
  await expect(p.getByText("Testgroep 1 is verantwoordelijk")).toBeVisible();
  await expect(p.getByText("Testgroep 2 is verantwoordelijk")).toBeVisible();
  // vakken zonder toegewezen groep zeggen dat ook
  await expect(p.getByText("Nog geen projectgroep toegewezen").first()).toBeVisible();
  // dagen hebben elk een eigen kleur
  const kleuren = await p.locator("h2[id^='dag-']").evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
  expect(new Set(kleuren).size).toBe(3);
  await s.ctx.close();
});
