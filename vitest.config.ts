import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 30000,
    // De tests delen één database (ook VD en VC); achter elkaar draaien voorkomt dat ze elkaar storen.
    fileParallelism: false,
    hookTimeout: 60000,
    setupFiles: ["tests/setup-env.ts"],
  },
});
