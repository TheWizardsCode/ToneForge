/**
 * Unit tests for the instrument contracts (`instrument.ts`).
 *
 * Covers the note→frequency and velocity→gain mappings (anchors,
 * monotonicity, full MIDI range, boundary velocities and out-of-range
 * handling), the structured MIDI message types and the `Instrument`
 * interface surface.
 */

import { describe, it, expect } from "vitest";
import {
  midiNoteToFrequency,
  velocityToGain,
  midiNoteOn,
  midiNoteOff,
  type MidiNoteOnMessage,
  type MidiNoteOffMessage,
  type Instrument,
} from "./instrument.js";

describe("midiNoteToFrequency", () => {
  it("maps A4 (note 69) to exactly 440 Hz", () => {
    expect(midiNoteToFrequency(69)).toBe(440);
  });

  it("maps middle C (note 60) to approximately 261.6256 Hz", () => {
    expect(midiNoteToFrequency(60)).toBeCloseTo(261.6256, 4);
  });

  it("is strictly increasing across the full MIDI range", () => {
    let previous = midiNoteToFrequency(0);
    for (let note = 1; note <= 127; note++) {
      const frequency = midiNoteToFrequency(note);
      expect(frequency).toBeGreaterThan(previous);
      previous = frequency;
    }
  });

  it("doubles the frequency every twelve semitones", () => {
    expect(midiNoteToFrequency(69 + 12)).toBeCloseTo(880, 6);
    expect(midiNoteToFrequency(69 - 12)).toBeCloseTo(220, 6);
  });

  it("handles the range edges deterministically", () => {
    expect(midiNoteToFrequency(0)).toBeGreaterThan(0);
    expect(Number.isFinite(midiNoteToFrequency(127))).toBe(true);
  });
});

describe("velocityToGain", () => {
  it("is strictly monotonic across typical velocities", () => {
    expect(velocityToGain(127)).toBeGreaterThan(velocityToGain(64));
    expect(velocityToGain(64)).toBeGreaterThan(velocityToGain(1));
  });

  it("maps the endpoints to the documented values", () => {
    expect(velocityToGain(0)).toBe(0);
    expect(velocityToGain(127)).toBe(1);
  });

  it("is an exact linear mapping over the range", () => {
    expect(velocityToGain(64)).toBeCloseTo(64 / 127, 6);
    expect(velocityToGain(1)).toBeCloseTo(1 / 127, 6);
  });

  it("is non-decreasing across the full MIDI range", () => {
    let previous = velocityToGain(0);
    for (let velocity = 1; velocity <= 127; velocity++) {
      const gain = velocityToGain(velocity);
      expect(gain).toBeGreaterThanOrEqual(previous);
      previous = gain;
    }
  });

  it("clamps out-of-range velocities deterministically", () => {
    expect(velocityToGain(-10)).toBe(0);
    expect(velocityToGain(200)).toBe(1);
    expect(velocityToGain(NaN)).toBe(0);
    expect(velocityToGain(Infinity)).toBe(1);
  });
});

describe("midiNoteOn / midiNoteOff messages", () => {
  it("builds a structured midiNoteOn message with note, velocity and time", () => {
    const message: MidiNoteOnMessage = midiNoteOn(60, 100, 0.25);
    expect(message).toEqual({
      type: "midiNoteOn",
      note: 60,
      velocity: 100,
      time: 0.25,
    });
  });

  it("defaults time to 0 for midiNoteOn", () => {
    expect(midiNoteOn(60, 100)).toEqual({
      type: "midiNoteOn",
      note: 60,
      velocity: 100,
      time: 0,
    });
  });

  it("builds a structured midiNoteOff message with note, velocity and time", () => {
    const message: MidiNoteOffMessage = midiNoteOff(60, 64, 1.5);
    expect(message).toEqual({
      type: "midiNoteOff",
      note: 60,
      velocity: 64,
      time: 1.5,
    });
  });

  it("defaults time to 0 for midiNoteOff and allows without velocity", () => {
    expect(midiNoteOff(60)).toEqual({
      type: "midiNoteOff",
      note: 60,
      velocity: 0,
      time: 0,
    });
  });

  it("rejects notes outside the MIDI range", () => {
    expect(() => midiNoteOn(128, 100)).toThrow(/note/);
    expect(() => midiNoteOn(-1, 100)).toThrow(/note/);
    expect(() => midiNoteOff(128)).toThrow(/note/);
  });

  it("rejects negative times", () => {
    expect(() => midiNoteOn(60, 100, -1)).toThrow(/time/);
    expect(() => midiNoteOff(60, 0, -1)).toThrow(/time/);
  });
});

describe("Instrument interface surface", () => {
  it("accepts a noteOn/noteOff implementation and calls it with note and velocity", () => {
    const calls: Array<[string, number, number]> = [];
    const instrument: Instrument = {
      id: "capture",
      noteOn(midiNote: number, velocity: number): void {
        calls.push(["on", midiNote, velocity]);
      },
      noteOff(midiNote: number): void {
        calls.push(["off", midiNote, 0]);
      },
    };

    instrument.noteOn(60, 100);
    instrument.noteOff(60);

    expect(calls).toEqual([
      ["on", 60, 100],
      ["off", 60, 0],
    ]);
  });

  it("accepts optional time parameters on both note methods", () => {
    const instrument: Instrument = {
      id: "capture-time",
      noteOn(_midiNote: number, _velocity: number, _time?: number): void {},
      noteOff(_midiNote: number, _time?: number): void {},
    };
    // Optional args must be accepted without TS errors at the callsite.
    expect(() => {
      instrument.noteOn(60, 100, 0.5);
      instrument.noteOff(60, 0.75);
    }).not.toThrow();
  });
});
