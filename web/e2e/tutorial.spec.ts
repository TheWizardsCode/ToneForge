/**
 * Playwright E2E test: Full tutorial walkthrough.
 *
 * Starts the web demo server, loads the page in a real browser, and steps
 * through every wizard step clicking Run buttons and verifying that the
 * terminal receives and executes each command successfully.
 *
 * Timeouts report the true root cause via the shared diagnostics helper
 * (`./helpers/diagnostics`), so a missing `toneforge` binary surfaces
 * "command not found" rather than a generic "Timed out waiting for terminal
 * text". Work item: TF-0MUVK0K230013UC3.
 *
 * Prerequisites (handled by playwright.config.ts webServer):
 *   - Root project built:  npm run build       (in project root)
 *   - Web project built:   npm run build       (in web/)
 *   - Server started:      node dist-server/index.js  (in web/)
 */
import { test, expect, type Page } from "@playwright/test";
import {
  captureConsole,
  waitForTerminalText,
  type ConsoleCapture,
} from "./helpers/diagnostics";

// -- Helpers ----------------------------------------------------------

/**
 * Wait until the terminal shows the output that means a command finished.
 *
 * For vitest commands (act-4) we wait for the test summary; for generate
 * commands we wait for the rendered output; otherwise we wait for the next
 * shell prompt. All waits go through the diagnostics helper so a shell error
 * is reported explicitly.
 */
async function waitForCommandCompletion(
  page: Page,
  command: string,
  timeoutMs = 60_000,
  capture?: ConsoleCapture,
): Promise<string> {
  if (command.includes("vitest")) {
    return waitForTerminalText(page, "Tests", timeoutMs, capture);
  }

  if (command.includes("generate")) {
    return waitForTerminalText(page, "Rendered", timeoutMs, capture);
  }

  return waitForTerminalText(page, "$", timeoutMs, capture);
}

// -- Tests ------------------------------------------------------------

test.describe("Tutorial walkthrough", () => {
  test("loads the page and shows the header", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("ToneForge Web Demo");
    await expect(page.locator("header h1")).toHaveText("ToneForge Web Demo");
  });

  test("renders all 6 wizard step navigation buttons", async ({ page }) => {
    await page.goto("/");
    const navButtons = page.locator(".wizard-nav-btn");
    await expect(navButtons).toHaveCount(6);

    // Verify labels
    const labels = await navButtons.allTextContents();
    expect(labels).toEqual(["Intro", "1/4", "2/4", "3/4", "4/4", "Recap"]);
  });

  test("terminal connects and shows banner", async ({ page }) => {
    // Collect browser console messages to verify connection logging
    const consoles = captureConsole(page);

    await page.goto("/");

    // Wait for the terminal to render something
    await page.waitForSelector(".xterm", { timeout: 10_000 });

    // The terminal should show the "ToneForge Terminal" banner on connect
    await waitForTerminalText(page, "ToneForge Terminal", 15_000, consoles);

    // Verify console shows connection logs (no silent failures)
    const toneForgeMessages = consoles.records.filter((record) =>
      record.text.includes("[ToneForge]"),
    );
    expect(toneForgeMessages.length).toBeGreaterThan(0);
    expect(
      toneForgeMessages.some((record) => record.text.includes("WebSocket connected")),
    ).toBe(true);

    // No AudioContext errors on page load
    const audioContextErrors = consoles.records.filter(
      (record) => record.type === "error" && record.text.includes("AudioContext"),
    );
    expect(audioContextErrors).toHaveLength(0);
  });

  test("PTY environment exposes a resolvable toneforge command", async ({ page }) => {
    const consoles = captureConsole(page);

    await page.goto("/");
    await page.waitForSelector(".xterm", { timeout: 10_000 });
    await waitForTerminalText(page, "ToneForge Terminal", 15_000, consoles);

    // Drive the PTY directly through xterm's hidden input textarea. The marker
    // is computed at runtime so the shell's command echo cannot satisfy the
    // wait before the command actually runs.
    const terminalInput = page.locator(".xterm-helper-textarea");
    await terminalInput.click();
    await page.keyboard.type("toneforge version >/dev/null && echo TONEFORGE_READY_$((6*7))");
    await page.keyboard.press("Enter");

    // If `toneforge` is missing, bash prints "toneforge: command not found"
    // and the diagnostics helper fails naming that error.
    const terminalText = await waitForTerminalText(
      page,
      "TONEFORGE_READY_42",
      20_000,
      consoles,
    );
    expect(terminalText).toContain("TONEFORGE_READY_42");
  });

  test("full tutorial: click Run on every step and verify terminal output", async ({ page }) => {
    test.setTimeout(180_000); // 3 minutes for the full walkthrough

    // Collect console messages to verify commands are sent
    const consoles = captureConsole(page);

    await page.goto("/");

    // Wait for terminal to connect
    await page.waitForSelector(".xterm", { timeout: 10_000 });
    await waitForTerminalText(page, "ToneForge Terminal", 15_000, consoles);

    // Wait for the shell prompt to appear
    await waitForTerminalText(page, "$", 15_000, consoles);

    // Step definitions: map step button labels to expected behaviour
    const steps = [
      {
        label: "Intro",
        hasRun: false,
        title: "ToneForge MVP Demo",
      },
      {
        label: "1/4",
        hasRun: true,
        title: "Unblock your build on day one",
        // Command: toneforge generate --recipe ui-scifi-confirm --seed 42
        expectInTerminal: "Rendered",
      },
      {
        label: "2/4",
        hasRun: true,
        title: "Explore the design space",
        // Commands: 3 generate commands with seeds 100, 9999, 7
        expectInTerminal: "seed 7", // last command's seed
      },
      {
        label: "3/4",
        hasRun: true,
        title: "Reproducible placeholders",
        // Command: generate --seed 42
        expectInTerminal: "seed 42",
      },
      {
        label: "4/4",
        hasRun: true,
        title: "Determinism you can verify in CI",
        // Command: npx vitest run src/core/renderer.test.ts
        expectInTerminal: "Tests",
      },
      {
        label: "Recap",
        hasRun: false,
        title: "What you just saw",
      },
    ];

    for (const step of steps) {
      // Click the step's nav button
      const navBtn = page.locator(".wizard-nav-btn", { hasText: step.label });
      await navBtn.click();

      // Verify the step title renders
      await expect(page.locator(".wizard-step-title")).toContainText(step.title, {
        timeout: 5_000,
      });

      // Verify the nav button is marked active
      await expect(navBtn).toHaveClass(/active/);

      if (step.hasRun) {
        // Click the Run button
        const runBtn = page.locator(".wizard-btn-run");
        await expect(runBtn).toBeVisible({ timeout: 5_000 });
        await runBtn.click();

        // Wait for the expected output in the terminal
        const termText = await waitForCommandCompletion(
          page,
          step.label === "4/4" ? "vitest" : "generate",
          step.label === "4/4" ? 90_000 : 30_000, // vitest takes longer
          consoles,
        );

        // Basic sanity: terminal should have some output
        expect(termText.length).toBeGreaterThan(0);

        // Wait for the wizard's global run guard to clear before the next
        // step — the Run button is disabled and re-labelled while a command
        // is executing. This replaces a fixed sleep with an explicit wait.
        await expect(runBtn).toBeEnabled({ timeout: 15_000 });
        await expect(runBtn).not.toHaveClass(/wizard-btn-running/, {
          timeout: 15_000,
        });
      }
    }

    // After the full walkthrough, verify that commands were actually sent
    // (not silently swallowed by a disconnected WebSocket)
    const sendMessages = consoles.records.filter((record) =>
      record.text.includes("[ToneForge] Executing command:"),
    );
    // Acts 1-4 send commands: 1 + 3 + 1 + 1 = 6 commands total
    expect(sendMessages.length).toBe(6);

    // No AudioContext errors during the walkthrough
    const audioContextErrors = consoles.records.filter(
      (record) => record.type === "error" && record.text.includes("AudioContext"),
    );
    expect(audioContextErrors).toHaveLength(0);
  });

  test("wizard navigation with Next/Back buttons works", async ({ page }) => {
    await page.goto("/");

    // Should start on Intro (first nav button active)
    const firstNav = page.locator(".wizard-nav-btn").first();
    await expect(firstNav).toHaveClass(/active/);

    // Intro should not have a Back button
    await expect(page.locator(".wizard-btn-prev")).toHaveCount(0);

    // Click Next through all steps
    for (let i = 0; i < 5; i++) {
      const nextBtn = page.locator(".wizard-btn-next");
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();
      await page.waitForTimeout(300);
    }

    // Should now be on Recap (last step) — no Next button
    await expect(page.locator(".wizard-btn-next")).toHaveCount(0);
    await expect(page.locator(".wizard-step-title")).toContainText("What you just saw");

    // Click Back to go to 4/4
    const backBtn = page.locator(".wizard-btn-prev");
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page.locator(".wizard-step-title")).toContainText("Determinism");
  });
});
