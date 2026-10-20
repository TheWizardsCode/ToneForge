/**
 * CLI integration tests for `toneforge instrument noteon` / `noteoff`.
 *
 * Runs the real CLI entry (`main`) against an in-process instrument daemon
 * backed by a silent engine and a fake clock, so the sustained-playback
 * semantics, `--length` auto Note Off, validation and JSON output are all
 * exercised headlessly (no audio device, no real timers).
 *
 * Work item: TF-0MVBECXFJ006SSW4.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { rmSync, existsSync } from "node:fs";

// The --fallback path plays through the system player; mock it so the test
// runs headless and can assert the rendered buffer handed to the player.
vi.mock("./audio/player.js", () => ({
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

import { main } from "./cli.js";
import { decodeWavFile } from "./audio/wav-decoder.js";
import { computeRms, isSilent } from "./instruments/__tests__/helpers.js";
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
import { DEFAULT_NOTE_HOLD_SECONDS } from "./instruments/offline-demo.js";

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

/** Deterministic fake clock so `--length` fires without wall-clock waits. */
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

beforeEach(async () => {
  instrumentRegistry.clear();
  await loadBundledInstrumentPresets();

  socketPath = join(
    tmpdir(),
    `toneforge-cli-test-${process.pid}-${Math.random().toString(36).slice(2)}.sock`,
  );
  prevSocketEnv = process.env.TONEFORGE_INSTRUMENT_SOCKET;
  process.env.TONEFORGE_INSTRUMENT_SOCKET = socketPath;

  clock = createFakeClock(0);
  daemon = createInstrumentDaemon({
    socketPath,
    createEngine: createNullEngineFactory(),
    clock,
    idleTimeoutMs: 0,
  });
  await daemon.start();
});

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

describe("instrument help", () => {
  it("is listed in the top-level help", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("--help")));
    expect(code).toBe(0);
    expect(stdout).toContain("instrument");
    expect(stdout).toContain("Demo live MIDI note playback");
  });

  it("documents noteon options and the hold semantics", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("instrument", "noteon", "--help")));
    expect(code).toBe(0);
    expect(stdout).toContain("instrument noteon");
    expect(stdout).toContain("--preset");
    expect(stdout).toContain("--velocity");
    expect(stdout).toContain("--length");
    expect(stdout).toContain("--output");
    expect(stdout).toContain("--fallback");
    expect(stdout).toMatch(/sounding until/i);
  });

  it("documents the group subcommands", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("instrument", "--help")));
    expect(code).toBe(0);
    expect(stdout).toContain("noteon");
    expect(stdout).toContain("noteoff");
    expect(stdout).toContain("status");
    expect(stdout).toContain("stop");
  });
});

// ── Sustained playback ────────────────────────────────────────────

describe("instrument noteon / noteoff", () => {
  it("holds a note across two sequential invocations and releases it", async () => {
    const on = await captureOutput(() => main(argv("instrument", "noteon", "60")));
    expect(on.code).toBe(0);
    expect(on.stdout).toContain("Holding note 60");
    expect(daemon!.heldNotes().map((n) => n.note)).toEqual([60]);

    // The note is still sounding between invocations.
    const status = await captureOutput(() => main(argv("instrument", "status")));
    expect(status.code).toBe(0);
    expect(status.stdout).toContain("note 60");

    const off = await captureOutput(() => main(argv("instrument", "noteoff", "60")));
    expect(off.code).toBe(0);
    expect(off.stdout).toContain("Released note 60");
    expect(daemon!.heldNotes()).toHaveLength(0);
  });

  it("releases only the matching note of a chord", async () => {
    for (const note of ["60", "64", "67"]) {
      const result = await captureOutput(() => main(argv("instrument", "noteon", note)));
      expect(result.code).toBe(0);
    }
    const off = await captureOutput(() => main(argv("instrument", "noteoff", "64")));
    expect(off.code).toBe(0);

    const status = await captureOutput(() => main(argv("instrument", "status", "--json")));
    expect(status.code).toBe(0);
    const parsed = JSON.parse(status.stdout) as { notes: Array<{ note: number }> };
    expect(parsed.notes.map((n) => n.note).sort()).toEqual([60, 67]);
  });

  it("fails with a clear message for an unmatched noteoff", async () => {
    const off = await captureOutput(() => main(argv("instrument", "noteoff", "60")));
    expect(off.code).toBe(1);
    expect(off.stderr).toContain("not currently held");
  });

  it("applies --preset and --velocity", async () => {
    const on = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--preset", "pad", "--velocity", "90")),
    );
    expect(on.code).toBe(0);
    expect(on.stdout).toContain("pad");
    expect(on.stdout).toContain("90");
    expect(daemon!.heldNotes()[0]).toMatchObject({ note: 60, velocity: 90, preset: "pad" });
  });

  it("emits JSON when --json is set", async () => {
    const on = await captureOutput(() => main(argv("instrument", "noteon", "60", "--json")));
    expect(on.code).toBe(0);
    expect(JSON.parse(on.stdout)).toMatchObject({
      ok: true,
      command: "instrument-noteon",
      note: 60,
      preset: "pluck",
    });

    const off = await captureOutput(() => main(argv("instrument", "noteoff", "60", "--json")));
    expect(JSON.parse(off.stdout)).toMatchObject({ ok: true, command: "instrument-noteoff", note: 60 });
  });
});

// ── --length ──────────────────────────────────────────────────────

describe("instrument noteon --length", () => {
  it("sends the matching Note Off automatically after the duration", async () => {
    const on = await captureOutput(() => main(argv("instrument", "noteon", "67", "--length", "0.5")));
    expect(on.code).toBe(0);
    expect(on.stdout).toContain("automatically after 0.5s");
    expect(daemon!.heldNotes().map((n) => n.note)).toEqual([67]);

    clock.advance(499);
    await new Promise((r) => setTimeout(r, 0));
    expect(daemon!.heldNotes().map((n) => n.note)).toEqual([67]);

    clock.advance(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(daemon!.heldNotes()).toHaveLength(0);
  });

  it("rejects a non-positive --length", async () => {
    const on = await captureOutput(() => main(argv("instrument", "noteon", "60", "--length", "0")));
    expect(on.code).toBe(1);
    expect(on.stderr).toContain("--length");
    expect(daemon!.heldNotes()).toHaveLength(0);
  });
});

// ── Validation ────────────────────────────────────────────────────

describe("instrument validation", () => {
  it.each(["128", "-1", "60.5", "abc"])("rejects an invalid note '%s'", async (note) => {
    const on = await captureOutput(() => main(argv("instrument", "noteon", note)));
    expect(on.code).toBe(1);
    expect(on.stderr).toContain("invalid MIDI note");
    expect(daemon!.heldNotes()).toHaveLength(0);
  });

  it.each(["0", "128", "abc"])("rejects an invalid velocity '%s'", async (velocity) => {
    const on = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--velocity", velocity)),
    );
    expect(on.code).toBe(1);
    expect(on.stderr).toContain("--velocity");
  });

  it("rejects an unknown preset and lists the available ones", async () => {
    const on = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--preset", "not-a-preset")),
    );
    expect(on.code).toBe(1);
    expect(on.stderr).toContain("not-a-preset");
    expect(on.stderr).toContain("Available presets");
  });
});

// ── status / presets / stop ───────────────────────────────────────

describe("instrument status, presets and stop", () => {
  it("reports held notes and an empty state", async () => {
    const empty = await captureOutput(() => main(argv("instrument", "status")));
    expect(empty.stdout).toContain("No notes are currently held");

    await captureOutput(() => main(argv("instrument", "noteon", "60")));
    await captureOutput(() => main(argv("instrument", "noteon", "64")));
    const held = await captureOutput(() => main(argv("instrument", "status")));
    expect(held.stdout).toContain("note 60");
    expect(held.stdout).toContain("note 64");
  });

  it("lists the bundled instrument presets", async () => {
    const { code, stdout } = await captureOutput(() => main(argv("instrument", "presets")));
    expect(code).toBe(0);
    for (const id of ["pluck", "pad", "bass", "bell", "string-lead", "drum-kit", "percussion"]) {
      expect(stdout).toContain(id);
    }
  });

  it("stops the daemon and releases held notes", async () => {
    await captureOutput(() => main(argv("instrument", "noteon", "60")));
    const stop = await captureOutput(() => main(argv("instrument", "stop")));
    expect(stop.code).toBe(0);
    expect(stop.stdout).toContain("Stopped the instrument daemon");

    // The fake daemon object shared by the test reflects the release.
    await daemon!.whenStopped();
    expect(daemon!.heldNotes()).toHaveLength(0);
  });

  it("is a no-op when stopping a daemon that is not running", async () => {
    await daemon!.stop("test");
    daemon = null;
    await new Promise((r) => setTimeout(r, 10));
    const stop = await captureOutput(() => main(argv("instrument", "stop")));
    expect(stop.code).toBe(0);
  });

  it("rejects an unknown subcommand", async () => {
    const result = await captureOutput(() => main(argv("instrument", "nope")));
    expect(result.code).toBe(1);
  });
});

// ── Drum kit CLI integration (offline renders) ────────────────────

/** The shipped action leitmotif: carries GM drums (36/38/42/49) plus melody. */
const ACTION_MIDI = resolve(import.meta.dirname, "../assets/music/leitmotif-action.mid");

/** The melodic fixture used to prove non-kit notes are ignored. */
const DRUM_FREE_MIDI = resolve(import.meta.dirname, "test-utils/fixtures/midi/chord.mid");

describe("instrument drum kit (offline renders, per-note voices)", () => {
  beforeEach(async () => {
    await loadBundledInstrumentPresets();
    vi.mocked(playAudio).mockClear();
  });

  it("renders the kick (note 36) non-silent via noteon --preset drum-kit", async () => {
    const target = join(tmpdir(), `tf-kick-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const result = await captureOutput(() =>
      main(argv("instrument", "noteon", "36", "--preset", "drum-kit", "--length", "0.05", "--output", target)),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote");

    const wav = await decodeWavFile(target);
    expect(wav.sampleRate).toBe(44100);
    expect(computeRms(wav.samples)).toBeGreaterThan(0.001);
    rmSync(target, { force: true });
  });

  it("renders leitmotif-action.mid through the kit: drums audible, oblivious to length", async () => {
    const target = join(tmpdir(), `tf-action-kit-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const result = await captureOutput(() =>
      main(argv("instrument", "play", ACTION_MIDI, "--preset", "drum-kit", "--output", target)),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote");

    const wav = await decodeWavFile(target);
    expect(wav.sampleRate).toBe(44100);
    expect(wav.samples.length).toBeGreaterThan(0);
    // GM drums (36/38/42/49) hit their one-shot kit voices: audible.
    expect(computeRms(wav.samples)).toBeGreaterThan(0.001);
    rmSync(target, { force: true });
  });

  it("ignores non-kit notes deterministically (melodic file renders silent)", async () => {
    const target = join(tmpdir(), `tf-mel-kit-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const result = await captureOutput(() =>
      main(argv("instrument", "play", DRUM_FREE_MIDI, "--preset", "drum-kit", "--output", target)),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote");

    // chord.mid contains notes 60/64/67 — none are kit notes, so the kit
    // deliberately renders silence for the whole file (documented behaviour:
    // auditioning the drum track alone).
    const wav = await decodeWavFile(target);
    expect(wav.samples.length).toBeGreaterThan(0);
    expect(isSilent(wav.samples)).toBe(true);
    rmSync(target, { force: true });
  });

  it("is deterministic: two kit renders of the action cue are byte-identical", async () => {
    const a = join(tmpdir(), `tf-kit-a-${Date.now()}.wav`);
    const b = join(tmpdir(), `tf-kit-b-${Date.now()}.wav`);
    const runOne = await captureOutput(() =>
      main(argv("instrument", "play", ACTION_MIDI, "--preset", "drum-kit", "--output", a)),
    );
    const runTwo = await captureOutput(() =>
      main(argv("instrument", "play", ACTION_MIDI, "--preset", "drum-kit", "--output", b)),
    );
    expect(runOne.code).toBe(0);
    expect(runTwo.code).toBe(0);
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(a).equals(readFileSync(b))).toBe(true);
    rmSync(a, { force: true });
    rmSync(b, { force: true });
  });

  it("renders distinct kit voices for different GM notes", async () => {
    const kick = join(tmpdir(), `tf-kick-${Date.now()}.wav`);
    const hat = join(tmpdir(), `tf-hat-${Date.now()}.wav`);
    const runKick = await captureOutput(() =>
      main(argv("instrument", "noteon", "36", "--preset", "drum-kit", "--length", "0.05", "--output", kick)),
    );
    const runHat = await captureOutput(() =>
      main(argv("instrument", "noteon", "42", "--preset", "drum-kit", "--length", "0.05", "--output", hat)),
    );
    expect(runKick.code).toBe(0);
    expect(runHat.code).toBe(0);
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(kick).equals(readFileSync(hat))).toBe(false);
    rmSync(kick, { force: true });
    rmSync(hat, { force: true });
  });
});

// ── Offline modes: --output and --fallback ────────────────────────

describe("instrument noteon --output / --fallback (offline, no device)", () => {
  beforeEach(() => {
    vi.mocked(playAudio).mockClear();
  });

  it("renders a note to a decodable, non-silent WAV with --output", async () => {
    const target = join(tmpdir(), `tf-note-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const result = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--preset", "pad", "--length", "0.4", "--output", target)),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote");
    expect(existsSync(target)).toBe(true);

    const wav = await decodeWavFile(target);
    expect(wav.sampleRate).toBe(44100);
    expect(wav.samples.length).toBeGreaterThan(0);
    expect(computeRms(wav.samples)).toBeGreaterThan(0.001);
    rmSync(target, { force: true });
  });

  it("uses the documented default hold when --length is omitted", async () => {
    const target = join(tmpdir(), `tf-default-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const result = await captureOutput(() =>
      main(argv("instrument", "noteon", "64", "--output", target)),
    );
    expect(result.code).toBe(0);
    const wav = await decodeWavFile(target);
    // Default hold (>=1 s) + release tail is audible.
    expect(wav.samples.length / wav.sampleRate).toBeGreaterThanOrEqual(DEFAULT_NOTE_HOLD_SECONDS);
    expect(computeRms(wav.samples)).toBeGreaterThan(0.001);
    rmSync(target, { force: true });
  });

  it("is deterministic: two renders produce byte-identical WAVs", async () => {
    const a = join(tmpdir(), `tf-det-a-${Date.now()}.wav`);
    const b = join(tmpdir(), `tf-det-b-${Date.now()}.wav`);
    const runOne = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--length", "0.3", "--output", a)),
    );
    const runTwo = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--length", "0.3", "--output", b)),
    );
    expect(runOne.code).toBe(0);
    expect(runTwo.code).toBe(0);
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(a).equals(readFileSync(b))).toBe(true);
    rmSync(a, { force: true });
    rmSync(b, { force: true });
  });

  it("plays the pre-rendered note through the system player with --fallback", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "noteon", "67", "--preset", "bell", "--length", "0.3", "--fallback")),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("offline pre-render");
    expect(playAudio).toHaveBeenCalledTimes(1);
    const [samples, options] = vi.mocked(playAudio).mock.calls[0] as unknown as [Float32Array, { sampleRate: number }];
    expect(samples).toBeInstanceOf(Float32Array);
    expect(options.sampleRate).toBe(44100);
    expect(computeRms(samples)).toBeGreaterThan(0.001);
  });

  it("rejects --output combined with --fallback", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--output", "a.wav", "--fallback")),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("cannot be combined");
  });

  it("rejects an unknown preset in offline mode and lists available ones", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--preset", "nope", "--output", "a.wav")),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Unknown instrument preset 'nope'");
  });

  it("reports an unwritable --output path with exit 1", async () => {
    const dir = join(tmpdir(), `tf-ro-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
    const result = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--output", dir)),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("EISDIR");
    rmSync(dir, { recursive: true, force: true });
  });

  it("emits JSON with file metadata for --output", async () => {
    const target = join(tmpdir(), `tf-json-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    const result = await captureOutput(() =>
      main(argv("instrument", "noteon", "60", "--length", "0.2", "--output", target, "--json")),
    );
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      command: string;
      file: string;
      sampleRate: number;
      duration: number;
    };
    expect(parsed).toMatchObject({
      ok: true,
      command: "instrument-noteon",
      sampleRate: 44100,
    });
    expect(parsed.file).toContain(".wav");
    expect(parsed.duration).toBeGreaterThan(0.2);
    rmSync(target, { force: true });
    rmSync(parsed.file, { force: true });
  });
});
