/**
 * Opslaan terwijl je typt: tekst mag niet verloren gaan als je direct na het typen doorklikt of de pagina sluit.
 * Gebruikt het voorbeeld-AVF van vd-groep-1 en zet de waarde daarna terug.
 * Draait tegen het echte Supabase-project.
 */
import { expect, test } from "@playwright/test";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

let avfId: string;
let oorspronkelijk: string | null;

test.beforeAll(async () => {
  const VD = await clusterId("VD");
  const { data } = await admin.from("avf").select("id, contactpersoon, projectgroep:projectgroep_id(nummer)").eq("cluster_id", VD);
  const eerste = (data ?? []).find((r) => (r.projectgroep as unknown as { nummer: number }).nummer === 1)!;
  avfId = eerste.id;
  oorspronkelijk = eerste.contactpersoon;
});

test.afterAll(async () => {
  await admin.from("avf").update({ contactpersoon: oorspronkelijk }).eq("id", avfId);
});

async function contactpersoonInDatabase() {
  const { data } = await admin.from("avf").select("contactpersoon").eq("id", avfId).single();
  return data?.contactpersoon ?? null;
}

test("tekst wordt na een korte stilte opgeslagen, zonder het veld te verlaten", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-1");
  await s.page.goto("/avf/A");
  await s.page.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  const veld = s.page.getByLabel("Contactpersoon");
  await veld.fill("Stilte-test");
  // geen blur: het veld houdt de aandacht
  await expect.poll(contactpersoonInDatabase, { timeout: 8_000 }).toBe("Stilte-test");
  await s.ctx.close();
});

test("tekst blijft bewaard als je direct na het typen op een knop in het menu tikt", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-1");
  await s.page.goto("/avf/A");
  await s.page.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  await s.page.getByLabel("Contactpersoon").fill("Direct-doorklikken");
  // niet "Onze meerdaagse": het Next.js-ontwikkelbolletje (alleen in dev) ligt over de knop linksonder
  await s.page.getByRole("link", { name: "Belevenissen", exact: true }).first().click();
  await expect(s.page).toHaveURL(/\/belevenissen/);
  await expect.poll(contactpersoonInDatabase, { timeout: 10_000 }).toBe("Direct-doorklikken");
  await s.ctx.close();
});

test("tekst blijft bewaard als je de pagina direct na het typen opnieuw laadt", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-1");
  await s.page.goto("/avf/A");
  await s.page.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  await s.page.getByLabel("Contactpersoon").fill("Pagina-herladen");
  await s.page.goto("/");
  await expect.poll(contactpersoonInDatabase, { timeout: 10_000 }).toBe("Pagina-herladen");
  await s.ctx.close();
});
