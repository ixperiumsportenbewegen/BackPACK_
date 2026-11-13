// Maakt de PWA-iconen en het favicon van het BackPACK_-avatar (assets/logo/BackPACK-avatar-BP-v2.png).
// Gebruik: node scripts/maak-iconen.mjs
import sharp from "sharp";

const BRON = "assets/logo/BackPACK-avatar-BP-v2.png";

// Achtergrondkleur van het avatar, uit de hoek van de afbeelding (voor de rand van het "maskable"-icoon)
const { data: hoek } = await sharp(BRON).ensureAlpha().extract({ left: 3, top: 3, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
const achtergrond = { r: hoek[0], g: hoek[1], b: hoek[2], alpha: 1 };
console.log("achtergrondkleur:", `rgb(${hoek[0]}, ${hoek[1]}, ${hoek[2]})`);

async function vierkant(bestand, maat) {
  await sharp(BRON).resize(maat, maat, { fit: "cover" }).flatten({ background: achtergrond }).png().toFile(bestand);
}

// Maskable: het avatar op 70% in het midden met ruimte rondom, zodat afgeronde of ronde iconen niets afsnijden
async function maskable(bestand, maat) {
  const binnen = Math.round(maat * 0.7);
  const klein = await sharp(BRON).resize(binnen, binnen, { fit: "cover" }).png().toBuffer();
  await sharp({ create: { width: maat, height: maat, channels: 4, background: achtergrond } })
    .composite([{ input: klein, gravity: "center" }])
    .png()
    .toFile(bestand);
}

await vierkant("public/icons/icon-192.png", 192);
await vierkant("public/icons/icon-512.png", 512);
await maskable("public/icons/icon-maskable-512.png", 512);
await vierkant("public/icons/apple-touch-icon.png", 180);
await vierkant("public/icons/favicon-32.png", 32);
await vierkant("public/icons/favicon-48.png", 48);
console.log("Iconen gemaakt");
