import { describe, it, expect } from "vitest";
import { TimeDomainExtractor } from "../extractors/time-domain.js";

describe("TimeDomainExtractor", () => {
  const extractor = new TimeDomainExtractor();
  const sampleRate = 44100;

  it("has correct name and category", () => {
    expect(extractor.name).toBe("time-domain");
    expect(extractor.category).toBe("time");
  });

  it("computes correct metrics for a known sine wave", () => {
    // Generate a 440 Hz sine wave at sampleRate 44100, 0.1s duration
    const numSamples = Math.round(sampleRate * 0.1);
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
    }

    const result = extractor.extract(samples, sampleRate);

    // Duration should be ~0.1s
    expect(result["duration"]).toBeCloseTo(0.1, 4);

    // Peak of sine wave should be ~1.0
    expect(result["peak"] as number).toBeCloseTo(1.0, 2);

    // RMS of sine wave = 1/sqrt(2) ≈ 0.7071
    expect(result["rms"] as number).toBeCloseTo(0.7071, 2);

    // Crest factor of sine = sqrt(2) ≈ 1.4142
    expect(result["crestFactor"] as number).toBeCloseTo(1.4142, 2);
  });

  it("handles empty buffer", () => {
    const result = extractor.extract(new Float32Array(0), sampleRate);
    expect(result["duration"]).toBe(0);
    expect(result["peak"]).toBe(0);
    expect(result["rms"]).toBe(0);
    expect(result["crestFactor"]).toBe(0);
  });

  it("handles all-zero buffer", () => {
    const samples = new Float32Array(100);
    const result = extractor.extract(samples, sampleRate);

    expect(result["duration"]).toBeCloseTo(100 / sampleRate, 6);
    expect(result["peak"]).toBe(0);
    expect(result["rms"]).toBe(0);
    expect(result["crestFactor"]).toBe(0);
  });

  it("handles single-sample buffer", () => {
    const samples = new Float32Array([0.5]);
    const result = extractor.extract(samples, sampleRate);

    expect(result["duration"]).toBeCloseTo(1 / sampleRate, 6);
    expect(result["peak"]).toBe(0.5);
    expect(result["rms"]).toBe(0.5);
    expect(result["crestFactor"]).toBe(1.0);
  });

  it("produces deterministic output", () => {
    const samples = new Float32Array([0.1, -0.5, 0.3, -0.9, 0.7]);
    const r1 = extractor.extract(samples, sampleRate);
    const r2 = extractor.extract(samples, sampleRate);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
