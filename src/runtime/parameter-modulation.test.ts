/**
 * Runtime SFX Parameter Modulation Tests
 *
 * Behavioural tests for `applySfxParameters`: the transform that makes
 * `setSfxParameter` values audible on the next playback pass.
 *
 * Work item: TF-0MUYBRRCQ00148QD
 */

import { describe, it, expect } from "vitest";
import { applySfxParameters } from "./parameter-modulation.js";
import type { RenderResult } from "../core/renderer.js";

// ── Fixtures ──────────────────────────────────────────────────────

function makeResult(samples: number[], sampleRate = 44100): RenderResult {
  const data = Float32Array.from(samples);
  return {
    samples: data,
    sampleRate,
    duration: data.length / sampleRate,
    numberOfChannels: 1,
  };
}

/** A high-frequency alternating signal, useful for filter tests. */
function alternating(length: number): number[] {
  return Array.from({ length }, (_, i) => (i % 2 === 0 ? 1 : -1));
}

// ── Identity ──────────────────────────────────────────────────────

describe("applySfxParameters — identity", () => {
  it("returns the input unchanged when no parameter is set", () => {
    const result = makeResult([0.1, 0.2, 0.3]);
    expect(applySfxParameters(result, {})).toBe(result);
  });

  it("returns the input unchanged when values equal the neutral defaults", () => {
    const result = makeResult([0.1, 0.2, 0.3]);
    expect(
      applySfxParameters(result, { gain: 1, intensity: 1, pitch: 1, filter: 1 }),
    ).toBe(result);
  });

  it("never mutates the input samples", () => {
    const result = makeResult([0.5, 0.5, 0.5]);
    const before = Array.from(result.samples);
    applySfxParameters(result, { gain: 0.25, pitch: 2, filter: 0.1 });
    expect(Array.from(result.samples)).toEqual(before);
  });
});

// ── Amplitude (gain / intensity) ──────────────────────────────────

describe("applySfxParameters — amplitude", () => {
  it("scales samples by gain", () => {
    const out = applySfxParameters(makeResult([0.4, -0.8]), { gain: 0.5 });
    expect(out.samples[0]).toBeCloseTo(0.2);
    expect(out.samples[1]).toBeCloseTo(-0.4);
  });

  it("scales samples by intensity", () => {
    const out = applySfxParameters(makeResult([0.4, -0.8]), { intensity: 0.25 });
    expect(out.samples[0]).toBeCloseTo(0.1);
    expect(out.samples[1]).toBeCloseTo(-0.2);
  });

  it("multiplies gain and intensity", () => {
    const out = applySfxParameters(makeResult([0.5]), { gain: 0.5, intensity: 0.5 });
    expect(out.samples[0]).toBeCloseTo(0.125);
  });

  it("gain of zero produces silence", () => {
    const out = applySfxParameters(makeResult([0.4, -0.8]), { gain: 0 });
    expect(out.samples[0]).toBeCloseTo(0);
    expect(out.samples[1]).toBeCloseTo(0);
  });
});

// ── Pitch ─────────────────────────────────────────────────────────

describe("applySfxParameters — pitch", () => {
  it("shortens the buffer when pitch rises", () => {
    const input = makeResult(new Array(100).fill(0.5));
    const out = applySfxParameters(input, { pitch: 2 });
    expect(out.samples.length).toBe(50);
    expect(out.duration).toBeCloseTo(50 / 44100);
  });

  it("lengthens the buffer when pitch falls", () => {
    const input = makeResult(new Array(100).fill(0.5));
    const out = applySfxParameters(input, { pitch: 0.5 });
    expect(out.samples.length).toBe(200);
  });

  it("interpolates a ramp continuously", () => {
    const input = makeResult([0, 1, 2, 3]);
    const out = applySfxParameters(input, { pitch: 2 });
    // Output index 0 -> input 0, output index 1 -> input 2.
    expect(Array.from(out.samples)).toEqual([0, 2]);
  });
});

// ── Filter ────────────────────────────────────────────────────────

describe("applySfxParameters — filter", () => {
  it("attenuates a high-frequency signal", () => {
    const input = makeResult(alternating(64));
    const out = applySfxParameters(input, { filter: 0.05 });

    const rms = (samples: Float32Array): number =>
      Math.sqrt(
        Array.from(samples).reduce((sum, v) => sum + v * v, 0) / samples.length,
      );
    expect(rms(out.samples)).toBeLessThan(rms(input.samples));
    expect(rms(out.samples)).toBeGreaterThan(0);
  });

  it("keeps the buffer length and sample rate", () => {
    const input = makeResult(alternating(32));
    const out = applySfxParameters(input, { filter: 0.5 });
    expect(out.samples.length).toBe(32);
    expect(out.sampleRate).toBe(input.sampleRate);
  });

  it("preserves a constant (DC) signal", () => {
    const input = makeResult(new Array(16).fill(0.5));
    const out = applySfxParameters(input, { filter: 0.1 });
    for (const value of out.samples) {
      expect(value).toBeCloseTo(0.5);
    }
  });
});

// ── Determinism ───────────────────────────────────────────────────

describe("applySfxParameters — determinism", () => {
  it("produces byte-identical output for identical input + parameters", () => {
    const input = makeResult(alternating(100));
    const params = { gain: 0.7, intensity: 0.5, pitch: 1.25, filter: 0.3 };
    const a = applySfxParameters(input, params);
    const b = applySfxParameters(input, params);
    expect(Array.from(a.samples)).toEqual(Array.from(b.samples));
  });
});
