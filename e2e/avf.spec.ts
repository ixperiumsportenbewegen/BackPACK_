/**
 * AVF invullen (opdracht 3): het voorbeeld-AVF van vd-groep-1 bekijken en aanpassen op een telefoon,
 * twee browsers op hetzelfde account, andere groepen zien alleen de publieke kaart, programma en toewijzing.
 * Draait tegen het echte Supabase-project en zet alles daarna terug.
 */
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { admin, clusterId } from "../tests/helpers";
import { nieuweSessie } from "./helpers";

test.describe.configure({ mode: "serial" });

let VD: string;
const avf: Record<number, string> = {};
const regel: Record<number, string | null> = {};
let oorspronkelijk: { doelgroep: string | null; contactpersoon: string | null; titel: string | null; veiligheid: unknown; locatie: string | null };
let onderdeelIds: string[] = [];

const voorbeeld = JSON.parse(readFileSync("seed/avf-voorbeeld.json", "utf8"));

test.beforeAll(async () => {
  VD = await clusterId("VD");
  const { data } = await admin.from("avf").select("id, programma_regel_id, projectgroep:projectgroep_id(nummer)").eq("cluster_id", VD);
  for (const r of data ?? []) {
    const nr = (r.projectgroep as unknown as { nummer: number }).nummer;
    avf[nr] = r.id;
    regel[nr] = r.programma_regel_id;
  }
  // Beginwaarden komen uit het voorbeeldbestand, niet uit wat er toevallig in de database staat: zo herstelt de test zichzelf.
  await admin.from("avf").update({
    titel: voorbeeld.titel, doelgroep: voorbeeld.doelgroep, contactpersoon: voorbeeld.contactpersoon, locatie_keuze: voorbeeld.locatie_keuze, locatie_detail: voorbeeld.locatie_detail,
    // ook de velden die een eerder afgebroken run kan hebben laten staan
    verschijningsvorm: voorbeeld.verschijningsvorm, publieke_samenvatting: voorbeeld.publieke_samenvatting,
    organiserende_studenten: voorbeeld.organiserende_studenten, aantal_deelnemers: voorbeeld.aantal_deelnemers,
  }).eq("id", avf[1]);
  const { data: a } = await admin.from("avf").select("veiligheid").eq("id", avf[1]).single();
  oorspronkelijk = { doelgroep: voorbeeld.doelgroep, contactpersoon: voorbeeld.contactpersoon, titel: voorbeeld.titel, veiligheid: a!.veiligheid, locatie: voorbeeld.locatie_keuze };
  const { data: o } = await admin.from("avf_onderdeel").select("id").eq("avf_id", avf[1]);
  onderdeelIds = (o ?? []).map((x) => x.id);
});

test.afterAll(async () => {
  await admin.from("avf").update({
    doelgroep: oorspronkelijk.doelgroep, contactpersoon: oorspronkelijk.contactpersoon, titel: oorspronkelijk.titel,
    veiligheid: oorspronkelijk.veiligheid, locatie_keuze: oorspronkelijk.locatie, locatie_detail: voorbeeld.locatie_detail,
  }).eq("id", avf[1]);
  const { data: o } = await admin.from("avf_onderdeel").select("id").eq("avf_id", avf[1]);
  const extra = (o ?? []).map((x) => x.id).filter((id) => !onderdeelIds.includes(id));
  if (extra.length) await admin.from("avf_onderdeel").delete().in("id", extra);
  await admin.from("avf_fase").update({ overzichtstekening_pad: null, overzichtstekening_bijschrift: null }).eq("avf_id", avf[1]);
  const { data: bestanden } = await admin.storage.from("avf").list(`cluster/${VD}/avf/${avf[1]}`);
  const weg = (bestanden ?? []).filter((f) => f.name.startsWith("tekening-")).map((f) => `cluster/${VD}/avf/${avf[1]}/${f.name}`);
  if (weg.length) await admin.storage.from("avf").remove(weg);
  // tijdvakken terugzetten
  for (const nr of [1, 2, 3, 4, 5, 6]) await admin.from("avf").update({ programma_regel_id: null }).eq("id", avf[nr]);
  for (const nr of [1, 2, 3, 4, 5, 6]) await admin.from("avf").update({ programma_regel_id: regel[nr] }).eq("id", avf[nr]);
  const { data: r } = await admin.from("programma_regel").select("id, titel, starttijd").eq("id", regel[1]!).single();
  if (r?.starttijd !== "19:30:00") await admin.from("programma_regel").update({ starttijd: "19:30:00", eindtijd: "21:00:00" }).eq("id", regel[1]!);
  await admin.from("programma_regel").update({ oorspronkelijke_starttijd: null, oorspronkelijke_eindtijd: null }).eq("id", regel[1]!);
});

test("het voorbeeld-AVF is compleet en staat in het juiste tijdvak", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-1");
  await s.page.goto("/avf");
  await expect(s.page.getByRole("heading", { name: "Oer-Olympische Spelen" })).toBeVisible();
  await expect(s.page.getByText("7 van 7 vakken ingepakt")).toBeVisible();
  await expect(s.page.getByText("maandag 28 juni · 19:30–21:00").first()).toBeVisible();
  await expect(s.page.getByText("Veld naast de camping").first()).toBeVisible();
  for (const code of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    await expect(s.page.locator(`a[href="/avf/${code}"]`)).toBeVisible();
  }
  await s.ctx.close();
});

test("een veld wijzigen blijft bewaard na verversen; tijdvak en locatie zijn alleen-lezen", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-1");
  await s.page.goto("/avf/A");
  await s.page.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  const doelgroep = s.page.getByLabel("Doelgroep");
  await doelgroep.fill("Studenten 18–25 jaar");
  await doelgroep.blur();
  await expect(s.page.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();
  await s.page.reload();
  await expect(s.page.getByLabel("Doelgroep")).toHaveValue("Studenten 18–25 jaar");
  await expect(s.page.getByText(/Laatst gewijzigd door Testgebruiker/).or(s.page.getByText("Jullie tijdvak"))).toBeVisible();

  // Het tijdvak is geen invoerveld
  await expect(s.page.getByLabel("Tijdvak")).toHaveCount(0);
  await expect(s.page.getByText("Het tijdvak bepaalt de stuurgroep")).toBeVisible();

  // De locatie kiezen de projectgroepen zelf: camping of bivak, en waar precies
  const keuze = s.page.getByRole("radiogroup", { name: "Op welke locatie vindt de belevenis plaats?" });
  await expect(keuze.getByRole("radio")).toHaveCount(2);
  await keuze.getByRole("radio", { name: "Bivak" }).click();
  await expect(s.page.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();
  await expect.poll(async () => (await admin.from("avf").select("locatie_keuze").eq("id", avf[1]).single()).data?.locatie_keuze).toBe("bivak");
  await keuze.getByRole("radio", { name: "Camping" }).click();
  await expect.poll(async () => (await admin.from("avf").select("locatie_keuze").eq("id", avf[1]).single()).data?.locatie_keuze).toBe("camping");

  // Het overzicht toont wie het laatst iets wijzigde
  await s.page.goto("/avf");
  await expect(s.page.getByText(/Laatst gewijzigd door Testgebruiker/).first()).toBeVisible();
  await admin.from("avf").update({ doelgroep: voorbeeld.doelgroep }).eq("id", avf[1]);
  await s.ctx.close();
});

test("twee browsers met hetzelfde account: verschillende velden blijven allebei bewaard, hetzelfde veld geeft een waarschuwing", async ({ browser }) => {
  const a = await nieuweSessie(browser, "vd-groep-1");
  const b = await nieuweSessie(browser, "vd-groep-1");
  for (const [s, naam] of [[a, "Persoon A"], [b, "Persoon B"]] as const) {
    await s.page.goto("/avf/A");
    await s.page.getByLabel("Wie werkt hier?").fill(naam);
  }

  // Verschillende velden
  await a.page.getByLabel("Doelgroep").fill("Doelgroep van A");
  await a.page.getByLabel("Doelgroep").blur();
  await b.page.getByLabel("Contactpersoon").fill("Contact van B");
  await b.page.getByLabel("Contactpersoon").blur();
  await expect(a.page.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();
  await expect(b.page.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();
  const { data: beide } = await admin.from("avf").select("doelgroep, contactpersoon").eq("id", avf[1]).single();
  expect(beide).toEqual({ doelgroep: "Doelgroep van A", contactpersoon: "Contact van B" });

  // Hetzelfde veld: B was nog op de oude waarde, A wijzigt eerst
  await a.page.getByLabel("Titel van de belevenis").fill("Titel van A");
  await a.page.getByLabel("Titel van de belevenis").blur();
  await expect.poll(async () => (await admin.from("avf").select("titel").eq("id", avf[1]).single()).data?.titel).toBe("Titel van A");
  await b.page.getByLabel("Titel van de belevenis").fill("Titel van B");
  await b.page.getByLabel("Titel van de belevenis").blur();
  await expect(b.page.getByText(/Iemand anders heeft dit net gewijzigd/).first()).toBeVisible();
  const { data: titel } = await admin.from("avf").select("titel").eq("id", avf[1]).single();
  expect(titel?.titel).toBe("Titel van A"); // niets ongemerkt overschreven

  // Bewust overschrijven kan wel
  await b.page.getByRole("button", { name: "Mijn versie bewaren" }).click();
  await expect.poll(async () => (await admin.from("avf").select("titel").eq("id", avf[1]).single()).data?.titel).toBe("Titel van B");
  // direct terugzetten, zodat de volgende tests het voorbeeld zien
  await admin.from("avf").update({ titel: voorbeeld.titel, doelgroep: voorbeeld.doelgroep, contactpersoon: voorbeeld.contactpersoon }).eq("id", avf[1]);
  await Promise.all([a.ctx.close(), b.ctx.close()]);
});

test("twee browsers werken aan verschillende velden van hetzelfde onderdeel van de romp", async ({ browser }) => {
  const a = await nieuweSessie(browser, "vd-groep-1");
  const b = await nieuweSessie(browser, "vd-groep-1");
  const { data: o } = await admin.from("avf_onderdeel").select("id, beschrijving, fysieke_veiligheid").eq("avf_id", avf[1]).eq("fase", "romp").order("volgorde").limit(1).single();
  for (const [s, naam] of [[a, "Persoon A"], [b, "Persoon B"]] as const) {
    await s.page.goto(`/avf/onderdeel/${o!.id}`);
    await s.page.getByLabel("Wie werkt hier?").fill(naam);
  }
  await a.page.getByLabel("Beschrijving").fill("Beschrijving door A");
  await a.page.getByLabel("Beschrijving").blur();
  await b.page.getByLabel("Fysieke veiligheid").first().fill("Veiligheid door B");
  await b.page.getByLabel("Fysieke veiligheid").first().blur();
  await expect(a.page.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();
  await expect(b.page.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();
  const { data } = await admin.from("avf_onderdeel").select("beschrijving, fysieke_veiligheid").eq("id", o!.id).single();
  expect(data).toEqual({ beschrijving: "Beschrijving door A", fysieke_veiligheid: "Veiligheid door B" });
  await admin.from("avf_onderdeel").update({ beschrijving: o!.beschrijving, fysieke_veiligheid: o!.fysieke_veiligheid }).eq("id", o!.id);
  await Promise.all([a.ctx.close(), b.ctx.close()]);
});

test("een onderdeel toevoegen, uitwerken, verschuiven en verwijderen", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-1");
  const p = s.page;
  await p.goto("/avf/D?fase=staart");
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  await p.getByRole("button", { name: "Onderdeel toevoegen" }).click();
  await expect(p).toHaveURL(/\/avf\/onderdeel\//);
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");

  const naam = p.getByLabel("Naam van het onderdeel");
  await naam.fill("Testonderdeel");
  await naam.blur();
  await expect(p.getByText("Opgeslagen", { exact: true }).first()).toBeVisible();

  // niet van toepassing markeren schakelt het veld uit
  await p.getByLabel("Niet van toepassing").first().click();
  await expect(p.getByLabel("Sociale veiligheid")).toBeDisabled();
  await p.getByLabel("Niet van toepassing").first().click();
  await expect(p.getByLabel("Sociale veiligheid")).toBeEnabled();

  await p.goto("/avf/D?fase=staart");
  const lijst = p.getByRole("listitem").filter({ hasText: "Testonderdeel" });
  await expect(lijst).toBeVisible();
  await lijst.getByRole("button", { name: "Omhoog" }).click();
  await expect(p.locator("ol > li").first()).toContainText("Testonderdeel");

  await p.getByRole("listitem").filter({ hasText: "Testonderdeel" }).getByRole("button", { name: "Verwijderen" }).click();
  await p.getByRole("button", { name: "Ja, verwijderen" }).click();
  await expect(p.getByText("Testonderdeel")).toHaveCount(0);
  await s.ctx.close();
});

test("een weerscenario afwegen en de EHBO-vraag", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-1");
  const p = s.page;
  await p.goto("/avf/E");
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  const ehbo = p.getByRole("radiogroup", { name: "Zijn aanvullende EHBO-maatregelen nodig?" });
  await ehbo.getByRole("radio", { name: "Nee" }).click();
  await expect(p.getByText("Voor deze belevenis geldt het algemene EHBO-plan")).toBeVisible();
  await ehbo.getByRole("radio", { name: "Ja" }).click();
  await expect(p.getByLabel("Welke maatregelen? (wie, waar, middelen)")).toBeVisible();

  // koel scenario relevant maken geeft de velden
  const koel = p.getByRole("heading", { name: "Koel", level: 3 }).locator("xpath=ancestor::section[1]");
  await koel.getByRole("radio", { name: "Ja" }).click();
  await expect(koel.getByLabel("Maatregel")).toBeVisible();
  await s.ctx.close();
});

/**
 * Een AVF van een ander is niet te openen. Door het laadscherm (streaming) kan de statuscode al 200 zijn voordat de
 * pagina "niet gevonden" meldt; wat telt is dat er niets van het AVF in de pagina staat.
 */
async function geenToegang(res: { status(): number; text(): Promise<string> }) {
  const html = await res.text();
  expect([200, 404]).toContain(res.status());
  expect(html).not.toContain("Tien studenten doen mee"); // sectie B
  expect(html).not.toContain("Geraakt worden door een speer"); // sectie E
  expect(html).not.toContain("Veld naast de camping"); // locatie
}

test("andere groepen, studenten en andere clusters zien alleen de publieke kaart", async ({ browser }) => {
  const groep2 = await nieuweSessie(browser, "vd-groep-2");
  await groep2.page.goto("/belevenissen");
  await expect(groep2.page.getByText("Oer-Olympische Spelen")).toBeVisible();
  await expect(groep2.page.getByText("Stammen nemen het tegen elkaar op")).toBeVisible();
  const tekst = await groep2.page.locator("main").innerText();
  expect(tekst).not.toContain("Tien studenten doen mee"); // sectie B
  expect(tekst).not.toContain("Geraakt worden door een speer"); // sectie E
  expect(tekst).not.toContain("Veld naast de camping"); // locatie is niet publiek
  await geenToegang(await groep2.page.request.get(`/belevenissen/${avf[1]}`));
  expect((await groep2.page.request.get(`/avf/A`)).url()).not.toContain(avf[1]); // eigen AVF, niet dat van groep 1
  await groep2.ctx.close();

  const student = await nieuweSessie(browser, "vd-student");
  await student.page.goto("/belevenissen");
  await expect(student.page.getByText("Oer-Olympische Spelen")).toBeVisible();
  await geenToegang(await student.page.request.get(`/belevenissen/${avf[1]}`));
  await student.page.goto("/avf");
  await expect(student.page).toHaveURL(/\/belevenissen$/);
  await student.ctx.close();

  const vc = await nieuweSessie(browser, "vc-stuur-programma");
  await geenToegang(await vc.page.request.get(`/belevenissen/${avf[1]}`));
  await vc.page.goto("/belevenissen");
  await expect(vc.page.getByText("Oer-Olympische Spelen")).toHaveCount(0);
  await vc.ctx.close();
});

test("de stuurgroep leest het hele AVF en de afdrukweergave verbergt het menu", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-stuur-programma");
  const p = s.page;
  await p.goto("/belevenissen");
  await p.locator(`a[href="/belevenissen/${avf[1]}"]`).click();
  await expect(p.getByRole("heading", { name: "Oer-Olympische Spelen", level: 1 })).toBeVisible();
  for (const kop of ["A · Basisgegevens", "B · Beginsituatie", "C · Doelen", "D · Kop, romp en staart", "E · Veiligheid, EHBO en weer", "G · Thema en organisatie", "H · Communicatie"]) {
    await expect(p.getByRole("heading", { name: kop })).toBeVisible();
  }
  await expect(p.getByText("Geraakt worden door een speer of steen")).toBeVisible();
  await expect(p.getByText("Teststudent 3").first()).toBeVisible(); // rolverdeling

  // De stuurgroep kan niets bewerken
  await p.goto("/avf");
  await expect(p).toHaveURL(/\/belevenissen$/);

  await p.goto(`/belevenissen/${avf[1]}`);
  await p.emulateMedia({ media: "print" });
  await expect(p.getByRole("navigation", { name: "Hoofdmenu" })).toBeHidden();
  await expect(p.getByRole("button", { name: /Afdrukken/ })).toBeHidden();
  await s.ctx.close();
});

test("een afbeelding bij een fase uploaden is alleen voor de eigen groep en de stuurgroep zichtbaar", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-1");
  const p = s.page;
  await p.goto("/avf/D?fase=kop");
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  const plaatje = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#406040" } }).png().toBuffer();
  await p.locator('input[type="file"]').first().setInputFiles({ name: "tekening.png", mimeType: "image/png", buffer: plaatje });
  await expect(p.getByText("Opgeslagen", { exact: true }).first()).toBeVisible({ timeout: 20000 });
  const { data } = await admin.from("avf_fase").select("overzichtstekening_pad").eq("avf_id", avf[1]).eq("fase", "kop").single();
  const pad = data!.overzichtstekening_pad as string;
  expect(pad).toMatch(new RegExp(`^cluster/${VD}/avf/${avf[1]}/tekening-kop-\\d+\\.webp$`));

  expect((await p.request.get(`/api/avf/${pad}`)).status()).toBe(200);
  const stuur = await nieuweSessie(browser, "vd-stuur-programma");
  expect((await stuur.page.request.get(`/api/avf/${pad}`)).status()).toBe(200);
  const groep2 = await nieuweSessie(browser, "vd-groep-2");
  expect((await groep2.page.request.get(`/api/avf/${pad}`)).status()).toBe(404);
  const student = await nieuweSessie(browser, "vd-student");
  expect((await student.page.request.get(`/api/avf/${pad}`)).status()).toBe(404);
  await Promise.all([s.ctx.close(), stuur.ctx.close(), groep2.ctx.close(), student.ctx.close()]);
});

test("het programma is voor iedereen te lezen en markeert wat voor de eigen groep geldt", async ({ browser }) => {
  const groep = await nieuweSessie(browser, "vd-groep-1");
  await groep.page.goto("/programma");
  await expect(groep.page.getByRole("heading", { name: "Maandag 28 juni" })).toBeVisible();
  await expect(groep.page.getByText("Verzamelen bij Gymnasion")).toBeVisible();
  await expect(groep.page.getByText("Jullie organiseren dit")).toHaveCount(1);
  await expect(groep.page.getByText("Jullie doen mee")).toHaveCount(3); // dinsdagochtend, dinsdagavond en woensdagmiddag
  await expect(groep.page.getByText("Jullie zijn bij Rocks & Rivers")).toHaveCount(2);
  await expect(groep.page.getByRole("link", { name: /Programma beheren/ })).toHaveCount(0);
  await groep.ctx.close();

  const student = await nieuweSessie(browser, "vd-student");
  await student.page.goto("/programma");
  await expect(student.page.getByText("Busreis terug naar Nijmegen")).toBeVisible();
  await student.page.goto("/stuurgroep/programma");
  await expect(student.page).toHaveURL(/\/programma$/);
  await student.ctx.close();
});

test("de stuurgroep wisselt twee groepen van tijdvak en past een tijd aan: de projectgroep ziet het direct", async ({ browser }) => {
  const stuur = await nieuweSessie(browser, "vd-stuur-programma");
  const p = stuur.page;
  await p.goto("/stuurgroep/programma");
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");

  // Wisselen: projectgroep 2 in het tijdvak van projectgroep 1
  const kiezer = p.locator(`#toewijzen-${regel[1]}`);
  await kiezer.selectOption(avf[2]);
  await expect(p.getByText(/Dit tijdvak is al van Projectgroep 1/).first()).toBeVisible();
  await p.getByRole("button", { name: "Wisselen" }).click();
  await expect.poll(async () => (await admin.from("avf").select("programma_regel_id").eq("id", avf[1]).single()).data?.programma_regel_id).toBe(regel[2]);
  const { data: twee } = await admin.from("avf").select("programma_regel_id").eq("id", avf[2]).single();
  expect(twee?.programma_regel_id).toBe(regel[1]);

  // Projectgroep 1 ziet nu het dinsdagochtendtijdvak
  const groep = await nieuweSessie(browser, "vd-groep-1");
  await groep.page.goto("/avf");
  await expect(groep.page.getByText("dinsdag 29 juni · 09:00–12:00").first()).toBeVisible();

  // Terugwisselen
  await p.reload();
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  await p.locator(`#toewijzen-${regel[1]}`).selectOption(avf[1]);
  await p.getByRole("button", { name: "Wisselen" }).click();
  await expect.poll(async () => (await admin.from("avf").select("programma_regel_id").eq("id", avf[1]).single()).data?.programma_regel_id).toBe(regel[1]);

  // Locatie aanpassen
  await p.reload();
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  // De projectgroep koos camping; de stuurgroep kan het corrigeren
  await expect(p.locator(`#locatie-${regel[1]}`)).toHaveValue("camping");
  await expect(p.getByText("Waar precies: Veld naast de camping")).toBeVisible();
  await p.locator(`#locatie-${regel[1]}`).selectOption("bivak");
  await expect(p.getByText("Locatie opgeslagen", { exact: true }).first()).toBeVisible();
  await expect.poll(async () => (await admin.from("avf").select("locatie_keuze").eq("id", avf[1]).single()).data?.locatie_keuze).toBe("bivak");
  await groep.page.goto("/avf");
  await expect(groep.page.getByText("Bivak", { exact: false }).first()).toBeVisible();
  await p.locator(`#locatie-${regel[1]}`).selectOption("camping");
  await expect.poll(async () => (await admin.from("avf").select("locatie_keuze").eq("id", avf[1]).single()).data?.locatie_keuze).toBe("camping");

  // Een tijd aanpassen in het programma: de projectgroep ziet de nieuwe tijd (programma en toewijzing matchen)
  await p.reload();
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  const details = p.locator("details").filter({ hasText: "Avondactiviteit" }).first();
  await details.locator("summary").click();
  await details.getByLabel("Start").fill("20:00");
  await details.getByLabel("Einde").fill("21:30");
  await details.getByRole("button", { name: "Opslaan" }).click();
  await expect(p.getByRole("status")).toContainText("Opgeslagen");
  await groep.page.goto("/avf");
  await expect(groep.page.getByText("maandag 28 juni · 20:00–21:30").first()).toBeVisible();
  await groep.page.goto("/programma");
  await expect(groep.page.getByText("20:00–")).toBeVisible();

  await Promise.all([stuur.ctx.close(), groep.ctx.close()]);
});

test("de verschijningsvorm heeft meerdere keuzes", async ({ browser }) => {
  const s = await nieuweSessie(browser, "vd-groep-1");
  const p = s.page;
  await p.goto("/avf/A");
  await p.waitForLoadState("networkidle"); // wachten tot de pagina klaar is voor aanraken
  await p.getByLabel("Wie werkt hier?").fill("Testgebruiker");
  const groep = p.getByRole("group", { name: "Verschijningsvorm" });
  for (const vorm of ["Spel", "Wedstrijd", "Avontuur", "Gezondheid", "Recreatie", "Show"]) {
    await expect(groep.getByRole("button", { name: vorm })).toBeVisible();
  }
  await expect(groep.getByRole("button", { name: "Tocht" })).toHaveCount(0);
  await expect(groep.getByRole("button", { name: "Spel" })).toHaveAttribute("aria-pressed", "true");

  // Snel achter elkaar aantikken (zoals op een telefoon): alles wordt bewaard, zonder onterechte waarschuwing
  await groep.getByRole("button", { name: "Show" }).click();
  await groep.getByRole("button", { name: "Avontuur" }).click();
  await expect(groep.getByRole("button", { name: "Show" })).toHaveAttribute("aria-pressed", "true");
  await expect(groep.getByRole("button", { name: "Avontuur" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await admin.from("avf").select("verschijningsvorm").eq("id", avf[1]).single()).data?.verschijningsvorm).toBe("Spel, Avontuur, Show");
  await groep.getByRole("button", { name: "Spel" }).click();
  await expect.poll(async () => (await admin.from("avf").select("verschijningsvorm").eq("id", avf[1]).single()).data?.verschijningsvorm).toBe("Avontuur, Show");
  await expect(p.getByText(/Iemand anders heeft dit net gewijzigd/)).toHaveCount(0);

  // Andere groepen zien de gekozen vormen op de publieke kaart
  const groep2 = await nieuweSessie(browser, "vd-groep-2");
  await groep2.page.goto("/belevenissen");
  await expect(groep2.page.getByText("Avontuur, Show")).toBeVisible();

  await admin.from("avf").update({ verschijningsvorm: voorbeeld.verschijningsvorm }).eq("id", avf[1]);
  await Promise.all([s.ctx.close(), groep2.ctx.close()]);
});

test("VC heeft een eigen, gespiegeld programma", async ({ browser }) => {
  const vc = await nieuweSessie(browser, "vc-groep-1");
  await vc.page.goto("/programma");
  await expect(vc.page.getByRole("heading", { name: "Maandag 28 juni" })).toBeVisible();
  await expect(vc.page.getByText("Locaties: vertrek Gymnasion Nijmegen → hike → bivak")).toBeVisible();
  await expect(vc.page.getByText("Bivak inrichten en avondeten")).toBeVisible();
  await expect(vc.page.getByText("Diner en lopen naar camping")).toBeVisible();
  await expect(vc.page.getByText("Camping inrichten en avondeten")).toHaveCount(0);
  await expect(vc.page.getByText("Jullie organiseren dit")).toHaveCount(1);
  await vc.ctx.close();

  const vd = await nieuweSessie(browser, "vd-groep-1");
  await vd.page.goto("/programma");
  await expect(vd.page.getByText("Locaties: vertrek Gymnasion Nijmegen → hike → camping")).toBeVisible();
  await expect(vd.page.getByText("Camping inrichten en avondeten")).toBeVisible();
  await expect(vd.page.getByText("Bivak inrichten en avondeten")).toHaveCount(0);
  await vd.ctx.close();
});
