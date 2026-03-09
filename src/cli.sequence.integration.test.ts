/**
 * CLI Integration Tests for the sequence command.
 *
 * Tests help text, flag validation, simulate/inspect JSON output, and
 * generate (WAV export + playback) using real preset files.
 *
 * Work item: TF-0MM196G9Q0HXBDRA
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock playAudio to avoid actual audio playback
vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

import { main } from "./compat/cli.js";

// ── Helpers ───────────────────────────────────────────────────────

/** Capture console output during a function call. */
async function captureOutput(fn: () => Promise<number>): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

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
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

/** Helper to build a fake argv array. */
function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

// Preset paths
const WEAPON_BURST = "presets/sequences/weapon_burst.json";
const GAMEOVER_MELODY = "presets/sequences/gameover_melody.json";
const RHYTHMIC_STING = "presets/sequences/rhythmic_sting.json";

// ── Help Text ─────────────────────────────────────────────────────

describe("CLI sequence — help text", () => {
  it("shows sequence help when no subcommand given", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("sequence");
    expect(stdout).toContain("generate");
    expect(stdout).toContain("simulate");
    expect(stdout).toContain("inspect");
  });

  it("shows sequence help with --help flag", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("sequence");
  });

  it("shows generate help", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "generate", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("generate");
    expect(stdout).toContain("--preset");
    expect(stdout).toContain("--seed");
  });

  it("shows simulate help", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "simulate", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("simulate");
    expect(stdout).toContain("--preset");
  });

  it("shows inspect help", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "inspect", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("inspect");
    expect(stdout).toContain("--preset");
    expect(stdout).toContain("--validate");
  });
});

// ── Flag Validation ───────────────────────────────────────────────

describe("CLI sequence — flag validation", () => {
  it("generate requires --preset", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("sequence", "generate", "--seed", "42", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--preset");
  });

  it("generate requires --seed", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("sequence", "generate", "--preset", WEAPON_BURST, "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--seed");
  });

  it("generate rejects non-integer seed", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("sequence", "generate", "--preset", WEAPON_BURST, "--seed", "abc", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("integer");
  });

  it("generate rejects invalid duration", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("sequence", "generate", "--preset", WEAPON_BURST, "--seed", "42", "--duration", "-5", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("duration");
  });

  it("simulate requires --preset", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("sequence", "simulate", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--preset");
  });

  it("inspect requires --preset", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("sequence", "inspect", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("--preset");
  });

  it("rejects unknown subcommand", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("sequence", "bogus", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Unknown sequence subcommand");
  });
});

// ── Simulate ──────────────────────────────────────────────────────

describe("CLI sequence simulate", () => {
  it("produces JSON timeline for weapon_burst preset", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "simulate", "--preset", WEAPON_BURST, "--seed", "42", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.name).toBe("weapon_burst");
    expect(data.seed).toBe(42);
    expect(data.sampleRate).toBe(44100);
    expect(Array.isArray(data.events)).toBe(true);
    expect(data.events.length).toBe(3);
  });

  it("produces JSON timeline for rhythmic_sting preset with repeats", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "simulate", "--preset", RHYTHMIC_STING, "--seed", "42", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.name).toBe("rhythmic_sting");
    // 4 events * 3 repetitions (count=2 means original+2) but probability filtering may reduce some
    expect(data.events.length).toBeGreaterThan(0);
  });

  it("defaults seed to 42 when --seed is omitted", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "simulate", "--preset", WEAPON_BURST, "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.seed).toBe(42);
  });

  it("respects --duration flag", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "simulate", "--preset", WEAPON_BURST, "--seed", "42", "--duration", "0.15", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    // Only events at t <= 0.15s should be included (first two: t=0, t=0.12)
    expect(data.events.length).toBe(2);
    expect(data.totalDuration).toBe(0.15);
  });

  it("produces human-readable output when --json is omitted", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "simulate", "--preset", WEAPON_BURST, "--seed", "42")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("weapon_burst");
    expect(stdout).toContain("weapon-laser-zap");
  });

  it("timeline events have expected fields", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "simulate", "--preset", WEAPON_BURST, "--seed", "100", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    const evt = data.events[0];
    expect(typeof evt.time_ms).toBe("number");
    expect(typeof evt.sampleOffset).toBe("number");
    expect(typeof evt.event).toBe("string");
    expect(typeof evt.seedOffset).toBe("number");
    expect(typeof evt.eventSeed).toBe("number");
    expect(typeof evt.gain).toBe("number");
    expect(typeof evt.repetition).toBe("number");
  });

  it("deterministic: same preset+seed produces identical JSON", async () => {
    const run = async () => {
      const { stdout } = await captureOutput(() =>
        main(argv("sequence", "simulate", "--preset", WEAPON_BURST, "--seed", "42", "--json")),
      );
      return stdout;
    };
    const a = await run();
    const b = await run();
    expect(a).toBe(b);
  });
});

// ── Inspect ───────────────────────────────────────────────────────

describe("CLI sequence inspect", () => {
  it("produces JSON output for weapon_burst preset", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "inspect", "--preset", WEAPON_BURST, "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("sequence inspect");
    expect(data.name).toBe("weapon_burst");
    expect(Array.isArray(data.events)).toBe(true);
    expect(data.events.length).toBe(3);
  });

  it("produces human-readable output for gameover_melody preset", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "inspect", "--preset", GAMEOVER_MELODY)),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("gameover_melody");
    expect(stdout).toContain("ui-notification-chime");
    expect(stdout).toContain("Tempo: 100");
  });

  it("shows repeat info for rhythmic_sting preset", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "inspect", "--preset", RHYTHMIC_STING)),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("Repeat");
  });

  it("--validate reports valid preset", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "inspect", "--preset", WEAPON_BURST, "--validate", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.valid).toBe(true);
    expect(data.errors).toHaveLength(0);
  });

  it("--validate reports errors for invalid preset", async () => {
    // Write a bad preset to a temp file
    const badPath = join(tmpdir(), `tf-bad-preset-${Date.now()}.json`);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(badPath, JSON.stringify({ version: 42, events: "bad" }));

    try {
      const { code, stdout } = await captureOutput(() =>
        main(argv("sequence", "inspect", "--preset", badPath, "--validate", "--json")),
      );
      expect(code).toBe(0);
      const data = JSON.parse(stdout);
      expect(data.valid).toBe(false);
      expect(data.errors.length).toBeGreaterThan(0);
    } finally {
      try { unlinkSync(badPath); } catch { /* ignore */ }
    }
  });

  it("inspect returns error for nonexistent preset file", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("sequence", "inspect", "--preset", "nonexistent.json", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("error");
  });
});

// ── Generate ──────────────────────────────────────────────────────

describe("CLI sequence generate", () => {
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const f of tempFiles) {
      try { unlinkSync(f); } catch { /* ignore */ }
    }
    tempFiles.length = 0;
  });

  it("generates WAV file from weapon_burst preset", async () => {
    const outPath = join(tmpdir(), `tf-seq-gen-${Date.now()}.wav`);
    tempFiles.push(outPath);

    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "generate", "--preset", WEAPON_BURST, "--seed", "42", "--output", outPath, "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.command).toBe("sequence generate");
    expect(data.name).toBe("weapon_burst");
    expect(data.seed).toBe(42);
    expect(data.events).toBe(3);
    expect(data.duration).toBeGreaterThan(0);
    expect(data.sampleRate).toBe(44100);
    expect(data.samples).toBeGreaterThan(0);

    // Verify file exists and is a valid WAV
    expect(existsSync(outPath)).toBe(true);
    const wavData = readFileSync(outPath);
    expect(wavData.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wavData.toString("ascii", 8, 12)).toBe("WAVE");
  });

  it("plays audio when --output is omitted (human mode)", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "generate", "--preset", WEAPON_BURST, "--seed", "42")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("Playing");
    expect(stdout).toContain("Done");
  });

  it("produces JSON with played:true when --output is omitted", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("sequence", "generate", "--preset", WEAPON_BURST, "--seed", "42", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.played).toBe(true);
  });

  it("generates WAV file from gameover_melody preset", async () => {
    const outPath = join(tmpdir(), `tf-seq-melody-${Date.now()}.wav`);
    tempFiles.push(outPath);

    const { code } = await captureOutput(() =>
      main(argv("sequence", "generate", "--preset", GAMEOVER_MELODY, "--seed", "42", "--output", outPath)),
    );
    expect(code).toBe(0);
    expect(existsSync(outPath)).toBe(true);
  });

  it("respects --duration flag for generate", async () => {
    const outPath = join(tmpdir(), `tf-seq-dur-${Date.now()}.wav`);
    tempFiles.push(outPath);

    const { code, stdout } = await captureOutput(() =>
      main(argv(
        "sequence", "generate",
        "--preset", WEAPON_BURST,
        "--seed", "42",
        "--duration", "0.15",
        "--output", outPath,
        "--json",
      )),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    // With duration=0.15, only first 2 events (t=0, t=0.12) fit
    expect(data.events).toBe(2);
  });

  it("deterministic: same preset+seed produces identical WAV files", async () => {
    const path1 = join(tmpdir(), `tf-seq-det1-${Date.now()}.wav`);
    const path2 = join(tmpdir(), `tf-seq-det2-${Date.now()}.wav`);
    tempFiles.push(path1, path2);

    await captureOutput(() =>
      main(argv("sequence", "generate", "--preset", WEAPON_BURST, "--seed", "42", "--output", path1)),
    );
    await captureOutput(() =>
      main(argv("sequence", "generate", "--preset", WEAPON_BURST, "--seed", "42", "--output", path2)),
    );

    const wav1 = readFileSync(path1);
    const wav2 = readFileSync(path2);
    expect(wav1.equals(wav2)).toBe(true);
  });

  it("different seeds produce different WAV files", async () => {
    const path1 = join(tmpdir(), `tf-seq-diff1-${Date.now()}.wav`);
    const path2 = join(tmpdir(), `tf-seq-diff2-${Date.now()}.wav`);
    tempFiles.push(path1, path2);

    await captureOutput(() =>
      main(argv("sequence", "generate", "--preset", WEAPON_BURST, "--seed", "42", "--output", path1)),
    );
    await captureOutput(() =>
      main(argv("sequence", "generate", "--preset", WEAPON_BURST, "--seed", "99", "--output", path2)),
    );

    const wav1 = readFileSync(path1);
    const wav2 = readFileSync(path2);
    expect(wav1.equals(wav2)).toBe(false);
  });
});
