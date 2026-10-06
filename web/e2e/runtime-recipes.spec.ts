/**
 * Browser e2e tests for the ToneForge Runtime and recipe rendering.
 *
 * The Runtime and recipes are bundled separately (esbuild) and injected into
 * the real browser page, so these tests exercise the browser-native Web Audio
 * API path rather than the Node.js offline renderer.
 *
 * Work item: TF-0MUUPJ95Z001OHEN
 */
import { test, expect, type Page } from "@playwright/test";
import { build, type Plugin } from "esbuild";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * esbuild does not resolve TypeScript's `.js` specifiers to `.ts` sources on
 * its own; this plugin re-maps them for the harness bundle.
 */
const jsToTsPlugin: Plugin = {
  name: "js-to-ts",
  setup(builder) {
    builder.onResolve({ filter: /\.js$/ }, (args) => {
      if (!args.path.startsWith(".")) return null;
      const candidate = resolve(
        args.resolveDir,
        args.path.replace(/\.js$/, ".ts"),
      );
      return existsSync(candidate) ? { path: candidate } : null;
    });
  },
};

async function bundleHarness(): Promise<string> {
  const result = await build({
    entryPoints: [resolve(here, "fixtures/toneforge-browser-harness.ts")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    external: ["node:*"],
    plugins: [jsToTsPlugin],
    logLevel: "silent",
  });
  const output = result.outputFiles?.[0];
  if (!output) throw new Error("esbuild produced no output for the harness");
  return output.text;
}

let harnessCode: string;

test.beforeAll(async () => {
  harnessCode = await bundleHarness();
});

async function runScenario<T>(page: Page, name: string): Promise<T> {
  return (await page.evaluate((scenarioName) => {
    const harness = (
      globalThis as unknown as {
        __tfHarness?: { run: (n: string) => unknown };
      }
    ).__tfHarness;
    if (!harness) throw new Error("__tfHarness was not injected");
    return harness.run(scenarioName);
  }, name)) as T;
}

test.describe("ToneForge Runtime and recipes in the browser", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".xterm", { timeout: 15_000 });
    await page.addScriptTag({ type: "module", content: harnessCode });
    await page.waitForFunction(
      () =>
        (globalThis as unknown as { __tfHarness?: unknown }).__tfHarness !==
        undefined,
      undefined,
      { timeout: 15_000 },
    );
  });

  test("start/stop lifecycle logs events and notifies listeners", async ({
    page,
  }) => {
    const result = await runScenario<{
      sessionId: string;
      runningAfterStart: boolean;
      runningAfterStop: boolean;
      loggedTypes: string[];
      notified: string[];
    }>(page, "lifecycle");

    expect(result.sessionId).toMatch(/^session-/);
    expect(result.runningAfterStart).toBe(true);
    expect(result.runningAfterStop).toBe(false);
    expect(result.loggedTypes).toContain("start");
    expect(result.loggedTypes).toContain("stop");
    expect(result.notified).toContain("start");
  });

  test("state changes activate sequences and fire deterministic events", async ({
    page,
  }) => {
    const result = await runScenario<{
      from: string;
      to: string;
      currentState: string;
      transitionCount: number;
      activeSequences: string[];
      eventTypes: string[];
      startedSequences: string[];
      resolvedRecipes: string[];
    }>(page, "stateMachine");

    expect(result.from).toBe("idle");
    expect(result.to).toBe("walk");
    expect(result.currentState).toBe("run");
    expect(result.transitionCount).toBe(2);
    expect(result.activeSequences).toEqual(["footsteps_run"]);
    expect(result.eventTypes).toContain("state_change");
    expect(result.eventTypes).toContain("sequence_start");
    expect(result.eventTypes).toContain("event_fire");
    expect(result.startedSequences).toEqual(["footsteps_walk", "footsteps_run"]);
    expect(result.resolvedRecipes.length).toBeGreaterThan(0);
  });

  test("context changes are logged and reflected in inspection", async ({
    page,
  }) => {
    const result = await runScenario<{
      changeCount: number;
      snapshot: Record<string, string>;
      eventTypes: string[];
    }>(page, "context");

    expect(result.changeCount).toBe(1);
    expect(result.snapshot.surface).toBe("gravel");
    expect(result.eventTypes).toContain("context_change");
  });

  test("the same seed produces identical event logs", async ({ page }) => {
    const result = await runScenario<{
      first: unknown[];
      second: unknown[];
      equal: boolean;
    }>(page, "determinism");

    expect(result.first.length).toBeGreaterThan(0);
    expect(result.equal).toBe(true);
  });

  test("built-in recipes render non-silent, deterministic audio", async ({
    page,
  }) => {
    const result = await runScenario<{
      results: Array<{
        name: string;
        length: number;
        sampleRate: number;
        nonSilent: boolean;
        deterministic: boolean;
        seedVaries: boolean;
      }>;
    }>(page, "renderRecipes");

    expect(result.results.length).toBeGreaterThan(0);
    for (const recipe of result.results) {
      expect(recipe.length, `${recipe.name} rendered no samples`).toBeGreaterThan(0);
      expect(recipe.sampleRate, `${recipe.name} sample rate`).toBe(44100);
      expect(recipe.nonSilent, `${recipe.name} rendered silence`).toBe(true);
      expect(recipe.deterministic, `${recipe.name} was not deterministic`).toBe(true);
      expect(recipe.seedVaries, `${recipe.name} ignored the seed`).toBe(true);
    }
  });
});
