import { expect, test } from "@playwright/test";

/**
 * Browser end-to-end coverage for the embeddable SoundEditor demo.
 *
 * Mounts the editor, edits a control, previews (gesture-gated), exports a WAV
 * and verifies mount/dispose cleanliness. Playwright CSS locators pierce the
 * editor's open shadow DOM.
 */
test.describe("SoundEditor (browser e2e)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/editor-demo.html");
    await expect(
      page.locator('[data-testid="editor-container"] .toneforge-editor'),
    ).toBeVisible();
  });

  test("mounts controls, edits, previews and exports a WAV", async ({ page }) => {
    // Load a known recipe/seed for deterministic assertions.
    await page.locator('[data-testid="recipe-select"]').selectOption("footstep-stone");
    await page.locator('[data-testid="seed-input"]').fill("42");
    await page.locator('[data-testid="load-button"]').click();

    const output = page.locator('[data-testid="preset-output"]');
    await expect(output).toContainText('"recipe": "footstep-stone"');

    // Edit a control (keyboard interaction) and assert the preset updates.
    const control = page.locator('[data-parameter="bodyDecay"]');
    await expect(control).toBeVisible();
    await control.focus();
    await control.press("ArrowRight");
    await expect(output).toContainText("bodyDecay");

    // Preview: gesture gate then playback (or the documented fallback).
    const enable = page.locator(".tf-audition__enable");
    await expect(enable).toBeVisible();
    await enable.click();

    const status = page.locator(".tf-audition__status");
    await expect(status).toHaveText(/Audio enabled|unavailable/i, {
      timeout: 15_000,
    });
    if ((await status.textContent())?.includes("enabled")) {
      await page.locator(".tf-audition__play").click();
      await expect(status).toHaveText(/Playing/i, { timeout: 15_000 });
    }

    // Export triggers a WAV download with a deterministic filename.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('[data-testid="export-button"]').click(),
    ]);
    expect(download.suggestedFilename()).toBe("footstep-stone-seed-42.wav");
  });

  test("dispose empties the container and leaks no globals", async ({ page }) => {
    const before = await page.evaluate(() => Object.keys(window).sort());

    await page.locator('[data-testid="dispose-button"]').click();

    await expect(page.locator('[data-testid="editor-container"]')).toBeEmpty();

    const after = await page.evaluate(() => Object.keys(window).sort());
    expect(after).toEqual(before);
  });
});
