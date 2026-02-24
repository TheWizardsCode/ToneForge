import { describe, it, expect } from "vitest";
import { TextureClassifier } from "../dimensions/texture.js";
import type { AnalysisResult } from "../../analyze/types.js";

function makeAnalysis(
  centroid: number,
  attackTime: number,
  crestFactor: number = 3,
): AnalysisResult {
  return {
    analysisVersion: "1.0",
    sampleRate: 44100,
    sampleCount: 44100,
    metrics: {
      time: { duration: 1.0, peak: 0.5, rms: 0.2, crestFactor },
      quality: { clipping: false, silence: false },
      envelope: { attackTime },
      spectral: { spectralCentroid: centroid },
    },
  };
}

describe("TextureClassifier", () => {
  const classifier = new TextureClassifier();

  it("includes bright for spectral centroid > 4000 Hz", () => {
    const result = classifier.classify(makeAnalysis(5000, 25));
    expect(result.texture).toContain("bright");
  });

  it("includes dark for spectral centroid < 500 Hz", () => {
    const result = classifier.classify(makeAnalysis(300, 25));
    expect(result.texture).toContain("dark");
  });

  it("includes sharp for attack time < 5 ms", () => {
    const result = classifier.classify(makeAnalysis(2000, 3));
    expect(result.texture).toContain("sharp");
  });

  it("includes smooth for attack time > 50 ms", () => {
    const result = classifier.classify(makeAnalysis(2000, 80));
    expect(result.texture).toContain("smooth");
  });

  it("allows multiple labels: sharp + bright", () => {
    const result = classifier.classify(makeAnalysis(5000, 3));
    expect(result.texture).toContain("sharp");
    expect(result.texture).toContain("bright");
  });

  it("includes warm for centroid 500-1500", () => {
    const result = classifier.classify(makeAnalysis(1000, 25));
    expect(result.texture).toContain("warm");
  });

  it("includes noisy for high crest factor", () => {
    const result = classifier.classify(makeAnalysis(2000, 25, 10));
    expect(result.texture).toContain("noisy");
  });

  it("includes tonal for low crest factor", () => {
    const result = classifier.classify(makeAnalysis(2000, 25, 1.5));
    expect(result.texture).toContain("tonal");
  });

  it("limits texture array to 3 labels", () => {
    // This should trigger multiple labels: bright, sharp, harsh, crunchy
    // but should be limited to 3
    const result = classifier.classify(makeAnalysis(5000, 2, 1.5));
    expect(result.texture!.length).toBeLessThanOrEqual(3);
  });

  it("returns sorted array for determinism", () => {
    const result = classifier.classify(makeAnalysis(5000, 3));
    const sorted = [...result.texture!].sort();
    expect(result.texture).toEqual(sorted);
  });

  it("is deterministic", () => {
    const analysis = makeAnalysis(3000, 10);
    const results = Array.from({ length: 10 }, () => classifier.classify(analysis));
    for (const r of results) {
      expect(r).toEqual(results[0]);
    }
  });

  it("returns at least one label for any input", () => {
    const result = classifier.classify(makeAnalysis(2000, 25, 3));
    expect(result.texture!.length).toBeGreaterThanOrEqual(1);
  });
});
