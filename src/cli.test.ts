import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { main } from "./cli.js";
import { existsSync, readFileSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock the playAudio and getPlayerCommand functions to avoid actual audio playback during tests
vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
  getPlayerCommand: vi.fn().mockReturnValue({ command: "echo", args: ["mock-play"] }),
}));

/** Helper to build a fake argv array as if invoked via `node cli.ts <...args>`. */
function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

/** Capture console output during a function call. */
async function captureOutput(fn: () => Promise<number>): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const origLog = console.log;
  const origError = console.error;

  console.log = (...args: unknown[]) => {
    stdoutLines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderrLines.push(args.map(String).join(" "));
  };

  try {
    const code = await fn();
    return {
      code,
      stdout: stdoutLines.join("\n"),
      stderr: stderrLines.join("\n"),
    };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

describe("CLI", () => {
  describe("help", () => {
    it("prints help with --help flag", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("--help")));
      expect(code).toBe(0);
      expect(stdout).toContain("ToneForge");
      expect(stdout).toContain("generate");
      expect(stdout).toContain("list");
    });

    it("prints help with -h flag", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("-h")));
      expect(code).toBe(0);
      expect(stdout).toContain("ToneForge");
    });

    it("prints help and returns 1 when no command given", async () => {
      const { code, stdout } = await captureOutput(() => main(argv()));
      expect(code).toBe(1);
      expect(stdout).toContain("Usage");
    });

    it("prints generate-specific help", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--help")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("--recipe");
      expect(stdout).toContain("--seed");
      expect(stdout).toContain("--output");
      expect(stdout).toContain("--seed-range");
      expect(stdout).toContain("ui-scifi-confirm");
    });
  });

  describe("error handling", () => {
    it("returns 1 for unknown command", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("unknown-cmd")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("Unknown command");
    });

    it("returns 1 when --recipe is missing", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("--recipe is required");
    });

    it("returns 1 for invalid recipe name", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "nonexistent")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("Unknown recipe");
      expect(stderr).toContain("nonexistent");
    });

    it("returns 1 for non-integer seed", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "abc")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("--seed must be an integer");
    });
  });

  describe("generate command", () => {
    it("does not print startup banner to stdout", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42")),
      );
      expect(code).toBe(0);
      expect(stdout).not.toMatch(/^ToneForge v\d+\.\d+\.\d+$/m);
    });

    it("renders and plays with explicit seed (exit 0)", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("Generating");
      expect(stdout).toContain("ui-scifi-confirm");
      expect(stdout).toContain("seed 42");
      expect(stdout).toContain("Rendered");
      expect(stdout).toContain("Done.");
    });

    it("uses random seed when --seed is omitted", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("Using random seed:");
      expect(stdout).toContain("Done.");
    });

    it("completes in under 5 seconds", async () => {
      const start = performance.now();
      const { code } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "1")),
      );
      const elapsed = performance.now() - start;
      expect(code).toBe(0);
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe("list command", () => {
    it("lists all registered recipes", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("list", "recipes")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("ui-scifi-confirm");
      expect(stdout).toContain("weapon-laser-zap");
      expect(stdout).toContain("footstep-stone");
      expect(stdout).toContain("ui-notification-chime");
      expect(stdout).toContain("ambient-wind-gust");
    });

    it("outputs one recipe per line", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("list", "recipes")),
      );
      expect(code).toBe(0);
      const lines = stdout.trim().split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(5);
    });

    it("prints list help with --help flag", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("list", "--help")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("recipes");
      expect(stdout).toContain("resource");
    });

    it("returns 1 when no resource specified", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("list")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("requires a resource type");
    });

    it("returns 1 for unknown resource type", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("list", "unknown")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("Unknown resource");
    });
  });

  describe("--output flag (single-file WAV export)", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `toneforge-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    });

    afterEach(() => {
      try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it("writes a valid WAV file to the specified path", async () => {
      const outPath = join(tempDir, "test-output.wav");
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
      );
      expect(code).toBe(0);
      expect(stdout).toContain(`Wrote ${outPath}`);
      expect(existsSync(outPath)).toBe(true);

      // Validate WAV header
      const fileData = readFileSync(outPath);
      expect(fileData.length).toBeGreaterThan(44);
      expect(fileData.toString("ascii", 0, 4)).toBe("RIFF");
      expect(fileData.toString("ascii", 8, 12)).toBe("WAVE");
    });

    it("does not play audio when --output is specified", async () => {
      const outPath = join(tempDir, "no-play.wav");
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
      );
      expect(code).toBe(0);
      expect(stdout).not.toContain("Playing...");
      expect(stdout).not.toContain("Done.");
    });

    it("auto-creates parent directories", async () => {
      const outPath = join(tempDir, "nested", "deep", "test.wav");
      const { code } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
      );
      expect(code).toBe(0);
      expect(existsSync(outPath)).toBe(true);
    });

    it("overwrites existing files silently", async () => {
      const outPath = join(tempDir, "overwrite.wav");

      // Write first time
      await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
      );
      const firstSize = readFileSync(outPath).length;

      // Write again with a different seed
      const { code } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "99", "--output", outPath)),
      );
      expect(code).toBe(0);
      expect(existsSync(outPath)).toBe(true);
      // File should still be valid WAV (may differ in size due to different seed)
      const data = readFileSync(outPath);
      expect(data.toString("ascii", 0, 4)).toBe("RIFF");
    });

    it("suppresses verbose output in write-only mode", async () => {
      const outPath = join(tempDir, "quiet.wav");
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
      );
      expect(code).toBe(0);
      expect(stdout).not.toContain("Generating");
      expect(stdout).not.toContain("Rendered");
      expect(stdout).toContain("Wrote");
    });

    it("writes to directory with deterministic filename when --output is a dir", async () => {
      const outDir = join(tempDir, "dir-output/");
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outDir)),
      );
      expect(code).toBe(0);
      const expectedFile = join(tempDir, "dir-output", "ui-scifi-confirm-seed-42.wav");
      expect(stdout).toContain("Wrote");
      expect(existsSync(expectedFile)).toBe(true);
    });
  });

  describe("--seed-range flag (batch generation)", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = join(tmpdir(), `toneforge-batch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    });

    afterEach(() => {
      try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it("generates multiple WAV files with correct naming", async () => {
      const outDir = tempDir + "/";
      const { code, stdout } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:3", "--output", outDir)),
      );
      expect(code).toBe(0);
      expect(existsSync(join(tempDir, "ui-scifi-confirm-seed-1.wav"))).toBe(true);
      expect(existsSync(join(tempDir, "ui-scifi-confirm-seed-2.wav"))).toBe(true);
      expect(existsSync(join(tempDir, "ui-scifi-confirm-seed-3.wav"))).toBe(true);
      expect(stdout).toContain("ui-scifi-confirm-seed-1.wav");
      expect(stdout).toContain("ui-scifi-confirm-seed-2.wav");
      expect(stdout).toContain("ui-scifi-confirm-seed-3.wav");
    });

    it("seed range is inclusive (1:1 generates one file)", async () => {
      const outDir = tempDir + "/";
      const { code } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "5:5", "--output", outDir)),
      );
      expect(code).toBe(0);
      expect(existsSync(join(tempDir, "ui-scifi-confirm-seed-5.wav"))).toBe(true);
    });

    it("auto-creates output directory", async () => {
      const outDir = join(tempDir, "nested", "batch") + "/";
      const { code } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:1", "--output", outDir)),
      );
      expect(code).toBe(0);
      expect(existsSync(join(tempDir, "nested", "batch", "ui-scifi-confirm-seed-1.wav"))).toBe(true);
    });

    it("each generated file is a valid WAV", async () => {
      const outDir = tempDir + "/";
      await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:2", "--output", outDir)),
      );

      for (const seed of [1, 2]) {
        const data = readFileSync(join(tempDir, `ui-scifi-confirm-seed-${seed}.wav`));
        expect(data.toString("ascii", 0, 4)).toBe("RIFF");
        expect(data.toString("ascii", 8, 12)).toBe("WAVE");
        expect(data.length).toBeGreaterThan(44);
      }
    });
  });

  describe("play command", () => {
    it("prints play help with --help flag", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("play", "--help")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("play");
      expect(stdout).toContain("<file.wav>");
      expect(stdout).toContain("Examples");
    });

    it("returns 1 when no file path is given", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("play")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("requires a WAV file path");
    });

    it("returns 1 when file does not exist", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("play", "./nonexistent/path/to/file.wav")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("File not found");
    });

    it("plays an existing WAV file successfully", async () => {
      // First generate a WAV file to play
      const outPath = join(tmpdir(), `toneforge-play-test-${Date.now()}.wav`);
      await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
      );
      expect(existsSync(outPath)).toBe(true);

      // Now play it (getPlayerCommand is mocked to return { command: "echo", args: ["mock-play"] })
      const { code } = await captureOutput(
        () => main(argv("play", outPath)),
      );
      expect(code).toBe(0);

      // Clean up
      try { unlinkSync(outPath); } catch { /* ignore */ }
    });

    it("appears in the top-level help text", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("--help")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("play");
    });
  });

  describe("version", () => {
    it("prints version with 'version' command", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("version")));
      expect(code).toBe(0);
      expect(stdout).toMatch(/^ToneForge v\d+\.\d+\.\d+$/);
    });

    it("prints version with --version flag", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("--version")));
      expect(code).toBe(0);
      expect(stdout).toMatch(/^ToneForge v\d+\.\d+\.\d+$/);
    });

    it("prints version with -V flag", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("-V")));
      expect(code).toBe(0);
      expect(stdout).toMatch(/^ToneForge v\d+\.\d+\.\d+$/);
    });

    it("version appears in top-level help text", async () => {
      const { code, stdout } = await captureOutput(() => main(argv("--help")));
      expect(code).toBe(0);
      expect(stdout).toContain("version");
      expect(stdout).toContain("--version");
    });
  });

  describe("flag validation", () => {
    it("errors when --seed-range is used without --output", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:10")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("--seed-range requires --output");
    });

    it("errors when --seed and --seed-range are both specified", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--seed-range", "1:10", "--output", "./test/")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("mutually exclusive");
    });

    it("errors when --seed-range is used with .wav output path", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:10", "--output", "./test.wav")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("directory");
    });

    it("errors when --seed-range format is invalid", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "bad", "--output", "./test/")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("format");
    });

    it("errors when --seed-range has non-integer values", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "a:b", "--output", "./test/")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("integers");
    });

    it("errors when --seed-range start > end", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "10:1", "--output", "./test/")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("must be <=");
    });
  });

  describe("show command", () => {
    it("prints show help with --help flag", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "--help")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("show");
      expect(stdout).toContain("<recipe-name>");
      expect(stdout).toContain("--seed");
      expect(stdout).toContain("Examples");
    });

    it("returns 1 when no recipe name is given", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("show")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("requires a recipe name");
    });

    it("displays recipe metadata for a valid recipe", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("# ui-scifi-confirm");
      expect(stdout).toContain("**Category:** UI");
      expect(stdout).toContain("**Description:**");
      expect(stdout).toContain("## Signal Chain");
      expect(stdout).toContain("## Parameters");
      expect(stdout).toContain("## Duration");
      expect(stdout).toContain("| Parameter");
      expect(stdout).toContain("| frequency");
      expect(stdout).toContain("| attack");
      expect(stdout).toContain("| decay");
      expect(stdout).toContain("| filterCutoff");
    });

    it("does not include a Value column without --seed", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("| Parameter | Min | Max | Unit |");
      expect(stdout).not.toContain("| Value");
    });

    it("includes a Value column with --seed", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "42")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("# ui-scifi-confirm (seed: 42)");
      expect(stdout).toContain("| Parameter | Min | Max | Value | Unit |");
      // Value column should have actual numbers for each param
      const lines = stdout.split("\n");
      const paramLines = lines.filter((l: string) => l.startsWith("| frequency") || l.startsWith("| attack") || l.startsWith("| decay") || l.startsWith("| filterCutoff"));
      for (const line of paramLines) {
        // Each param line should have 5 pipe-delimited columns (plus borders)
        const cells = line.split("|").filter((c: string) => c.trim() !== "");
        expect(cells.length).toBe(5);
      }
    });

    it("shows seed-specific duration with --seed", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "42")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("seed 42");
      expect(stdout).toContain("Range:");
    });

    it("shows duration range without --seed", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm")),
      );
      expect(code).toBe(0);
      // Duration section should contain a range like "0.051s - 0.31s"
      const durationMatch = stdout.match(/(\d+\.?\d*)s\s*-\s*(\d+\.?\d*)s/);
      expect(durationMatch).not.toBeNull();
    });

    it("returns error with suggestions for unknown recipe", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("show", "ui-scfi-confrim")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("Unknown recipe");
      expect(stderr).toContain("ui-scfi-confrim");
      expect(stderr).toContain("Did you mean:");
      expect(stderr).toContain("ui-scifi-confirm");
    });

    it("returns error for completely unrelated recipe name", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("show", "zzz-nonexistent")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("Unknown recipe");
      expect(stderr).toContain("Did you mean:");
    });

    it("errors for non-integer --seed", async () => {
      const { code, stderr } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "abc")),
      );
      expect(code).toBe(1);
      expect(stderr).toContain("--seed must be an integer");
    });

    it("appears in the top-level help text", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("--help")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("show");
    });

    it("outputs raw markdown (no ANSI escape codes)", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm")),
      );
      expect(code).toBe(0);
      // eslint-disable-next-line no-control-regex
      expect(stdout).not.toMatch(/\x1b\[/);
    });

    it("produces output for all five recipes", async () => {
      const recipes = [
        "ui-scifi-confirm",
        "weapon-laser-zap",
        "footstep-stone",
        "ui-notification-chime",
        "ambient-wind-gust",
      ];
      for (const recipe of recipes) {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", recipe)),
        );
        expect(code).toBe(0);
        expect(stdout).toContain(`# ${recipe}`);
        expect(stdout).toContain("**Category:**");
        expect(stdout).toContain("**Description:**");
        expect(stdout).toContain("## Signal Chain");
        expect(stdout).toContain("## Parameters");
        expect(stdout).toContain("## Duration");
      }
    });

    it("seed produces deterministic output", async () => {
      const { stdout: first } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "42")),
      );
      const { stdout: second } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "42")),
      );
      expect(first).toBe(second);
    });

    it("different seeds produce different parameter values", async () => {
      const { stdout: seed1 } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "1")),
      );
      const { stdout: seed2 } = await captureOutput(
        () => main(argv("show", "ui-scifi-confirm", "--seed", "2")),
      );
      expect(seed1).not.toBe(seed2);
    });
  });

  describe("metadata completeness", () => {
    it("all registered recipes have complete metadata", async () => {
      const { registry } = await import("./recipes/index.js");
      const names = registry.list();
      expect(names.length).toBeGreaterThanOrEqual(5);

      for (const name of names) {
        const reg = registry.getRegistration(name);
        expect(reg).toBeDefined();
        expect(reg!.description).toBeTruthy();
        expect(reg!.category).toBeTruthy();
        expect(reg!.signalChain).toBeTruthy();
        expect(reg!.params.length).toBeGreaterThan(0);
        expect(typeof reg!.getParams).toBe("function");

        // Verify all param descriptors have required fields
        for (const p of reg!.params) {
          expect(p.name).toBeTruthy();
          expect(typeof p.min).toBe("number");
          expect(typeof p.max).toBe("number");
          expect(p.unit).toBeTruthy();
          expect(p.max).toBeGreaterThan(p.min);
        }
      }
    });

    it("getParams keys match param descriptor names", async () => {
      const { registry } = await import("./recipes/index.js");
      const { createRng } = await import("./core/rng.js");
      const names = registry.list();

      for (const name of names) {
        const reg = registry.getRegistration(name)!;
        const rng = createRng(42);
        const values = reg.getParams(rng);
        const valueKeys = Object.keys(values).sort();
        const paramNames = reg.params.map((p) => p.name).sort();
        expect(valueKeys).toEqual(paramNames);
      }
    });

    it("getParams values fall within declared min/max ranges", async () => {
      const { registry } = await import("./recipes/index.js");
      const { createRng } = await import("./core/rng.js");
      const names = registry.list();

      for (const name of names) {
        const reg = registry.getRegistration(name)!;
        // Test with several seeds
        for (let seed = 0; seed < 50; seed++) {
          const rng = createRng(seed);
          const values = reg.getParams(rng);
          for (const p of reg.params) {
            const v = values[p.name]!;
            expect(v).toBeGreaterThanOrEqual(p.min);
            expect(v).toBeLessThan(p.max);
          }
        }
      }
    });
  });
});
