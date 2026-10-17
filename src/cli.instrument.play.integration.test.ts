/**
 * CLI integration tests for `toneforge instrument play <file.mid>`.
 *
 * Covers the CLI surface on top of the shipped MIDI import (TF-0MVBDU0RM007QTNR):
 * parse/read validation with clear UK-English errors, deterministic offline WAV
 * rendering (`--output`) at the pinned 44100 Hz, preset validation, the
 * `--fallback` system-player path, the mutually-exclusive flags guard, and the
 * real-time daemon path's device-less actionable error. All tests are hermetic/
 * headless: no physical audio device, no real tempo wall-clock, no real timers.
 *
 * Work item: TF-0MVCSYRQM008P812.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { rmSync, existsSync, readFileSync, mkdtempSync, writeFileSync } from "node:fs";

// The --fallback path plays through the system player; mock it so the test
// runs headless and can assert the rendered buffer handed to the player.
vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

import { main } from "./cli.js";
import { decodeWavFile } from "./audio/wav-decoder.js";
import {
  computeRms,
  estimateDominantFrequency,
  isSilent,
  midiNoteToFrequency,
} from "./instruments/__tests__/helpers.js";
import { playAudio } from "./audio/player.js";
import {
  createInstrumentDaemon,
  createNullEngineFactory,
  type InstrumentDaemon,
  type DaemonClock,
} from "./instruments/daemon.js";
import {
  instrumentRegistry,
  loadBundledInstrumentPresets,
} from "./instruments/presets.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "test-utils/fixtures/midi");
const CHORD = join(FIXTURES_DIR, "chord.mid");
const MELODY = join(FIXTURES_DIR, "melody.mid");

/** Frequency tolerance for pitch assertions (mirrors translate.test.ts). */
const FREQUENCY_TOLERANCE_RATIO = 0.045;

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
    return { code, stdout: stdoutLines.join("\n"), stderr: stderrLines.join("\n") };
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

function argv(...args: string[]): string[] {
  return ["node", "cli.ts", ...args];
}

/** Deterministic fake clock (mirrors cli.instrument.integration.test.ts). */
function createFakeClock(startMs = 0) {
  let now = startMs;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: DaemonClock & { advance: (ms: number) => void } = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number);
    },
    advance: (ms) => {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
  };
  return clock;
}

let socketPath: string;
let daemon: InstrumentDaemon | null = null;
let clock: ReturnType<typeof createFakeClock>;
let prevSocketEnv: string | undefined;

/** Daemon with a real-time audio device reported as *available* (null engine). */
async function startDaemon(): Promise<void> {
  preStart();
  daemon = createInstrumentDaemon({
    socketPath,
    createEngine: createNullEngineFactory(),
    clock,
    idleTimeoutMs: 0,
  });
  await daemon.start();
}

/** Daemon whose probe reports *no* live audio device (device-less path). */
async function startDeviceLessDaemon(): Promise<void> {
  preStart();
  daemon = createInstrumentDaemon({
    socketPath,
    createEngine: createNullEngineFactory(),
    probeAudio: async () => ({ environment: "linux", audioDeviceAvailable: false }),
    clock,
    idleTimeoutMs: 0,
  });
  await daemon.start();
}

function preStart(): void {
  instrumentRegistry.clear();
  socketPath = join(
    tmpdir(),
    `toneforge-play-test-${process.pid}-${Math.random().toString(36).slice(2)}.sock`,
  );
  prevSocketEnv = process.env.TONEFORGE_INSTRUMENT_SOCKET;
  process.env.TONEFORGE_INSTRUMENT_SOCKET = socketPath;
  clock = createFakeClock(0);
}

afterEach(async () => {
  if (daemon) {
    await daemon.stop("test-cleanup");
    daemon = null;
  }
  if (prevSocketEnv === undefined) {
    delete process.env.TONEFORGE_INSTRUMENT_SOCKET;
  } else {
    process.env.TONEFORGE_INSTRUMENT_SOCKET = prevSocketEnv;
  }
  try {
    rmSync(socketPath, { force: true });
  } catch {
    /* ignore */
  }
  instrumentRegistry.clear();
  await loadBundledInstrumentPresets();
});

// ── Help ──────────────────────────────────────────────────────────

describe("instrument play help", () => {
  it("documents the play subcommand in the group help", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("instrument", "--help")));
    expect(code).toBe(0);
    expect(stdout).toContain("play");
  });

  it("documents play usage and options via play --help", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("instrument", "play", "--help")));
    expect(code).toBe(0);
    expect(stdout).toContain("instrument play <file.mid>");
    expect(stdout).toContain("--preset");
    expect(stdout).toContain("--output");
    expect(stdout).toContain("--fallback");
    expect(stdout).toContain("--json");
  });

  it("is listed in the top-level help", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("--help")));
    expect(code).toBe(0);
    expect(stdout).toContain("instrument");
    expect(stdout).toContain("play");
  });
});

// ── File parsing / validation ─────────────────────────────────────

describe("instrument play file validation", () => {
  beforeEach(async () => {
    await loadBundledInstrumentPresets();
  });

  it("rejects a missing file argument with a clear error", async () => {
    const result = await captureOutput(() => main(argv("instrument", "play")));
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/requires a MIDI file/);
    expect(result.stderr).not.toMatch(/\s+at /);
  });

  it("rejects an unreadable file with a clear error and no stack trace", async () => {
    const missing = join(tmpdir(), `tf-no-${Date.now()}-${Math.random().toString(36).slice(2)}.mid`);
    const result = await captureOutput(() => main(argv("instrument", "play", missing)));
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/cannot read MIDI file/i);
    expect(result.stderr).not.toMatch(/\s+at /);
  });

  it("rejects invalid MIDI bytes with a clear error and no stack trace", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tf-bad-midi-"));
    const bad = join(dir, "bad.mid");
    writeFileSync(bad, Buffer.from("this is definitely not a midi file", "utf8"));
    try {
      const result = await captureOutput(() => main(argv("instrument", "play", bad)));
      expect(result.code).toBe(1);
      expect(result.stderr).toMatch(/invalid MIDI file/i);
      expect(result.stderr).not.toMatch(/\s+at /);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── Offline WAV render (--output) ─────────────────────────────────

describe("instrument play --output (offline WAV render, no device)", () => {
  beforeEach(async () => {
    await loadBundledInstrumentPresets();
    vi.mocked(playAudio).mockClear();
  });

  it("renders chord.mid to a decodable, non-silent 44100 Hz WAV with release-to-silence", async () => {
    const target = join(tmpdir(), `tf-chord-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const result = await captureOutput(() =>
      main(argv("instrument", "play", CHORD, "--output", target)),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote");
    expect(existsSync(target)).toBe(true);

    const wav = await decodeWavFile(target);
    expect(wav.sampleRate).toBe(44100);
    expect(wav.samples.length).toBeGreaterThan(0);
    expect(computeRms(wav.samples)).toBeGreaterThan(0.001);

    // Last note-off (1.0 s) + release (0.12 s) → silence resumes shortly after;
    // the engine appends a 0.2 s tail, so assert the final slice is silent.
    const tailStart = Math.floor(1.14 * wav.sampleRate);
    const tailSamples = wav.samples.slice(tailStart);
    expect(tailSamples.length).toBeGreaterThan(0);
    expect(isSilent(tailSamples)).toBe(true);
    rmSync(target, { force: true });
  });

  it("renders melody.mid at the expected pitches (tempo map honoured)", async () => {
    const target = join(tmpdir(), `tf-mel-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const result = await captureOutput(() =>
      main(argv("instrument", "play", MELODY, "--output", target)),
    );
    expect(result.code).toBe(0);
    const wav = await decodeWavFile(target);

    const rate = wav.sampleRate;
    const windowed = (start: number, end: number): Float32Array =>
      wav.samples.slice(Math.floor(start * rate), Math.floor(end * rate));

    // C5 window (0.03–0.22 s) — the previous silence gives a clean tone.
    const c5 = estimateDominantFrequency(windowed(0.03, 0.22), rate);
    const c5Target = midiNoteToFrequency(72);
    expect(Math.abs(c5 - c5Target) / c5Target).toBeLessThan(FREQUENCY_TOLERANCE_RATIO);

    // D5 window (0.52–0.72 s).
    const d5 = estimateDominantFrequency(windowed(0.52, 0.72), rate);
    const d5Target = midiNoteToFrequency(74);
    expect(Math.abs(d5 - d5Target) / d5Target).toBeLessThan(FREQUENCY_TOLERANCE_RATIO);

    // E5 window (1.02–1.22 s).
    const e5 = estimateDominantFrequency(windowed(1.02, 1.22), rate);
    const e5Target = midiNoteToFrequency(76);
    expect(Math.abs(e5 - e5Target) / e5Target).toBeLessThan(FREQUENCY_TOLERANCE_RATIO);

    // The A4 (note 69) onset at 2.0 s spans the 120 → 60 BPM tempo change, so
    // the file plays past 4.0 s (a naive fixed-tempo map would end at 3.0 s).
    expect(wav.samples.length / rate).toBeGreaterThan(4.0);
    expect(computeRms(wav.samples)).toBeGreaterThan(0.001);
    rmSync(target, { force: true });
  });

  it("is deterministic: two renders produce byte-identical WAVs", async () => {
    const a = join(tmpdir(), `tf-det-a-${Date.now()}.wav`);
    const b = join(tmpdir(), `tf-det-b-${Date.now()}.wav`);
    const runOne = await captureOutput(() =>
      main(argv("instrument", "play", CHORD, "--preset", "pad", "--output", a)),
    );
    const runTwo = await captureOutput(() =>
      main(argv("instrument", "play", CHORD, "--preset", "pad", "--output", b)),
    );
    expect(runOne.code).toBe(0);
    expect(runTwo.code).toBe(0);
    expect(readFileSync(a).equals(readFileSync(b))).toBe(true);
    rmSync(a, { force: true });
    rmSync(b, { force: true });
  });

  it("accepts any registered preset id and renders with it", async () => {
    const target = join(tmpdir(), `tf-preset-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const result = await captureOutput(() =>
      main(argv("instrument", "play", CHORD, "--preset", "bell", "--output", target)),
    );
    expect(result.code).toBe(0);
    const wav = await decodeWavFile(target);
    expect(wav.sampleRate).toBe(44100);
    expect(computeRms(wav.samples)).toBeGreaterThan(0.001);
    rmSync(target, { force: true });
  });

  it("rejects an unknown preset and lists the available ones", async () => {
    const target = join(tmpdir(), `tf-nopreset-${Date.now()}.wav`);
    const result = await captureOutput(() =>
      main(argv("instrument", "play", CHORD, "--preset", "nope", "--output", target)),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Unknown instrument preset 'nope'");
    expect(result.stderr).toContain("pluck");
    expect(existsSync(target)).toBe(false);
  });

  it("rejects --output combined with --fallback", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "play", CHORD, "--output", "a.wav", "--fallback")),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("cannot be combined");
  });

  it("plays the rendered file through the system player with --fallback", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "play", CHORD, "--fallback")),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("offline pre-render");
    expect(playAudio).toHaveBeenCalledTimes(1);
    const [samples, options] = vi.mocked(playAudio).mock.calls[0] as unknown as [Float32Array, { sampleRate: number }];
    expect(samples).toBeInstanceOf(Float32Array);
    expect(options.sampleRate).toBe(44100);
    expect(computeRms(samples)).toBeGreaterThan(0.001);
  });

  it("emits JSON with file metadata for --output", async () => {
    const target = join(tmpdir(), `tf-json-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const result = await captureOutput(() =>
      main(argv("instrument", "play", CHORD, "--output", target, "--json")),
    );
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      command: string;
      file: string;
      preset: string;
      sampleRate: number;
      duration: number;
    };
    expect(parsed).toMatchObject({
      ok: true,
      command: "instrument-play",
      preset: "pluck",
      sampleRate: 44100,
    });
    expect(parsed.file).toContain(".wav");
    expect(parsed.duration).toBeGreaterThan(1.0);
    expect(existsSync(parsed.file)).toBe(true);
    rmSync(parsed.file, { force: true });
  });
});

// ── Real-time path (device-less error) ────────────────────────────

describe("instrument play real-time path (device-less)", () => {
  it("fails with the actionable no-device error when no live audio device is available", async () => {
    await startDeviceLessDaemon();
    const result = await captureOutput(() =>
      main(argv("instrument", "play", CHORD)),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/no live audio device/i);
    expect(result.stderr).toContain("--output");
    expect(result.stderr).toContain("--fallback");
    expect(result.stderr).not.toMatch(/\s+at /);
  });

  it("emits the device-less error as JSON in --json mode", async () => {
    await startDeviceLessDaemon();
    const result = await captureOutput(() =>
      main(argv("instrument", "play", CHORD, "--json")),
    );
    expect(result.code).toBe(1);
    const parsed = JSON.parse(result.stderr) as {
      ok: boolean;
      command: string;
      code: string;
      environment: string;
      audioDeviceAvailable: boolean;
      error: string;
    };
    expect(parsed).toMatchObject({
      ok: false,
      command: "instrument-play",
      code: "no_audio_device",
      environment: "linux",
      audioDeviceAvailable: false,
    });
    expect(parsed.error).toContain("--output");
  });

  it("streams the file's note events through a live daemon (null engine, no device-less error)", async () => {
    await startDaemon();
    const result = await captureOutput(() =>
      main(argv("instrument", "play", CHORD, "--json")),
    );
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      command: string;
      preset: string;
      eventCount: number;
    };
    expect(parsed).toMatchObject({
      ok: true,
      command: "instrument-play",
      preset: "pluck",
      eventCount: 3,
    });

    // The three chord notes are held by the daemon, each with the file's own
    // auto-release length (1.0 s at 120 BPM), and release after it elapses.
    const held = daemon?.heldNotes() ?? [];
    expect(held).toHaveLength(3);
    expect(held.map((entry) => entry.note).sort()).toEqual([60, 64, 67]);
    expect(held.every((entry) => entry.length === 1.0)).toBe(true);

    clock.advance(1500);
    expect(daemon?.heldNotes().length ?? 0).toBe(0);
  });
});
