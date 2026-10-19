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
  computeBandEnergy,
  computeDecayTime,
  computePeak,
  computeRms,
  describeSpectralDifference,
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

/**
 * Synthesise a sum of equal-amplitude sine tones, each spanning the whole
 * buffer, used to build low-pass / high-pass-shaped spectral shapes.
 */
function makeToneStack(
  frequencies: number[],
  amplitude: number,
  duration: number,
): Float32Array {
  const samples = new Float32Array(Math.ceil(duration * HARNESS_SAMPLE_RATE));
  const perTone = amplitude / frequencies.length;
  for (const frequency of frequencies) {
    const omega = (2 * Math.PI * frequency) / HARNESS_SAMPLE_RATE;
    for (let i = 0; i < samples.length; i++) {
      samples[i] = (samples[i] ?? 0) + perTone * Math.sin(omega * i);
    }
  }
  return samples;
}

/**
 * Synthesise a linearly decaying burst: a sine carrier under a ramp that
 * reaches zero at `duration` seconds. The ramp crosses a fraction `ratio` of
 * its peak value at `duration * (1 - ratio)` seconds.
 */
function makeDecayingBurst(
  frequency: number,
  amplitude: number,
  duration: number,
): Float32Array {
  const samples = new Float32Array(Math.ceil(duration * HARNESS_SAMPLE_RATE));
  const omega = (2 * Math.PI * frequency) / HARNESS_SAMPLE_RATE;
  for (let i = 0; i < samples.length; i++) {
    const t = i / HARNESS_SAMPLE_RATE;
    const envelope = Math.max(0, 1 - t / duration);
    samples[i] = amplitude * envelope * Math.sin(omega * i);
  }
  return samples;
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

// ── Spectral band energy ──────────────────────────────────────────

describe("computeBandEnergy", () => {
  it("concentrates a pure tone's energy in the band containing its frequency", () => {
    const tone = makeSine(440, 0.5, 32768 / HARNESS_SAMPLE_RATE);

    const inBand = computeBandEnergy(tone, 250, 2000);
    const lowBand = computeBandEnergy(tone, 20, 250);
    const highBand = computeBandEnergy(tone, 2000, 8000);

    expect(inBand).toBeGreaterThan(lowBand);
    expect(inBand).toBeGreaterThan(highBand);
  });

  it("reports more low-band than high-band energy for a low-pass shape (and the reverse for a high-pass one)", () => {
    const lowPass = makeToneStack([100, 150, 200], 0.4, 8192 / HARNESS_SAMPLE_RATE);
    const highPass = makeToneStack([3000, 4000, 5000], 0.4, 8192 / HARNESS_SAMPLE_RATE);

    expect(computeBandEnergy(lowPass, 20, 250)).toBeGreaterThan(
      computeBandEnergy(lowPass, 2000, 8000),
    );
    expect(computeBandEnergy(highPass, 2000, 8000)).toBeGreaterThan(
      computeBandEnergy(highPass, 20, 250),
    );
  });

  it("returns 0 for empty and all-zero buffers", () => {
    expect(computeBandEnergy(new Float32Array(0), 20, 2000)).toBe(0);
    expect(computeBandEnergy(new Float32Array(4096), 20, 2000)).toBe(0);
  });

  it("rejects an inverted or non-finite band", () => {
    const tone = makeSine(440, 0.5, 8192 / HARNESS_SAMPLE_RATE);
    expect(() => computeBandEnergy(tone, 2000, 500)).toThrow(/invalid band/);
    expect(() => computeBandEnergy(tone, Number.NaN, 2000)).toThrow(/invalid band/);
  });
});

// ── Envelope decay ────────────────────────────────────────────────

describe("computeDecayTime", () => {
  it("measures a 0.2 s decaying burst as 0.2 s within 10%", () => {
    // Linear ramp: at `ramp` seconds the envelope is 0; it crosses the 10%
    // level exactly 0.2 s after the peak (1 − 0.2 / ramp = 0.1 → ramp ≈ 0.2222).
    const ramp = 0.2 / 0.9;
    const burst = makeDecayingBurst(440, 0.8, ramp);

    const decay = computeDecayTime(burst);
    expect(decay).toBeGreaterThan(0.18);
    expect(decay).toBeLessThan(0.22);
  });

  it("reports a shorter decay for a faster decay", () => {
    const fast = computeDecayTime(makeDecayingBurst(440, 0.8, 0.05 / 0.9));
    const slow = computeDecayTime(makeDecayingBurst(440, 0.8, 0.3 / 0.9));
    expect(fast).toBeLessThan(slow);
  });

  it("honours a stricter decay ratio (later crossing, longer time)", () => {
    const burst = makeDecayingBurst(440, 0.8, 0.2 / 0.9);
    // ratio 0.05 crosses later than ratio 0.2 → longer measured decay.
    expect(computeDecayTime(burst, { ratio: 0.05 })).toBeGreaterThan(
      computeDecayTime(burst, { ratio: 0.2 }),
    );
  });

  it("returns 0 for empty and silent buffers", () => {
    expect(computeDecayTime(new Float32Array(0))).toBe(0);
    expect(computeDecayTime(new Float32Array(4096))).toBe(0);
  });
});

// ── Spectral difference ───────────────────────────────────────────

describe("describeSpectralDifference", () => {
  it("reports a 440 Hz sine's centroid within 5% of 440 Hz", () => {
    const tone = makeSine(440, 0.5, 32768 / HARNESS_SAMPLE_RATE);

    const diff = describeSpectralDifference(tone, tone);
    expect(diff.centroidA).toBeGreaterThan(440 * 0.95);
    expect(diff.centroidA).toBeLessThan(440 * 1.05);
  });

  it("does not report identical buffers as distinct", () => {
    const tone = makeToneStack([300, 600], 0.4, 8192 / HARNESS_SAMPLE_RATE);

    const diff = describeSpectralDifference(tone, tone);
    expect(diff.centroidDeltaHz).toBe(0);
    expect(diff.bandEnergyRatios.low).toBeCloseTo(1, 6);
    expect(diff.bandEnergyRatios.mid).toBeCloseTo(1, 6);
    expect(diff.bandEnergyRatios.high).toBeCloseTo(1, 6);
    expect(diff.distinct).toBe(false);
  });

  it("reports a low tone and a high tone as distinct, with the expected spectral structure", () => {
    const low = makeSine(100, 0.5, 8192 / HARNESS_SAMPLE_RATE);
    const high = makeSine(5000, 0.5, 8192 / HARNESS_SAMPLE_RATE);

    const diff = describeSpectralDifference(low, high);
    expect(diff.distinct).toBe(true);
    expect(diff.centroidDeltaHz).toBeGreaterThan(0);
    // A is low in pitch: proportionally more low-band energy and less
    // high-band energy than B.
    expect(diff.bandEnergyRatios.low).toBeGreaterThan(1);
    expect(diff.bandEnergyRatios.high).toBeLessThan(1);
  });

  it("keeps the distinctness verdict symmetric under argument swap", () => {
    const low = makeSine(100, 0.5, 8192 / HARNESS_SAMPLE_RATE);
    const high = makeSine(5000, 0.5, 8192 / HARNESS_SAMPLE_RATE);
    expect(describeSpectralDifference(low, high).distinct).toBe(true);
    expect(describeSpectralDifference(high, low).distinct).toBe(true);
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
