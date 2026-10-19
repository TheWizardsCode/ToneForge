/**
 * Visualise CLI integration tests.
 *
 * Every test in this file invokes the real CLI entrypoint in a child process
 * (via `test/run-yargs-child.ts`), so each invocation cold-boots `tsx` from
 * source before registering the yargs command. Cached full-suite runs put the
 * two-spawn determinism test at a median of ~4.9 s but up to ~20.1 s under
 * heavy parallel load — over the global 20 s `testTimeout` (`vitest.config.ts`),
 * which is exactly how it flaked (TF-0MVE3YXLK001Z4WX). All four tests here
 * therefore override the global budget with an explicit per-test timeout,
 * matching the audited precedent in `src/cli.marketplace.integration.test.ts`
 * (`MULTI_PROCESS_TEST_TIMEOUT`, TF-0MVE3X79Q004NNVJ).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../../test/run-yargs-child.js";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * Per-test timeout for the cold-CLI-spawn cases in this file.
 *
 * Each spawn boots the CLI from source via `bin/dev-cli.js` (which registers
 * `tsx` before importing the yargs entrypoint), so a single spawn costs seconds
 * and multi-spawn cases stack that cost sequentially. Evidence from cached
 * full-suite runs (49 entries): the two-spawn determinism test ranges 2.7 s
 * (min) → 4.9 s (median) → 14.7 s (worst pass) → **20.1 s timeout failure**,
 * and the single-spawn tests reach up to ~12.8 s — both tails inside a factor
 * of ~2 of the global 20 s budget. 60 s gives ~3-4x headroom over the worst
 * observed duration while still surfacing genuine hangs, and matches the
 * `runCli` per-spawn cap (30 s) so a hang ends in a clear assertion failure
 * rather than a Vitest timeout. The global default stays tight for the rest of
 * the suite (TF-0MVE3YXLK001Z4WX).
 */
const CLI_SPAWN_TEST_TIMEOUT = 60_000;

describe("visualize export CLI integration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "toneforge-visual-cli-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("exports a sprite sheet via the yargs entrypoint with JSON output", async () => {
    const { code, stdout, stderr } = await runCli([
      "visualize", "export",
      "--recipe", "weapon-laser-zap",
      "--seed", "42",
      "--format", "spritesheet",
      "--frames", "4",
      "--width", "16",
      "--height", "16",
      "--output", tempDir,
      "--json",
    ]);

    expect(stderr).toBe("");
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("visualize export");
    expect(data.recipe).toBe("weapon-laser-zap");
    expect(data.seed).toBe(42);
    expect(data.effect).toBe("directional_streak");
    expect(data.frameCount).toBe(4);
    expect(existsSync(data.spriteSheet)).toBe(true);
    expect(Array.from(readFileSync(data.spriteSheet).subarray(0, 8))).toEqual(PNG_SIGNATURE);
  }, CLI_SPAWN_TEST_TIMEOUT);

  it("produces byte-identical assets for the same seed and palette", async () => {
    const baseArgs = [
      "visualize", "export",
      "--recipe", "weapon-laser-zap",
      "--seed", "99",
      "--format", "spritesheet",
      "--frames", "3",
      "--width", "12",
      "--height", "12",
      "--json",
    ];
    const first = await runCli([...baseArgs, "--output", join(tempDir, "a")]);
    const second = await runCli([...baseArgs, "--output", join(tempDir, "b")]);
    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    const a = JSON.parse(first.stdout);
    const b = JSON.parse(second.stdout);
    expect(readFileSync(a.spriteSheet).equals(readFileSync(b.spriteSheet))).toBe(true);
  }, CLI_SPAWN_TEST_TIMEOUT);

  it("reports a non-zero exit code for an unsupported format", async () => {
    const { code, stderr } = await runCli([
      "visualize", "export",
      "--recipe", "weapon-laser-zap",
      "--seed", "1",
      "--format", "gif",
      "--output", tempDir,
    ]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/format/);
  }, CLI_SPAWN_TEST_TIMEOUT);

  it("lists visualizer usage via --help", async () => {
    const { code, stdout } = await runCli(["visualize", "export", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("visualize");
    expect(stdout).toContain("--palette");
  }, CLI_SPAWN_TEST_TIMEOUT);
});
