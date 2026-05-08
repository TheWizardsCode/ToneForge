import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

async function getTerminalText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const rows = document.querySelectorAll(".xterm-accessibility .xterm-accessibility-tree div");
    if (rows.length > 0) {
      return Array.from(rows)
        .map((row) => row.textContent ?? "")
        .join("\n");
    }

    const fallbackRows = document.querySelectorAll(".xterm-rows > div");
    return Array.from(fallbackRows)
      .map((row) => row.textContent ?? "")
      .join("\n");
  });
}

async function waitForTerminalText(page: Page, expected: string, timeoutMs: number): Promise<string> {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    last = await getTerminalText(page);
    if (last.includes(expected)) {
      return last;
    }
    await page.waitForTimeout(400);
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for terminal text: ${expected}.\n` +
      `Last output:\n${last.slice(0, 2000)}`,
  );
}

async function waitForRenderedBufferLength(page: Page, timeoutMs: number): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const length = await page.evaluate(() => {
      const value = (globalThis as { __tfLastRenderedLength?: unknown }).__tfLastRenderedLength;
      return typeof value === "number" ? value : 0;
    });
    if (length > 0) {
      return length;
    }
    await page.waitForTimeout(200);
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for non-zero rendered buffer length.`);
}

test.describe("ToneGraph browser smoke", () => {
  test("renders a recipe in browser without Node-only console errors", async ({ page }) => {
    test.setTimeout(120_000);

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
        (globalThis as { __tfLastRenderedLength?: number }).__tfLastRenderedLength = rendered.length;
        return rendered;
      };
    });

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      // Forward browser console messages to the test runner stdout for debugging
      // so we can see diagnostic logs added to web/src/audio.ts during e2e runs.
      // eslint-disable-next-line no-console
      console.log(`[PW-${msg.type()}] ${msg.text()}`);
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForSelector(".xterm", { timeout: 10_000 });
    await waitForTerminalText(page, "ToneForge Terminal", 20_000);

    const demoSelect = page.locator("#demo-select");
    if (await demoSelect.count()) {
      await demoSelect.selectOption("mvp-1");
    }

    const actOneButton = page.locator(".wizard-nav-btn", { hasText: "1/4" });
    await actOneButton.click();

    const runButton = page.locator(".wizard-btn-run");
    await expect(runButton).toBeVisible({ timeout: 5_000 });

    consoleErrors.length = 0;
    await runButton.click();

    const renderedBufferLength = await waitForRenderedBufferLength(page, 45_000);
    expect(renderedBufferLength).toBeGreaterThan(0);

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
