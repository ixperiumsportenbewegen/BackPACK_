import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { accountLabel, type Accountsoort } from "../src/lib/label";

interface Basis {
  clusters: {
    code: string;
    projectgroepen: { nummer: number; naam: string }[];
    stuurgroeprollen: { code: string; naam: string }[];
  }[];
  accounts: { gebruikersnaam: string; soort: Accountsoort; cluster?: string; projectgroep?: number; stuurgroeprol?: string }[];
}
const basis: Basis = JSON.parse(readFileSync("seed/basis.json", "utf8"));
const wachtwoorden: Record<string, string> = JSON.parse(
  readFileSync("seed/wachtwoorden.local.json", "utf8"),
);

/** Verwacht label per account, afgeleid uit seed/basis.json. */
function verwachtLabel(a: Basis["accounts"][number]): string {
  const cluster = basis.clusters.find((c) => c.code === a.cluster);
  return accountLabel({
    soort: a.soort,
    // de docent begint op VD en dat staat in het label
    clusterCode: a.soort === "docent" ? "VD" : a.cluster,
    projectgroepNaam: cluster?.projectgroepen.find((g) => g.nummer === a.projectgroep)?.naam,
    stuurgroeprolNaam: cluster?.stuurgroeprollen.find((r) => r.code === a.stuurgroeprol)?.naam,
  });
}

test.describe("Alle accounts kunnen inloggen en zien het juiste label", () => {
  for (const a of basis.accounts) {
    test(a.gebruikersnaam, async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("Gebruikersnaam").fill(a.gebruikersnaam);
      await page.getByLabel("Wachtwoord").fill(wachtwoorden[a.gebruikersnaam]);
      await page.getByRole("button", { name: "Inloggen" }).click();

      await expect(page).toHaveURL("/");
      await expect(page.getByRole("banner").getByText(verwachtLabel(a), { exact: true })).toBeVisible();

      // Navigatie: studenten hebben geen derde knop
      const nav = page.getByRole("navigation", { name: "Hoofdmenu" });
      await expect(nav.getByRole("link")).toHaveCount(a.soort === "student" ? 3 : 4);
    });
  }
});

test("verkeerd wachtwoord geeft een melding", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Gebruikersnaam").fill("vd-student");
  await page.getByLabel("Wachtwoord").fill("fout-fout-fout");
  await page.getByRole("button", { name: "Inloggen" }).click();
  await expect(page.getByText("Gebruikersnaam of wachtwoord klopt niet.")).toBeVisible();
});

test("zonder inloggen kom je op het inlogscherm", async ({ page }) => {
  for (const pad of ["/", "/belevenissen", "/meer", "/stuurgroep", "/budget"]) {
    await page.goto(pad);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("uitloggen brengt je terug naar het inlogscherm", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Gebruikersnaam").fill("vd-groep-1");
  await page.getByLabel("Wachtwoord").fill(wachtwoorden["vd-groep-1"]);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: "Meer", exact: true }).click();
  await page.getByRole("button", { name: "Uitloggen" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("studenten en projectgroepen zien de stuurgroeppagina niet", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Gebruikersnaam").fill("vd-student");
  await page.getByLabel("Wachtwoord").fill(wachtwoorden["vd-student"]);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/stuurgroep");
  await expect(page).toHaveURL("/");
});
