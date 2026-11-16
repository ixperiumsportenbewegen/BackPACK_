/** De opzet van het calamiteitenplan: unieke sleutels, geldige namen en de hulpfuncties voor telefoon en websites. */
import { describe, expect, it } from "vitest";
import { PLAN_SECTIES, planLijsten, planVelden } from "../src/config/calamiteitenplan";
import { telHref, webHref } from "../src/lib/planTekst";

describe("opzet van het calamiteitenplan", () => {
  it("elke sleutel is uniek en past in de database (kleine letters, cijfers en een underscore)", () => {
    // secties, tekstvelden (calamiteit_veld) en lijsten (calamiteit_item) hebben elk hun eigen reeks sleutels
    for (const sleutels of [PLAN_SECTIES.map((s) => s.code), planVelden().map((v) => v.sleutel), planLijsten().map((l) => l.sleutel)]) {
      expect(new Set(sleutels).size).toBe(sleutels.length);
      for (const s of sleutels) expect(s, s).toMatch(/^[a-z0-9_]{1,50}$/);
    }
    for (const l of planLijsten()) for (const v of l.velden) expect(v.sleutel, `${l.sleutel}.${v.sleutel}`).toMatch(/^[a-z0-9_]{1,50}$/);
  });

  it("de maximale lengtes passen binnen de grenzen van de database", () => {
    for (const v of planVelden()) expect(v.maxLengte, v.sleutel).toBeLessThanOrEqual(4000);
    for (const l of planLijsten()) for (const v of l.velden) expect(v.maxLengte, `${l.sleutel}.${v.sleutel}`).toBeLessThanOrEqual(2000);
  });

  it("elke lijst heeft een titelveld dat bij de velden hoort, en elke sectie heeft velden of een lijst", () => {
    for (const l of planLijsten()) expect(l.velden.map((v) => v.sleutel), l.sleutel).toContain(l.titelVeld);
    for (const s of PLAN_SECTIES) expect(Boolean(s.velden?.length) || Boolean(s.lijst), s.code).toBe(true);
  });

  it("bevat geen ingevulde inhoud: alleen labels en hulpteksten zonder telefoonnummers", () => {
    const alles = JSON.stringify(PLAN_SECTIES);
    expect(alles).not.toMatch(/\+\d{2}[\s\d()-]{6,}/);
    expect(alles).not.toMatch(/https?:\/\//);
  });
});

describe("telefoon- en weblinks", () => {
  it("maakt een tel-link van het eerste telefoonnummer in een tekst", () => {
    expect(telHref("112")).toBe("tel:112");
    expect(telHref("Bel +32 (0)82 21 24 11 (kantoor)")).toBe("tel:+320822124 11".replace(" ", ""));
    expect(telHref("0612 345 678")).toBe("tel:0612345678");
    expect(telHref("geen nummer")).toBeNull();
    expect(telHref("12")).toBeNull();
    expect(telHref(null)).toBeNull();
  });

  it("maakt een https-link van een webadres en weigert de rest", () => {
    expect(webHref("https://www.voorbeeld.be/zorg")).toBe("https://www.voorbeeld.be/zorg");
    expect(webHref("http://www.voorbeeld.be")).toBe("https://www.voorbeeld.be");
    expect(webHref("www.voorbeeld.be")).toBe("https://www.voorbeeld.be");
    expect(webHref("voorbeeld")).toBeNull();
    expect(webHref("javascript:alert(1)")).toBeNull();
    expect(webHref("twee woorden.be")).toBeNull();
    expect(webHref("")).toBeNull();
  });
});
