import { defineConfig } from "@playwright/test";
import { findFreePortSync } from "./scripts/select-port.js";

/** Env var used to share the selected port with Playwright worker processes. */
const PORT_ENV = "TF_E2E_PORT";

/**
 * Resolve the port the e2e web server binds.
 *
 * `PORT` wins when set explicitly. Otherwise the first free port at or after
 * 3000 is selected so a busy default port (for example another project's dev
 * server) does not abort the run before a single test executes.
 *
 * Playwright evaluates this config in the main process *and* in every worker
 * process; without a shared value the workers would probe different ports and
 * navigate to a server that was never started. The main process evaluates
 * first and caches its choice in `TF_E2E_PORT`, which worker processes inherit.
 */
function resolvePort(): number {
  const requested = process.env.PORT
    ? Number.parseInt(process.env.PORT, 10)
    : undefined;
  if (requested !== undefined && Number.isFinite(requested)) {
    return requested;
  }

  const cached = process.env[PORT_ENV]
    ? Number.parseInt(process.env[PORT_ENV] as string, 10)
    : undefined;
  if (cached !== undefined && Number.isFinite(cached)) {
    return cached;
  }

  const selected = findFreePortSync(3000);
  process.env[PORT_ENV] = String(selected);
  return selected;
}

const port = resolvePort();

/** True when running under a CI provider (GitHub Actions sets `CI=true`). */
const isCI = process.env.CI === "true" || process.env.CI === "1";

/** Environment for the web server command, preserving the inherited env. */
const webServerEnv: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) {
    webServerEnv[key] = value;
  }
}
webServerEnv.PORT = String(port);

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000, // 2 minutes per test — commands take time in the terminal
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false, // tests share a single server
  // Retry on CI only: the terminal-walkthrough specs drive a PTY and are the
  // most sensitive to cold-start timing; a retry absorbs that without hiding
  // genuine failures locally.
  retries: isCI ? 2 : 0,
  // CI emits both a list (for the job log) and an HTML report (uploaded as an
  // artifact); local runs keep the concise list output.
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
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
    env: webServerEnv,
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
