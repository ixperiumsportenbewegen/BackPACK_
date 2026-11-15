import { describe, expect, it } from "vitest";
import { dagenTot, nlDag } from "@/lib/tijd";

describe("dagenTot: kalenderdagen in Nederlandse tijd", () => {
  it("telt tot middernacht Nederlandse tijd, ook in de winter met zomertijd in het vooruitzicht", () => {
    // 15 november 2026, 22:30 UTC = 23:30 in Nederland: het is nog steeds 15 november
    expect(nlDag(new Date("2026-11-15T22:30:00Z"))).toBe("2026-11-15");
    expect(dagenTot("2027-06-28", new Date("2026-11-15T22:30:00Z"))).toBe(225);
    // een uur later is het in Nederland 16 november
    expect(dagenTot("2027-06-28", new Date("2026-11-15T23:30:00Z"))).toBe(224);
    // vlak voor middernacht UTC is het in Nederland al na middernacht
    expect(dagenTot("2027-06-28", new Date("2026-11-16T00:10:00Z"))).toBe(224);
  });

  it("klopt ook in de zomer (twee uur verschil met UTC)", () => {
    expect(nlDag(new Date("2027-06-27T21:30:00Z"))).toBe("2027-06-27");
    expect(nlDag(new Date("2027-06-27T22:30:00Z"))).toBe("2027-06-28");
    expect(dagenTot("2027-06-28", new Date("2027-06-27T21:30:00Z"))).toBe(1);
    expect(dagenTot("2027-06-28", new Date("2027-06-27T22:30:00Z"))).toBe(0);
  });

  it("de dag zelf is 0, een dag die voorbij is is negatief", () => {
    expect(dagenTot("2027-06-28", new Date("2027-06-28T10:00:00Z"))).toBe(0);
    expect(dagenTot("2027-06-28", new Date("2027-06-30T10:00:00Z"))).toBe(-2);
  });

  it("de wisseling naar zomertijd telt geen dag mee of minder", () => {
    // zondag 28 maart 2027 is de dag van de tijdwisseling (23 uur lang)
    expect(dagenTot("2027-03-29", new Date("2027-03-27T12:00:00Z"))).toBe(2);
    expect(dagenTot("2027-03-29", new Date("2027-03-28T12:00:00Z"))).toBe(1);
  });
});
