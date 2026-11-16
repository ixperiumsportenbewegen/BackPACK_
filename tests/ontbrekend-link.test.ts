import { describe, expect, it } from "vitest";
import { ontbrekendLink } from "@/lib/avfVoortgang";

describe("ontbrekendLink: waar een ontbrekend punt wordt ingevuld", () => {
  it("een gewoon veld staat in zijn eigen sectie", () => {
    expect(ontbrekendLink("A", "titel")).toBe("/avf/A");
    expect(ontbrekendLink("E", "veiligheid.weer.zeer_warm")).toBe("/avf/E");
    expect(ontbrekendLink("H", "communicatie.voor")).toBe("/avf/H");
  });

  it("sectie D opent de fase waar het punt hoort", () => {
    expect(ontbrekendLink("D", "kop.organisatievorm")).toBe("/avf/D?fase=kop");
    expect(ontbrekendLink("D", "romp.opruimen")).toBe("/avf/D?fase=romp");
    expect(ontbrekendLink("D", "staart.0.beschrijving")).toBe("/avf/D?fase=staart");
    expect(ontbrekendLink("D", "staart.onderdelen")).toBe("/avf/D?fase=staart");
  });

  it("de rolverdeling staat bovenaan sectie A", () => {
    expect(ontbrekendLink("A", "projectgroep_rol")).toBe("/avf/A#rolverdeling");
  });

  it("een onbekende sleutel in D valt terug op de sectie", () => {
    expect(ontbrekendLink("D", "iets.anders")).toBe("/avf/D");
  });
});
