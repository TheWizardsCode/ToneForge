/**
 * Integration tests for the machine-use reporting script.
 *
 * Exercises `scripts/report-available-sounds.sh` end-to-end against the
 * committed fixture and a known category, asserting filtering correctness,
 * JSON validity, and field presence.  Also verifies the empty-result path
 * (all items used) exits 0.
 *
 * Work item: TF-0MUX0XKCC0088GV4
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Project paths
// ---------------------------------------------------------------------------

/** Project root (grandparent of this test file which lives in `src/demo/`). */
const PROJECT_ROOT = resolve(import.meta.dirname, "..", "..");

/** Path to the reporting script. */
const REPORT_SCRIPT = join(PROJECT_ROOT, "scripts", "report-available-sounds.sh");

/** Path to the committed fixture. */
const FIXTURE_FILE = join(PROJECT_ROOT, "demos", "fixtures", "used-sounds.txt");

/** Verify paths at import time to catch mistakes early. */
if (!existsSync(REPORT_SCRIPT)) {
  throw new Error(
    `REPORT_SCRIPT not found at ${REPORT_SCRIPT} — fix PROJECT_ROOT`,
  );
}
if (!existsSync(FIXTURE_FILE)) {
  throw new Error(
    `FIXTURE_FILE not found at ${FIXTURE_FILE} — fix PROJECT_ROOT`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run the reporting script and return stdout + exit code. */
function runScript(args: string[] = []): { code: number; stdout: string; stderr: string } {
  const result = execFileSync("bash", [REPORT_SCRIPT, ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    timeout: 30_000,
  });
  return { code: 0, stdout: result, stderr: "" };
}

/** Run the reporting script and capture errors when the script exits non-zero. */
function runScriptThrows(args: string[] = []): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("bash", [REPORT_SCRIPT, ...args], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err: unknown) {
    const childErr = err as { status: number; stdout: Buffer; stderr: Buffer };
    return {
      code: childErr.status ?? 1,
      stdout: childErr.stdout?.toString() ?? "",
      stderr: childErr.stderr?.toString() ?? "",
    };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("report-available-sounds.sh", () => {
  // -----------------------------------------------------------------------
  // AC1: script exists
  // -----------------------------------------------------------------------
  it("script file exists and is executable", () => {
    expect(existsSync(REPORT_SCRIPT)).toBe(true);
    expect(() => {
      // stat to check executable bit
      const fs = require("node:fs");
      const stats = fs.statSync(REPORT_SCRIPT);
      expect(stats.mode & 0o111).toBeGreaterThan(0);
    }).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // AC2: used-sounds fixture exists
  // -----------------------------------------------------------------------
  it("used-sounds fixture exists", () => {
    expect(existsSync(FIXTURE_FILE)).toBe(true);
    const content = readFileSync(FIXTURE_FILE, "utf-8");
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    expect(lines.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // AC4a: filtering — used recipes excluded, non-used included
  // -----------------------------------------------------------------------
  it("human-readable output excludes used recipes and includes remaining", () => {
    const { stdout } = runScript();

    // The fixture has 9 used sounds; card-game has 35 total recipes.
    // So remaining should be 26.
    expect(stdout).toContain("Already used:    9");
    expect(stdout).toContain("Remaining:       26");

    // Used recipes should NOT appear in the remaining candidates list
    const usedNames = [
      "card-flip",
      "card-slide",
      "card-place",
      "card-draw",
      "card-shuffle",
      "card-success",
      "card-failure",
      "card-victory-fanfare",
      "card-defeat-sting",
    ];

    // Parse the remaining section — after "Remaining candidates:"
    const remainingSection = stdout.split("Remaining candidates:")[1] ?? "";
    for (const name of usedNames) {
      expect(remainingSection).not.toContain(name);
    }

    // Non-used recipes should appear
    expect(remainingSection).toContain("card-fan");
    expect(remainingSection).toContain("card-discard");
    expect(remainingSection).toContain("card-transform");
  });

  // -----------------------------------------------------------------------
  // AC4b: --json report is valid JSON with expected fields
  // -----------------------------------------------------------------------
  it("JSON report is valid and contains expected fields", () => {
    const { stdout } = runScript(["--json"]);

    const report = JSON.parse(stdout) as Record<string, unknown>;

    // Required top-level fields (AC4b)
    expect(report.command).toBe("report-available-sounds");
    expect(typeof report.category).toBe("string");
    expect(typeof report.total).toBe("number");
    expect(typeof report.used).toBe("number");
    expect(typeof report.remaining).toBe("number");
    expect(Array.isArray(report.candidates)).toBe(true);

    // Count assertions
    expect(report.total).toBe(35);
    expect(report.used).toBe(9);
    expect(report.remaining).toBe(26);
    expect(report.candidates.length).toBe(26);

    // Each candidate must have the expected fields
    for (const candidate of report.candidates as Array<Record<string, unknown>>) {
      expect(typeof candidate.name).toBe("string");
      expect(typeof candidate.description).toBe("string");
      expect(typeof candidate.category).toBe("string");
      expect(Array.isArray(candidate.tags)).toBe(true);
    }
  });

  // -----------------------------------------------------------------------
  // AC4c: empty result (all items used) exits 0
  // -----------------------------------------------------------------------
  it(
    "empty candidate list exits 0 with success message",
    () => {
      const tempDir = mkdtempSync(join(tmpdir(), "toneforge-machine-use-"));
    try {
      // Create a file with ALL card-game recipe names
      const allRecipes = execFileSync(
        "npx",
        ["toneforge", "list", "recipes", "--category", "card-game", "--json"],
        { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 30_000 },
      );
      const recipeNames = JSON.parse(allRecipes)
        .recipes.map((r: { name: string }) => r.name)
        .join("\n");

      const allUsedFile = join(tempDir, "all-used.txt");
      writeFileSync(allUsedFile, recipeNames + "\n", "utf-8");

      const { stdout, code } = runScriptThrows([
        "--category", "card-game",
        "--used-sounds", allUsedFile,
      ]);

      expect(code).toBe(0);
      expect(stdout).toContain("All recipes in this category are already used.");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 15_000);

  // -----------------------------------------------------------------------
  // AC2: error — missing used-sounds file exits non-zero
  // -----------------------------------------------------------------------
  it("missing used-sounds file exits non-zero with diagnostic", () => {
    const { code, stderr } = runScriptThrows([
      "--used-sounds", "/nonexistent/path/used-sounds.txt",
    ]);

    expect(code).toBeGreaterThan(0);
    expect(stderr).toContain("used-sounds file not found");
  });
});
