import { describe, it, expect } from "vitest";
import {
  AnalysisMetricsProvider,
  createAnalysisMetricsProvider,
} from "../embeddings/analysis-metrics-provider.js";
import type { AnalysisResult } from "../../analyze/types.js";

/** Minimal analysis result for testing with all 7 metrics populated. */
function makeAnalysis(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    analysisVersion: "1.0",
    sampleRate: 44100,
    sampleCount: 44100,
    metrics: {
      time: {
        duration: 1.0,
        peak: 0.5,
        rms: 0.2,
        crestFactor: 2.5,
        zeroCrossingRate: 0.3,
      },
      quality: { clipping: false, silence: false },
      envelope: { attackTime: 0.05 },
      spectral: { spectralCentroid: 2000 },
    },
    ...overrides,
  };
}

describe("AnalysisMetricsProvider", () => {
  const provider = new AnalysisMetricsProvider();

  describe("interface properties", () => {
    it("has name 'analysis-metrics'", () => {
      expect(provider.name).toBe("analysis-metrics");
    });

    it("reports dimensionality of 7", () => {
      expect(provider.dimensionality()).toBe(7);
    });

    it("reports 'euclidean' as recommended distance function", () => {
      expect(provider.distanceFunction()).toBe("euclidean");
    });
  });

  describe("embed()", () => {
    it("produces a 7-element vector", () => {
      const analysis = makeAnalysis();
      const vector = provider.embed(analysis);
      expect(vector).toHaveLength(7);
    });

    it("normalizes known inputs to expected values", () => {
      const analysis = makeAnalysis({
        metrics: {
          time: {
            rms: 0.5, // range [0,1] -> 0.5
            peak: 1.0, // range [0,1] -> 1.0
            crestFactor: 10, // range [0,20] -> 0.5
            duration: 15, // range [0,30] -> 0.5
            zeroCrossingRate: 0.5, // range [0,1] -> 0.5
          },
          spectral: {
            spectralCentroid: 10000, // range [0,20000] -> 0.5
          },
          envelope: {
            attackTime: 0.5, // range [0,1] -> 0.5
          },
        },
      });

      const vector = provider.embed(analysis);

      // Vector order: [rms, peak, crest, centroid, duration, zcr, attack]
      expect(vector[0]).toBeCloseTo(0.5); // RMS
      expect(vector[1]).toBeCloseTo(1.0); // Peak
      expect(vector[2]).toBeCloseTo(0.5); // Crest factor
      expect(vector[3]).toBeCloseTo(0.5); // Spectral centroid
      expect(vector[4]).toBeCloseTo(0.5); // Duration
      expect(vector[5]).toBeCloseTo(0.5); // Zero-crossing rate
      expect(vector[6]).toBeCloseTo(0.5); // Attack time
    });

    it("clamps values at minimum (0) boundary", () => {
      const analysis = makeAnalysis({
        metrics: {
          time: {
            rms: 0,
            peak: 0,
            crestFactor: 0,
            duration: 0,
            zeroCrossingRate: 0,
          },
          spectral: { spectralCentroid: 0 },
          envelope: { attackTime: 0 },
        },
      });

      const vector = provider.embed(analysis);
      for (let i = 0; i < 7; i++) {
        expect(vector[i]).toBe(0);
      }
    });

    it("clamps values at maximum (1) boundary", () => {
      const analysis = makeAnalysis({
        metrics: {
          time: {
            rms: 1.0,
            peak: 1.0,
            crestFactor: 20,
            duration: 30,
            zeroCrossingRate: 1.0,
          },
          spectral: { spectralCentroid: 20000 },
          envelope: { attackTime: 1.0 },
        },
      });

      const vector = provider.embed(analysis);
      for (let i = 0; i < 7; i++) {
        expect(vector[i]).toBe(1);
      }
    });

    it("clamps values exceeding maximum to 1", () => {
      const analysis = makeAnalysis({
        metrics: {
          time: {
            rms: 2.0, // above max 1
            peak: 5.0, // above max 1
            crestFactor: 50, // above max 20
            duration: 100, // above max 30
            zeroCrossingRate: 3.0, // above max 1
          },
          spectral: { spectralCentroid: 50000 }, // above max 20000
          envelope: { attackTime: 5.0 }, // above max 1
        },
      });

      const vector = provider.embed(analysis);
      for (let i = 0; i < 7; i++) {
        expect(vector[i]).toBe(1);
      }
    });

    it("clamps negative values to 0", () => {
      const analysis = makeAnalysis({
        metrics: {
          time: {
            rms: -0.5,
            peak: -1.0,
            crestFactor: -5,
            duration: -1,
            zeroCrossingRate: -0.1,
          },
          spectral: { spectralCentroid: -100 },
          envelope: { attackTime: -0.5 },
        },
      });

      const vector = provider.embed(analysis);
      for (let i = 0; i < 7; i++) {
        expect(vector[i]).toBe(0);
      }
    });

    it("all values are in [0, 1] range", () => {
      const analysis = makeAnalysis();
      const vector = provider.embed(analysis);
      for (let i = 0; i < 7; i++) {
        expect(vector[i]).toBeGreaterThanOrEqual(0);
        expect(vector[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("missing metric handling", () => {
    it("defaults to 0 when a metric category is missing", () => {
      const analysis = makeAnalysis({
        metrics: {
          // Only time metrics -- spectral and envelope categories missing
          time: {
            rms: 0.5,
            peak: 0.5,
            crestFactor: 10,
            duration: 15,
            zeroCrossingRate: 0.5,
          },
        },
      });

      const vector = provider.embed(analysis);
      expect(vector).toHaveLength(7);
      // Spectral centroid (index 3) -> 0 (missing category)
      expect(vector[3]).toBe(0);
      // Attack time (index 6) -> 0 (missing category)
      expect(vector[6]).toBe(0);
    });

    it("defaults to 0 when a specific metric key is missing", () => {
      const analysis = makeAnalysis({
        metrics: {
          time: {
            rms: 0.5,
            peak: 0.5,
            crestFactor: 10,
            duration: 15,
            // zeroCrossingRate intentionally omitted
          },
          spectral: { spectralCentroid: 5000 },
          envelope: { attackTime: 0.1 },
        },
      });

      const vector = provider.embed(analysis);
      expect(vector).toHaveLength(7);
      // zeroCrossingRate (index 5) -> 0 (missing key)
      expect(vector[5]).toBe(0);
    });

    it("defaults to 0 when metric value is null", () => {
      const analysis = makeAnalysis({
        metrics: {
          time: {
            rms: 0.5,
            peak: 0.5,
            crestFactor: 10,
            duration: 15,
            zeroCrossingRate: 0.5,
          },
          spectral: { spectralCentroid: 5000 },
          envelope: { attackTime: null }, // null metric
        },
      });

      const vector = provider.embed(analysis);
      expect(vector).toHaveLength(7);
      // Attack time (index 6) -> 0 (null value)
      expect(vector[6]).toBe(0);
    });

    it("defaults to 0 when metric value is non-numeric", () => {
      const analysis = makeAnalysis({
        metrics: {
          time: {
            rms: "not-a-number" as unknown as number,
            peak: 0.5,
            crestFactor: 10,
            duration: 15,
            zeroCrossingRate: 0.5,
          },
          spectral: { spectralCentroid: 5000 },
          envelope: { attackTime: 0.1 },
        },
      });

      const vector = provider.embed(analysis);
      expect(vector).toHaveLength(7);
      // RMS (index 0) -> 0 (non-numeric value)
      expect(vector[0]).toBe(0);
    });

    it("defaults to 0 for all dimensions when metrics object is empty", () => {
      const analysis = makeAnalysis({
        metrics: {},
      });

      const vector = provider.embed(analysis);
      expect(vector).toHaveLength(7);
      for (let i = 0; i < 7; i++) {
        expect(vector[i]).toBe(0);
      }
    });
  });

  describe("determinism", () => {
    it("produces identical vectors for identical inputs (10x)", () => {
      const analysis = makeAnalysis();
      const vectors: number[][] = [];

      for (let i = 0; i < 10; i++) {
        vectors.push(provider.embed(analysis));
      }

      const first = JSON.stringify(vectors[0]);
      for (let i = 1; i < 10; i++) {
        expect(JSON.stringify(vectors[i])).toBe(first);
      }
    });
  });

  describe("createAnalysisMetricsProvider()", () => {
    it("returns an AnalysisMetricsProvider instance", () => {
      const p = createAnalysisMetricsProvider();
      expect(p).toBeInstanceOf(AnalysisMetricsProvider);
      expect(p.name).toBe("analysis-metrics");
      expect(p.dimensionality()).toBe(7);
      expect(p.distanceFunction()).toBe("euclidean");
    });
  });
});
