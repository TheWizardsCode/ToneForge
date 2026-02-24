import { describe, it, expect } from "vitest";
import {
  QualityFlagsExtractor,
  CLIPPING_THRESHOLD,
  SILENCE_RMS_THRESHOLD,
} from "../extractors/quality-flags.js";

describe("QualityFlagsExtractor", () => {
  const extractor = new QualityFlagsExtractor();
  const sampleRate = 44100;

  it("has correct name and category", () => {
    expect(extractor.name).toBe("quality-flags");
    expect(extractor.category).toBe("quality");
  });

  it("detects clipping when peak >= 1.0", () => {
    const samples = new Float32Array([0.5, 1.0, -0.3]);
    const result = extractor.extract(samples, sampleRate);
    expect(result["clipping"]).toBe(true);
  });

  it("does not flag clipping below 1.0", () => {
    const samples = new Float32Array([0.5, 0.999, -0.3]);
    const result = extractor.extract(samples, sampleRate);
    expect(result["clipping"]).toBe(false);
  });

  it("detects silence when RMS is below threshold", () => {
    // Very quiet signal
    const samples = new Float32Array(1000);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 0.0001 * Math.sin(i);
    }
    const result = extractor.extract(samples, sampleRate);
    expect(result["silence"]).toBe(true);
  });

  it("does not flag silence for normal signal", () => {
    const samples = new Float32Array(100);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 0.5 * Math.sin(i);
    }
    const result = extractor.extract(samples, sampleRate);
    expect(result["silence"]).toBe(false);
  });

  it("handles empty buffer", () => {
    const result = extractor.extract(new Float32Array(0), sampleRate);
    expect(result["clipping"]).toBe(false);
    expect(result["silence"]).toBe(true);
  });

  it("handles all-zero buffer", () => {
    const result = extractor.extract(new Float32Array(100), sampleRate);
    expect(result["clipping"]).toBe(false);
    expect(result["silence"]).toBe(true);
  });

  it("exports threshold constants", () => {
    expect(CLIPPING_THRESHOLD).toBe(1.0);
    expect(SILENCE_RMS_THRESHOLD).toBe(0.001);
  });
});
