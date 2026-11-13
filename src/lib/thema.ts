/** Wit op rood, zwart op de lichte HAN-kleuren (oranje, groen, blauw): kies wat het meeste contrast geeft. */
export function kleurOpAccent(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  const metWit = 1.05 / (l + 0.05);
  const metZwart = (l + 0.05) / 0.05;
  return metWit >= metZwart ? "#FFFFFF" : "#000000";
}
