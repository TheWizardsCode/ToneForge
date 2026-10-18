/**
 * Unit tests for the MIDI writer util (`src/midi/writer.ts`).
 *
 * The writer wraps `midi-file`'s `writeMidi` behind a small, validated,
 * deterministic document API: the same `SmfDocument` always serialises to
 * the same bytes (`running` compression off by default), and every written
 * file parses back to equivalent events (round-trip). Program changes,
 * controllers and meta events that the engine-neutral `ParsedMidi` structure
 * deliberately drops are verified through the raw `midi-file` parser.
 *
 * Work item: TF-0MVDQP78X007OZNA.
 */

import { describe, it, expect } from "vitest";
import { parseMidi, writeMidi } from "midi-file";

import {
  writeSmfBytes,
  DEFAULT_PPQ_TICKS_PER_BEAT,
  type SmfDocument,
  type SmfWriterEvent,
} from "./writer.js";
import { parseMidiFile, buildTempoMap } from "./smf.js";

/** A small, deterministic 3-track document shared by several tests. */
function sampleDocument(): SmfDocument {
  const conductor: SmfWriterEvent[] = [
    { type: "trackName", deltaTime: 0, text: "Conductor" },
    { type: "setTempo", deltaTime: 0, microsecondsPerBeat: 500_000 },
    { type: "timeSignature", deltaTime: 0, numerator: 4, denominator: 4 },
  ];
  const melody: SmfWriterEvent[] = [
    { type: "programChange", deltaTime: 0, channel: 0, programNumber: 89 },
    { type: "noteOn", deltaTime: 0, channel: 0, noteNumber: 72, velocity: 100 },
    { type: "noteOff", deltaTime: 240, channel: 0, noteNumber: 72, velocity: 0 },
    { type: "noteOn", deltaTime: 0, channel: 0, noteNumber: 76, velocity: 90 },
    { type: "noteOff", deltaTime: 240, channel: 0, noteNumber: 76, velocity: 0 },
  ];
  const bass: SmfWriterEvent[] = [
    { type: "controller", deltaTime: 0, channel: 1, controllerType: 7, value: 100 },
    { type: "noteOn", deltaTime: 0, channel: 1, noteNumber: 48, velocity: 90 },
    { type: "noteOff", deltaTime: 480, channel: 1, noteNumber: 48, velocity: 0 },
  ];
  return { format: 1, ticksPerBeat: 480, tracks: [conductor, melody, bass] };
}

describe("writeSmfBytes round-trip (engine-neutral)", () => {
  it("writes a format 1 file that parses back to the same header and note/tempo events", () => {
    const bytes = writeSmfBytes(sampleDocument());
    const parsed = parseMidiFile(bytes);

    expect(parsed.format).toBe(1);
    expect(parsed.numTracks).toBe(3);
    expect(parsed.ticksPerBeat).toBe(480);
    expect(parsed.tracks).toHaveLength(3);

    // Conductor track: the tempo map's raw material.
    expect(parsed.tracks[0]!.map((entry) => entry.event)).toEqual([
      { type: "tempo", microsecondsPerBeat: 500_000 },
    ]);

    // Melody track: note pairs with the author's delta times preserved.
    const melody = parsed.tracks[1]!;
    expect(melody.map((entry) => entry.event.type)).toEqual([
      "noteOn", "noteOff", "noteOn", "noteOff",
    ]);
    expect(melody.map((entry) => entry.event.noteNumber)).toEqual([72, 72, 76, 76]);
    expect(melody.map((entry) => entry.deltaTime)).toEqual([0, 240, 0, 240]);

    // Bass track: one long held note (two beats).
    const bass = parsed.tracks[2]!;
    expect(bass).toHaveLength(2);
    expect(bass[0]!.event).toEqual({
      type: "noteOn",
      channel: 1,
      noteNumber: 48,
      velocity: 90,
    });
    expect(bass[1]!.deltaTime).toBe(480);
  });

  it("writes tempo and time-signature meta that build the correct tempo map", () => {
    const bytes = writeSmfBytes(sampleDocument());
    const tempoMap = buildTempoMap(parseMidiFile(bytes));
    // 120 BPM default from the written setTempo: one beat (480 ticks) = 0.5 s.
    expect(tempoMap.tickToSeconds(480)).toBeCloseTo(0.5, 9);
  });
});

describe("writeSmfBytes round-trip (raw midi-file)", () => {
  it("carries program changes, controllers and meta events the engine drops", () => {
    const bytes = writeSmfBytes(sampleDocument());
    const raw = parseMidi(bytes);

    const conductor = raw.tracks[0]!;
    expect(conductor.some((event) => event.type === "trackName"
      && event.text === "Conductor")).toBe(true);
    expect(conductor.some((event) => event.type === "setTempo"
      && event.microsecondsPerBeat === 500_000)).toBe(true);
    expect(conductor.some((event) => event.type === "timeSignature"
      && event.numerator === 4 && event.metronome === 24)).toBe(true);

    const melody = raw.tracks[1]!;
    expect(melody.some((event) => event.type === "programChange"
      && event.channel === 0 && event.programNumber === 89)).toBe(true);

    const bass = raw.tracks[2]!;
    expect(bass.some((event) => event.type === "controller"
      && event.channel === 1 && event.controllerType === 7 && event.value === 100)).toBe(true);
  });
});

describe("writeSmfBytes determinism", () => {
  it("serialises the same document to byte-identical output every time", () => {
    const first = writeSmfBytes(sampleDocument());
    const second = writeSmfBytes(sampleDocument());
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it("round-trips bytes through the library bit-for-bit (parse → write is stable)", () => {
    const original = writeSmfBytes(sampleDocument());
    const reparsed = parseMidi(original);
    // `running: false` matches the writer's deterministic default, so
    // re-serialising parsed bytes reproduces the exact original bytes.
    const rewritten = new Uint8Array(writeMidi(reparsed, { running: false }));
    expect(rewritten).toEqual(original);
  });
});

describe("writeSmfBytes conveniences", () => {
  it("applies the default format and PPQ division when omitted", () => {
    const bytes = writeSmfBytes({
      tracks: [[
        { type: "noteOn", deltaTime: 0, channel: 0, noteNumber: 60, velocity: 64 },
        { type: "noteOff", deltaTime: 480, channel: 0, noteNumber: 60, velocity: 0 },
      ]],
    });
    const parsed = parseMidiFile(bytes);
    expect(parsed.format).toBe(1);
    expect(parsed.ticksPerBeat).toBe(DEFAULT_PPQ_TICKS_PER_BEAT);
    expect(parsed.numTracks).toBe(1);
  });

  it("appends an end-of-track event when the track does not end with one", () => {
    const bytes = writeSmfBytes(sampleDocument());
    const raw = parseMidi(bytes);
    for (const track of raw.tracks) {
      expect(track[track.length - 1]!.type).toBe("endOfTrack");
    }
  });

  it("keeps an explicit trailing end-of-track event without duplicating it", () => {
    const bytes = writeSmfBytes({
      tracks: [[
        { type: "endOfTrack", deltaTime: 0 },
      ]],
    });
    const raw = parseMidi(bytes);
    const endOfTrackEvents = raw.tracks[0]!.filter((event) => event.type === "endOfTrack");
    expect(endOfTrackEvents).toHaveLength(1);
  });
});

describe("writeSmfBytes validation", () => {
  const validDoc: SmfDocument = {
    tracks: [[
      { type: "noteOn", deltaTime: 0, channel: 0, noteNumber: 60, velocity: 64 },
    ]],
  };

  it("rejects a negative delta time", () => {
    expect(() => writeSmfBytes({
      ...validDoc,
      tracks: [[{ type: "noteOn", deltaTime: -1, channel: 0, noteNumber: 60, velocity: 64 }]],
    })).toThrow(/deltaTime/i);
  });

  it("rejects a channel outside 0–15", () => {
    expect(() => writeSmfBytes({
      ...validDoc,
      tracks: [[{ type: "noteOn", deltaTime: 0, channel: 16, noteNumber: 60, velocity: 64 }]],
    })).toThrow(/channel/i);
  });

  it("rejects note numbers outside 0–127", () => {
    expect(() => writeSmfBytes({
      ...validDoc,
      tracks: [[{ type: "noteOn", deltaTime: 0, channel: 0, noteNumber: 128, velocity: 64 }]],
    })).toThrow(/note/i);
  });

  it("rejects a non-positive PPQ division", () => {
    expect(() => writeSmfBytes({ ticksPerBeat: 0, tracks: [[]] })).toThrow(/ticksPerBeat/i);
  });

  it("rejects a document with no tracks", () => {
    expect(() => writeSmfBytes({ tracks: [] })).toThrow(/tracks/i);
  });

  it("rejects a non-positive tempo", () => {
    expect(() => writeSmfBytes({
      tracks: [[{ type: "setTempo", deltaTime: 0, microsecondsPerBeat: 0 }]],
    })).toThrow(/tempo|microseconds/i);
  });
});
