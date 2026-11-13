// Maakt de PWA-iconen (backpack in HAN rood op wit). Gebruik: node scripts/maak-iconen.mjs
import sharp from "sharp";

// Lucide "backpack", lijnstijl
const pad = `
<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>
<path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
<path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5"/>
<path d="M8 10h8"/><path d="M8 18h8"/>`;

function svg(maat, schaal) {
  const s = (maat * schaal) / 24;
  const o = (maat - 24 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maat}" height="${maat}" viewBox="0 0 ${maat} ${maat}">
<rect width="${maat}" height="${maat}" fill="#FFFFFF"/>
<g transform="translate(${o} ${o}) scale(${s})" fill="none" stroke="#E50056" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${pad}</g></svg>`;
}

const uit = [
  ["public/icons/icon-192.png", 192, 0.7],
  ["public/icons/icon-512.png", 512, 0.7],
  ["public/icons/icon-maskable-512.png", 512, 0.5], // extra ruimte voor afgeronde iconen
  ["public/icons/apple-touch-icon.png", 180, 0.6],
];
for (const [bestand, maat, schaal] of uit) {
  await sharp(Buffer.from(svg(maat, schaal))).png().toFile(bestand);
}
console.log("Iconen gemaakt");
