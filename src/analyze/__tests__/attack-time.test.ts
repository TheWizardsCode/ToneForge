import { describe, it, expect } from "vitest";
import { AttackTimeExtractor } from "../extractors/attack-time.js";

describe("AttackTimeExtractor", () => {
  const extractor = new AttackTimeExtractor();
  const sampleRate = 44100;

  it("has correct name and category", () => {
    expect(extractor.name).toBe("attack-time");
    expect(extractor.category).toBe("envelope");
  });

  it("detects attack time for a linear ramp", () => {
    // Create a linear ramp from 0 to 1 over 441 samples (10ms at 44100 Hz)
    const numSamples = 441;
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      samples[i] = i / (numSamples - 1);
    }

    const result = extractor.extract(samples, sampleRate);
    const attackTime = result["attackTime"] as number;

    // 90% of peak (1.0) is 0.9, which occurs at sample ~396
    // Attack time = 396 / 44100 ≈ 0.009s
    expect(attackTime).not.toBeNull();
    expect(attackTime).toBeGreaterThan(0);
    expect(attackTime).toBeLessThan(0.011);
  });

  it("returns null for all-zero buffer", () => {
    const result = extractor.extract(new Float32Array(100), sampleRate);
    expect(result["attackTime"]).toBeNull();
  });

  it("returns null for empty buffer", () => {
    const result = extractor.extract(new Float32Array(0), sampleRate);
    expect(result["attackTime"]).toBeNull();
  });

  it("returns null for signal below noise floor", () => {
    const samples = new Float32Array(100);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 0.005; // Below noise floor of 0.01
    }
    const result = extractor.extract(samples, sampleRate);
    expect(result["attackTime"]).toBeNull();
  });

  it("detects instant attack for signal starting at peak", () => {
    const samples = new Float32Array([1.0, 0.5, 0.2, 0.1]);
    const result = extractor.extract(samples, sampleRate);
    const attackTime = result["attackTime"] as number;

    // First sample is already at peak, so attack time = 0
    expect(attackTime).toBe(0);
  });

  it("produces deterministic output", () => {
    const samples = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * (i / 100);
    }
    const r1 = extractor.extract(samples, sampleRate);
    const r2 = extractor.extract(samples, sampleRate);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("handles single-sample buffer", () => {
    const samples = new Float32Array([0.5]);
    const result = extractor.extract(samples, sampleRate);
    // Peak is 0.5 (above noise floor), 90% of 0.5 = 0.45
    // First sample (0.5) >= 0.45, so attackTime = 0
    expect(result["attackTime"]).toBe(0);
  });
});
