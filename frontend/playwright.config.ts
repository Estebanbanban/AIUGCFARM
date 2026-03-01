import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../docs/qa-flows/artifacts",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "../docs/qa-flows/report", open: "never" }],
    ["json", { outputFile: "../docs/qa-flows/results.json" }],
  ],
  use: {
    baseURL: "http://localhost:4000",
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: "on",
    video: "off",
    trace: "off",
    actionTimeout: 15000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
