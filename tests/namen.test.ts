/** Namen van studenten: één naam per veld in de app, opgeslagen als tekst met komma's. */
import { describe, expect, it } from "vitest";
import { aantalPersonen, schoonNaam, splitNamen, uniekeNamen, voegNamenSamen, MAX_LENGTE_NAAM, MAX_NAMEN_PER_ROL } from "../src/lib/namen";

describe("namen", () => {
  it("splitst op komma's en haalt lege plekken weg", () => {
    expect(splitNamen("Anna, Bram,  ,Chris")).toEqual(["Anna", "Bram", "Chris"]);
    expect(splitNamen(null)).toEqual([]);
    expect(splitNamen("")).toEqual([]);
    expect(splitNamen("Student A, Student B")).toEqual(["Student A", "Student B"]);
  });

  it("oude tekst zonder komma blijft één naam", () => {
    expect(splitNamen("Mila en Daan")).toEqual(["Mila en Daan"]);
  });

  it("voegt samen tot tekst, of null als er niemand is", () => {
    expect(voegNamenSamen(["Anna", " Bram ", ""])).toBe("Anna, Bram");
    expect(voegNamenSamen(["", "  "])).toBeNull();
    expect(voegNamenSamen([])).toBeNull();
  });

  it("een komma in een naam wordt een spatie en een naam is niet te lang", () => {
    expect(schoonNaam("Anna, Bram")).toBe("Anna Bram");
    expect(schoonNaam("x".repeat(100))).toHaveLength(MAX_LENGTE_NAAM);
    expect(voegNamenSamen(Array.from({ length: 30 }, (_, i) => `N${i}`))?.split(", ")).toHaveLength(MAX_NAMEN_PER_ROL);
  });

  it("dezelfde naam bij twee rollen telt één keer", () => {
    expect(uniekeNamen(["Anna, Bram", "anna", null, "Chris,  BRAM"])).toEqual(["Anna", "Bram", "Chris"]);
  });

  it("schrijft het aantal personen netjes", () => {
    expect(aantalPersonen(1)).toBe("1 persoon");
    expect(aantalPersonen(9)).toBe("9 personen");
    expect(aantalPersonen(0)).toBe("0 personen");
  });
});
