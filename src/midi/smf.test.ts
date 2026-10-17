/**
 * Unit tests for the SMF parsing layer (`src/midi/smf.ts`).
 *
 * Parses the committed SMF fixtures into the engine-neutral `ParsedMidi`
 * structure (header + delta-time note/tempo events) and resolves PPQ ticks
 * to absolute seconds through the tempo map, deterministically.
 *
 * Work item: TF-0MVBDU0RM007QTNR.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  parseMidiFile,
  buildTempoMap,
  DEFAULT_MICROSECONDS_PER_BEAT,
  type ParsedMidi,
} from "./smf.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../test-utils/fixtures/midi");

/** Load a committed fixture as raw bytes. */
function loadFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(FIXTURES_DIR, name)));
}

describe("parseMidiFile", () => {
  it("parses the chord fixture header and track", () => {
    const parsed = parseMidiFile(loadFixture("chord.mid"));

    expect(parsed.format).toBe(0);
    expect(parsed.numTracks).toBe(1);
    expect(parsed.ticksPerBeat).toBe(480);
    expect(parsed.framesPerSecond).toBeNull();
    expect(parsed.ticksPerFrame).toBeNull();
    expect(parsed.tracks).toHaveLength(1);
  });

  it("reads the chord's simultaneous note events with delta times", () => {
    const parsed = parseMidiFile(loadFixture("chord.mid"));
    const events = parsed.tracks[0]!;

    expect(events.map((entry) => entry.event.type)).toEqual([
      "noteOn", "noteOn", "noteOn", "noteOff", "noteOff", "noteOff",
    ]);
    expect(events.map((entry) => entry.event.noteNumber)).toEqual([60, 64, 67, 60, 64, 67]);
    expect(events.map((entry) => entry.event.velocity)).toEqual([100, 100, 100, 0, 0, 0]);
    // The chord is simultaneous at tick 0 and released together at tick 960.
    expect(events.map((entry) => entry.deltaTime)).toEqual([0, 0, 0, 960, 0, 0]);
    expect(events.slice(0, 3).every((entry) => entry.event.channel === 0)).toBe(true);
  });

  it("parses the multi-track melody fixture including the conductor tempo events", () => {
    const parsed = parseMidiFile(loadFixture("melody.mid"));

    expect(parsed.format).toBe(1);
    expect(parsed.numTracks).toBe(3);
    expect(parsed.ticksPerBeat).toBe(480);
    expect(parsed.tracks).toHaveLength(3);

    // Conductor track: two tempo changes.
    const conductor = parsed.tracks[0]!;
    expect(conductor.map((entry) => entry.event)).toEqual([
      { type: "tempo", microsecondsPerBeat: 500_000 },
      { type: "tempo", microsecondsPerBeat: 1_000_000 },
    ]);
    expect(conductor.map((entry) => entry.deltaTime)).toEqual([0, 1920]);

    // Melody track: five note pairs.
    const melody = parsed.tracks[1]!;
    expect(melody.map((entry) => entry.event.noteNumber)).toEqual([72, 72, 74, 74, 76, 76, 77, 77, 69, 69]);
    expect(melody.map((entry) => entry.event.type)).toEqual([
      "noteOn", "noteOff", "noteOn", "noteOff", "noteOn", "noteOff", "noteOn", "noteOff", "noteOn", "noteOff",
    ]);

    // Bass track: one long note.
    const bass = parsed.tracks[2]!;
    expect(bass).toHaveLength(2);
    expect(bass[0]!.event.noteNumber).toBe(48);
  });

  it("rejects non-SMF bytes with a clear error", () => {
    expect(() => parseMidiFile(new Uint8Array([0x00, 0x01, 0x02, 0xff]))).toThrow(
      /not a valid SMF file/,
    );
  });

  it("rejects a non-Uint8Array input", () => {
    expect(() => parseMidiFile("MThd" as unknown as Uint8Array)).toThrow(TypeError);
  });
});

describe("TempoMap / buildTempoMap", () => {
  it("applies the default 120 BPM tempo when the file has no tempo events", () => {
    const parsed = parseMidiFile(loadFixture("chord.mid"));
    const tempoMap = buildTempoMap(parsed);

    // 500 000 µs/beat → 0.5 s per beat (120 BPM): tick 480 = 0.5 s,
    // tick 960 (= 2 beats) = 1.0 s.
    expect(tempoMap.tickToSeconds(0)).toBe(0);
    expect(tempoMap.tickToSeconds(480)).toBeCloseTo(0.5, 9);
    expect(tempoMap.tickToSeconds(960)).toBeCloseTo(1.0, 9);
  });

  it("resolves ticks through the tempo-change map (120 → 60 BPM)", () => {
    const parsed = parseMidiFile(loadFixture("melody.mid"));
    const tempoMap = buildTempoMap(parsed);

    // 120 BPM (0.5 s/beat) for the first two beats (ticks 0–1920).
    expect(tempoMap.tickToSeconds(0)).toBe(0);
    expect(tempoMap.tickToSeconds(480)).toBeCloseTo(0.5, 9);
    expect(tempoMap.tickToSeconds(1920)).toBeCloseTo(2.0, 9);
    // 60 BPM (1.0 s/beat) from tick 1920: 960 more ticks = 2 beats = 2.0 s,
    // so tick 2880 = 4.0 s.
    expect(tempoMap.tickToSeconds(2880)).toBeCloseTo(4.0, 9);
    // Monotonic non-decreasing (no negative durations across a tempo change).
    expect(tempoMap.tickToSeconds(2880)).toBeGreaterThan(tempoMap.tickToSeconds(1919));
  });

  it("uses the default tempo before the first tempo event", () => {
    const parsed = parseMidiFile(loadFixture("melody.mid"));
    // A tick below the first tempo change still resolves at the default tempo.
    const tempoMap = buildTempoMap(parsed);
    expect(tempoMap.tickToSeconds(240)).toBeCloseTo(0.25, 9);
  });

  it("is deterministic: identical input yields identical seconds", () => {
    const parsed = loadFixture("melody.mid");
    const first = buildTempoMap(parseMidiFile(parsed));
    const second = buildTempoMap(parseMidiFile(parsed));
    expect(first.tickToSeconds(2400)).toBe(second.tickToSeconds(2400));
  });

  it("rejects negative ticks with a clear error", () => {
    const tempoMap = buildTempoMap(parseMidiFile(loadFixture("chord.mid")));
    expect(() => tempoMap.tickToSeconds(-1)).toThrow(/non-negative/);
  });

  it("rejects a SMPTE-timed division (no tempo map applies)", () => {
    const parsed: ParsedMidi = {
      format: 1,
      numTracks: 1,
      ticksPerBeat: null,
      framesPerSecond: 25,
      ticksPerFrame: 40,
      tracks: [[]],
    };
    expect(() => buildTempoMap(parsed)).toThrow(/SMPTE/);
  });

  it("exposes the documented default microseconds per beat", () => {
    expect(DEFAULT_MICROSECONDS_PER_BEAT).toBe(500_000);
  });
});
