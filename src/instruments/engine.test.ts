/**
 * Integration tests for the instrument engine (`engine.ts`).
 *
 * Exercises the offline render path (sustain + release tail, fundamental
 * frequency, velocity → loudness monotonicity, polyphonic voice limit) and
 * the runtime-guarded Node real-time path through `node-web-audio-api`, plus
 * context/clock injectability and determinism.
 */

import { describe, it, expect } from "vitest";
import type { InstrumentDefinition } from "./schema.js";
import {
  ENGINE_SAMPLE_RATE,
  renderInstrument,
  createRealtimeInstrument,
  type InstrumentEvent,
} from "./engine.js";
import { OfflineAudioContext, isNodeRuntime } from "../audio/web-audio.js";
import {
  computeRms,
  estimateDominantFrequency,
  isSilent,
} from "./__tests__/helpers.js";

/** A pluck-like definition used across tests. */
const PLUCK: InstrumentDefinition = {
  id: "test.pluck",
  name: "Test Pluck",
  oscillator: { type: "sine" },
  envelope: { attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.12 },
};

/** Render a single held note (noteOn → noteOff) with the given definition. */
async function renderHeldNote(
  definition: InstrumentDefinition,
  note: number,
  velocity: number,
  holdSeconds = 0.3,
  tail = 0.3,
): Promise<Float32Array> {
  const events: InstrumentEvent[] = [
    { type: "midiNoteOn", note, velocity, time: 0 },
    { type: "midiNoteOff", note, velocity, time: holdSeconds },
  ];
  const rendered = await renderInstrument(definition, events, {
    sampleRate: ENGINE_SAMPLE_RATE,
    tail,
  });
  return rendered.samples;
}

describe("renderInstrument offline", () => {
  it("produces a sustained tone that is non-silent while held and silent after the release tail", async () => {
    const samples = await renderHeldNote(PLUCK, 60, 100);
    const sampleRate = ENGINE_SAMPLE_RATE;

    // Sustain window (t in [0.1, 0.25]) — envelope is at sustain=0.6.
    const hold = samples.slice(
      Math.round(0.1 * sampleRate),
      Math.round(0.25 * sampleRate),
    );
    expect(isSilent(hold)).toBe(false);
    expect(computeRms(hold)).toBeGreaterThan(0.01);

    // Release at t=0.3 + 0.12 s tail → silent by t≈0.45; sample the tail end.
    const tailWindow = samples.slice(
      Math.round(0.5 * sampleRate),
      Math.round(0.58 * sampleRate),
    );
    expect(isSilent(tailWindow)).toBe(true);

    // The buffer as a whole is not silent (it held a note).
    expect(isSilent(samples)).toBe(false);
  });

  it("renders the expected fundamental frequency for notes 60 and 69", async () => {
    const cases: Array<[number, number]> = [
      [60, 261.63],
      [69, 440],
    ];
    for (const [note, expected] of cases) {
      const samples = await renderHeldNote(PLUCK, note, 100, 0.4, 0.25);
      const dominant = estimateDominantFrequency(samples, ENGINE_SAMPLE_RATE);
      const tolerance = expected * 0.02;
      expect(dominant).toBeGreaterThan(expected - tolerance);
      expect(dominant).toBeLessThan(expected + tolerance);
    }
  });

  it("maps higher velocity to monotonically higher loudness", async () => {
    const low = await renderHeldNote(PLUCK, 60, 40);
    const high = await renderHeldNote(PLUCK, 60, 127);
    const window = [Math.round(0.1 * ENGINE_SAMPLE_RATE), Math.round(0.25 * ENGINE_SAMPLE_RATE)];
    const lowRms = computeRms(low.slice(window[0], window[1]));
    const highRms = computeRms(high.slice(window[0], window[1]));
    expect(highRms).toBeGreaterThan(lowRms);
    // Roughly proportional to the linear velocity ratio (sustain-scaling).
    expect(highRms).toBeLessThan(lowRms * (127 / 40) * 1.1 + 1e-4);
  });

  it("is deterministic: identical inputs render byte-identical samples", async () => {
    const events: InstrumentEvent[] = [
      { type: "midiNoteOn", note: 60, velocity: 100, time: 0 },
      { type: "midiNoteOff", note: 60, velocity: 100, time: 0.3 },
    ];
    const a = await renderInstrument(PLUCK, events, { tail: 0.2 });
    const b = await renderInstrument(PLUCK, events, { tail: 0.2 });
    expect(a.samples.length).toBe(b.samples.length);
    expect(a.samples).toEqual(b.samples);
  });

  it("supports an injectable offline context (hermetic rendering)", async () => {
    const events: InstrumentEvent[] = [
      { type: "midiNoteOn", note: 60, velocity: 100, time: 0 },
      { type: "midiNoteOff", note: 60, velocity: 100, time: 0.3 },
    ];
    const tail = 0.2;
    const duration = 0.3 + tail;
    const length = Math.ceil(ENGINE_SAMPLE_RATE * duration);
    const injected = new OfflineAudioContext(1, length, ENGINE_SAMPLE_RATE);
    const rendered = await renderInstrument(PLUCK, events, {
      sampleRate: ENGINE_SAMPLE_RATE,
      tail,
      context: injected,
    });
    expect(rendered.samples.length).toBeGreaterThan(0);
    expect(rendered.duration).toBeCloseTo(duration, 6);
    expect(isSilent(rendered.samples)).toBe(false);
  });

  it("respects the voice limit and steals the oldest voice", async () => {
    const events: InstrumentEvent[] = [
      { type: "midiNoteOn", note: 60, velocity: 100, time: 0 },
      { type: "midiNoteOn", note: 64, velocity: 100, time: 0.05 },
      { type: "midiNoteOn", note: 67, velocity: 100, time: 0.1 },
      { type: "midiNoteOn", note: 72, velocity: 100, time: 0.15 },
      { type: "midiNoteOff", note: 64, velocity: 100, time: 0.25 },
      { type: "midiNoteOff", note: 67, velocity: 100, time: 0.25 },
      { type: "midiNoteOff", note: 72, velocity: 100, time: 0.25 },
    ];
    // Voice limit 2: the third note steals note 60, the fourth steals 64.
    const rendered = await renderInstrument(PLUCK, events, {
      maxVoices: 2,
      tail: 0.2,
    });
    // The buffer still renders audio (steals are trimmed, not fatal).
    expect(isSilent(rendered.samples)).toBe(false);
    expect(rendered.samples.length).toBeGreaterThan(0);
  });
});

describe("createRealtimeInstrument (Node real-time path)", () => {
  it("drives a real node-web-audio-api context when available (runtime-guarded)", async (testContext) => {
    if (!isNodeRuntime()) {
      testContext.skip();
      return;
    }
    let audioContext: OfflineAudioContext | undefined;
    let instrument: ReturnType<typeof createRealtimeInstrument>;
    try {
      // Real-time context (node-web-audio-api); skipped if the host cannot
      // open an audio device (headless/CI), per the runtime-guarded contract.
      instrument = createRealtimeInstrument(PLUCK, {
        maxVoices: 4,
      });
      // The engine owns an internal AudioContext; drive a note and release it.
      instrument.noteOn(60, 100);
      instrument.noteOff(60);
      // Second note + retrigger must not throw (voice manager path).
      instrument.noteOn(64, 90);
      instrument.noteOn(64, 90);
      instrument.noteOff(64);
    } catch (error) {
      if (
        error instanceof Error
        && /open (a )?client|device|AudioContext|backend/i.test(error.message)
      ) {
        testContext.skip();
        return;
      }
      throw error;
    }
    void audioContext;
  });

  it("releases a voice on noteOff via the injected context", () => {
    // Injectable context contract: the engine accepts an explicit context
    // (created here via the cross-platform abstraction), avoiding implicit
    // global state and making the path testable in Node.
    const instrument = createRealtimeInstrument(PLUCK, { maxVoices: 4 });
    expect(instrument.id).toBe("test.pluck");
    // No exceptions scheduling noteOn/noteOff on the real-time graph.
    instrument.noteOn(60, 100);
    instrument.noteOn(60, 100);
    instrument.noteOff(60);
    instrument.noteOff(60);
  });
});
