/**
 * CLI Integration Tests (always run)
 *
 * Unlike cli.test.ts, these tests do NOT mock playAudio.
 * They exercise the pipeline from render through WAV encoding and file I/O
 * without requiring a system audio player to be installed.
 *
 * For full end-to-end tests that include player detection and actual
 * playback, see cli.e2e.test.ts (run via `npm run test:e2e`).
 *
 * Work item: TF-0MLW2GCS31CTRQ4T
 */

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { readFileSync, existsSync, unlinkSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderRecipe } from "./core/renderer.js";
import { encodeWav } from "./audio/wav-encoder.js";
import { main } from "./cli.js";

// Mock the playAudio function for CLI tests in this file
import { vi } from "vitest";
vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

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
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

  console.log = (...args: unknown[]) => {
    stdoutLines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderrLines.push(args.map(String).join(" "));
  };
  // Capture process.stdout.write / process.stderr.write used by output helpers
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutLines.push(String(chunk).replace(/\n$/, ""));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrLines.push(String(chunk).replace(/\n$/, ""));
    return true;
  }) as typeof process.stderr.write;

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
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

/** Helper to build a fake argv array. */
function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

describe("CLI Integration — render and WAV encode pipeline (no mocks)", () => {
  it("renders audio and encodes a valid WAV file", async () => {
    // Step 1: Render — exercises the real OfflineAudioContext pipeline
    const result = await renderRecipe("ui-scifi-confirm", 42);

    expect(result.samples).toBeInstanceOf(Float32Array);
    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.sampleRate).toBe(44100);
    expect(result.duration).toBeGreaterThan(0);

    // Step 2: WAV encode — exercises the real encoder
    const wav = encodeWav(result.samples, { sampleRate: result.sampleRate });

    expect(wav).toBeInstanceOf(Buffer);
    expect(wav.length).toBeGreaterThan(44); // Header + some data

    // Validate RIFF header
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.toString("ascii", 12, 16)).toBe("fmt ");
    expect(wav.toString("ascii", 36, 40)).toBe("data");

    // Validate data chunk size matches rendered samples
    const dataSize = wav.readUInt32LE(40);
    expect(dataSize).toBe(result.samples.length * 2); // 16-bit = 2 bytes per sample
  });

  it("writes a valid WAV temp file to disk", async () => {
    const result = await renderRecipe("ui-scifi-confirm", 42);
    const wav = encodeWav(result.samples, { sampleRate: result.sampleRate });

    // Write to a temp file just like playAudio does
    const tempPath = join(tmpdir(), `toneforge-integration-test-${Date.now()}.wav`);

    try {
      await writeFile(tempPath, wav);

      // Verify the file exists and has the correct size
      expect(existsSync(tempPath)).toBe(true);
      const fileContents = readFileSync(tempPath);
      expect(fileContents.length).toBe(wav.length);

      // Verify file starts with RIFF header (not corrupted during write)
      expect(fileContents.toString("ascii", 0, 4)).toBe("RIFF");
    } finally {
      // Clean up
      try { unlinkSync(tempPath); } catch { /* ignore */ }
    }
  });

  it("WAV byte count matches render output exactly", async () => {
    const result = await renderRecipe("ui-scifi-confirm", 99);
    const wav = encodeWav(result.samples, { sampleRate: result.sampleRate });

    // 44-byte WAV header + (samples * 2 bytes per 16-bit sample)
    const expectedSize = 44 + result.samples.length * 2;
    expect(wav.length).toBe(expectedSize);
  });

  it("multiple seeds produce different WAV files", async () => {
    const result1 = await renderRecipe("ui-scifi-confirm", 1);
    const result2 = await renderRecipe("ui-scifi-confirm", 9999);

    const wav1 = encodeWav(result1.samples, { sampleRate: result1.sampleRate });
    const wav2 = encodeWav(result2.samples, { sampleRate: result2.sampleRate });

    // Different seeds should produce different WAV content
    // (they may differ in length and/or sample data)
    const differ = wav1.length !== wav2.length || !wav1.equals(wav2);
    expect(differ).toBe(true);
  });
});

describe("CLI Integration — WAV export determinism", () => {
  it("same recipe+seed produces byte-identical WAV on two renders", async () => {
    const result1 = await renderRecipe("ui-scifi-confirm", 42);
    const wav1 = encodeWav(result1.samples, { sampleRate: result1.sampleRate });

    const result2 = await renderRecipe("ui-scifi-confirm", 42);
    const wav2 = encodeWav(result2.samples, { sampleRate: result2.sampleRate });

    expect(wav1.length).toBe(wav2.length);
    expect(wav1.equals(wav2)).toBe(true);
  });

  it("determinism holds for weapon-laser-zap recipe", async () => {
    const result1 = await renderRecipe("weapon-laser-zap", 100);
    const wav1 = encodeWav(result1.samples, { sampleRate: result1.sampleRate });

    const result2 = await renderRecipe("weapon-laser-zap", 100);
    const wav2 = encodeWav(result2.samples, { sampleRate: result2.sampleRate });

    expect(wav1.equals(wav2)).toBe(true);
  });
});

describe("CLI Integration — --output flag end-to-end", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `toneforge-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("--output writes a valid WAV file via CLI main()", async () => {
    const outPath = join(tempDir, "e2e-output.wav");
    const { code, stdout } = await captureOutput(
      () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("Wrote");
    expect(existsSync(outPath)).toBe(true);

    const fileData = readFileSync(outPath);
    expect(fileData.toString("ascii", 0, 4)).toBe("RIFF");
    expect(fileData.toString("ascii", 8, 12)).toBe("WAVE");

    // Validate the data chunk size
    const dataSize = fileData.readUInt32LE(40);
    expect(dataSize).toBeGreaterThan(0);
    expect(fileData.length).toBe(44 + dataSize);
  });

  it("--seed-range batch generates correct number of valid WAV files", async () => {
    const outDir = tempDir + "/";
    const { code } = await captureOutput(
      () => main(argv("generate", "--recipe", "footstep-stone", "--seed-range", "1:3", "--output", outDir)),
    );
    expect(code).toBe(0);

    for (const seed of [1, 2, 3]) {
      const filePath = join(tempDir, `footstep-stone-seed-${seed}.wav`);
      expect(existsSync(filePath)).toBe(true);
      const data = readFileSync(filePath);
      expect(data.toString("ascii", 0, 4)).toBe("RIFF");
      expect(data.length).toBe(44 + data.readUInt32LE(40));
    }
  });

  it("batch-generated files from different seeds are different", async () => {
    const outDir = tempDir + "/";
    await captureOutput(
      () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed-range", "1:2", "--output", outDir)),
    );

    const file1 = readFileSync(join(tempDir, "ui-scifi-confirm-seed-1.wav"));
    const file2 = readFileSync(join(tempDir, "ui-scifi-confirm-seed-2.wav"));
    const differ = file1.length !== file2.length || !file1.equals(file2);
    expect(differ).toBe(true);
  });

  it("WAV exported via --output is byte-identical to manual render+encode", async () => {
    const outPath = join(tempDir, "compare.wav");
    await captureOutput(
      () => main(argv("generate", "--recipe", "ui-scifi-confirm", "--seed", "42", "--output", outPath)),
    );

    // Manual render + encode
    const result = await renderRecipe("ui-scifi-confirm", 42);
    const manualWav = encodeWav(result.samples, { sampleRate: result.sampleRate });

    const cliWav = readFileSync(outPath);
    expect(cliWav.equals(manualWav)).toBe(true);
  });
});

// ── Stack CLI Integration ─────────────────────────────────────────
// Work item: TF-0MLZZJZP50VW0Q4P

describe("CLI Integration — stack render", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `toneforge-stack-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("stack render --preset produces a valid WAV file", async () => {
    const outPath = join(tempDir, "explosion.wav");
    const { code, stdout } = await captureOutput(
      () => main(argv("stack", "render", "--preset", "presets/explosion_heavy.json", "--seed", "42", "--output", outPath)),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("Wrote");
    expect(existsSync(outPath)).toBe(true);

    const fileData = readFileSync(outPath);
    expect(fileData.toString("ascii", 0, 4)).toBe("RIFF");
    expect(fileData.toString("ascii", 8, 12)).toBe("WAVE");
    expect(fileData.length).toBeGreaterThan(44);
  });

  it("stack render --layer produces a valid WAV file", async () => {
    const outPath = join(tempDir, "inline.wav");
    const { code } = await captureOutput(
      () => main(argv(
        "stack", "render",
        "--layer", "recipe=impact-crack,offset=0ms,gain=0.9",
        "--layer", "recipe=rumble-body,offset=5ms,gain=0.7",
        "--seed", "42",
        "--output", outPath,
      )),
    );
    expect(code).toBe(0);
    expect(existsSync(outPath)).toBe(true);

    const fileData = readFileSync(outPath);
    expect(fileData.toString("ascii", 0, 4)).toBe("RIFF");
  });

  it("stack render with door_slam preset produces valid WAV", async () => {
    const outPath = join(tempDir, "door_slam.wav");
    const { code } = await captureOutput(
      () => main(argv("stack", "render", "--preset", "presets/door_slam.json", "--seed", "99", "--output", outPath)),
    );
    expect(code).toBe(0);
    expect(existsSync(outPath)).toBe(true);
  });

  it("stack render without --seed returns error", async () => {
    const outPath = join(tempDir, "no-seed.wav");
    const { code, stderr } = await captureOutput(
      () => main(argv("stack", "render", "--preset", "presets/explosion_heavy.json", "--output", outPath)),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--seed");
  });

  it("stack render without --output returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("stack", "render", "--preset", "presets/explosion_heavy.json", "--seed", "42")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--output");
  });

  it("stack render without --preset or --layer returns error", async () => {
    const outPath = join(tempDir, "empty.wav");
    const { code, stderr } = await captureOutput(
      () => main(argv("stack", "render", "--seed", "42", "--output", outPath)),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--preset");
  });

  it("stack render is deterministic — same preset+seed produces same WAV", async () => {
    const out1 = join(tempDir, "det1.wav");
    const out2 = join(tempDir, "det2.wav");

    await captureOutput(
      () => main(argv("stack", "render", "--preset", "presets/explosion_heavy.json", "--seed", "42", "--output", out1)),
    );
    await captureOutput(
      () => main(argv("stack", "render", "--preset", "presets/explosion_heavy.json", "--seed", "42", "--output", out2)),
    );

    const wav1 = readFileSync(out1);
    const wav2 = readFileSync(out2);
    expect(wav1.equals(wav2)).toBe(true);
  });
});

describe("CLI Integration — stack inspect", () => {
  it("stack inspect --preset displays layer structure", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("stack", "inspect", "--preset", "presets/explosion_heavy.json")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("explosion_heavy");
    expect(stdout).toContain("impact-crack");
    expect(stdout).toContain("rumble-body");
    expect(stdout).toContain("debris-tail");
    expect(stdout).toContain("3 layers");
  });

  it("stack inspect shows gain values", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("stack", "inspect", "--preset", "presets/explosion_heavy.json")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("0.90");
    expect(stdout).toContain("0.70");
    expect(stdout).toContain("0.50");
  });

  it("stack inspect shows offset values", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("stack", "inspect", "--preset", "presets/explosion_heavy.json")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("0ms");
    expect(stdout).toContain("5ms");
    expect(stdout).toContain("50ms");
  });

  it("stack inspect without --preset returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("stack", "inspect")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--preset");
  });

  it("stack inspect with nonexistent file returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("stack", "inspect", "--preset", "/nonexistent/path.json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Failed to read");
  });
});

describe("CLI Integration — stack help", () => {
  it("stack --help returns 0 and shows help text", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("stack", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("render");
    expect(stdout).toContain("inspect");
  });

  it("stack render --help returns 0", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("stack", "render", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("--preset");
    expect(stdout).toContain("--seed");
    expect(stdout).toContain("--output");
  });

  it("stack inspect --help returns 0", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("stack", "inspect", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("--preset");
  });

  it("top-level --help lists the stack command", async () => {
    const { code, stdout } = await captureOutput(
      () => main(argv("--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("stack");
  });

  it("unknown stack subcommand returns error", async () => {
    const { code, stderr } = await captureOutput(
      () => main(argv("stack", "explode")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Unknown stack subcommand");
  });
});
