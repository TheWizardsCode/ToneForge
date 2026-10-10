/**
 * `toneforge sync` CLI integration tests.
 *
 * Drives the in-process yargs entrypoint end-to-end against a real
 * on-disk library and asserts the target-specific layout, JSON output,
 * and structured errors (unsupported target, missing flags, blocking
 * validation).
 *
 * Work item: TF-0MUZYS2VP007O99D. Reference: docs/prd/INTEGRATIONS_PRD.md
 * Sections 5.1 (CLI), 6 (Mapping), 9 (Library Sync).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { main } from "./cli.js";
import { captureOutput, createTempDir, addLibraryEntry } from "../test/cli-test-utils.js";

/** Build a fake argv array as if invoked via `node cli.ts <...args>`. */
function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

describe("toneforge sync", () => {
  let tempDir: string;
  let libDir: string;
  let outDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("toneforge-sync-cli-");
    libDir = join(tempDir, "library");
    outDir = join(tempDir, "unity-project", "Assets", "Audio");
    await addLibraryEntry(libDir, {
      id: "impact-crack",
      recipe: "impact-crack",
      duration: 0.25,
      peak: 0.8,
      category: "Impact",
      tags: ["impact", "heavy"],
    });
    await addLibraryEntry(libDir, {
      id: "ui-confirm",
      recipe: "ui-notification-chime",
      duration: 0.3,
      peak: 0.6,
      category: "UI",
      tags: ["ui", "confirm"],
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("syncs a library to Unity and reports the result as JSON", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv(
        "sync", "--target", "unity", "--library", libDir,
        "--output", outDir, "--json",
      )),
    );

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("sync");
    expect(data.target).toBe("unity");
    expect(data.manifest.buildId).toMatch(/^tfs_[0-9a-f]{16}$/);
    expect(data.manifest.audioGroups).toEqual({ Impact: "SFX", UI: "UI" });
    expect(data.written.sort()).toEqual([
      "Assets/Audio/Impact/lib-impact-crack.wav",
      "Assets/Audio/UI/lib-ui-confirm.wav",
    ]);

    expect(existsSync(join(outDir, "manifest.json"))).toBe(true);
    expect(existsSync(join(outDir, "Assets/Audio/Impact/lib-impact-crack.wav"))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8"));
    expect(manifest).toEqual(data.manifest);
  });

  it("writes a flat web layout for --target web", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv(
        "sync", "--target", "web", "--library", libDir,
        "--output", outDir, "--json",
      )),
    );

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.target).toBe("web");
    expect(existsSync(join(outDir, "audio/lib-ui-confirm.wav"))).toBe(true);
    expect(existsSync(join(outDir, "Assets"))).toBe(false);
  });

  it("emits a structured error for an unsupported target", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv(
        "sync", "--target", "godot", "--library", libDir,
        "--output", outDir, "--json",
      )),
    );

    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(data.code).toBe("unsupported_target");
    expect(data.target).toBe("godot");
    expect(data.supportedTargets).toEqual(["unity", "web"]);
    expect(data.error).toContain("godot");
    expect(existsSync(outDir)).toBe(false);
  });

  it("emits a machine-parseable error when --target is missing", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("sync", "--library", libDir, "--output", outDir, "--json")),
    );

    expect(code).toBe(1);
    expect(JSON.parse(stderr).error).toContain("--target");
  });

  it("emits a machine-parseable error when --output is missing", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("sync", "--target", "unity", "--library", libDir, "--json")),
    );

    expect(code).toBe(1);
    expect(JSON.parse(stderr).error).toContain("--output");
  });

  it("fails with a structured validation error when the library is invalid", async () => {
    const badDir = join(tempDir, "bad-library");
    await addLibraryEntry(badDir, {
      id: "broken-blast",
      recipe: "impact-crack",
      duration: 0.5,
      peak: 1.2,
      category: "Impact",
      tags: ["impact"],
    });

    const { code, stderr } = await captureOutput(() =>
      main(argv(
        "sync", "--target", "unity", "--library", badDir,
        "--output", join(tempDir, "bad-out"), "--json",
      )),
    );

    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(data.code).toBe("validation_failed");
    expect(data.validation.blocking).toBe(true);
  });

  it("documents every option in --help", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("sync", "--help")));

    expect(code).toBe(0);
    expect(stdout).toContain("--target");
    expect(stdout).toContain("--library");
    expect(stdout).toContain("--output");
    expect(stdout).toContain("--json");
  });
});
