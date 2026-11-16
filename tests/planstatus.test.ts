/** Wanneer het calamiteitenplan en de persoonlijke paklijst af zijn (voor het uitroepteken op de werkpagina van de stuurgroep). */
import { describe, expect, it } from "vitest";
import { PLAN_SECTIES } from "../src/config/calamiteitenplan";
import type { Plan } from "../src/lib/calamiteitenplan";
import type { Paklijst } from "../src/lib/paklijst";
import { opsomming, paklijstOntbreekt, planOntbreekt } from "../src/lib/planStatus";

const leegPlan = (): Plan => ({ clusterId: "c", velden: {}, lijsten: {}, groepsappLink: null, bijgewerkt: null });

/** Een plan waarin alles is ingevuld, behalve "Overig" (dat mag leeg blijven). */
function volPlan(): Plan {
  const plan = leegPlan();
  for (const sectie of PLAN_SECTIES) {
    for (const v of sectie.velden ?? []) plan.velden[v.sleutel] = "ingevuld";
    if (sectie.lijst && sectie.code !== "overig") {
      plan.lijsten[sectie.lijst.sleutel] = [{ id: sectie.code, velden: { [sectie.lijst.titelVeld]: "regel", telefoon: "0612345678" } }];
    }
  }
  return plan;
}

const NAMEN = PLAN_SECTIES.filter((s) => s.code !== "overig").map((s) => s.naam);

describe("calamiteitenplan: wat ontbreekt er?", () => {
  it("een leeg plan mist alle onderdelen behalve Overig", () => {
    expect(planOntbreekt(leegPlan())).toEqual(NAMEN);
    expect(NAMEN).not.toContain("Overig");
    expect(NAMEN).toHaveLength(8);
  });

  it("een volledig ingevuld plan is af, ook zonder iets bij Overig", () => {
    expect(planOntbreekt(volPlan())).toEqual([]);
  });

  it("elk onderdeel telt: ontbreekt er één, dan is het plan niet af en staat het onderdeel in de lijst", () => {
    for (const sectie of PLAN_SECTIES.filter((s) => s.code !== "overig")) {
      const plan = volPlan();
      for (const v of sectie.velden ?? []) delete plan.velden[v.sleutel];
      if (sectie.lijst) plan.lijsten[sectie.lijst.sleutel] = [];
      expect(planOntbreekt(plan), sectie.code).toEqual([sectie.naam]);
    }
  });

  it("een onderdeel met meer velden is pas af als al zijn velden zijn gevuld", () => {
    const plan = volPlan();
    plan.velden.melden = "   ";
    expect(planOntbreekt(plan)).toEqual(["Noodnummer en melden"]);
    plan.velden.melden = "Melden in de groepsapp";
    delete plan.velden.noodnummer;
    expect(planOntbreekt(plan)).toEqual(["Noodnummer en melden"]);
  });

  it("een contactpersoon telt pas mee met een naam én een telefoonnummer", () => {
    const alleenNaam = volPlan();
    alleenNaam.lijsten.contactpersonen = [{ id: "1", velden: { naam: "Contact" } }];
    expect(planOntbreekt(alleenNaam)).toEqual(["Wie bel je (in volgorde)"]);
    const alleenNummer = volPlan();
    alleenNummer.lijsten.contactpersonen = [{ id: "1", velden: { telefoon: "0612345678" } }];
    expect(planOntbreekt(alleenNummer)).toEqual(["Wie bel je (in volgorde)"]);
  });

  it("een regel in een lijst zonder titel telt niet mee", () => {
    const plan = volPlan();
    plan.lijsten.ziekenhuizen = [{ id: "x", velden: { adres: "Alleen een adres" } }];
    expect(planOntbreekt(plan)).toEqual(["Ziekenhuizen en hulp in de buurt"]);
  });
});

const paklijst = (persoon: string[], groepje: string[]): Paklijst => ({
  clusterId: "c", bijgewerkt: null,
  categorieen: [
    { id: "a", blok: "persoon", naam: "Kleding", spullen: persoon.map((naam, i) => ({ id: `p${i}`, naam, aantal: null, toelichting: null, optioneel: false, onderdelen: [] })) },
    { id: "b", blok: "groepje", naam: "Koken", spullen: groepje.map((naam, i) => ({ id: `g${i}`, naam, aantal: null, toelichting: null, optioneel: false, onderdelen: [] })) },
  ],
});

describe("persoonlijke paklijst: wat ontbreekt er?", () => {
  it("een lege lijst mist beide blokken; met een item in elk blok is hij af", () => {
    expect(paklijstOntbreekt(paklijst([], []))).toEqual(["per persoon", "om met een groepje te delen"]);
    expect(paklijstOntbreekt(paklijst(["Broek"], []))).toEqual(["om met een groepje te delen"]);
    expect(paklijstOntbreekt(paklijst([], ["Gasstel"]))).toEqual(["per persoon"]);
    expect(paklijstOntbreekt(paklijst(["Broek"], ["Gasstel"]))).toEqual([]);
  });

  it("een item zonder naam telt niet mee", () => {
    expect(paklijstOntbreekt(paklijst(["  "], ["Gasstel"]))).toEqual(["per persoon"]);
  });
});

describe("opsomming", () => {
  it("zet geen komma voor en", () => {
    expect(opsomming([])).toBe("");
    expect(opsomming(["a"])).toBe("a");
    expect(opsomming(["a", "b"])).toBe("a en b");
    expect(opsomming(["a", "b", "c"])).toBe("a, b en c");
  });
});
