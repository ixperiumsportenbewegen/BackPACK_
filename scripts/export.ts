/**
 * Maakt een volledige export van de gegevens (JSON, en met --excel ook een Excel-bestand) in de map export/.
 * Gebruikt de service role key. Wordt ook door de wekelijkse GitHub Actions-taak gebruikt.
 *
 * Gebruik: npm run export            alleen JSON
 *          npm run export -- --excel  ook Excel
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { exportBestandsnaam, exporteerAlles } from "../src/lib/exporteren";
import { exportNaarExcel } from "../src/lib/exporterenExcel";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sleutel = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !sleutel) {
  console.error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken");
  process.exit(1);
}

async function main() {
  const admin = createClient(url!, sleutel!, { auth: { autoRefreshToken: false, persistSession: false } });
  const data = await exporteerAlles(admin);
  mkdirSync("export", { recursive: true });
  const jsonPad = path.join("export", exportBestandsnaam("json"));
  writeFileSync(jsonPad, JSON.stringify(data, null, 2));
  console.log(`Export gemaakt: ${jsonPad}`);
  if (process.argv.includes("--excel")) {
    const xlsxPad = path.join("export", exportBestandsnaam("xlsx"));
    writeFileSync(xlsxPad, await exportNaarExcel(data));
    console.log(`Excel gemaakt: ${xlsxPad}`);
  }
  const totaal = Object.values(data.aantallen).reduce((a, b) => a + b, 0);
  console.log(`${Object.keys(data.aantallen).length} tabellen, ${totaal} rijen.`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
