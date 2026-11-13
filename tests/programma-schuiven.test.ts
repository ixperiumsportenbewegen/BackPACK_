import { describe, expect, it } from "vitest";
import { berekenVerschuiving, naarMinuten, naarTijd, type TijdRegel } from "@/lib/programmaSchuiven";

const dag = "2027-06-28";
const regels: TijdRegel[] = [
  { id: "a", dag, volgorde: 1, starttijd: "08:00:00", eindtijd: "08:30:00" },
  { id: "b", dag, volgorde: 2, starttijd: "08:30:00", eindtijd: "11:30:00" },
  { id: "c", dag, volgorde: 3, starttijd: "11:30:00", eindtijd: "12:30:00" },
  { id: "d", dag, volgorde: 4, starttijd: "13:00:00", eindtijd: "16:00:00" }, // gat van een half uur
  { id: "e", dag, volgorde: 5, starttijd: "16:00:00", eindtijd: "17:00:00" },
  { id: "x", dag: "2027-06-29", volgorde: 6, starttijd: "08:00:00", eindtijd: "09:00:00" },
];

describe("meeschuiven van tijden", () => {
  it("omrekenen tussen tijd en minuten", () => {
    expect(naarMinuten("09:30")).toBe(570);
    expect(naarMinuten("09:30:00")).toBe(570);
    expect(naarTijd(570)).toBe("09:30");
    expect(naarTijd(0)).toBe("00:00");
  });

  it("een latere eindtijd schuift de aansluitende activiteiten op, met dezelfde duur", () => {
    // eerste activiteit eindigt om 09:00 in plaats van 08:30: alles daarna een half uur later
    const r = berekenVerschuiving(regels, { dag, volgorde: 1 }, "08:30:00", 30);
    expect(r.pastNiet).toBe(false);
    expect(r.verschoven.map((v) => [v.id, v.nieuwStart, v.nieuwEind])).toEqual([
      ["b", "09:00", "12:00"],
      ["c", "12:00", "13:00"],
    ]);
  });

  it("bij een gat in het programma stopt het meeschuiven", () => {
    const r = berekenVerschuiving(regels, { dag, volgorde: 1 }, "08:30", 30);
    expect(r.verschoven.map((v) => v.id)).not.toContain("d");
    expect(r.verschoven.map((v) => v.id)).not.toContain("e");
  });

  it("een eerdere eindtijd schuift naar voren", () => {
    const r = berekenVerschuiving(regels, { dag, volgorde: 1 }, "08:30", -15);
    expect(r.verschoven[0]).toMatchObject({ id: "b", nieuwStart: "08:15", nieuwEind: "11:15" });
  });

  it("andere dagen schuiven niet mee", () => {
    const r = berekenVerschuiving(regels, { dag, volgorde: 3 }, "12:30", 60);
    expect(r.verschoven).toEqual([]); // d begint pas om 13:00: een gat
    expect(r.verschoven.map((v) => v.id)).not.toContain("x");
  });

  it("zonder verschil of buiten de dag verschuift er niets", () => {
    expect(berekenVerschuiving(regels, { dag, volgorde: 1 }, "08:30", 0)).toEqual({ verschoven: [], pastNiet: false });
    const laat: TijdRegel[] = [
      { id: "p", dag, volgorde: 1, starttijd: "20:00", eindtijd: "21:00" },
      { id: "q", dag, volgorde: 2, starttijd: "21:00", eindtijd: "23:30" },
    ];
    expect(berekenVerschuiving(laat, { dag, volgorde: 1 }, "21:00", 60).pastNiet).toBe(true);
    expect(berekenVerschuiving(laat, { dag, volgorde: 1 }, "21:00", -300).pastNiet).toBe(false);
  });
});
