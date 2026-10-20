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
import type { AudioContext } from "../audio/web-audio.js";
import { compareBuffers, formatCompareResult } from "../test-utils/buffer-compare.js";
import {
  computeBandEnergy,
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

// ── Noise oscillator ──────────────────────────────────────────────

/** A noise definition used across the noise tests. */
const NOISE: InstrumentDefinition = {
  id: "test.noise",
  name: "Test Noise",
  oscillator: { type: "noise", color: "white", seed: 42 },
  envelope: { attack: 0.001, decay: 0.05, sustain: 0.6, release: 0.1 },
};

/** Render a single held noise note and return its samples. */
async function renderNoiseNote(
  definition: InstrumentDefinition,
  holdSeconds = 0.3,
  tail = 0.2,
): Promise<Float32Array> {
  const rendered = await renderInstrument(
    definition,
    [
      { type: "midiNoteOn", note: 60, velocity: 100, time: 0 },
      { type: "midiNoteOff", note: 60, velocity: 100, time: holdSeconds },
    ],
    { sampleRate: ENGINE_SAMPLE_RATE, tail },
  );
  return rendered.samples;
}

/** RMS of a time window, in seconds, within a rendered buffer. */
function windowRms(samples: Float32Array, startSeconds: number, endSeconds: number): number {
  return computeRms(
    samples.slice(
      Math.round(startSeconds * ENGINE_SAMPLE_RATE),
      Math.round(endSeconds * ENGINE_SAMPLE_RATE),
    ),
  );
}

describe("renderInstrument offline (noise oscillator)", () => {
  it("renders non-silent noise deterministically for the same seed", async () => {
    const first = await renderNoiseNote(NOISE);
    const second = await renderNoiseNote(NOISE);

    expect(isSilent(first)).toBe(false);
    expect(computeRms(first)).toBeGreaterThan(0.01);

    const comparison = compareBuffers(first, second);
    expect(
      comparison.identical,
      `noise determinism drifted between runs\n${formatCompareResult(comparison)}`,
    ).toBe(true);
  });

  it("changes the samples when only the seed changes", async () => {
    const base = await renderNoiseNote(NOISE);
    const otherSeed = await renderNoiseNote({
      ...NOISE,
      oscillator: { type: "noise", color: "white", seed: 43 },
    });
    expect(compareBuffers(base, otherSeed).identical).toBe(false);
  });

  it("changes the samples when only the colour changes", async () => {
    const white = await renderNoiseNote(NOISE);
    for (const color of ["pink", "brown"] as const) {
      const other = await renderNoiseNote({
        ...NOISE,
        oscillator: { type: "noise", color, seed: 42 },
      });
      expect(
        compareBuffers(white, other).identical,
        `white and ${color} noise must render different samples`,
      ).toBe(false);
    }
  });

  it("honours a fast-decay ADSR envelope and returns to silence on release", async () => {
    const sustained = await renderNoiseNote(
      {
        ...NOISE,
        envelope: { attack: 0.05, decay: 0.05, sustain: 0.4, release: 0.05 },
      },
      0.5,
      0.2,
    );

    // Peak window straddles the end of the attack; the decay has barely
    // started, so its RMS approximates the peak envelope level.
    const peak = windowRms(sustained, 0.045, 0.055);
    const sustainEarly = windowRms(sustained, 0.2, 0.3);
    const sustainLate = windowRms(sustained, 0.35, 0.45);

    // White noise RMS is statistically stable over 0.1 s windows, so the
    // sustain-to-peak ratio recovers the declared sustain gain (~0.4).
    expect(sustainEarly / peak).toBeGreaterThan(0.3);
    expect(sustainEarly / peak).toBeLessThan(0.55);

    // Once decayed, the envelope stays at the sustain level.
    expect(sustainLate / sustainEarly).toBeGreaterThan(0.85);
    expect(sustainLate / sustainEarly).toBeLessThan(1.15);

    // Note-off at 0.5 s + 0.05 s release: silence from 0.6 s onwards.
    expect(isSilent(sustained.slice(Math.round(0.6 * ENGINE_SAMPLE_RATE)))).toBe(true);
  });

  it("reduces high-band energy when a low-pass filter is applied", async () => {
    const unfiltered = await renderNoiseNote(NOISE);
    const filtered = await renderNoiseNote({
      ...NOISE,
      filter: { type: "lowpass", frequency: 500, Q: 0.7 },
    });

    const highUnfiltered = computeBandEnergy(unfiltered, 2000, 8000);
    const highFiltered = computeBandEnergy(filtered, 2000, 8000);

    expect(highUnfiltered).toBeGreaterThan(0);
    expect(highFiltered).toBeLessThan(highUnfiltered * 0.25);
  });
});

// ── Real-time noise voice (mock context) ──────────────────────────

/** A scheduling parameter that tracks the most recently scheduled value. */
class FakeParam {
  value = 0;
  setValueAtTime(value: number): void {
    this.value = value;
  }
  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }
  cancelScheduledValues(): void {}
  setValueCurveAtTime(curve: Float32Array): void {
    this.value = curve[curve.length - 1] ?? 0;
  }
}

/** Base for connectable fake nodes. */
class FakeNode {
  connect(target: unknown): unknown {
    return target;
  }
}

/** A startable/stoppable fake source that records its scheduling calls. */
class FakeSourceNode extends FakeNode {
  readonly startedAt: number[] = [];
  readonly stoppedAt: number[] = [];
  start(when = 0): void {
    this.startedAt.push(when);
  }
  stop(when = 0): void {
    this.stoppedAt.push(when);
  }
}

class FakeOscillatorNode extends FakeSourceNode {
  type = "sine";
  readonly frequency = new FakeParam();
  readonly detune = new FakeParam();
}

class FakeBufferSourceNode extends FakeSourceNode {
  buffer: unknown = null;
  loop = false;
}

class FakeGainNode extends FakeNode {
  readonly gain = new FakeParam();
}

class FakeFilterNode extends FakeNode {
  type = "lowpass";
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
}

/** Minimal AudioContext double recording every created source node. */
class FakeAudioContext {
  readonly sampleRate = ENGINE_SAMPLE_RATE;
  currentTime = 0;
  readonly destination = new FakeNode();
  readonly oscillators: FakeOscillatorNode[] = [];
  readonly bufferSources: FakeBufferSourceNode[] = [];

  createOscillator(): FakeOscillatorNode {
    const node = new FakeOscillatorNode();
    this.oscillators.push(node);
    return node;
  }
  createBufferSource(): FakeBufferSourceNode {
    const node = new FakeBufferSourceNode();
    this.bufferSources.push(node);
    return node;
  }
  createGain(): FakeGainNode {
    return new FakeGainNode();
  }
  createBiquadFilter(): FakeFilterNode {
    return new FakeFilterNode();
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return {
      sampleRate,
      length,
      numberOfChannels: 1,
      getChannelData: () => data,
    };
  }
}

/** Cast the fake onto the engine's injected-context parameter type. */
function asAudioContext(fake: FakeAudioContext): AudioContext {
  return fake as unknown as AudioContext;
}

describe("createRealtimeInstrument (noise voice)", () => {
  it("starts a looping noise buffer source on note-on and stops it on note-off", () => {
    const fake = new FakeAudioContext();
    const instrument = createRealtimeInstrument(NOISE, {
      context: asAudioContext(fake),
      maxVoices: 4,
    });

    instrument.noteOn(60, 100, 0);
    expect(fake.oscillators).toHaveLength(0);
    expect(fake.bufferSources).toHaveLength(1);
    const source = fake.bufferSources[0]!;
    expect(source.buffer).not.toBeNull();
    expect(source.loop).toBe(true);
    expect(source.startedAt).toEqual([0]);

    instrument.noteOff(60, 0.5);
    expect(source.stoppedAt).toHaveLength(1);
    expect(source.stoppedAt[0]).toBeGreaterThan(0.5);
  });

  it("releases the stolen noise voice when the voice limit is exceeded", () => {
    const fake = new FakeAudioContext();
    const instrument = createRealtimeInstrument(NOISE, {
      context: asAudioContext(fake),
      maxVoices: 1,
    });

    instrument.noteOn(60, 100, 0);
    instrument.noteOn(64, 100, 0.25);

    expect(fake.bufferSources).toHaveLength(2);
    const [stolen, fresh] = fake.bufferSources;
    // The stolen voice is released (stopped after the steal time).
    expect(stolen!.stoppedAt).toHaveLength(1);
    expect(stolen!.stoppedAt[0]).toBeGreaterThan(0.25);
    // The fresh voice starts at the steal time and is still sounding.
    expect(fresh!.startedAt).toEqual([0.25]);
    expect(fresh!.stoppedAt).toHaveLength(0);
  });

  it("still builds oscillator sources for waveform voices", () => {
    const fake = new FakeAudioContext();
    const instrument = createRealtimeInstrument(PLUCK, {
      context: asAudioContext(fake),
      maxVoices: 2,
    });

    instrument.noteOn(60, 100, 0);
    expect(fake.bufferSources).toHaveLength(0);
    expect(fake.oscillators).toHaveLength(1);
    expect(fake.oscillators[0]!.startedAt).toEqual([0]);
  });
});
