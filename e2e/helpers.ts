import { expect, type Browser, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";

const wachtwoorden: Record<string, string> = JSON.parse(readFileSync("seed/wachtwoorden.local.json", "utf8"));
const CACHE = ".auth-cache";
const GELDIG_MS = 30 * 60 * 1000;

/**
 * Een browsersessie als het gegeven testaccount, op telefoonformaat. De eerste keer wordt echt ingelogd;
 * daarna wordt de sessie hergebruikt. Zo blijven we onder de inloglimiet van Supabase
 * (ca. 30 pogingen per 5 minuten per IP-adres).
 */
export async function nieuweSessie(browser: Browser, gebruiker: string) {
  mkdirSync(CACHE, { recursive: true });
  const host = (process.env.BASE_URL ?? "localhost").replace(/\W+/g, "_");
  const bestand = `${CACHE}/${host}-${gebruiker}.json`;
  const bruikbaar = existsSync(bestand) && Date.now() - statSync(bestand).mtimeMs < GELDIG_MS;

  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, ...(bruikbaar ? { storageState: bestand } : {}) });
  const page = await ctx.newPage();

  if (bruikbaar) {
    await page.goto("/");
    if (!page.url().endsWith("/login")) return { ctx, page };
  }
  await inloggen(page, gebruiker);
  await ctx.storageState({ path: bestand });
  return { ctx, page };
}

export async function inloggen(page: Page, gebruiker: string) {
  await page.goto("/login");
  await page.getByLabel("Gebruikersnaam").fill(gebruiker);
  await page.getByLabel("Wachtwoord").fill(wachtwoorden[gebruiker]);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await expect(page).toHaveURL("/");
}
