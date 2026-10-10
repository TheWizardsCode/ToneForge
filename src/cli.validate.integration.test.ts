import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readdir, rm } from "node:fs/promises";
import { main } from "./cli.js";
import { parseValidateArgs } from "./cli/commands/validate.js";
import { captureOutput, createTempDir, addLibraryEntry } from "../test/cli-test-utils.js";

/** Build a fake argv array as if invoked via `node cli.ts <...args>`. */
function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

describe("toneforge validate", () => {
  let libDir: string;

  beforeEach(async () => {
    libDir = await createTempDir("toneforge-validate-");
  });

  afterEach(async () => {
    await rm(libDir, { recursive: true, force: true });
  });

  it("emits a structured JSON report to stdout", async () => {
    await addLibraryEntry(libDir, { id: "good", duration: 0.2, peak: 0.6 });

    const { code, stdout } = await captureOutput(() =>
      main(argv("validate", "--library", libDir, "--ruleset", "web", "--strictness", "warning", "--json")),
    );

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("validate");
    expect(data.library).toBe(libDir);
    expect(data.ruleset).toBe("web");
    expect(data.strictness).toBe("warning");
    expect(data.entryCount).toBe(1);
    expect(data.status).toBe("pass");
    expect(data.blocking).toBe(false);
    expect(data.counts).toMatchObject({ pass: 3, info: 0, warning: 0, error: 0, skipped: 0 });
    expect(data.perCheck.peak_clipping.pass).toBe(1);
    expect(data.perCheck.duration_bounds.pass).toBe(1);
    expect(data.perCheck.silence_ratio.pass).toBe(1);
    expect(data.assets).toHaveLength(1);
    expect(data.assets[0].assetId).toBe("lib-good");
  });

  it("reports violations at the requested strictness and blocks on errors", async () => {
    await addLibraryEntry(libDir, { id: "bad", duration: 2.0, peak: 0.99, silentFraction: 0.5 });

    const blocked = await captureOutput(() =>
      main(argv("validate", "--library", libDir, "--ruleset", "mobile", "--strictness", "error", "--json")),
    );
    expect(blocked.code).toBe(1);
    const blockedData = JSON.parse(blocked.stdout);
    expect(blockedData.status).toBe("error");
    expect(blockedData.blocking).toBe(true);
    expect(blockedData.counts.error).toBe(3);

    const warned = await captureOutput(() =>
      main(argv("validate", "--library", libDir, "--ruleset", "mobile", "--strictness", "warning", "--json")),
    );
    expect(warned.code).toBe(0);
    const warnedData = JSON.parse(warned.stdout);
    expect(warnedData.status).toBe("warning");
    expect(warnedData.blocking).toBe(false);
    expect(warnedData.counts.warning).toBe(3);
  });

  it("defaults to the web ruleset and warning strictness", async () => {
    await addLibraryEntry(libDir, { id: "bad", duration: 2.0, peak: 0.99, silentFraction: 0.5 });

    const { code, stdout } = await captureOutput(() =>
      main(argv("validate", "--library", libDir, "--json")),
    );

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.ruleset).toBe("web");
    expect(data.strictness).toBe("warning");
    expect(data.blocking).toBe(false);
  });

  it("does not modify the library", async () => {
    await addLibraryEntry(libDir, { id: "good", duration: 0.2, peak: 0.6 });
    const before = (await readdir(libDir)).sort();

    const { code } = await captureOutput(() =>
      main(argv("validate", "--library", libDir, "--json")),
    );

    expect(code).toBe(0);
    expect((await readdir(libDir)).sort()).toEqual(before);
  });

  it("emits a machine-parseable JSON error for an unknown ruleset", async () => {
    const { code, stdout, stderr } = await captureOutput(() =>
      main(argv("validate", "--library", libDir, "--ruleset", "nope", "--json")),
    );

    expect(code).toBe(1);
    expect(stdout).toBe("");
    const data = JSON.parse(stderr);
    expect(data.error).toContain("Unknown ruleset 'nope'");
    expect(data.error).toContain("mobile, web, console, desktop");
  });

  it("emits a machine-parseable JSON error for an invalid strictness", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("validate", "--library", libDir, "--strictness", "loud", "--json")),
    );

    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(data.error).toContain("Invalid strictness 'loud'");
    expect(data.error).toContain("info, warning, error");
  });

  it("emits a machine-parseable JSON error for a valueless flag", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("validate", "--library", "--json")),
    );

    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(data.error).toBe("--library requires a value.");
  });

  it("renders a human-readable summary without --json", async () => {
    await addLibraryEntry(libDir, { id: "bad", duration: 2.0, peak: 0.99, silentFraction: 0.5 });

    const { code, stdout } = await captureOutput(() =>
      main(argv("validate", "--library", libDir, "--ruleset", "mobile", "--strictness", "warning")),
    );

    expect(code).toBe(0);
    expect(stdout).toContain("Validation");
    expect(stdout).toContain("mobile");
    expect(stdout).toContain("lib-bad");
    expect(stdout).toContain("warning");
  });

  it("documents every option in --help", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("validate", "--help")));

    expect(code).toBe(0);
    expect(stdout).toContain("--library");
    expect(stdout).toContain("--ruleset");
    expect(stdout).toContain("--strictness");
    expect(stdout).toContain("--json");
  });
});

describe("parseValidateArgs", () => {
  it("applies defaults", () => {
    expect(parseValidateArgs({})).toEqual({
      libraryDir: ".toneforge-library",
      ruleset: "web",
      strictness: "warning",
    });
  });

  it("normalises explicit values", () => {
    expect(
      parseValidateArgs({ library: "./lib", ruleset: "console", strictness: "error" }),
    ).toEqual({ libraryDir: "./lib", ruleset: "console", strictness: "error" });
  });

  it("rejects unknown rulesets and strictness levels", () => {
    expect(() => parseValidateArgs({ ruleset: "nope" })).toThrow(/Unknown ruleset/);
    expect(() => parseValidateArgs({ strictness: "loud" })).toThrow(/Invalid strictness/);
  });

  it("rejects a valueless flag", () => {
    expect(() => parseValidateArgs({ library: true })).toThrow(/--library requires a value/);
  });
});
