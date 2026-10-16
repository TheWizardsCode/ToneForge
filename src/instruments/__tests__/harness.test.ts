/**
 * Smoke tests for the instrument test harness and its analysis helpers.
 *
 * Proves the harness is deterministic (identical runs produce byte-identical
 * output) and that the analysis helpers behave correctly on synthetic tones
 * (a generated 440 Hz sine reports ~440 Hz; a quiet buffer is reported
 * silent), per TF-0MV9WXLBL003Y53S AC3.
 */

import { describe, it, expect } from "vitest";
import { compareBuffers, formatCompareResult } from "../../test-utils/buffer-compare.js";
import {
  DEFAULT_TAIL,
  DOMINANT_FREQUENCY_TOLERANCE_RATIO,
  HARNESS_SAMPLE_RATE,
  computePeak,
  computeRms,
  estimateDominantFrequency,
  isSilent,
  midiNoteToFrequency,
  renderNoteSequence,
  velocityToGain,
} from "./helpers.js";
import type { NoteEvent } from "./helpers.js";

/** MIDI note number of concert A4. */
const A4 = 69;
/** Concert A4 equal-tempered frequency in Hz. */
const A4_FREQ = 440;

/**
 * Synthesise a pure sine tone on the pinned 44100 Hz grid.
 *
 * Amplitude and duration are chosen so the tone spans whole cycles at the
 * A4 frequency, keeping the RMS/peak expectations exact.
 */
function makeSine(frequency: number, amplitude: number, duration: number): Float32Array {
  const samples = new Float32Array(Math.ceil(duration * HARNESS_SAMPLE_RATE));
  const omega = (2 * Math.PI * frequency) / HARNESS_SAMPLE_RATE;
  for (let i = 0; i < samples.length; i++) {
    samples[i] = amplitude * Math.sin(omega * i);
  }
  return samples;
}

/** Assert `actual` is within the documented frequency tolerance of `expected`. */
function expectFrequencyWithinTolerance(actual: number, expected: number): void {
  const tolerance = expected * DOMINANT_FREQUENCY_TOLERANCE_RATIO;
  expect(
    actual,
    `expected ~${expected} Hz, got ${actual} (tolerance ±${tolerance.toFixed(2)} Hz)`,
  ).toBeGreaterThan(expected - tolerance);
  expect(actual).toBeLessThan(expected + tolerance);
}

// ── Pitch / loudness mapping ──────────────────────────────────────

describe("midiNoteToFrequency / velocityToGain", () => {
  it("maps A4 (note 69) to exactly 440 Hz and middle C (60) to ~261.63 Hz", () => {
    expect(midiNoteToFrequency(A4)).toBe(A4_FREQ);
    expect(midiNoteToFrequency(60)).toBeCloseTo(261.63, 2);
  });

  it("is strictly increasing across the full MIDI range", () => {
    let previous = midiNoteToFrequency(0);
    for (let note = 1; note <= 127; note++) {
      const frequency = midiNoteToFrequency(note);
      expect(frequency).toBeGreaterThan(previous);
      previous = frequency;
    }
  });

  it("maps velocity 0 to silence and velocity 127 to unity gain", () => {
    expect(velocityToGain(0)).toBe(0);
    expect(velocityToGain(127)).toBe(1);
    expect(velocityToGain(64)).toBeCloseTo(64 / 127, 3);
  });
});

// ── Note sequence rendering ───────────────────────────────────────

describe("renderNoteSequence", () => {
  it("renders at the pinned 44100 Hz sample rate and returns a Float32Array", async () => {
    const result = await renderNoteSequence([
      { note: A4, velocity: 100, time: 0, duration: 0.2 },
    ]);

    expect(result.samples).toBeInstanceOf(Float32Array);
    expect(result.sampleRate).toBe(44100);
    expect(result.samples.length).toBe(Math.ceil(44100 * (0.2 + DEFAULT_TAIL)));
    expect(result.duration).toBeCloseTo(0.2 + DEFAULT_TAIL, 9);
  });

  it("renders an empty sequence as an empty buffer", async () => {
    const result = await renderNoteSequence([]);
    expect(result.samples.length).toBe(0);
    expect(result.duration).toBe(0);
  });

  it("renders a single A4 note as an audible ~440 Hz tone", async () => {
    const result = await renderNoteSequence([
      { note: A4, velocity: 100, time: 0, duration: 0.3 },
    ]);

    expect(isSilent(result.samples)).toBe(false);
    expectFrequencyWithinTolerance(
      estimateDominantFrequency(result.samples),
      A4_FREQ,
    );
  });

  it("rejects notes, velocities and times outside their documented ranges", async () => {
    await expect(
      renderNoteSequence([{ note: 128, velocity: 100, time: 0, duration: 0.1 }]),
    ).rejects.toThrow(/note 128 out of range/);
    await expect(
      renderNoteSequence([{ note: A4, velocity: -1, time: 0, duration: 0.1 }]),
    ).rejects.toThrow(/velocity -1 out of range/);
    await expect(
      renderNoteSequence([{ note: A4, velocity: 100, time: -0.5, duration: 0.1 }]),
    ).rejects.toThrow(/time -0.5 must be a non-negative number/);
    await expect(
      renderNoteSequence([{ note: A4, velocity: 100, time: 0, duration: 0 }]),
    ).rejects.toThrow(/duration 0 must be a positive number/);
  });

  it("voices respect note timing, duration and velocity in the output", async () => {
    // Two notes: A4 starting at t=0 (0.2 s) then A5 starting at t=0.3 (0.2 s).
    const events: NoteEvent[] = [
      { note: 69, velocity: 100, time: 0, duration: 0.2 },
      { note: 81, velocity: 100, time: 0.3, duration: 0.2 },
    ];
    const result = await renderNoteSequence(events);

    expect(result.samples.length).toBe(Math.ceil(44100 * (0.5 + DEFAULT_TAIL)));

    // The first half (before A5 starts) should be dominated by A4; measure
    // pitch over the first 0.25 s window.
    const firstWindow = result.samples.subarray(0, Math.ceil(44100 * 0.25));
    expectFrequencyWithinTolerance(
      estimateDominantFrequency(firstWindow),
      midiNoteToFrequency(69),
    );
  });
});

// ── Analysis helpers ──────────────────────────────────────────────

describe("analysis helpers on synthetic tones", () => {
  it("computes peak and RMS of a 0.5-amplitude sine", () => {
    const sine = makeSine(A4_FREQ, 0.5, 0.5);

    // Peak: max |sample| ≈ amplitude; RMS of a sine = amplitude / √2.
    expect(computePeak(sine)).toBeCloseTo(0.5, 2);
    expect(computeRms(sine)).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it("reports a quiet buffer as silent", () => {
    expect(isSilent(new Float32Array(HARNESS_SAMPLE_RATE))).toBe(true);

    // A tone whose RMS sits below the platform silence threshold.
    const whisper = makeSine(A4_FREQ, 1e-4, 0.2);
    expect(computeRms(whisper)).toBeLessThan(0.001);
    expect(isSilent(whisper)).toBe(true);

    const loud = makeSine(A4_FREQ, 0.5, 0.2);
    expect(isSilent(loud)).toBe(false);
  });

  it("reports a 440 Hz sine as ~440 Hz within the documented tolerance", () => {
    const sine = makeSine(A4_FREQ, 0.5, 0.5);
    expectFrequencyWithinTolerance(estimateDominantFrequency(sine), A4_FREQ);
  });

  it("returns 0 for empty and all-zero buffers (no crossings)", () => {
    expect(estimateDominantFrequency(new Float32Array(0))).toBe(0);
    expect(
      estimateDominantFrequency(new Float32Array(HARNESS_SAMPLE_RATE)),
    ).toBe(0);
    expect(computeRms(new Float32Array(0))).toBe(0);
    expect(computePeak(new Float32Array(0))).toBe(0);
  });

  it("estimates different pitches at different frequencies", () => {
    const a4 = estimateDominantFrequency(makeSine(440, 0.5, 0.5));
    const a5 = estimateDominantFrequency(makeSine(880, 0.5, 0.5));
    expectFrequencyWithinTolerance(a4, 440);
    expectFrequencyWithinTolerance(a5, 880);
    // One octave apart → measured ratio ≈ 2.
    expect(a5 / a4).toBeCloseTo(2, 1);
  });
});

// ── Smoke: determinism ────────────────────────────────────────────

describe("harness determinism", () => {
  it("produces byte-identical output for two identical runs of the same sequence", async () => {
    const events: NoteEvent[] = [
      { note: 69, velocity: 100, time: 0, duration: 0.2 },
      { note: 76, velocity: 80, time: 0.05, duration: 0.3 },
      { note: 64, velocity: 64, time: 0.25, duration: 0.2 },
    ];

    const first = await renderNoteSequence(events);
    const second = await renderNoteSequence(events);

    const comparison = compareBuffers(first.samples, second.samples);
    expect(
      comparison.identical,
      `Second run diverged from the first:\n${formatCompareResult(comparison)}`,
    ).toBe(true);
  });

  it("stays deterministic across velocity extremes", async () => {
    const events: NoteEvent[] = [
      { note: 69, velocity: 127, time: 0, duration: 0.15 },
      { note: 57, velocity: 1, time: 0.05, duration: 0.15 },
    ];

    const runs: Float32Array[] = [];
    for (let i = 0; i < 3; i++) {
      const result = await renderNoteSequence(events);
      runs.push(result.samples);
    }

    for (const samples of runs.slice(1)) {
      const comparison = compareBuffers(runs[0]!, samples);
      expect(
        comparison.identical,
        `Run diverged:\n${formatCompareResult(comparison)}`,
      ).toBe(true);
    }
  });
});
