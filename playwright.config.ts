import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  // Eén worker: alle tests werken op dezelfde gegevens in het cluster TEST, dus twee bestanden tegelijk zouden elkaar storen.
  workers: 1,
  expect: { timeout: 10_000 },
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000" },
  projects: [{ name: "mobiel", use: { ...devices["Pixel 7"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true },
});
