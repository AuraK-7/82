import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  use: { baseURL: process.env.E2E_BASE || "http://localhost:3000", headless: true },
  webServer: { command: "npm run dev", port: 3000, timeout: 30000, reuseExistingServer: true },
});
