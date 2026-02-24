import { describe, it, expect } from "vitest";
import { AnalysisEngine } from "../engine.js";
import type { MetricExtractor, AnalysisResult } from "../types.js";
import { ANALYSIS_VERSION } from "../types.js";

/** Trivial extractor that returns fixed values. */
class FixedExtractor implements MetricExtractor {
  readonly name = "fixed";
  readonly category = "test";

  extract(): Record<string, number | boolean | string | null> {
    return { value: 42, flag: true, label: "hello" };
  }
}

/** Extractor that computes a simple metric from samples. */
class SumExtractor implements MetricExtractor {
  readonly name = "sum";
  readonly category = "math";

  extract(
    samples: Float32Array,
  ): Record<string, number | boolean | string | null> {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i]!;
    }
    return { sum };
  }
}

/** Extractor that always throws. */
class FailingExtractor implements MetricExtractor {
  readonly name = "failing";
  readonly category = "broken";

  extract(): Record<string, number | boolean | string | null> {
    throw new Error("Something went wrong");
  }
}

describe("AnalysisEngine", () => {
  it("returns minimal result with no extractors", () => {
    const engine = new AnalysisEngine();
    const samples = new Float32Array([0.1, 0.2, 0.3]);
    const result = engine.analyze(samples, 44100);

    expect(result.analysisVersion).toBe(ANALYSIS_VERSION);
    expect(result.sampleRate).toBe(44100);
    expect(result.sampleCount).toBe(3);
    expect(result.metrics).toEqual({});
  });

  it("merges results from multiple extractors", () => {
    const engine = new AnalysisEngine();
    engine.register(new FixedExtractor());
    engine.register(new SumExtractor());

    const samples = new Float32Array([0.1, 0.2, 0.3]);
    const result = engine.analyze(samples, 44100);

    expect(result.metrics["test"]).toEqual({
      value: 42,
      flag: true,
      label: "hello",
    });
    expect(result.metrics["math"]).toBeDefined();
    expect(result.metrics["math"]!["sum"]).toBeCloseTo(0.6, 5);
  });

  it("rounds numeric values to 6 decimal places", () => {
    const extractor: MetricExtractor = {
      name: "precision",
      category: "precision",
      extract: () => ({
        pi: 3.14159265358979,
        tiny: 0.0000001,
        exact: 1.0,
      }),
    };

    const engine = new AnalysisEngine();
    engine.register(extractor);

    const result = engine.analyze(new Float32Array(1), 44100);
    expect(result.metrics["precision"]!["pi"]).toBe(3.141593);
    // 0.0000001 rounds to 0 at 6 decimal places -- this is correct behavior
    expect(result.metrics["precision"]!["tiny"]).toBe(0);
    expect(result.metrics["precision"]!["exact"]).toBe(1.0);
  });

  it("produces deterministic output for the same input", () => {
    const engine = new AnalysisEngine();
    engine.register(new FixedExtractor());
    engine.register(new SumExtractor());

    const samples = new Float32Array([0.5, -0.3, 0.7]);

    const result1 = engine.analyze(samples, 44100);
    const result2 = engine.analyze(samples, 44100);

    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
  });

  it("wraps extractor errors with extractor name", () => {
    const engine = new AnalysisEngine();
    engine.register(new FixedExtractor());
    engine.register(new FailingExtractor());

    const samples = new Float32Array([0.1]);

    expect(() => engine.analyze(samples, 44100)).toThrow(
      "Extractor 'failing' failed: Something went wrong",
    );
  });

  it("includes analysisVersion in output", () => {
    const engine = new AnalysisEngine();
    const result = engine.analyze(new Float32Array(0), 44100);
    expect(result.analysisVersion).toBe("1.0");
  });

  it("handles empty Float32Array", () => {
    const engine = new AnalysisEngine();
    engine.register(new SumExtractor());

    const result = engine.analyze(new Float32Array(0), 44100);
    expect(result.sampleCount).toBe(0);
    expect(result.metrics["math"]!["sum"]).toBe(0);
  });
});
