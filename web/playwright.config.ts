import { defineConfig } from "@playwright/test";

const port = parseInt(process.env.PORT || "3000", 10);

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000, // 2 minutes per test — commands take time in the terminal
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false, // tests share a single server
  retries: 0,
  use: {
    baseURL: `http://localhost:${port}`,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node dist-server/index.js",
    port,
    reuseExistingServer: false,
    timeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
