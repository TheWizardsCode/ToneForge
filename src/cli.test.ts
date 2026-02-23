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
});
