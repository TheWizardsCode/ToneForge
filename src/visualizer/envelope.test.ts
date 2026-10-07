import { describe, it, expect } from "vitest";
import { buildAmplitudeEnvelope } from "./envelope.js";

describe("buildAmplitudeEnvelope", () => {
  it("returns one normalised value per frame", () => {
    const samples = new Float32Array(1000).fill(0.5);
    const envelope = buildAmplitudeEnvelope(samples, 1000, 10);
    expect(envelope).toHaveLength(10);
    // Constant amplitude normalises to 1 for every frame.
    for (const value of envelope) {
      expect(value).toBeCloseTo(1, 5);
    }
  });

  it("tracks a decaying signal so later frames are quieter", () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < samples.length; i++) {
      // Linear fade from 1 to 0 across the buffer.
      samples[i] = 1 - i / samples.length;
    }
    const envelope = buildAmplitudeEnvelope(samples, 1000, 5);
    for (let i = 1; i < envelope.length; i++) {
      expect(envelope[i]!).toBeLessThan(envelope[i - 1]!);
    }
    expect(envelope[0]).toBeCloseTo(1, 2);
  });

  it("returns an all-zero envelope for silence", () => {
    const envelope = buildAmplitudeEnvelope(new Float32Array(500), 1000, 5);
    expect(envelope).toEqual([0, 0, 0, 0, 0]);
  });

  it("handles an empty sample buffer without producing NaN", () => {
    const envelope = buildAmplitudeEnvelope(new Float32Array(0), 44100, 4);
    expect(envelope).toEqual([0, 0, 0, 0]);
  });

  it("rejects a non-positive frame count", () => {
    expect(() => buildAmplitudeEnvelope(new Float32Array(10).fill(0.1), 1000, 0)).toThrow(
      RangeError,
    );
    expect(() => buildAmplitudeEnvelope(new Float32Array(10).fill(0.1), 1000, 1.5)).toThrow(
      RangeError,
    );
  });
});
