/**
 * CLI integration tests for `toneforge instrument play --track / --channel`
 * (single-voice isolation of a multi-track MIDI file).
 *
 * Covers the filter semantics end-to-end through the real CLI surface with the
 * shipped leitmotif files: track selection, channel selection, multi-value
 * (comma-separated **and** repeated) flags, the track/channel intersection,
 * deterministic renders within a fixed filter, backward-compatible full-mix
 * behaviour, and clear UK-English validation errors (no stack traces). All
 * tests are hermetic/headless: the offline `--output` path needs no audio
 * device and asserts observable WAV properties only.
 *
 * Work item: TF-0MVEWJCRP006IXGC (discovered from TF-0MVDQP78X007OZNA).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { rmSync, existsSync, readFileSync } from "node:fs";

// Keep the suite hermetic: the offline `--output` path never plays audio, but
// mock the system player so no code path can reach a real device.
vi.mock("./audio/player.js", () => ({ playAudio: vi.fn().mockResolvedValue(undefined) }));

import { main } from "./cli.js";
import { decodeWavFile } from "./audio/wav-decoder.js";
import { computeRms } from "./instruments/__tests__/helpers.js";
import { parseMidiFile, type ParsedMidi } from "./midi/smf.js";

const MUSIC_DIR = resolve(import.meta.dirname, "../assets/music");
const ACTION = join(MUSIC_DIR, "leitmotif-action.mid");
const MENU = join(MUSIC_DIR, "leitmotif-menu.mid");

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

function loadParsed(file: string): ParsedMidi {
  return parseMidiFile(new Uint8Array(readFileSync(file)));
}

/** Number of note events (on + off) a track contributes to the merged stream. */
function trackNoteEventCount(parsed: ParsedMidi, trackIndex: number): number {
  return parsed.tracks[trackIndex]!.filter(
    (entry) => entry.event.type === "noteOn" || entry.event.type === "noteOff",
  ).length;
}

/** Total note events (on + off) across every track of a file. */
function totalNoteEventCount(parsed: ParsedMidi): number {
  return parsed.tracks.reduce(
    (sum, _track, index) => sum + trackNoteEventCount(parsed, index),
    0,
  );
}

/** Unique temporary WAV path for one test. */
function tempWav(label: string): string {
  return join(
    tmpdir(),
    `tf-voice-${label}-${process.pid}-${Math.random().toString(36).slice(2)}.wav`,
  );
}

interface PlayRender {
  code: number;
  stdout: string;
  stderr: string;
  noteEvents: number;
  file: string;
}

/** Run `instrument play … --output` with `--json` and decode the render. */
async function renderPlay(...args: string[]): Promise<PlayRender> {
  const target = tempWav("render");
  const result = await captureOutput(() =>
    main(argv("instrument", "play", ...args, "--output", target, "--json")),
  );
  if (result.code !== 0) {
    rmSync(target, { force: true });
    return { ...result, noteEvents: -1, file: target };
  }
  const parsed = JSON.parse(result.stdout) as {
    ok: boolean;
    command: string;
    file: string;
    noteEvents: number;
  };
  expect(parsed).toMatchObject({ ok: true, command: "instrument-play" });
  return { ...result, noteEvents: parsed.noteEvents, file: parsed.file };
}

async function expectAudible(file: string): Promise<void> {
  const wav = await decodeWavFile(file);
  expect(wav.sampleRate).toBe(44100);
  expect(wav.samples.length).toBeGreaterThan(0);
  expect(computeRms(wav.samples)).toBeGreaterThan(0.001);
}

beforeEach(async () => {
  const { loadBundledInstrumentPresets } = await import("./instruments/presets.js");
  await loadBundledInstrumentPresets();
});

// ── Filter semantics ──────────────────────────────────────────────

describe("instrument play --track (single voice)", () => {
  it("renders only the percussion track of the action cue as audible audio", async () => {
    const parsed = loadParsed(ACTION);
    // The shipped percussion track (index 5, channel 9) carries 111 note-ons.
    const percussionNoteOns = parsed.tracks[5]!.filter(
      (entry) => entry.event.type === "noteOn",
    ).length;
    expect(percussionNoteOns).toBe(111);
    const percussionEvents = trackNoteEventCount(parsed, 5);

    const render = await renderPlay(ACTION, "--track", "5");
    try {
      expect(render.code).toBe(0);
      expect(render.noteEvents).toBe(percussionEvents);
      expect(render.noteEvents).toBeLessThan(totalNoteEventCount(parsed));
      expect(existsSync(render.file)).toBe(true);
      await expectAudible(render.file);
    } finally {
      rmSync(render.file, { force: true });
    }
  });

  it("renders the menu bass track audible and distinct from the full mix", async () => {
    const parsed = loadParsed(MENU);
    const bass = await renderPlay(MENU, "--track", "3");
    const full = await renderPlay(MENU);
    try {
      expect(bass.code).toBe(0);
      expect(full.code).toBe(0);
      expect(bass.noteEvents).toBe(trackNoteEventCount(parsed, 3));
      expect(full.noteEvents).toBe(totalNoteEventCount(parsed));
      // A filtered voice is a different render from the merged mix.
      expect(readFileSync(bass.file).equals(readFileSync(full.file))).toBe(false);
      await expectAudible(bass.file);
      await expectAudible(full.file);
    } finally {
      rmSync(bass.file, { force: true });
      rmSync(full.file, { force: true });
    }
  });

  it("selects the same events by channel as by the equivalent track", async () => {
    // The percussion track is the only track on channel 9.
    const byTrack = await renderPlay(ACTION, "--track", "5");
    const byChannel = await renderPlay(ACTION, "--channel", "9");
    try {
      expect(byTrack.code).toBe(0);
      expect(byChannel.code).toBe(0);
      expect(byChannel.noteEvents).toBe(byTrack.noteEvents);
      expect(readFileSync(byChannel.file).equals(readFileSync(byTrack.file))).toBe(true);
    } finally {
      rmSync(byTrack.file, { force: true });
      rmSync(byChannel.file, { force: true });
    }
  });

  it("accepts multiple tracks, comma-separated or repeated, with identical results", async () => {
    const parsed = loadParsed(ACTION);
    const expected = trackNoteEventCount(parsed, 1) + trackNoteEventCount(parsed, 2);

    const comma = await renderPlay(ACTION, "--track", "1,2");
    const repeated = await renderPlay(ACTION, "--track", "1", "--track", "2");
    try {
      expect(comma.code).toBe(0);
      expect(repeated.code).toBe(0);
      expect(comma.noteEvents).toBe(expected);
      expect(repeated.noteEvents).toBe(expected);
      expect(readFileSync(comma.file).equals(readFileSync(repeated.file))).toBe(true);
    } finally {
      rmSync(comma.file, { force: true });
      rmSync(repeated.file, { force: true });
    }
  });

  it("accepts multiple channels, comma-separated or repeated", async () => {
    const comma = await renderPlay(ACTION, "--channel", "1,2");
    const repeated = await renderPlay(ACTION, "--channel", "1", "--channel", "2");
    try {
      expect(comma.code).toBe(0);
      expect(repeated.code).toBe(0);
      expect(comma.noteEvents).toBe(
        trackNoteEventCount(loadParsed(ACTION), 1) + trackNoteEventCount(loadParsed(ACTION), 2),
      );
      expect(readFileSync(comma.file).equals(readFileSync(repeated.file))).toBe(true);
    } finally {
      rmSync(comma.file, { force: true });
      rmSync(repeated.file, { force: true });
    }
  });

  it("intersects --track with --channel", async () => {
    const parsed = loadParsed(ACTION);

    // Track 2 (melody) is on channel 2 — the matching pair keeps the melody.
    const matching = await renderPlay(ACTION, "--track", "2", "--channel", "2");
    try {
      expect(matching.code).toBe(0);
      expect(matching.noteEvents).toBe(trackNoteEventCount(parsed, 2));
    } finally {
      rmSync(matching.file, { force: true });
    }

    // Track 1 (pad, channel 1) never carries channel-9 events: the
    // intersection is empty and lands on the existing no-note-events error.
    const empty = await captureOutput(() =>
      main(argv("instrument", "play", ACTION, "--track", "1", "--channel", "9", "--output", tempWav("empty"))),
    );
    expect(empty.code).toBe(1);
    expect(empty.stderr).toContain("no note events found");
    expect(empty.stderr).not.toMatch(/\s+at /);
  });

  it("is deterministic within a fixed filter", async () => {
    const first = await renderPlay(MENU, "--track", "3");
    const second = await renderPlay(MENU, "--track", "3");
    try {
      expect(first.code).toBe(0);
      expect(second.code).toBe(0);
      expect(readFileSync(first.file).equals(readFileSync(second.file))).toBe(true);
    } finally {
      rmSync(first.file, { force: true });
      rmSync(second.file, { force: true });
    }
  });

  it("keeps the full-mix behaviour when neither flag is given", async () => {
    const parsed = loadParsed(ACTION);
    const full = await renderPlay(ACTION);
    try {
      expect(full.code).toBe(0);
      expect(full.noteEvents).toBe(totalNoteEventCount(parsed));
    } finally {
      rmSync(full.file, { force: true });
    }
  });
});

// ── Validation ────────────────────────────────────────────────────

describe("instrument play --track / --channel validation", () => {
  it("rejects an out-of-range track, naming the file's track count", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "play", ACTION, "--track", "7", "--output", tempWav("oob"))),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("file has 6 tracks (0–5); got 7");
    expect(result.stderr).not.toMatch(/\s+at /);
    expect(result.stderr).not.toContain("Error: Error:");
  });

  it("rejects a non-numeric track index", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "play", ACTION, "--track", "abc", "--output", tempWav("bad"))),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/invalid --track 'abc'/);
    expect(result.stderr).not.toMatch(/\s+at /);
  });

  it("rejects an out-of-range channel", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "play", ACTION, "--channel", "16", "--output", tempWav("bad-chan"))),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/invalid --channel '16'.*between 0 and 15/);
    expect(result.stderr).not.toMatch(/\s+at /);
  });

  it("rejects a non-numeric channel", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "play", ACTION, "--channel", "melody", "--output", tempWav("bad-chan2"))),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/invalid --channel 'melody'/);
    expect(result.stderr).not.toMatch(/\s+at /);
  });

  it("emits validation errors as JSON in --json mode", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "play", ACTION, "--track", "99", "--output", tempWav("bad-json"), "--json")),
    );
    expect(result.code).toBe(1);
    const parsed = JSON.parse(result.stderr) as { ok: boolean; error: string };
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("file has 6 tracks (0–5); got 99");
  });
});

// ── Help ──────────────────────────────────────────────────────────

describe("instrument play --help documents the voice selectors", () => {
  it("lists --track and --channel in the play help", async () => {
    const result = await captureOutput(() =>
      main(argv("instrument", "play", "--help")),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("--track");
    expect(result.stdout).toContain("--channel");
    expect(result.stdout).toMatch(/single voice|one voice|voice/i);
  });
});
