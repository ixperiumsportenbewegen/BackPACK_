import { describe, expect, it } from "vitest";
import { HAN_ACCENTEN, MIN_CONTRAST, contrastRatio, isToegestaneAccent, kleurOpAccent } from "@/lib/thema";
import { themaBeeldUrl } from "@/lib/themaBeeld";

describe("accentkleur en contrast", () => {
  it("wit op HAN rood, zwart op oranje, groen en blauw", () => {
    expect(kleurOpAccent("#E50056")).toBe("#FFFFFF");
    expect(kleurOpAccent("#F5A846")).toBe("#000000");
    expect(kleurOpAccent("#7AC48E")).toBe("#000000");
    expect(kleurOpAccent("#6AC3ED")).toBe("#000000");
  });

  it("elke toegestane accentkleur haalt met de gekozen tekstkleur minstens 4,5 : 1", () => {
    for (const a of HAN_ACCENTEN) {
      const ratio = contrastRatio(a.hex, kleurOpAccent(a.hex));
      expect(ratio, a.naam).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it("contrast van zwart op wit is 21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("HAN rood met wit komt overeen met de huisstijl (ca. 4,7)", () => {
    expect(contrastRatio("#E50056", "#FFFFFF")).toBeGreaterThan(4.5);
    expect(contrastRatio("#E50056", "#FFFFFF")).toBeLessThan(5);
  });

  it("andere kleuren dan de vier HAN-kleuren zijn niet toegestaan", () => {
    expect(isToegestaneAccent("#e50056")).toBe(true);
    expect(isToegestaneAccent("#6AC3ED")).toBe(true);
    expect(isToegestaneAccent("#FF00FF")).toBe(false);
    expect(isToegestaneAccent("#B14196")).toBe(false); // tertiair: alleen grafieken
    expect(isToegestaneAccent(null)).toBe(false);
  });
});

describe("themaBeeldUrl", () => {
  it("outdoorfoto's komen uit de app zelf", () => {
    expect(themaBeeldUrl("fotos/vuur-avond", 800)).toBe("/fotos/vuur-avond-800.webp");
    expect(themaBeeldUrl("fotos/vuur-avond")).toBe("/fotos/vuur-avond-1600.webp");
  });
  it("eigen bestanden lopen via de afgeschermde route", () => {
    expect(themaBeeldUrl("cluster/abc/sfeerbeeld-1.webp")).toBe("/api/thema/cluster/abc/sfeerbeeld-1.webp");
  });
  it("onbekende of lege paden geven niets terug", () => {
    expect(themaBeeldUrl(null)).toBeNull();
    expect(themaBeeldUrl("https://example.com/x.png")).toBeNull();
  });
});
