import { describe, it, expect } from "vitest";
import { IntensityClassifier } from "../dimensions/intensity.js";
import type { AnalysisResult } from "../../analyze/types.js";

function makeAnalysis(
  rms: number,
  peak: number,
  centroid: number = 1000,
): AnalysisResult {
  return {
    analysisVersion: "1.0",
    sampleRate: 44100,
    sampleCount: 44100,
    metrics: {
      time: { duration: 1.0, peak, rms, crestFactor: peak / (rms || 0.001) },
      quality: { clipping: false, silence: false },
      envelope: { attackTime: 10 },
      spectral: { spectralCentroid: centroid },
    },
  };
}

describe("IntensityClassifier", () => {
  const classifier = new IntensityClassifier();

  it("returns soft for very low RMS and peak", () => {
    const result = classifier.classify(makeAnalysis(0.02, 0.05));
    expect(result.intensity).toBe("soft");
  });

  it("returns aggressive for high RMS and high peak", () => {
    const result = classifier.classify(makeAnalysis(0.4, 0.9));
    expect(result.intensity).toBe("aggressive");
  });

  it("returns hard for moderately high RMS", () => {
    const result = classifier.classify(makeAnalysis(0.25, 0.5));
    expect(result.intensity).toBe("hard");
  });

  it("returns hard for high peak even with moderate RMS", () => {
    const result = classifier.classify(makeAnalysis(0.15, 0.7));
    expect(result.intensity).toBe("hard");
  });

  it("returns medium for moderate levels", () => {
    const result = classifier.classify(makeAnalysis(0.1, 0.3));
    expect(result.intensity).toBe("medium");
  });

  it("returns subtle for low peak but high spectral centroid", () => {
    const result = classifier.classify(makeAnalysis(0.05, 0.1, 2000));
    expect(result.intensity).toBe("subtle");
  });

  it("is deterministic", () => {
    const analysis = makeAnalysis(0.2, 0.5);
    const results = Array.from({ length: 10 }, () => classifier.classify(analysis));
    for (const r of results) {
      expect(r).toEqual(results[0]);
    }
  });
});
