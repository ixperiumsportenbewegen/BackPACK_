/** Alleen in de browser gebruiken. */

export interface VerkleindeAfbeelding {
  blob: Blob;
  breedte: number;
  hoogte: number;
  extensie: "webp" | "png";
  /** Gemiddelde helderheid van de onderste helft (0 donker tot 1 licht), voor de leesbaarheidscontrole. */
  helderheidOnder: number;
}

/**
 * Verkleint een afbeelding tot maximaal `maxZijde` pixels en slaat hem op als WebP.
 * Door opnieuw te tekenen verdwijnen EXIF-gegevens (locatie, camera); de stand van de foto blijft juist.
 */
export async function verkleinAfbeelding(bestand: File, maxZijde: number): Promise<VerkleindeAfbeelding> {
  if (!bestand.type.startsWith("image/") || bestand.type === "image/svg+xml") {
    throw new Error("Kies een foto (JPG, PNG of WebP).");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(bestand, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Deze afbeelding kan niet worden gelezen. Probeer een andere foto.");
  }

  const schaal = Math.min(1, maxZijde / Math.max(bitmap.width, bitmap.height));
  const breedte = Math.max(1, Math.round(bitmap.width * schaal));
  const hoogte = Math.max(1, Math.round(bitmap.height * schaal));

  const canvas = document.createElement("canvas");
  canvas.width = breedte;
  canvas.height = hoogte;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Je browser kan deze afbeelding niet verwerken.");
  ctx.drawImage(bitmap, 0, 0, breedte, hoogte);
  bitmap.close();

  // Helderheid van de onderste helft (daar staat de themanaam in wit)
  const onder = ctx.getImageData(0, Math.floor(hoogte / 2), breedte, Math.ceil(hoogte / 2)).data;
  let som = 0;
  let n = 0;
  for (let i = 0; i < onder.length; i += 16) {
    som += (0.2126 * onder[i] + 0.7152 * onder[i + 1] + 0.0722 * onder[i + 2]) / 255;
    n++;
  }

  const blob = await new Promise<Blob | null>((klaar) => canvas.toBlob(klaar, "image/webp", 0.82));
  if (!blob) throw new Error("Verkleinen is niet gelukt.");
  return {
    blob,
    breedte,
    hoogte,
    extensie: blob.type === "image/webp" ? "webp" : "png",
    helderheidOnder: n ? som / n : 0,
  };
}
