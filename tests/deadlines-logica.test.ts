import { describe, expect, it } from "vitest";
import {
  DEADLINE_CODES, DEADLINE_ONDERDELEN, deadlineNiveau, deadlineStand, deadlineWaarschuwing, formatDeadline, herinneringTekst,
  momentNaarNl, nlNaarMoment, resterendTekst, sorteerDeadlines,
} from "@/lib/deadlines";
import { legeInhoud } from "@/lib/avfVoortgang";

const d = (iso: string) => new Date(iso);

describe("onderdelen", () => {
  it("er zijn elf onderdelen: sectie A t/m H, indienen, materiaal en budget", () => {
    expect(DEADLINE_CODES).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "indienen", "materiaal", "budget"]);
    expect(DEADLINE_ONDERDELEN.find((o) => o.code === "D")?.naam).toBe("Sectie D · Kop, romp en staart");
  });
});

describe("Nederlandse tijd omzetten", () => {
  it("een deadline van 17:00 is 16:00 UTC in de winter en 15:00 UTC in de zomer", () => {
    expect(nlNaarMoment("2026-12-04", "17:00")?.toISOString()).toBe("2026-12-04T16:00:00.000Z");
    expect(nlNaarMoment("2027-06-25", "17:00")?.toISOString()).toBe("2027-06-25T15:00:00.000Z");
  });

  it("klopt rond de overgang naar zomertijd (zondag 28 maart 2027)", () => {
    expect(nlNaarMoment("2027-03-27", "17:00")?.toISOString()).toBe("2027-03-27T16:00:00.000Z");
    expect(nlNaarMoment("2027-03-28", "12:00")?.toISOString()).toBe("2027-03-28T10:00:00.000Z");
    expect(nlNaarMoment("2027-03-29", "17:00")?.toISOString()).toBe("2027-03-29T15:00:00.000Z");
  });

  it("klopt rond de overgang naar wintertijd (zondag 31 oktober 2027)", () => {
    expect(nlNaarMoment("2027-10-30", "17:00")?.toISOString()).toBe("2027-10-30T15:00:00.000Z");
    expect(nlNaarMoment("2027-11-01", "17:00")?.toISOString()).toBe("2027-11-01T16:00:00.000Z");
  });

  it("ongeldige invoer geeft null", () => {
    expect(nlNaarMoment("2026-02-31", "17:00")).toBeNull();
    expect(nlNaarMoment("2026-12-04", "25:00")).toBeNull();
    expect(nlNaarMoment("04-12-2026", "17:00")).toBeNull();
    expect(nlNaarMoment("2026-12-04", "5 uur")).toBeNull();
  });

  it("heen en terug geeft hetzelfde", () => {
    for (const [dag, tijd] of [["2026-12-04", "17:00"], ["2027-06-25", "09:30"], ["2027-03-28", "12:15"], ["2027-01-01", "00:00"], ["2027-12-31", "23:59"]]) {
      const m = nlNaarMoment(dag, tijd)!;
      expect(momentNaarNl(m)).toEqual({ dag, tijd });
    }
  });

  it("toont een deadline als dag en tijd in Nederland", () => {
    expect(formatDeadline(d("2026-12-04T16:00:00Z"))).toBe("vrijdag 4 december · 17:00");
    expect(formatDeadline(d("2027-06-25T15:00:00Z"))).toBe("vrijdag 25 juni · 17:00");
  });
});

describe("hoe lang nog", () => {
  const deadline = d("2026-12-04T16:00:00Z"); // vrijdag 17:00

  it("ruim ervoor", () => {
    const nu = d("2026-11-20T10:00:00Z");
    expect(deadlineNiveau(deadline, nu)).toBe("ruim");
    expect(resterendTekst(deadline, nu)).toBe("nog 14 dagen");
  });

  it("binnen een week is binnenkort", () => {
    const nu = d("2026-12-01T10:00:00Z");
    expect(deadlineNiveau(deadline, nu)).toBe("binnenkort");
    expect(resterendTekst(deadline, nu)).toBe("nog 3 dagen");
    expect(deadlineNiveau(deadline, d("2026-11-27T10:00:00Z"))).toBe("binnenkort"); // precies 7 dagen
    expect(deadlineNiveau(deadline, d("2026-11-26T10:00:00Z"))).toBe("ruim"); // 8 dagen
  });

  it("morgen en vandaag zijn dringend", () => {
    expect(deadlineNiveau(deadline, d("2026-12-03T10:00:00Z"))).toBe("dringend");
    expect(resterendTekst(deadline, d("2026-12-03T10:00:00Z"))).toBe("morgen");
    expect(deadlineNiveau(deadline, d("2026-12-04T10:00:00Z"))).toBe("dringend");
    expect(resterendTekst(deadline, d("2026-12-04T10:00:00Z"))).toBe("vandaag nog 6 uur");
    expect(resterendTekst(deadline, d("2026-12-04T15:30:00Z"))).toBe("nog 30 minuten");
  });

  it("telt dagen in Nederlandse tijd, ook vlak voor middernacht", () => {
    // donderdag 3 december, 23:30 in Nederland (22:30 UTC): de deadline van vrijdag is morgen
    expect(resterendTekst(deadline, d("2026-12-03T22:30:00Z"))).toBe("morgen");
    // een uur later is het vrijdag
    expect(resterendTekst(deadline, d("2026-12-03T23:30:00Z"))).toContain("vandaag");
  });

  it("verstreken: uren, dan dagen", () => {
    expect(deadlineNiveau(deadline, d("2026-12-04T16:00:01Z"))).toBe("verstreken");
    expect(resterendTekst(deadline, d("2026-12-04T16:30:00Z"))).toBe("zojuist verstreken");
    expect(resterendTekst(deadline, d("2026-12-04T20:00:00Z"))).toBe("4 uur te laat");
    // na middernacht blijft het binnen 24 uur bij uren
    expect(resterendTekst(deadline, d("2026-12-04T23:30:00Z"))).toBe("7 uur te laat");
    expect(resterendTekst(deadline, d("2026-12-06T10:00:00Z"))).toBe("2 dagen te laat");
    expect(resterendTekst(deadline, d("2026-12-05T16:30:00Z"))).toBe("1 dag te laat");
  });
});

describe("zachte waarschuwing bij het instellen", () => {
  const nu = d("2026-11-15T12:00:00Z");
  it("geen waarschuwing voor een gewone deadline", () => {
    expect(deadlineWaarschuwing(d("2026-12-04T16:00:00Z"), nu)).toBeNull();
    expect(deadlineWaarschuwing(d("2027-06-25T15:00:00Z"), nu)).toBeNull();
  });
  it("waarschuwt bij een moment dat voorbij is", () => {
    expect(deadlineWaarschuwing(d("2026-11-01T16:00:00Z"), nu)).toMatch(/voorbij/);
  });
  it("waarschuwt bij een deadline op of na de start van de meerdaagse", () => {
    expect(deadlineWaarschuwing(d("2027-06-28T10:00:00Z"), nu)).toMatch(/meerdaagse/);
    expect(deadlineWaarschuwing(d("2027-07-15T10:00:00Z"), nu)).toMatch(/meerdaagse/);
  });
});

describe("wanneer is een groep klaar", () => {
  const leeg = () => ({ status: "in_ontwikkeling" as const, inhoud: legeInhoud() });

  it("een leeg AVF is voor sectie A niet klaar en zegt hoeveel er openstaat", () => {
    const s = deadlineStand("A", leeg());
    expect(s.klaar).toBe(false);
    expect(s.tekst).toMatch(/^\d+ punten open$/);
  });

  it("indienen: klaar bij ingediend of goedgekeurd", () => {
    expect(deadlineStand("indienen", leeg()).klaar).toBe(false);
    expect(deadlineStand("indienen", { ...leeg(), status: "ingediend" }).klaar).toBe(true);
    expect(deadlineStand("indienen", { ...leeg(), status: "goedgekeurd" }).klaar).toBe(true);
    expect(deadlineStand("indienen", { ...leeg(), status: "aanpassing_gevraagd" }).klaar).toBe(false);
  });

  it("materiaal: klaar bij minstens één gekozen of eigen materiaal", () => {
    expect(deadlineStand("materiaal", leeg()).klaar).toBe(false);
    const a = leeg(); a.inhoud.materialenAantal = 2;
    expect(deadlineStand("materiaal", a).klaar).toBe(true);
    const b = leeg(); b.inhoud.eigenMaterialenAantal = 1;
    expect(deadlineStand("materiaal", b).klaar).toBe(true);
  });

  it("budget: klaar als het financieel plan minstens één regel heeft", () => {
    expect(deadlineStand("budget", leeg()).klaar).toBe(false);
    const a = leeg(); a.inhoud.financieelPlanRegels = 3;
    expect(deadlineStand("budget", a).klaar).toBe(true);
  });

  it("sectie F is klaar zodra er materiaal of een plan in staat", () => {
    expect(deadlineStand("F", leeg()).klaar).toBe(false);
    const a = leeg(); a.inhoud.materialenAantal = 1;
    expect(deadlineStand("F", a).klaar).toBe(true);
  });

  it("een onbekend onderdeel is nooit klaar", () => {
    expect(deadlineStand("Z", leeg()).klaar).toBe(false);
  });
});

describe("herinnering voor Teams", () => {
  const nu = d("2026-12-01T10:00:00Z");
  it("noemt het onderdeel, de datum, hoe lang nog en wie nog open staat", () => {
    const t = herinneringTekst({ onderdeel: "D", moment: d("2026-12-04T16:00:00Z"), toelichting: "Daarna beoordelen we." }, ["Projectgroep 2", "Projectgroep 5"], nu);
    expect(t).toContain("Sectie D · Kop, romp en staart moet vrijdag 4 december · 17:00 klaar zijn (nog 3 dagen).");
    expect(t).toContain("Waarom deze datum: Daarna beoordelen we.");
    expect(t).toContain("Nog open: Projectgroep 2, Projectgroep 5.");
  });

  it("zegt na de deadline dat het klaar had moeten zijn, en laat lege regels weg", () => {
    const t = herinneringTekst({ onderdeel: "indienen", moment: d("2026-11-27T16:00:00Z"), toelichting: null }, [], nu);
    expect(t).toContain("AVF indienen had vrijdag 27 november · 17:00 klaar moeten zijn (4 dagen te laat).");
    expect(t).not.toContain("Waarom");
    expect(t).not.toContain("Nog open");
  });
});

describe("sorteren", () => {
  it("eerst wat het eerst afloopt, bij gelijk moment op de volgorde van de onderdelen", () => {
    const rijen = [
      { onderdeel: "H", moment: d("2026-12-11T16:00:00Z") },
      { onderdeel: "D", moment: d("2026-12-04T16:00:00Z") },
      { onderdeel: "B", moment: d("2026-12-04T16:00:00Z") },
      { onderdeel: "A", moment: d("2026-11-27T16:00:00Z") },
    ];
    expect(sorteerDeadlines(rijen).map((r) => r.onderdeel)).toEqual(["A", "B", "D", "H"]);
  });
});
