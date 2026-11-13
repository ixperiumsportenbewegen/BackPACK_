/** Past de migraties toe op het gekoppelde Supabase-project (leest het databasewachtwoord uit .env.local). */
import { config } from "dotenv";
import { spawnSync } from "node:child_process";

config({ path: ".env.local", quiet: true });
const wachtwoord = process.env.SUPABASE_DB_PASSWORD;
if (!wachtwoord) {
  console.error("SUPABASE_DB_PASSWORD ontbreekt in .env.local");
  process.exit(1);
}
const res = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["supabase", "db", "push", "--remote", "--password", wachtwoord, ...process.argv.slice(2)],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(res.status ?? 1);
