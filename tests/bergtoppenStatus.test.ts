import { describe, expect, it } from "vitest";
import { AANTAL_TOPPEN, BERGTOP_MAX, toppenNummers, topSleutel } from "@/config/bergtoppen";
import { bergtoppenOntbreekt, conceptAlsInhoud, conceptVerschilt, toppenIngevuld } from "@/lib/bergtoppenStatus";

function vol(): Record<string, string> {
  const v: Record<string, string> = { toelichting: "Uitleg" };
  for (const n of toppenNummers) {
    v[topSleutel(n, "titel")] = `Titel ${n}`;
    v[topSleutel(n, "afspraak")] = `Afspraak ${n}`;
  }
  return v;
}

describe("bergtoppen: status", () => {
  it("er zijn precies 10 toppen en de sleutels kloppen met de database", () => {
    expect(AANTAL_TOPPEN).toBe(10);
    expect(toppenNummers).toHaveLength(10);
    expect(topSleutel(10, "afspraak")).toBe("top_10_afspraak");
    expect(BERGTOP_MAX).toEqual({ titel: 80, afspraak: 300, toelichtingTitel: 80, toelichting: 3000 });
  });

  it("alles leeg: elke top en de toelichting ontbreken", () => {
    expect(bergtoppenOntbreekt({})).toEqual([...toppenNummers.map((n) => `top ${n}`), "toelichting"]);
    expect(toppenIngevuld({})).toBe(0);
  });

  it("volledig: niets ontbreekt; de titel van de toelichting is optioneel", () => {
    expect(bergtoppenOntbreekt(vol())).toEqual([]);
    expect(toppenIngevuld(vol())).toBe(10);
  });

  it("een top met alleen een titel of alleen spaties telt niet als ingevuld", () => {
    const v = vol();
    delete v[topSleutel(3, "afspraak")];
    v[topSleutel(5, "titel")] = "   ";
    expect(bergtoppenOntbreekt(v)).toEqual(["top 3", "top 5"]);
    expect(toppenIngevuld(v)).toBe(8);
  });

  it("zonder toelichting is het niet klaar", () => {
    const v = vol();
    delete v.toelichting;
    expect(bergtoppenOntbreekt(v)).toEqual(["toelichting"]);
  });

  it("het concept verschilt pas van de publicatie als er echt iets anders staat", () => {
    const v = vol();
    const gepubliceerd = conceptAlsInhoud(v);
    expect(conceptVerschilt(v, null)).toBe(false);
    expect(conceptVerschilt(v, gepubliceerd)).toBe(false);
    expect(conceptVerschilt({ ...v, [topSleutel(2, "titel")]: "  Titel 2  " }, gepubliceerd)).toBe(false); // spaties tellen niet
    expect(conceptVerschilt({ ...v, [topSleutel(2, "titel")]: "Anders" }, gepubliceerd)).toBe(true);
    expect(conceptVerschilt({ ...v, toelichting: "Andere uitleg" }, gepubliceerd)).toBe(true);
    expect(conceptVerschilt({ ...v, toelichting_titel: "Het dal" }, gepubliceerd)).toBe(true);
  });
});
