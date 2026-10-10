/**
 * CLI Integration Tests for the runtime command.
 *
 * Tests help text, flag validation, JSON timeline output, and headless WAV
 * export/playback for `toneforge runtime demo`.
 *
 * Work item: TF-0MUXW66870013DOL
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock playAudio to avoid actual audio playback.
vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

import { main } from "./cli.js";

// ── Helpers ───────────────────────────────────────────────────────

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

function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

// ── Help Text ─────────────────────────────────────────────────────

describe("CLI runtime — help text", () => {
  it("shows runtime help when no subcommand given", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("runtime")));
    expect(code).toBe(0);
    expect(stdout).toContain("runtime");
    expect(stdout).toContain("demo");
  });

  it("shows runtime help with --help flag", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("runtime", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("# ToneForge runtime");
  });

  it("shows demo help", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("runtime", "demo", "--help")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("runtime demo");
    expect(stdout).toContain("--scenario");
    expect(stdout).toContain("--output");
    expect(stdout).toContain("--json");
  });
});

// ── Flag Validation ───────────────────────────────────────────────

describe("CLI runtime — flag validation", () => {
  it("rejects a non-integer seed", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("runtime", "demo", "--seed", "abc", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("integer");
  });

  it("rejects an unknown subcommand", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("runtime", "bogus", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Unknown runtime subcommand");
  });

  it("reports a missing scenario file", async () => {
    const { code, stderr } = await captureOutput(() =>
      main(argv("runtime", "demo", "--scenario", "presets/runtime/nope.json", "--json")),
    );
    expect(code).toBe(1);
    expect(stderr).toContain("Failed to read runtime scenario");
  });
});

// ── JSON timeline ─────────────────────────────────────────────────

describe("CLI runtime demo — JSON timeline", () => {
  it("prints the resolved event timeline as JSON", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("runtime", "demo", "--json")),
    );
    expect(code).toBe(0);

    const data = JSON.parse(stdout);
    expect(data.command).toBe("runtime demo");
    expect(data.scenario).toBe("runtime_footsteps");
    expect(data.seed).toBe(42);
    expect(data.sampleRate).toBe(44100);
    expect(data.played).toBe(false);
    expect(Array.isArray(data.events)).toBe(true);
    expect(data.events.length).toBeGreaterThan(0);

    const recipes = data.events.map((e: { recipe: string }) => e.recipe);
    expect(recipes).toContain("footstep-stone");
    expect(recipes).toContain("footstep-gravel");

    const states = data.events.map((e: { state: string }) => e.state);
    expect(states).toContain("walk");
    expect(states).toContain("sprint");
  });

  it("honours the --seed override", async () => {
    const { code, stdout } = await captureOutput(() =>
      main(argv("runtime", "demo", "--seed", "7", "--json")),
    );
    expect(code).toBe(0);
    const data = JSON.parse(stdout);
    expect(data.seed).toBe(7);
    // Event seeds are baseSeed + seedOffset.
    expect(data.events[0].eventSeed).toBe(7);
  });

  it("is deterministic: same seed produces identical JSON", async () => {
    const run = async () => {
      const { stdout } = await captureOutput(() =>
        main(argv("runtime", "demo", "--json")),
      );
      return stdout;
    };
    expect(await run()).toBe(await run());
  });
});

// ── Headless export ───────────────────────────────────────────────

describe("CLI runtime demo — --output export", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("writes the mixed WAV, per-event WAVs, and timeline.json", async () => {
    const outDir = join(tmpdir(), `tf-runtime-${Date.now()}-${Math.random()}`);
    tempDirs.push(outDir);

    const { code, stdout } = await captureOutput(() =>
      main(argv("runtime", "demo", "--output", outDir)),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("Wrote runtime demo");

    const mixed = join(outDir, "runtime-demo.wav");
    const timeline = join(outDir, "timeline.json");
    expect(existsSync(mixed)).toBe(true);
    expect(existsSync(timeline)).toBe(true);

    // Valid RIFF/WAVE header.
    const wav = readFileSync(mixed);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");

    // Per-event WAVs exist for both surfaces.
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(outDir);
    expect(files.some((f) => f.includes("footstep-stone"))).toBe(true);
    expect(files.some((f) => f.includes("footstep-gravel"))).toBe(true);

    // Timeline JSON is well-formed and marks played:false.
    const data = JSON.parse(readFileSync(timeline, "utf-8"));
    expect(data.command).toBe("runtime demo");
    expect(data.played).toBe(false);
    expect(data.events.length).toBeGreaterThan(0);
  });

  it("does not play audio when --output is given", async () => {
    const playerModule = await import("./audio/player.js");
    const outDir = join(tmpdir(), `tf-runtime-noplay-${Date.now()}-${Math.random()}`);
    tempDirs.push(outDir);

    vi.mocked(playerModule.playAudio).mockClear();
    const { code } = await captureOutput(() =>
      main(argv("runtime", "demo", "--output", outDir)),
    );
    expect(code).toBe(0);
    expect(playerModule.playAudio).not.toHaveBeenCalled();
  });
});

// ── Playback ──────────────────────────────────────────────────────

describe("CLI runtime demo — playback", () => {
  it("plays audio when --output and --json are omitted", async () => {
    const playerModule = await import("./audio/player.js");
    vi.mocked(playerModule.playAudio).mockClear();

    const { code, stdout } = await captureOutput(() =>
      main(argv("runtime", "demo")),
    );
    expect(code).toBe(0);
    expect(stdout).toContain("Playing");
    expect(stdout).toContain("Done");
    expect(playerModule.playAudio).toHaveBeenCalledTimes(1);
  });
});
