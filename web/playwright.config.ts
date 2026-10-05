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
    // Capture a trace on failure but skip DOM snapshots: the snapshot capture
    // races xterm.js's DOM renderer and can drop the "ToneForge Terminal"
    // banner (and other early terminal output) from the viewport, which
    // previously made the banner assertion fail intermittently. Screenshots,
    // sources, console and network activity are still recorded.
    trace: { mode: "retain-on-failure", snapshots: false },
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
    {
      // Cross-browser coverage for the Runtime/recipe browser tests.
      // Scoped to runtime-recipes.spec.ts so the terminal-walkthrough specs
      // keep their chromium-only assumptions.
      name: "firefox",
      testMatch: /runtime-recipes\.spec\.ts/,
      use: { browserName: "firefox" },
    },
  ],
});
