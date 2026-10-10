/**
 * `toneforge pipeline` CLI integration tests.
 *
 * Drives the in-process yargs entrypoint end-to-end against the offline
 * Integrations fixture manifests and asserts the structured JSON run
 * result, the produced library/compile/export output, and the non-zero
 * exit code when a stage fails.
 *
 * Work item: TF-0MUZYS3IX008OIF5. Reference: docs/prd/INTEGRATIONS_PRD.md
 * Sections 4.2 (Build Systems & CI), 7 (Deterministic Build Integration),
 * 10 (Validation & Compliance).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { main } from "./cli.js";
import { fixturePath } from "./integrations/index.js";
import { captureOutput, createTempDir } from "../test/cli-test-utils.js";

/** Heavy end-to-end tests render real audio; allow generous headroom. */
const TIMEOUT = 120_000;

/** Build a fake argv array as if invoked via `node cli.ts <...args>`. */
function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

describe("toneforge pipeline", () => {
  let tempDir: string;
  let libDir: string;
  let outDir: string;
  let compileDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("toneforge-pipeline-cli-");
    libDir = join(tempDir, "library");
    outDir = join(tempDir, "export");
    compileDir = join(tempDir, "compile");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("runs the full pipeline and reports a structured JSON result", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv(
        "pipeline",
        "--sounds", fixturePath("valid"),
        "--library", libDir,
        "--output", outDir,
        "--compile-dir", compileDir,
        "--json",
      )),
    );

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("pipeline");
    expect(data.status).toBe("ok");
    expect(data.failedStage).toBeNull();
    expect(data.stageLogs.map((log: { stage: string }) => log.stage)).toEqual([
      "generate",
      "validate",
      "compile",
      "export",
    ]);
    expect(data.stageLogs.every((log: { status: string }) => log.status === "ok")).toBe(true);

    expect(existsSync(join(libDir, "index.json"))).toBe(true);
    expect(existsSync(join(compileDir, "manifest.json"))).toBe(true);
    expect(existsSync(outDir)).toBe(true);
  }, TIMEOUT);

  it("exits non-zero and stops at the failing validation stage", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv(
        "pipeline",
        "--sounds", fixturePath("invalid"),
        "--library", libDir,
        "--output", outDir,
        "--compile-dir", compileDir,
        "--json",
      )),
    );

    expect(code).toBe(1);
    const data = JSON.parse(stdout);
    expect(data.status).toBe("failed");
    expect(data.failedStage).toBe("validate");
    expect(data.stageLogs.map((log: { stage: string }) => log.stage)).toEqual([
      "generate",
      "validate",
    ]);
    expect(data.stageLogs[1].status).toBe("failed");
    expect(data.stageLogs[1].error.code).toBe("validation_failed");

    // Later stages must not have produced output.
    expect(existsSync(compileDir)).toBe(false);
    expect(existsSync(outDir)).toBe(false);
  }, TIMEOUT);

  it("emits a structured error when --sounds is missing", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("pipeline", "--output", outDir, "--json")),
    );

    expect(code).toBe(1);
    expect(JSON.parse(stderr).error).toContain("--sounds");
  });
});
