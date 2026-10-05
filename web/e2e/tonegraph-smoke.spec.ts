import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  captureConsole,
  findUnknownRecipeWarnings,
  waitForRenderedBufferLength,
  waitForTerminalText,
} from "./helpers/diagnostics";

const NODE_ERROR_PATTERNS = [
  /require is not defined/i,
  /fs is not defined/i,
  /process is not defined/i,
];

const thisFileDir = resolve(fileURLToPath(new URL(".", import.meta.url)));

const CORE_BROWSER_FILES = [
  resolve(thisFileDir, "../../src/core/recipe.ts"),
  resolve(thisFileDir, "../../src/core/tonegraph.ts"),
];

/** Install the render probe the diagnostics helper reads. */
async function installRenderedBufferProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const proto = globalThis.OfflineAudioContext?.prototype as
      | { startRendering?: (...args: unknown[]) => Promise<{ length: number }> }
      | undefined;
    if (!proto || typeof proto.startRendering !== "function") {
      return;
    }

    const original = proto.startRendering;
    proto.startRendering = async function patchedStartRendering(...args: unknown[]) {
      const rendered = await original.apply(this, args);
      (globalThis as { __tfLastRenderedLength?: number }).__tfLastRenderedLength =
        rendered.length;
      return rendered;
    };
  });
}

test.describe("ToneGraph browser smoke", () => {
  test("renders a recipe in browser without Node-only console errors", async ({ page }) => {
    test.setTimeout(120_000);

    await installRenderedBufferProbe(page);

    // Capture console messages up-front so a rendering timeout can report the
    // real cause (e.g. an "Unknown recipe" warning) rather than a bare timeout.
    const consoles = captureConsole(page);

    await page.goto("/");
    await page.waitForSelector(".xterm", { timeout: 10_000 });
    await waitForTerminalText(page, "ToneForge Terminal", 20_000, consoles);

    const demoSelect = page.locator("#demo-select");
    if (await demoSelect.count()) {
      await demoSelect.selectOption("mvp-1");
    }

    const actOneButton = page.locator(".wizard-nav-btn", { hasText: "1/4" });
    await actOneButton.click();

    const runButton = page.locator(".wizard-btn-run");
    await expect(runButton).toBeVisible({ timeout: 5_000 });

    // Scope diagnostics to the Run interaction.
    consoles.clear();
    await runButton.click();

    const renderedBufferLength = await waitForRenderedBufferLength(page, 45_000, consoles);
    expect(renderedBufferLength).toBeGreaterThan(0);

    // The render only happens when the browser recipe registry resolves
    // "ui-scifi-confirm"; if it did not, web/src/audio.ts emits
    // "Unknown recipe ..." and startRendering() is never called. Asserting the
    // warning is absent is the observable proof of registry resolution.
    expect(findUnknownRecipeWarnings(consoles.records)).toHaveLength(0);

    const consoleErrors = consoles.records
      .filter((record) => record.type === "error")
      .map((record) => record.text);
    expect(consoleErrors).toHaveLength(0);

    for (const pattern of NODE_ERROR_PATTERNS) {
      const found = consoleErrors.some((message) => pattern.test(message));
      expect(found).toBe(false);
    }
  });

  test("core modules avoid unconditional Node-only top-level imports", async () => {
    const topLevelNodeImport = /^\s*import\s+.+\s+from\s+["']node:[^"']+["'];?/gm;
    const topLevelRequire =
      /^\s*(const|let|var)\s+.+?=\s*require\(\s*["'](?:node:)?(?:fs|path|url|child_process|os|crypto|http|https|net|tls|dns|worker_threads|zlib|stream|module)[^"']*["']\s*\);?/gm;

    for (const filePath of CORE_BROWSER_FILES) {
      const source = await readFile(filePath, "utf-8");
      expect(source.match(topLevelNodeImport)).toBeNull();
      expect(source.match(topLevelRequire)).toBeNull();
    }
  });
});
