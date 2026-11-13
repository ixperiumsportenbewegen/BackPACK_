/** De vier accentkleuren die een meerdaagsethema mag hebben (HAN rood, oranje, groen, blauw). */
export const HAN_ACCENTEN = [
  { naam: "HAN rood", hex: "#E50056" },
  { naam: "Oranje", hex: "#F5A846" },
  { naam: "Groen", hex: "#7AC48E" },
  { naam: "Blauw", hex: "#6AC3ED" },
] as const;

export function isToegestaneAccent(hex: string | null | undefined): hex is string {
  return !!hex && HAN_ACCENTEN.some((a) => a.hex.toLowerCase() === hex.toLowerCase());
}

function relatieveLuminantie(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** Contrastverhouding volgens WCAG (1 tot 21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relatieveLuminantie(hexA);
  const b = relatieveLuminantie(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Wit op rood, zwart op de lichte HAN-kleuren (oranje, groen, blauw): kies wat het meeste contrast geeft. */
export function kleurOpAccent(hex: string): "#FFFFFF" | "#000000" {
  return contrastRatio(hex, "#FFFFFF") >= contrastRatio(hex, "#000000") ? "#FFFFFF" : "#000000";
}

/** Minimaal contrast voor tekst volgens WCAG AA. */
export const MIN_CONTRAST = 4.5;
