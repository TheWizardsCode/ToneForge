import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../test/run-yargs-child.js";

describe("yargs CLI entrypoint integration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `toneforge-yargs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup issues
    }
  });

  it("supports list --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli(["list", "--json"]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("list");
    expect(data.resource).toBe("recipes");
    expect(Array.isArray(data.recipes)).toBe(true);
  });

  it("supports list text output via yargs entrypoint", async () => {
    const { code, stdout } = await runCli(["list", "recipes"]);
    expect(code).toBe(0);
    expect(stdout).toContain("Recipe");
    expect(stdout).toContain("ui-scifi-confirm");
  });

  it("supports show --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli(["show", "ui-scifi-confirm", "--json"]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("show");
    expect(data.recipe).toBe("ui-scifi-confirm");
  });

  it("supports show text output via yargs entrypoint", async () => {
    const { code, stdout } = await runCli(["show", "ui-scifi-confirm"]);
    expect(code).toBe(0);
    expect(stdout).toContain("# ui-scifi-confirm");
    expect(stdout).toContain("## Parameters");
  });

  it("supports generate --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli([
      "generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json",
    ]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("generate");
    expect(data.recipe).toBe("ui-scifi-confirm");
    expect(data.seed).toBe(42);
  });

  it("supports version command via yargs entrypoint", async () => {
    const { code, stdout } = await runCli(["version"]);
    expect(code).toBe(0);
    expect(stdout).toMatch(/^ToneForge v\d+\.\d+\.\d+$/);
  });

  it("supports play command via yargs entrypoint", async () => {
    // First generate a WAV file to play.
    const outPath = join(tempDir, "play-source.wav");
    const generated = await runCli([
      "generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath,
    ]);
    expect(generated.code).toBe(0);

    // Attempt to play the generated file. On headless machines without a
    // sound server the play command will exit 1 with an error message — that
    // is acceptable. The important assertion is that the CLI routes the
    // command correctly (i.e. does not crash or produce an unrelated error).
    // Use a short timeout (5s) to prevent hanging on audio servers that
    // accept connections but never finish playback.
    const { code, stderr } = await runCli(["play", outPath], { timeoutMs: 5_000 });
    if (code !== 0) {
      // Verify the failure is audio-related, not a routing or crash issue.
      expect(
        stderr.includes("Audio playback failed") ||
        stderr.includes("No audio player found") ||
        stderr.includes("Connection refused") ||
        stderr.includes("Connection failure") ||
        stderr.includes("ETIMEDOUT") ||
        stderr === "", // timeout kills the process before stderr is flushed
      ).toBe(true);
    }
  }, 15_000); // Extended timeout: spawns two child processes (generate + play)

  it("writes a valid WAV file via yargs generate --output", async () => {
    const outPath = join(tempDir, "yargs-output.wav");
    const { code, stdout } = await runCli([
      "generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath,
    ]);

    expect(code).toBe(0);
    expect(stdout).toContain("Wrote");
    expect(existsSync(outPath)).toBe(true);

    const data = readFileSync(outPath);
    expect(data.toString("ascii", 0, 4)).toBe("RIFF");
    expect(data.toString("ascii", 8, 12)).toBe("WAVE");
    expect(data.length).toBe(44 + data.readUInt32LE(40));
  });

  it("preserves JSON error output shape", async () => {
    const { code, stderr } = await runCli([
      "generate", "--recipe", "nonexistent", "--json",
    ]);
    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(typeof data.error).toBe("string");
    expect(data.error).toContain("Unknown recipe");
  });

  it("supports stack inspect --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli([
      "stack", "inspect", "--preset", "presets/explosion_heavy.json", "--json",
    ]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("stack inspect");
    expect(data.preset).toBe("presets/explosion_heavy.json");
    expect(Array.isArray(data.layers)).toBe(true);
  });

  it("supports sequence simulate --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli([
      "sequence", "simulate", "--preset", "presets/sequences/weapon_burst.json", "--seed", "42", "--json",
    ]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.name).toBe("weapon_burst");
    expect(data.seed).toBe(42);
    expect(Array.isArray(data.events)).toBe(true);
  });

  it("supports stack render --json via yargs entrypoint", async () => {
    const outPath = join(tempDir, "stack-output.wav");
    const { code, stdout } = await runCli([
      "stack", "render", "--preset", "presets/explosion_heavy.json", "--seed", "42", "--output", outPath, "--json",
    ]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("stack render");
    expect(data.name).toBe("explosion_heavy");
    expect(data.seed).toBe(42);
    expect(data.output).toBe(outPath);
    expect(existsSync(outPath)).toBe(true);
  });

  it("supports sequence inspect --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli([
      "sequence", "inspect", "--preset", "presets/sequences/weapon_burst.json", "--json",
    ]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("sequence inspect");
    expect(data.name).toBe("weapon_burst");
    expect(Array.isArray(data.events)).toBe(true);
  });

  it("supports analyze --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli([
      "analyze", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json",
    ]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("analyze");
    expect(data.source).toEqual({ recipe: "ui-scifi-confirm", seed: 42 });
    expect(typeof data.sampleRate).toBe("number");
    expect(typeof data.metrics).toBe("object");
  });

  it("supports classify --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli([
      "classify", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json",
    ]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("classify");
    expect(typeof data.category).toBe("string");
    expect(typeof data.intensity).toBe("string");
    expect(Array.isArray(data.texture)).toBe(true);
    expect(Array.isArray(data.tags)).toBe(true);
  });

  it("supports classify search --json via yargs entrypoint", async () => {
    const { code, stderr } = await runCli([
      "classify", "search", "--category", "ui", "--dir", "./tmp-nonexistent", "--json",
    ]);
    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(typeof data.error).toBe("string");
    expect(data.error).toContain("Directory not found");
  });

  it("supports explore sweep --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli([
      "explore", "sweep", "--recipe", "ui-scifi-confirm", "--seed-range", "1:2", "--keep-top", "1", "--json",
    ]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("explore sweep");
    expect(data.config.recipe).toBe("ui-scifi-confirm");
    expect(Array.isArray(data.candidates)).toBe(true);
    expect(typeof data.runId).toBe("string");
  });

  it("supports library list --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli(["library", "list", "--json"]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("library list");
    expect(Array.isArray(data.entries)).toBe(true);
  });

  it("supports validate --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli([
      "validate", "--library", "./tmp-nonexistent-library", "--json",
    ]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("validate");
    expect(data.entryCount).toBe(0);
    expect(data.blocking).toBe(false);
  });

  it("supports compile --dry-run --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli([
      "compile", "--library", "./tmp-nonexistent-library", "--target", "web", "--dry-run", "--json",
    ]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("compile");
    expect(data.dryRun).toBe(true);
    expect(data.written).toEqual([]);
  });

  it("preserves TUI non-interactive error behavior via yargs entrypoint", async () => {
    const { code, stderr } = await runCli(["tui"]);
    expect(code).toBe(1);
    expect(stderr).toContain("requires an interactive terminal");
  });

  // -----------------------------------------------------------------
  // New resource types: sequences
  // -----------------------------------------------------------------

  it("supports list sequences --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli(["list", "sequences", "--json"]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("list");
    expect(data.resource).toBe("sequences");
    expect(typeof data.total).toBe("number");
    expect(data.total).toBeGreaterThan(0);
    expect(Array.isArray(data.presets)).toBe(true);
    expect(data.presets.length).toBe(data.total);
    expect(data.presets[0]).toHaveProperty("name");
    expect(data.presets[0]).toHaveProperty("description");
  });

  it("supports list sequences text output via yargs entrypoint", async () => {
    const { code, stdout } = await runCli(["list", "sequences"]);
    expect(code).toBe(0);
    expect(stdout).toContain("Sequence");
    expect(stdout).toContain("Description");
  });

  it("supports list sequences --search filter via yargs entrypoint", async () => {
    const { code, stdout } = await runCli(["list", "sequences", "--search", "combo", "--json"]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.resource).toBe("sequences");
    expect(data.presets.every((p: { name: string }) =>
      p.name.toLowerCase().includes("combo") || p.description.toLowerCase().includes("combo"),
    )).toBe(true);
    expect(data.presets.length).toBeGreaterThan(0);
  });

  it("supports list sequences --search with no results", async () => {
    const { code, stdout } = await runCli(["list", "sequences", "--search", "zzzznotfound", "--json"]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.total).toBeGreaterThan(0);
    expect(data.presets.length).toBe(0);
  });

  it("returns non-zero for unknown resource", async () => {
    const { code, stderr } = await runCli(["list", "nonexistent_resource", "--json"]);
    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(typeof data.error).toBe("string");
    expect(data.error).toContain("Unknown resource");
  });

  // -----------------------------------------------------------------
  // New resource types: stacks
  // -----------------------------------------------------------------

  it("supports list stacks --json via yargs entrypoint", async () => {
    const { code, stdout } = await runCli(["list", "stacks", "--json"]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("list");
    expect(data.resource).toBe("stacks");
    expect(typeof data.total).toBe("number");
    expect(data.total).toBeGreaterThan(0);
    expect(Array.isArray(data.presets)).toBe(true);
    expect(data.presets.length).toBe(data.total);
    expect(data.presets[0]).toHaveProperty("name");
    expect(data.presets[0]).toHaveProperty("description");
  });

  it("supports list stacks text output via yargs entrypoint", async () => {
    const { code, stdout } = await runCli(["list", "stacks"]);
    expect(code).toBe(0);
    expect(stdout).toContain("Stack");
    expect(stdout).toContain("Description");
  });

  it("supports list stacks --search filter via yargs entrypoint", async () => {
    const { code, stdout } = await runCli(["list", "stacks", "--search", "victory", "--json"]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.resource).toBe("stacks");
    expect(data.presets.every((p: { name: string }) =>
      p.name.toLowerCase().includes("victory") || p.description.toLowerCase().includes("victory"),
    )).toBe(true);
    expect(data.presets.length).toBeGreaterThan(0);
  });

  it("supports list stacks --search with no results", async () => {
    const { code, stdout } = await runCli(["list", "stacks", "--search", "zzzznotfound", "--json"]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.total).toBeGreaterThan(0);
    expect(data.presets.length).toBe(0);
  });

  it("returns non-zero for a malformed preset file in an isolated --dir", async () => {
    // The fixture lives in an isolated temp directory and is passed to the CLI
    // via --dir, so the shared repo presets/sequences directory is never written
    // to (TF-0MUYJSZDT001T2NN AC1).
    const dir = join(tempDir, "malformed-sequences");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "bad_preset.json"), "{ this is not valid json");

    const { code, stderr } = await runCli(["list", "sequences", "--dir", dir, "--json"]);
    expect(code).toBe(1);
    const data = JSON.parse(stderr);
    expect(data.error).toContain("Malformed");
    expect(data.error).toContain("bad_preset.json");
  });

  // -----------------------------------------------------------------
  // Directory override: --dir and environment variables
  // -----------------------------------------------------------------

  it("lists sequences from an explicit --dir override", async () => {
    const dir = join(tempDir, "custom-sequences");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "custom_one.json"), JSON.stringify({ name: "custom_one", description: "A custom sequence" }));
    writeFileSync(join(dir, "custom_two.json"), JSON.stringify({ name: "custom_two", description: "Another custom sequence" }));

    const { code, stdout } = await runCli(["list", "sequences", "--dir", dir, "--json"]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.resource).toBe("sequences");
    expect(data.total).toBe(2);
    expect(data.presets.map((p: { name: string }) => p.name).sort()).toEqual(["custom_one", "custom_two"]);
    // The repo default presets must NOT leak into an overridden listing.
    expect(data.presets.some((p: { name: string }) => p.name === "weapon_burst")).toBe(false);
  });

  it("lists stacks from an explicit --dir override", async () => {
    const dir = join(tempDir, "custom-stacks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "custom_stack.json"), JSON.stringify({ name: "custom_stack", description: "A custom stack" }));

    const { code, stdout } = await runCli(["list", "stacks", "--dir", dir, "--json"]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.resource).toBe("stacks");
    expect(data.total).toBe(1);
    expect(data.presets.map((p: { name: string }) => p.name)).toEqual(["custom_stack"]);
  });

  it("lists sequences from TONEFORGE_SEQUENCES_DIR when --dir is absent", async () => {
    const dir = join(tempDir, "env-sequences");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "env_one.json"), JSON.stringify({ name: "env_one", description: "From the environment" }));

    const { code, stdout } = await runCli(["list", "sequences", "--json"], {
      env: { TONEFORGE_SEQUENCES_DIR: dir },
    });
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.total).toBe(1);
    expect(data.presets.map((p: { name: string }) => p.name)).toEqual(["env_one"]);
  });

  it("lists stacks from TONEFORGE_STACKS_DIR when --dir is absent", async () => {
    const dir = join(tempDir, "env-stacks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "env_stack.json"), JSON.stringify({ name: "env_stack", description: "From the environment" }));

    const { code, stdout } = await runCli(["list", "stacks", "--json"], {
      env: { TONEFORGE_STACKS_DIR: dir },
    });
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.total).toBe(1);
    expect(data.presets.map((p: { name: string }) => p.name)).toEqual(["env_stack"]);
  });

  it("prefers --dir over TONEFORGE_SEQUENCES_DIR", async () => {
    const envDir = join(tempDir, "env-precedence");
    const cliDir = join(tempDir, "cli-precedence");
    mkdirSync(envDir, { recursive: true });
    mkdirSync(cliDir, { recursive: true });
    writeFileSync(join(envDir, "env_preset.json"), JSON.stringify({ name: "env_preset", description: "env" }));
    writeFileSync(join(cliDir, "cli_preset.json"), JSON.stringify({ name: "cli_preset", description: "cli" }));

    const { code, stdout } = await runCli(["list", "sequences", "--dir", cliDir, "--json"], {
      env: { TONEFORGE_SEQUENCES_DIR: envDir },
    });
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.presets.map((p: { name: string }) => p.name)).toEqual(["cli_preset"]);
  });

  it("ignores __-prefixed malformed artefacts in a preset directory", async () => {
    const dir = join(tempDir, "artefact-sequences");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "__malformed_test__.json"), "{ this is not valid json");
    writeFileSync(join(dir, "real_preset.json"), JSON.stringify({ name: "real_preset", description: "A real preset" }));

    const { code, stdout } = await runCli(["list", "sequences", "--dir", dir, "--json"]);
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.total).toBe(1);
    expect(data.presets.map((p: { name: string }) => p.name)).toEqual(["real_preset"]);
  });

  it("documents --dir and the directory environment variables", async () => {
    const { code, stdout } = await runCli(["list", "--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("--dir");
    expect(stdout).toContain("TONEFORGE_SEQUENCES_DIR");
    expect(stdout).toContain("TONEFORGE_STACKS_DIR");
  });
});
