/**
 * Unit tests for the polyphonic voice manager (`voice-manager.ts`).
 *
 * Covers allocation/free, the configurable `maxVoices` limit, the documented
 * oldest-voice-first stealing policy, same-note retrigger (never two voices
 * for one note), voice reuse after note-off, and the pure/injectable
 * (no audio-context) contract.
 */

import { describe, it, expect } from "vitest";
import { VoiceManager } from "./voice-manager.js";

describe("VoiceManager allocation and release", () => {
  it("allocates a distinct voice per note and tracks the active count", () => {
    const manager = new VoiceManager({ maxVoices: 8 });
    expect(manager.activeCount).toBe(0);

    const a = manager.noteOn(60, 100, 0);
    const b = manager.noteOn(64, 100, 0);
    const c = manager.noteOn(67, 100, 0);

    expect(a.retriggered).toBe(false);
    expect(new Set([a.voice.id, b.voice.id, c.voice.id]).size).toBe(3);
    expect(manager.activeCount).toBe(3);
    expect(manager.notes()).toEqual([60, 64, 67]);
    expect(manager.has(60)).toBe(true);
    expect(manager.has(61)).toBe(false);
  });

  it("frees a voice on note-off and reuses the freed slot", () => {
    const manager = new VoiceManager({ maxVoices: 3 });
    manager.noteOn(60, 100);
    manager.noteOn(64, 100);
    manager.noteOn(67, 100);

    const released = manager.noteOff(64);
    expect(released?.note).toBe(64);
    expect(manager.activeCount).toBe(2);
    expect(manager.has(64)).toBe(false);

    // A new note fits without stealing because the slot was freed.
    const allocation = manager.noteOn(72, 100);
    expect(allocation.stolen).toBeUndefined();
    expect(manager.activeCount).toBe(3);
    expect(manager.notes()).toEqual([60, 67, 72]);
  });

  it("returns null when releasing a note that is not sounding", () => {
    const manager = new VoiceManager({ maxVoices: 4 });
    expect(manager.noteOff(60)).toBeNull();
    manager.noteOn(60, 100);
    expect(manager.noteOff(61)).toBeNull();
    expect(manager.activeCount).toBe(1);
  });

  it("supports a three-note chord exactly at the limit", () => {
    const manager = new VoiceManager({ maxVoices: 3 });
    manager.noteOn(60, 100);
    manager.noteOn(64, 100);
    manager.noteOn(67, 100);
    expect(manager.activeCount).toBe(3);
    expect(manager.isAtLimit).toBe(true);
    expect(manager.notes()).toEqual([60, 64, 67]);
  });
});

describe("VoiceManager stealing policy (oldest sounding voice first)", () => {
  it("steals the oldest voice when a new note arrives at the limit", () => {
    const manager = new VoiceManager({ maxVoices: 3 });
    const first = manager.noteOn(60, 100, 0);
    manager.noteOn(64, 100, 0.1);
    manager.noteOn(67, 100, 0.2);

    // A fourth note at the limit steals the oldest (note 60).
    const fourth = manager.noteOn(72, 100, 0.3);
    expect(fourth.stolen?.note).toBe(60);
    expect(fourth.stolen?.id).toBe(first.voice.id);
    expect(manager.activeCount).toBe(3);
    expect(manager.notes()).toEqual([64, 67, 72]);
    expect(manager.has(60)).toBe(false);
  });

  it("keeps stealing the oldest as more notes arrive over the limit", () => {
    const manager = new VoiceManager({ maxVoices: 2 });
    manager.noteOn(60, 100, 0);
    manager.noteOn(64, 100, 0.1);

    const third = manager.noteOn(67, 100, 0.2);
    expect(third.stolen?.note).toBe(60);
    expect(manager.notes()).toEqual([64, 67]);

    const fourth = manager.noteOn(72, 100, 0.3);
    expect(fourth.stolen?.note).toBe(64);
    expect(manager.notes()).toEqual([67, 72]);
  });
});

describe("VoiceManager same-note retrigger", () => {
  it("replaces the same note's voice instead of creating a second voice", () => {
    const manager = new VoiceManager({ maxVoices: 4 });
    const first = manager.noteOn(60, 100, 0);
    const second = manager.noteOn(60, 40, 1);

    expect(second.retriggered).toBe(true);
    expect(second.voice.id).toBe(first.voice.id);
    expect(second.voice.velocity).toBe(40);
    expect(second.voice.time).toBe(1);
    expect(manager.activeCount).toBe(1);
    expect(manager.notes()).toEqual([60]);
  });

  it("retrigger does not steal at the limit and refreshes the voice's age", () => {
    const manager = new VoiceManager({ maxVoices: 2 });
    manager.noteOn(60, 100, 0);
    manager.noteOn(64, 100, 0.1);

    // Retrigger 60 — it becomes the newest, so the next note steals 64.
    const retrigger = manager.noteOn(60, 100, 1);
    expect(retrigger.retriggered).toBe(true);
    expect(retrigger.stolen).toBeUndefined();
    expect(manager.notes()).toEqual([64, 60]);

    const next = manager.noteOn(67, 100, 2);
    expect(next.stolen?.note).toBe(64);
    expect(manager.notes()).toEqual([60, 67]);
  });
});

describe("VoiceManager validation and purity", () => {
  it("rejects a maxVoices below one", () => {
    expect(() => new VoiceManager({ maxVoices: 0 })).toThrow(/maxVoices/);
    expect(() => new VoiceManager({ maxVoices: -1 })).toThrow(/maxVoices/);
    expect(() => new VoiceManager({ maxVoices: 1.5 })).toThrow(/maxVoices/);
  });

  it("is a pure, deterministic data structure with no audio context", () => {
    const manager = new VoiceManager({ maxVoices: 2 });
    manager.noteOn(60, 100, 0);
    manager.noteOn(64, 90, 0);
    const snapshot = manager.snapshot();
    expect(snapshot).toEqual([
      { id: expect.any(Number), note: 60, velocity: 100, time: 0 },
      { id: expect.any(Number), note: 64, velocity: 90, time: 0 },
    ]);
    // reset() clears all voices deterministically.
    manager.reset();
    expect(manager.activeCount).toBe(0);
    expect(manager.snapshot()).toEqual([]);
  });
});
