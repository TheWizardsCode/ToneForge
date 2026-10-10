import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { main } from "./cli.js";
import {
  parseCompileArgs,
  parseCompileRuleset,
  parseMatchRule,
  resolveCompileRuleset,
} from "./cli/commands/compile.js";
import { getCompileRuleset, hashBytes, MANIFEST_FILE } from "./compiler/index.js";
import { captureOutput, createTempDir, addLibraryEntry } from "../test/cli-test-utils.js";

/** Build a fake argv array as if invoked via `node cli.ts <...args>`. */
function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

describe("toneforge compile", () => {
  let libDir: string;
  let outDir: string;
  let tempDir: string;
  let rulesFile: string;

  beforeEach(async () => {
    tempDir = await createTempDir("toneforge-compile-");
    libDir = join(tempDir, "library");
    outDir = join(tempDir, "dist");
    rulesFile = join(tempDir, "rules.json");
    await addLibraryEntry(libDir, { id: "a", duration: 0.5, peak: 0.6 });
    await addLibraryEntry(libDir, { id: "b", duration: 1.2, peak: 0.6 });
    await writeFile(rulesFile, JSON.stringify({ target: "web", bake: { durationAbove: 0.05 } }));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("shows decisions without writing files on --dry-run", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv(
        "compile", "--library", libDir, "--target", "web",
        "--rules", "web_defaults", "--dry-run", "--json",
      )),
    );

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("compile");
    expect(data.dryRun).toBe(true);
    expect(data.target).toBe("web");
    expect(data.written).toEqual([]);
    expect(data.plan.decisions.map((d: { decision: string }) => d.decision)).toEqual([
      "procedural",
      "hybrid",
    ]);
    expect(data.manifest.buildId).toMatch(/^tfc_[0-9a-f]{16}$/);
    // Dry run writes nothing, including the default output directory.
    expect(existsSync(join(outDir, MANIFEST_FILE))).toBe(false);
  });

  it("compiles and writes artifacts for a rules file", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv(
        "compile", "--library", libDir, "--target", "web",
        "--rules", rulesFile, "--output", outDir, "--json",
      )),
    );

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.dryRun).toBe(false);
    expect(data.written.sort()).toEqual([
      "uncategorized/lib-a.wav",
      "uncategorized/lib-b.wav",
    ]);

    expect(existsSync(join(outDir, MANIFEST_FILE))).toBe(true);
    const manifest = JSON.parse(await readFile(join(outDir, MANIFEST_FILE), "utf8"));
    expect(manifest).toEqual(data.manifest);

    for (const asset of manifest.assets) {
      expect(asset.decision).toBe("baked");
      const bytes = readFileSync(join(outDir, asset.file));
      expect(asset.bytes).toBe(bytes.length);
      expect(asset.hash).toBe(hashBytes(bytes));
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    }
  });

  it("accepts a built-in ruleset name", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv(
        "compile", "--library", libDir, "--target", "web",
        "--rules", "web_defaults", "--output", outDir, "--json",
      )),
    );

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.plan.decisions.map((d: { decision: string }) => d.decision)).toEqual([
      "procedural",
      "hybrid",
    ]);
    // Only the hybrid asset emits a WAV.
    expect(data.written).toEqual(["uncategorized/lib-b.wav"]);
  });

  it("lets --target override the ruleset target", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv(
        "compile", "--library", libDir, "--target", "mobile",
        "--rules", rulesFile, "--output", outDir, "--json",
      )),
    );

    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.target).toBe("mobile");
    expect(data.manifest.target).toBe("mobile");
  });

  it("emits a machine-parseable JSON error when --output is missing", async () => {
    const { code, stdout, stderr } = await captureOutput(() =>
      main(argv("compile", "--library", libDir, "--target", "web", "--json")),
    );

    expect(code).toBe(1);
    expect(stdout).toBe("");
    const data = JSON.parse(stderr);
    expect(data.error).toContain("--output <dir> is required");
  });

  it("emits a machine-parseable JSON error when neither --target nor --rules is given", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("compile", "--library", libDir, "--output", outDir, "--json")),
    );

    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(data.error).toContain("--target");
    expect(data.error).toContain("--rules");
  });

  it("emits a machine-parseable JSON error for an unreadable rules file", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv(
        "compile", "--library", libDir, "--target", "web",
        "--rules", join(tempDir, "missing.json"), "--output", outDir, "--json",
      )),
    );

    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(data.error).toContain("Failed to read compile ruleset");
  });

  it("emits a machine-parseable JSON error for malformed rules JSON", async () => {
    const badFile = join(tempDir, "bad.json");
    await writeFile(badFile, "{ not json");

    const { code, stderr } = await captureOutput(() =>
      main(argv(
        "compile", "--library", libDir, "--target", "web",
        "--rules", badFile, "--output", outDir, "--json",
      )),
    );

    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(data.error).toContain("is not valid JSON");
  });

  it("emits a machine-parseable JSON error for a ruleset without a target", async () => {
    const badFile = join(tempDir, "no-target.json");
    await writeFile(badFile, JSON.stringify({ bake: {} }));

    const { code, stderr } = await captureOutput(() =>
      main(argv(
        "compile", "--library", libDir, "--target", "web",
        "--rules", badFile, "--output", outDir, "--json",
      )),
    );

    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(data.error).toContain("missing a non-empty 'target'");
  });

  it("documents every option in --help", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("compile", "--help")));

    expect(code).toBe(0);
    expect(stdout).toContain("--library");
    expect(stdout).toContain("--target");
    expect(stdout).toContain("--rules");
    expect(stdout).toContain("--output");
    expect(stdout).toContain("--dry-run");
    expect(stdout).toContain("--json");
  });
});

describe("compile argument parsing", () => {
  it("parses a built-in ruleset name and requires output unless dry-run", async () => {
    const args = await parseCompileArgs({
      library: "./lib",
      rules: "web_defaults",
      output: "./dist",
    });
    expect(args.libraryDir).toBe("./lib");
    expect(args.ruleset).toEqual(getCompileRuleset("web_defaults"));
    expect(args.outputDir).toBe("./dist");
    expect(args.dryRun).toBe(false);

    await expect(parseCompileArgs({ rules: "web_defaults" })).rejects.toThrow(
      /--output <dir> is required/,
    );
  });

  it("defaults the output directory for a dry run", async () => {
    const args = await parseCompileArgs({ target: "console", "dry-run": true });
    expect(args.dryRun).toBe(true);
    expect(args.ruleset).toEqual({ target: "console" });
    expect(args.outputDir).toBe("dist/console");
  });

  it("resolves a ruleset from a JSON file and applies the target override", async () => {
    const dir = await createTempDir("toneforge-rules-");
    try {
      const file = join(dir, "custom.json");
      await writeFile(file, JSON.stringify({ target: "web", hybrid: { durationAbove: 0.5 } }));
      await expect(resolveCompileRuleset(file, undefined, dir)).resolves.toEqual({
        target: "web",
        hybrid: { durationAbove: 0.5 },
      });
      await expect(resolveCompileRuleset(file, "mobile", dir)).resolves.toEqual({
        target: "mobile",
        hybrid: { durationAbove: 0.5 },
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("requires at least one of --target or --rules", async () => {
    await expect(resolveCompileRuleset(undefined, undefined)).rejects.toThrow(
      /requires --target/,
    );
  });

  it("ships example ruleset files matching the built-ins", async () => {
    await expect(resolveCompileRuleset("presets/compile/web_defaults.json", undefined)).resolves.toEqual(
      getCompileRuleset("web_defaults"),
    );
    await expect(
      resolveCompileRuleset("presets/compile/mobile_aggressive.json", undefined),
    ).resolves.toEqual(getCompileRuleset("mobile_aggressive"));
  });

  it("validates the ruleset JSON shape", () => {
    expect(parseCompileRuleset({ target: "web" }, "inline")).toEqual({ target: "web" });
    expect(parseCompileRuleset({ target: "web", maxVoices: 16 }, "inline")).toEqual({
      target: "web",
      maxVoices: 16,
    });
    expect(() => parseCompileRuleset([], "inline")).toThrow(/must be a JSON object/);
    expect(() => parseCompileRuleset({}, "inline")).toThrow(/missing a non-empty 'target'/);
    expect(() => parseCompileRuleset({ target: "web", maxVoices: "lots" }, "inline")).toThrow(
      /'maxVoices' must be a number/,
    );
  });

  it("validates individual match rules", () => {
    expect(parseMatchRule(undefined, "inline", "bake")).toBeUndefined();
    expect(parseMatchRule({ category: ["Impact"], tags: ["heavy"] }, "inline", "bake")).toEqual({
      category: ["Impact"],
      tags: ["heavy"],
    });
    expect(() => parseMatchRule("nope", "inline", "bake")).toThrow(/must be an object/);
    expect(() => parseMatchRule({ category: "Impact" }, "inline", "bake")).toThrow(
      /'bake.category' must be an array of strings/,
    );
    expect(() => parseMatchRule({ durationAbove: "soon" }, "inline", "bake")).toThrow(
      /'bake.durationAbove' must be a number/,
    );
  });
});
