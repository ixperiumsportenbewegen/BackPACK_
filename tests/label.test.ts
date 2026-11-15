import { describe, expect, it } from "vitest";
import { accountLabel } from "@/lib/label";

describe("accountLabel: de tekst bovenaan elk scherm", () => {
  it("een projectgroep, stuurgroep en student tonen hun cluster", () => {
    expect(accountLabel({ soort: "projectgroep", clusterCode: "VD", projectgroepNaam: "Projectgroep 3" })).toBe("VD · Projectgroep 3");
    expect(accountLabel({ soort: "stuurgroep", clusterCode: "VC", stuurgroeprolNaam: "Budget" })).toBe("VC · Budget");
    expect(accountLabel({ soort: "student", clusterCode: "TEST" })).toBe("TEST · Student");
  });

  it("de docent ziet erbij welk cluster hij bekijkt", () => {
    expect(accountLabel({ soort: "docent", clusterCode: "TEST" })).toBe("Docent · TEST");
    expect(accountLabel({ soort: "docent", clusterCode: "VD" })).toBe("Docent · VD");
  });

  it("zonder cluster blijft het bij Docent", () => {
    expect(accountLabel({ soort: "docent" })).toBe("Docent");
    expect(accountLabel({ soort: "docent", clusterCode: null })).toBe("Docent");
  });
});
