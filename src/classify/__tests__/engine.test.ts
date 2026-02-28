import { describe, it, expect } from "vitest";
import { ClassificationEngine } from "../engine.js";
import type { DimensionClassifier, DimensionResult, RecipeContext } from "../types.js";
import type { AnalysisResult } from "../../analyze/types.js";

/** Minimal analysis result for testing. */
function makeAnalysis(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    analysisVersion: "1.0",
    sampleRate: 44100,
    sampleCount: 44100,
    metrics: {
      time: { duration: 1.0, peak: 0.5, rms: 0.2, crestFactor: 2.5 },
      quality: { clipping: false, silence: false },
      envelope: { attackTime: 10 },
      spectral: { spectralCentroid: 2000 },
    },
    ...overrides,
  };
}

/** Classifier that sets a fixed category. */
class FixedCategoryClassifier implements DimensionClassifier {
  readonly name = "fixed-category";
  classify(): DimensionResult {
    return { category: "weapon" };
  }
}

/** Classifier that sets a fixed intensity. */
class FixedIntensityClassifier implements DimensionClassifier {
  readonly name = "fixed-intensity";
  classify(): DimensionResult {
    return { intensity: "hard" };
  }
}

/** Classifier that sets texture based on analysis. */
class MetricTextureClassifier implements DimensionClassifier {
  readonly name = "metric-texture";
  classify(analysis: AnalysisResult): DimensionResult {
    const centroid = analysis.metrics["spectral"]?.["spectralCentroid"];
    if (typeof centroid === "number" && centroid > 3000) {
      return { texture: ["bright", "sharp"] };
    }
    return { texture: ["warm"] };
  }
}

/** Classifier that uses recipe context. */
class ContextAwareClassifier implements DimensionClassifier {
  readonly name = "context-aware";
  classify(_analysis: AnalysisResult, context?: RecipeContext): DimensionResult {
    if (context?.category) {
      return { category: context.category.toLowerCase() };
    }
    return { category: "unknown" };
  }
}

/** Classifier that always throws. */
class FailingClassifier implements DimensionClassifier {
  readonly name = "failing";
  classify(): DimensionResult {
    throw new Error("Something went wrong");
  }
}

describe("ClassificationEngine", () => {
  it("returns default empty result with no classifiers", () => {
    const engine = new ClassificationEngine();
    const analysis = makeAnalysis();
    const result = engine.classify(analysis, "test-source", "./analysis/test.json");

    expect(result.source).toBe("test-source");
    expect(result.category).toBe("");
    expect(result.intensity).toBe("");
    expect(result.texture).toEqual([]);
    expect(result.material).toBeNull();
    expect(result.tags).toEqual([]);
    expect(result.embedding).toEqual([]);
    expect(result.analysisRef).toBe("./analysis/test.json");
  });

  it("merges results from multiple classifiers", () => {
    const engine = new ClassificationEngine();
    engine.register(new FixedCategoryClassifier());
    engine.register(new FixedIntensityClassifier());
    engine.register(new MetricTextureClassifier());

    const analysis = makeAnalysis({
      metrics: {
        time: { duration: 1.0, peak: 0.5, rms: 0.2, crestFactor: 2.5 },
        quality: { clipping: false, silence: false },
        envelope: { attackTime: 10 },
        spectral: { spectralCentroid: 4000 },
      },
    });

    const result = engine.classify(analysis, "test", "./analysis/test.json");

    expect(result.category).toBe("weapon");
    expect(result.intensity).toBe("hard");
    expect(result.texture).toEqual(["bright", "sharp"]);
  });

  it("later classifiers can overwrite earlier results", () => {
    const engine = new ClassificationEngine();
    engine.register(new FixedCategoryClassifier()); // sets "weapon"
    engine.register(new ContextAwareClassifier()); // overwrites with context

    const analysis = makeAnalysis();
    const context: RecipeContext = {
      name: "footstep-stone",
      category: "Footstep",
      tags: ["stone"],
    };

    const result = engine.classify(analysis, "test", "./analysis/test.json", context);
    expect(result.category).toBe("footstep");
  });

  it("passes recipe context to classifiers", () => {
    const engine = new ClassificationEngine();
    engine.register(new ContextAwareClassifier());

    const analysis = makeAnalysis();
    const context: RecipeContext = {
      name: "ui-scifi-confirm",
      category: "UI",
      tags: ["sci-fi", "confirm"],
    };

    const result = engine.classify(analysis, "test", "./analysis/test.json", context);
    expect(result.category).toBe("ui");
  });

  it("produces deterministic output for same input (10x)", () => {
    const engine = new ClassificationEngine();
    engine.register(new FixedCategoryClassifier());
    engine.register(new FixedIntensityClassifier());
    engine.register(new MetricTextureClassifier());

    const analysis = makeAnalysis();

    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      const result = engine.classify(analysis, "test", "./analysis/test.json");
      results.push(JSON.stringify(result));
    }

    // All 10 runs should produce identical JSON
    const first = results[0];
    for (let i = 1; i < 10; i++) {
      expect(results[i]).toBe(first);
    }
  });

  it("wraps classifier errors with classifier name", () => {
    const engine = new ClassificationEngine();
    engine.register(new FixedCategoryClassifier());
    engine.register(new FailingClassifier());

    const analysis = makeAnalysis();

    expect(() =>
      engine.classify(analysis, "test", "./analysis/test.json"),
    ).toThrow("Classifier 'failing' failed: Something went wrong");
  });

  it("preserves source and analysisRef in result", () => {
    const engine = new ClassificationEngine();
    const analysis = makeAnalysis();

    const result = engine.classify(
      analysis,
      "weapon-laser-zap_seed-001",
      "./analysis/weapon-laser-zap_seed-001.json",
    );

    expect(result.source).toBe("weapon-laser-zap_seed-001");
    expect(result.analysisRef).toBe("./analysis/weapon-laser-zap_seed-001.json");
  });
});
