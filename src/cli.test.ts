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

    it("defaults to listing recipes when no resource specified", async () => {
      const { code, stdout } = await captureOutput(
        () => main(argv("list")),
      );
      expect(code).toBe(0);
      expect(stdout).toContain("ui-scifi-confirm");
      expect(stdout).toContain("weapon-laser-zap");
      expect(stdout).toContain("footstep-stone");
      expect(stdout).toContain("ui-notification-chime");
      expect(stdout).toContain("ambient-wind-gust");
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

  describe("--json flag", () => {
    describe("version", () => {
      it("outputs JSON with 'version --json'", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("version", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("version");
        expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
      });

      it("outputs JSON with '--version --json'", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("--version", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("version");
        expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });

    describe("list", () => {
      it("outputs JSON with recipe array", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("list");
        expect(data.resource).toBe("recipes");
        expect(Array.isArray(data.recipes)).toBe(true);
        expect(data.recipes).toContain("ui-scifi-confirm");
        expect(data.recipes).toContain("weapon-laser-zap");
        expect(data.recipes).toContain("footstep-stone");
        expect(data.recipes).toContain("ui-notification-chime");
        expect(data.recipes).toContain("ambient-wind-gust");
      });

      it("outputs JSON with 'list recipes --json'", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "recipes", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("list");
        expect(data.recipes.length).toBeGreaterThanOrEqual(5);
      });

      it("outputs JSON error for unknown resource", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("list", "unknown", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("Unknown resource");
      });
    });

    describe("show", () => {
      it("outputs JSON with recipe metadata", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("show");
        expect(data.recipe).toBe("ui-scifi-confirm");
        expect(data.category).toBe("UI");
        expect(typeof data.description).toBe("string");
        expect(Array.isArray(data.tags)).toBe(true);
        expect(typeof data.signalChain).toBe("string");
        expect(Array.isArray(data.params)).toBe(true);
        expect(data.params.length).toBeGreaterThan(0);
        expect(typeof data.duration).toBe("object");
        expect(typeof data.duration.min).toBe("number");
        expect(typeof data.duration.max).toBe("number");
      });

      it("includes seed-specific values with --seed", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.seed).toBe(42);
        expect(data.duration.value).toBeDefined();
        expect(data.duration.seed).toBe(42);
        // Every param should have a value
        for (const param of data.params) {
          expect(param.value).toBeDefined();
          expect(typeof param.value).toBe("number");
        }
      });

      it("does not include seed-specific values without --seed", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.seed).toBeUndefined();
        for (const param of data.params) {
          expect(param.value).toBeUndefined();
        }
      });

      it("param descriptors have correct fields", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        for (const param of data.params) {
          expect(typeof param.name).toBe("string");
          expect(typeof param.min).toBe("number");
          expect(typeof param.max).toBe("number");
          expect(typeof param.unit).toBe("string");
        }
      });

      it("outputs JSON error for unknown recipe", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("show", "nonexistent", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("Unknown recipe");
      });

      it("outputs JSON error for missing recipe name", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("show", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("requires a recipe name");
      });

      it("outputs JSON error for invalid seed", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--seed", "abc", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--seed must be an integer");
      });

      it("produces deterministic JSON output with same seed", async () => {
        const { stdout: first } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        const { stdout: second } = await captureOutput(
          () => main(argv("show", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        expect(first).toBe(second);
      });

      it("works for all five recipes", async () => {
        const recipes = [
          "ui-scifi-confirm",
          "weapon-laser-zap",
          "footstep-stone",
          "ui-notification-chime",
          "ambient-wind-gust",
        ];
        for (const recipe of recipes) {
          const { code, stdout } = await captureOutput(
            () => main(argv("show", recipe, "--json")),
          );
          expect(code).toBe(0);
          const data = JSON.parse(stdout);
          expect(data.recipe).toBe(recipe);
          expect(data.params.length).toBeGreaterThan(0);
        }
      });
    });

    describe("generate", () => {
      let tempDir: string;

      beforeEach(() => {
        tempDir = join(tmpdir(), `toneforge-json-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      });

      afterEach(() => {
        try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
      });

      it("outputs JSON for single-file export", async () => {
        const outPath = join(tempDir, "test.wav");
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("generate");
        expect(data.recipe).toBe("ui-scifi-confirm");
        expect(data.seed).toBe(42);
        expect(data.output).toBe(outPath);
        expect(typeof data.duration).toBe("number");
        expect(typeof data.sampleRate).toBe("number");
        expect(typeof data.samples).toBe("number");
      });

      it("outputs JSON for play mode", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("generate");
        expect(data.recipe).toBe("ui-scifi-confirm");
        expect(data.seed).toBe(42);
        expect(data.played).toBe(true);
        expect(typeof data.duration).toBe("number");
        expect(typeof data.sampleRate).toBe("number");
        expect(typeof data.samples).toBe("number");
      });

      it("suppresses text output in JSON mode", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--json")),
        );
        expect(code).toBe(0);
        // Should be a single JSON line, no "Generating", "Rendered", etc.
        expect(stdout).not.toContain("Generating");
        expect(stdout).not.toContain("Rendered");
        expect(stdout).not.toContain("Playing...");
        expect(stdout).not.toContain("Done.");
        expect(stdout).not.toContain("Using random seed");
        // Verify it's valid JSON
        expect(() => JSON.parse(stdout)).not.toThrow();
      });

      it("outputs JSON for batch generation", async () => {
        const outDir = tempDir + "/";
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:3", "--output", outDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("generate");
        expect(data.recipe).toBe("ui-scifi-confirm");
        expect(data.seedRange).toEqual([1, 3]);
        expect(data.output).toBe(outDir);
        expect(Array.isArray(data.files)).toBe(true);
        expect(data.files.length).toBe(3);
        for (const file of data.files) {
          expect(typeof file.seed).toBe("number");
          expect(typeof file.output).toBe("string");
          expect(typeof file.duration).toBe("number");
          expect(typeof file.sampleRate).toBe("number");
          expect(typeof file.samples).toBe("number");
        }
      });

      it("outputs JSON for directory output (single seed)", async () => {
        const outDir = join(tempDir, "dir-output/");
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outDir, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("generate");
        expect(data.output).toContain("ui-scifi-confirm-seed-42.wav");
      });

      it("outputs JSON error for missing recipe", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("generate", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--recipe is required");
      });

      it("outputs JSON error for unknown recipe", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("generate", "--recipe", "nonexistent", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("Unknown recipe");
      });

      it("outputs JSON error for invalid seed", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "abc", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("--seed must be an integer");
      });

      it("includes seed in JSON output when randomly generated", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(typeof data.seed).toBe("number");
        expect(data.seed).toBeGreaterThanOrEqual(0);
      });
    });

    describe("play", () => {
      it("outputs JSON after successful play", async () => {
        // Generate a WAV file first
        const outPath = join(tmpdir(), `toneforge-json-play-${Date.now()}.wav`);
        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
        );

        const { code, stdout } = await captureOutput(
          () => main(argv("play", outPath, "--json")),
        );
        expect(code).toBe(0);
        const data = JSON.parse(stdout);
        expect(data.command).toBe("play");
        expect(data.file).toBe(outPath);

        // Clean up
        try { unlinkSync(outPath); } catch { /* ignore */ }
      });

      it("suppresses text output in JSON mode", async () => {
        // Generate a WAV file first
        const outPath = join(tmpdir(), `toneforge-json-play-quiet-${Date.now()}.wav`);
        await captureOutput(
          () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
        );

        const { code, stdout } = await captureOutput(
          () => main(argv("play", outPath, "--json")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toContain("Playing ");
        expect(() => JSON.parse(stdout)).not.toThrow();

        try { unlinkSync(outPath); } catch { /* ignore */ }
      });

      it("outputs JSON error for missing file", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("play", "./nonexistent.wav", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("File not found");
      });

      it("outputs JSON error for missing path argument", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("play", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("requires a WAV file path");
      });
    });

    describe("errors", () => {
      it("outputs JSON error for unknown command", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("unknown-cmd", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).toContain("Unknown command");
      });

      it("JSON errors do not include 'Error:' prefix", async () => {
        const { code, stderr } = await captureOutput(
          () => main(argv("unknown-cmd", "--json")),
        );
        expect(code).toBe(1);
        const data = JSON.parse(stderr);
        expect(data.error).not.toMatch(/^Error:/);
      });
    });

    describe("help text", () => {
      it("global help mentions --json", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("--json");
      });

      it("generate help mentions --json", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("--json");
      });

      it("list help mentions --json", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("--json");
      });

      it("show help mentions --json", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("--json");
      });

      it("play help mentions --json", async () => {
        const { code, stdout } = await captureOutput(
          () => main(argv("play", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toContain("--json");
      });
    });
  });

  describe("help text markdown rendering", () => {
    // eslint-disable-next-line no-control-regex
    const ANSI_RE = /\x1b\[/;

    let setTtyOverride: (value: boolean | undefined) => void;

    beforeEach(async () => {
      const outputModule = await import("./output.js");
      setTtyOverride = outputModule.setTtyOverride;
    });

    afterEach(() => {
      setTtyOverride(undefined);
    });

    describe("TTY mode (ANSI output)", () => {
      it("global help contains ANSI codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(ANSI_RE);
        expect(stdout).toContain("ToneForge");
      });

      it("generate help contains ANSI codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(ANSI_RE);
        expect(stdout).toContain("recipe");
      });

      it("list help contains ANSI codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(ANSI_RE);
        expect(stdout).toContain("recipes");
      });

      it("play help contains ANSI codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("play", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(ANSI_RE);
        expect(stdout).toContain("play");
      });

      it("show help contains ANSI codes when TTY", async () => {
        setTtyOverride(true);
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).toMatch(ANSI_RE);
        expect(stdout).toContain("show");
      });
    });

    describe("non-TTY mode (raw markdown)", () => {
      it("global help contains no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("--help")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        expect(stdout).toContain("ToneForge");
        expect(stdout).toContain("generate");
      });

      it("generate help contains no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("generate", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        expect(stdout).toContain("--recipe");
      });

      it("list help contains no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("list", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        expect(stdout).toContain("recipes");
      });

      it("play help contains no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("play", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        expect(stdout).toContain("play");
      });

      it("show help contains no ANSI codes when non-TTY", async () => {
        setTtyOverride(false);
        const { code, stdout } = await captureOutput(
          () => main(argv("show", "--help")),
        );
        expect(code).toBe(0);
        expect(stdout).not.toMatch(ANSI_RE);
        expect(stdout).toContain("show");
      });
    });

    describe("content preservation", () => {
      it("global help preserves all command names in markdown format", async () => {
        setTtyOverride(false);
        const { stdout } = await captureOutput(
          () => main(argv("--help")),
        );
        expect(stdout).toContain("generate");
        expect(stdout).toContain("show");
        expect(stdout).toContain("play");
        expect(stdout).toContain("list");
        expect(stdout).toContain("version");
        expect(stdout).toContain("--help");
        expect(stdout).toContain("--version");
        expect(stdout).toContain("--json");
      });

      it("generate help preserves all flags and examples", async () => {
        setTtyOverride(false);
        const { stdout } = await captureOutput(
          () => main(argv("generate", "--help")),
        );
        expect(stdout).toContain("--recipe");
        expect(stdout).toContain("--seed");
        expect(stdout).toContain("--output");
        expect(stdout).toContain("--seed-range");
        expect(stdout).toContain("ui-scifi-confirm");
        expect(stdout).toContain("weapon-laser-zap");
      });

      it("show help preserves recipe-name argument and available recipes", async () => {
        setTtyOverride(false);
        const { stdout } = await captureOutput(
          () => main(argv("show", "--help")),
        );
        expect(stdout).toContain("<recipe-name>");
        expect(stdout).toContain("--seed");
        expect(stdout).toContain("ui-scifi-confirm");
        expect(stdout).toContain("weapon-laser-zap");
      });

      it("play help preserves file.wav argument", async () => {
        setTtyOverride(false);
        const { stdout } = await captureOutput(
          () => main(argv("play", "--help")),
        );
        expect(stdout).toContain("<file.wav>");
        expect(stdout).toContain("Examples");
      });

      it("list help preserves resource description", async () => {
        setTtyOverride(false);
        const { stdout } = await captureOutput(
          () => main(argv("list", "--help")),
        );
        expect(stdout).toContain("recipes");
        expect(stdout).toContain("resource");
      });
    });
  });
});
