import { describe, it, expect } from "vitest";
import { SpectralCentroidExtractor } from "../extractors/spectral-centroid.js";

describe("SpectralCentroidExtractor", () => {
  const extractor = new SpectralCentroidExtractor();
  const sampleRate = 44100;

  it("has correct name and category", () => {
    expect(extractor.name).toBe("spectral-centroid");
    expect(extractor.category).toBe("spectral");
  });

  it("computes spectral centroid near fundamental for a pure sine", () => {
    // Generate a 1000 Hz sine wave, 1.0s duration for good FFT resolution
    const numSamples = sampleRate; // 1 second = 44100 samples
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      samples[i] = Math.sin(2 * Math.PI * 1000 * i / sampleRate);
    }

    const result = extractor.extract(samples, sampleRate);
    const centroid = result["spectralCentroid"] as number;

    // Spectral centroid of a pure sine should be approximately
    // at the sine frequency (1000 Hz). Allow ±200 Hz tolerance
    // due to spectral leakage and FFT bin resolution.
    expect(centroid).toBeGreaterThan(800);
    expect(centroid).toBeLessThan(1200);
  });

  it("returns 0 for empty buffer", () => {
    const result = extractor.extract(new Float32Array(0), sampleRate);
    expect(result["spectralCentroid"]).toBe(0);
  });

  it("returns 0 for all-zero buffer", () => {
    const result = extractor.extract(new Float32Array(1024), sampleRate);
    expect(result["spectralCentroid"]).toBe(0);
  });

  it("produces deterministic output across runs", () => {
    const numSamples = 2048;
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
    }

    const r1 = extractor.extract(samples, sampleRate);
    const r2 = extractor.extract(samples, sampleRate);
    const r3 = extractor.extract(samples, sampleRate);

    expect(r1["spectralCentroid"]).toBe(r2["spectralCentroid"]);
    expect(r2["spectralCentroid"]).toBe(r3["spectralCentroid"]);
  });

  it("higher frequency sine has higher centroid", () => {
    const numSamples = 4096;

    const lowSamples = new Float32Array(numSamples);
    const highSamples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      lowSamples[i] = Math.sin(2 * Math.PI * 200 * i / sampleRate);
      highSamples[i] = Math.sin(2 * Math.PI * 4000 * i / sampleRate);
    }

    const lowResult = extractor.extract(lowSamples, sampleRate);
    const highResult = extractor.extract(highSamples, sampleRate);

    expect(highResult["spectralCentroid"] as number).toBeGreaterThan(
      lowResult["spectralCentroid"] as number,
    );
  });
});
