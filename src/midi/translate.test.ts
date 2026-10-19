/**
 * Unit tests for the SMF → engine-events translator (`src/midi/translate.ts`).
 *
 * Proves the deterministic translation of parsed SMF tracks into the engine's
 * `midiNoteOn`/`midiNoteOff` `InstrumentEvent[]` (delta time resolved via the
 * tempo map, multi-track merge sorted by absolute time with a documented
 * tie-break), and renders a known fixture offline at a pinned 44100 Hz to
 * verify non-silent audio at the expected pitches with release-to-silence and
 * byte-identical determinism.
 *
 * Work item: TF-0MVBDU0RM007QTNR.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  parseMidiToInstrumentEvents,
  smfToInstrumentEvents,
} from "./translate.js";
import { parseMidiFile } from "./smf.js";
import { renderInstrument, ENGINE_SAMPLE_RATE } from "../instruments/engine.js";
import type { InstrumentDefinition } from "../instruments/schema.js";
import { encodeWav } from "../audio/wav-encoder.js";
import { compareBuffers, hashBuffer } from "../test-utils/buffer-compare.js";
import {
  computeRms,
  estimateDominantFrequency,
  isSilent,
  midiNoteToFrequency,
} from "../instruments/__tests__/helpers.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../test-utils/fixtures/midi");

function loadFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(FIXTURES_DIR, name)));
}

/** A simple pluck-style definition used for the offline renders. */
const PLUCK: InstrumentDefinition = {
  id: "midi-import.pluck",
  name: "Midi Import Pluck",
  oscillator: { type: "triangle" },
  envelope: { attack: 0.005, decay: 0.09, sustain: 0.12, release: 0.12 },
};

/** Frequency tolerance for pitch assertions (semitone-and-a-half headroom). */
const FREQUENCY_TOLERANCE_RATIO = 0.045;

describe("smfToInstrumentEvents", () => {
  it("translates the chord fixture into simultaneous note-ons and shared release", () => {
    const parsed = parseMidiFile(loadFixture("chord.mid"));
    const events = smfToInstrumentEvents(parsed);

    expect(events).toHaveLength(6);
    expect(events.filter((event) => event.type === "midiNoteOn")).toHaveLength(3);
    expect(events.filter((event) => event.type === "midiNoteOff")).toHaveLength(3);

    const ons = events.filter((event) => event.type === "midiNoteOn");
    expect(ons.map((event) => event.note).sort()).toEqual([60, 64, 67]);
    expect(ons.every((event) => event.time === 0)).toBe(true);
    expect(ons.every((event) => event.velocity === 100)).toBe(true);

    const offs = events.filter((event) => event.type === "midiNoteOff");
    // Two-beat hold at 120 BPM = 1.0 s.
    expect(offs.every((event) => event.time === 1.0)).toBe(true);
  });

  it("resolves delta time through the tempo map (tempo change included)", () => {
    const events = parseMidiToInstrumentEvents(loadFixture("melody.mid"));

    const onsetOf = (note: number): number =>
      events.find((event) => event.type === "midiNoteOn" && event.note === note)!.time;

    // First four melody notes at 120 BPM (0.5 s/beat, 240 ticks each).
    expect(onsetOf(72)).toBe(0);
    expect(onsetOf(74)).toBeCloseTo(0.5, 9);
    expect(onsetOf(76)).toBeCloseTo(1.0, 9);
    expect(onsetOf(77)).toBeCloseTo(1.5, 9);
    // A4 starts at tick 1920 (2.0 s in 120 BPM time) and the four-beat hold
    // spans the 60 BPM section: tick 2880 = 2.0 + 2.0 = 4.0 s.
    expect(onsetOf(69)).toBeCloseTo(2.0, 9);

    const offA4 = events.find(
      (event) => event.type === "midiNoteOff" && event.note === 69,
    )!;
    expect(offA4.time).toBeCloseTo(4.0, 9);
    // The hold spans the tempo change: 960 ticks = 1.0 s at 120 BPM but
    // 2.0 s at 60 BPM, so the hold is a full beat longer than it would be
    // without the tempo change.
    expect(offA4.time - onsetOf(69)).toBeGreaterThan(1.9);
  });

  it("merges multi-track files deterministically with a documented tie-break", () => {
    const events = parseMidiToInstrumentEvents(loadFixture("melody.mid"));
    const tuples = events.map((event) => ({
      type: event.type,
      note: event.note,
      time: Math.round(event.time * 100) / 100,
    }));

    // Bass C3 and melody C5 are both struck at t=0 — sorted by note ascending.
    // At t=1.0 the bass release (midiNoteOff) precedes the melody note-on —
    // the tie-break is noteOff-before-noteOn, then note, then velocity.
    expect(tuples).toEqual([
      { type: "midiNoteOn", note: 48, time: 0 },
      { type: "midiNoteOn", note: 72, time: 0 },
      { type: "midiNoteOff", note: 72, time: 0.25 },
      { type: "midiNoteOn", note: 74, time: 0.5 },
      { type: "midiNoteOff", note: 74, time: 0.75 },
      { type: "midiNoteOff", note: 48, time: 1 },
      { type: "midiNoteOn", note: 76, time: 1 },
      { type: "midiNoteOff", note: 76, time: 1.25 },
      { type: "midiNoteOn", note: 77, time: 1.5 },
      { type: "midiNoteOff", note: 77, time: 1.75 },
      { type: "midiNoteOn", note: 69, time: 2 },
      { type: "midiNoteOff", note: 69, time: 4 },
    ]);
  });
});

describe("smfToInstrumentEvents voice isolation filter", () => {
  const noteTuple = (event: { type: string; note: number; time: number }) =>
    ({ type: event.type, note: event.note, time: Math.round(event.time * 100) / 100 });

  it("selects a single track (melody fixture track 1)", () => {
    const parsed = parseMidiFile(loadFixture("melody.mid"));
    const events = smfToInstrumentEvents(parsed, { tracks: [1] });

    expect(events).toHaveLength(10);
    expect(events.filter((event) => event.type === "midiNoteOn")).toHaveLength(5);
    expect(
      [...new Set(events.filter((event) => event.type === "midiNoteOn").map((event) => event.note))]
        .sort((a, b) => a - b),
    ).toEqual([69, 72, 74, 76, 77]);
  });

  it("keeps the file's tempo map when a non-conductor track is selected", () => {
    const parsed = parseMidiFile(loadFixture("melody.mid"));
    const full = smfToInstrumentEvents(parsed);
    const melodyOnly = smfToInstrumentEvents(parsed, { tracks: [1] });

    // The A4 (note 69) onset/release straddles the 120 → 60 BPM change on the
    // conductor track (0), so a filtered voice keeps the original timing.
    const onset = melodyOnly.find(
      (event) => event.type === "midiNoteOn" && event.note === 69,
    )!;
    const release = melodyOnly.find(
      (event) => event.type === "midiNoteOff" && event.note === 69,
    )!;
    expect(onset.time).toBeCloseTo(2.0, 9);
    expect(release.time).toBeCloseTo(4.0, 9);

    // Filtering is a pure selection: every surviving event is in the full mix
    // at exactly the same time.
    const fullTimes = new Set(full.map((event) => `${event.type}:${event.note}:${event.time}`));
    for (const event of melodyOnly) {
      expect(fullTimes.has(`${event.type}:${event.note}:${event.time}`)).toBe(true);
    }
  });

  it("selects by MIDI channel (melody fixture track 2 is channel 2)", () => {
    const parsed = parseMidiFile(loadFixture("melody.mid"));
    const events = smfToInstrumentEvents(parsed, { channels: [2] });

    expect(events).toHaveLength(2);
    expect(events.map(noteTuple)).toEqual([
      { type: "midiNoteOn", note: 48, time: 0 },
      { type: "midiNoteOff", note: 48, time: 1 },
    ]);
  });

  it("treats --track and --channel as an intersection", () => {
    const parsed = parseMidiFile(loadFixture("melody.mid"));

    // Track 1 is channel 1 and track 2 is channel 2: the mismatched pair is empty.
    expect(smfToInstrumentEvents(parsed, { tracks: [1], channels: [2] })).toEqual([]);

    // The matching pair keeps only the bass (track 2).
    const bass = smfToInstrumentEvents(parsed, { tracks: [1, 2], channels: [2] });
    expect(bass.map(noteTuple)).toEqual([
      { type: "midiNoteOn", note: 48, time: 0 },
      { type: "midiNoteOff", note: 48, time: 1 },
    ]);
  });

  it("supports multiple channel values", () => {
    const parsed = parseMidiFile(loadFixture("melody.mid"));
    const events = smfToInstrumentEvents(parsed, { channels: [1, 2] });
    expect(events).toHaveLength(12);
  });

  it("is byte-identical to the unfiltered path when no filter is given", () => {
    const bytes = loadFixture("chord.mid");
    const parsed = parseMidiFile(bytes);
    const unfiltered = smfToInstrumentEvents(parsed);

    expect(parseMidiToInstrumentEvents(bytes)).toEqual(unfiltered);
    expect(parseMidiToInstrumentEvents(bytes, {})).toEqual(unfiltered);
    expect(smfToInstrumentEvents(parsed, { tracks: [], channels: [] })).toEqual(unfiltered);
  });

  it("returns an empty stream for the conductor track (no note events)", () => {
    const parsed = parseMidiFile(loadFixture("melody.mid"));
    expect(smfToInstrumentEvents(parsed, { tracks: [0] })).toEqual([]);
  });
});

describe("offline render of a known fixture (pinned 44100 Hz)", () => {
  it("renders the chord non-silent with release-to-silence", async () => {
    const events = parseMidiToInstrumentEvents(loadFixture("chord.mid"));
    const rendered = await renderInstrument(PLUCK, events, {
      sampleRate: ENGINE_SAMPLE_RATE,
    });

    expect(rendered.sampleRate).toBe(44100);
    expect(rendered.samples.length).toBeGreaterThan(0);
    // A three-note chord at velocity 100 is clearly audible.
    expect(computeRms(rendered.samples)).toBeGreaterThan(0.001);
    // Last note-off (1.0 s) + release (0.12 s) → silence resumes by 1.12 s;
    // the engine appends a 0.2 s tail, so assert the final slice is silent.
    const tailStart = Math.floor(1.14 * ENGINE_SAMPLE_RATE);
    const tailSamples = rendered.samples.slice(tailStart);
    expect(tailSamples.length).toBeGreaterThan(0);
    expect(isSilent(tailSamples)).toBe(true);
  });

  it("renders the melody at the expected pitches", async () => {
    const events = parseMidiToInstrumentEvents(loadFixture("melody.mid"));
    const rendered = await renderInstrument(PLUCK, events, {
      sampleRate: ENGINE_SAMPLE_RATE,
    });

    const rate = rendered.sampleRate;
    const windowed = (start: number, end: number): Float32Array =>
      rendered.samples.slice(Math.floor(start * rate), Math.floor(end * rate));

    // C5 window (0.03–0.22 s): the previous silence gives a clean tone.
    const c5 = estimateDominantFrequency(windowed(0.03, 0.22), rate);
    const c5Target = midiNoteToFrequency(72);
    expect(Math.abs(c5 - c5Target) / c5Target).toBeLessThan(FREQUENCY_TOLERANCE_RATIO);

    // D5 window (0.52–0.72 s): C5 has fully released by then.
    const d5 = estimateDominantFrequency(windowed(0.52, 0.72), rate);
    const d5Target = midiNoteToFrequency(74);
    expect(Math.abs(d5 - d5Target) / d5Target).toBeLessThan(FREQUENCY_TOLERANCE_RATIO);

    // E5 window (1.02–1.22 s).
    const e5 = estimateDominantFrequency(windowed(1.02, 1.22), rate);
    const e5Target = midiNoteToFrequency(76);
    expect(Math.abs(e5 - e5Target) / e5Target).toBeLessThan(FREQUENCY_TOLERANCE_RATIO);
  });

  it("is deterministic: identical input yields byte-identical WAV output", async () => {
    const chord = loadFixture("chord.mid");
    const first = await renderInstrument(
      PLUCK,
      parseMidiToInstrumentEvents(chord),
      { sampleRate: ENGINE_SAMPLE_RATE },
    );
    const second = await renderInstrument(
      PLUCK,
      parseMidiToInstrumentEvents(chord),
      { sampleRate: ENGINE_SAMPLE_RATE },
    );

    const result = compareBuffers(
      encodeWav(first.samples, { sampleRate: first.sampleRate }),
      encodeWav(second.samples, { sampleRate: second.sampleRate }),
    );
    expect(result.identical).toBe(true);
    expect(result.totalSamples).toBeGreaterThan(0);

    // Same guarantee at the sample-hash level for the melody fixture.
    const melody = loadFixture("melody.mid");
    const a = await renderInstrument(
      PLUCK,
      parseMidiToInstrumentEvents(melody),
      { sampleRate: ENGINE_SAMPLE_RATE },
    );
    const b = await renderInstrument(
      PLUCK,
      parseMidiToInstrumentEvents(melody),
      { sampleRate: ENGINE_SAMPLE_RATE },
    );
    expect(hashBuffer(new Uint8Array(a.samples.buffer))).toBe(
      hashBuffer(new Uint8Array(b.samples.buffer)),
    );
  });

  it("rejects malformed input before rendering", () => {
    expect(() =>
      parseMidiToInstrumentEvents(new Uint8Array([0x00])),
    ).toThrow(/not a valid SMF file/);
  });
});
