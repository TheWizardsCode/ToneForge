import { describe, it, expect } from "vitest";
import { MaterialClassifier } from "../dimensions/material.js";
import type { AnalysisResult } from "../../analyze/types.js";
import type { RecipeContext } from "../types.js";

function makeAnalysis(centroid: number = 2000): AnalysisResult {
  return {
    analysisVersion: "1.0",
    sampleRate: 44100,
    sampleCount: 44100,
    metrics: {
      time: { duration: 1.0, peak: 0.5, rms: 0.2, crestFactor: 2.5 },
      quality: { clipping: false, silence: false },
      envelope: { attackTime: 10 },
      spectral: { spectralCentroid: centroid },
    },
  };
}

describe("MaterialClassifier", () => {
  const classifier = new MaterialClassifier();

  it("maps footstep-stone -> stone via tags", () => {
    const context: RecipeContext = { name: "footstep-stone", category: "Footstep", tags: ["footstep", "stone", "impact", "foley"] };
    expect(classifier.classify(makeAnalysis(), context).material).toBe("stone");
  });

  it("maps footstep-gravel -> stone via tags", () => {
    const context: RecipeContext = { name: "footstep-gravel", category: "Footstep", tags: ["footstep", "gravel", "impact", "foley", "sample-hybrid"] };
    expect(classifier.classify(makeAnalysis(), context).material).toBe("stone");
  });

  it("maps weapon-laser-zap -> energy via tags", () => {
    const context: RecipeContext = { name: "weapon-laser-zap", category: "Weapon", tags: ["laser", "zap", "sci-fi", "weapon"] };
    expect(classifier.classify(makeAnalysis(), context).material).toBe("energy");
  });

  it("maps vehicle-engine -> mechanical via tags", () => {
    const context: RecipeContext = { name: "vehicle-engine", category: "Vehicle", tags: ["vehicle", "engine", "loop", "mechanical", "sample-hybrid"] };
    expect(classifier.classify(makeAnalysis(), context).material).toBe("mechanical");
  });

  it("maps creature-vocal -> organic via tags", () => {
    const context: RecipeContext = { name: "creature-vocal", category: "Creature", tags: ["creature", "vocal", "growl", "monster", "sample-hybrid"] };
    expect(classifier.classify(makeAnalysis(), context).material).toBe("organic");
  });

  it("falls back to category-based defaults", () => {
    const context: RecipeContext = { name: "weapon-custom", category: "Weapon", tags: ["custom"] };
    expect(classifier.classify(makeAnalysis(), context).material).toBe("energy");
  });

  it("returns null for unknown sources without strong signal", () => {
    expect(classifier.classify(makeAnalysis(2000)).material).toBeNull();
  });

  it("returns metal for very high spectral centroid without metadata", () => {
    expect(classifier.classify(makeAnalysis(7000)).material).toBe("metal");
  });

  it("maps ambient-wind-gust -> organic via tags", () => {
    const context: RecipeContext = { name: "ambient-wind-gust", category: "Ambient", tags: ["wind", "ambient", "environment", "nature"] };
    expect(classifier.classify(makeAnalysis(), context).material).toBe("organic");
  });

  it("is deterministic", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "weapon-laser-zap", category: "Weapon", tags: ["laser", "zap"] };
    const results = Array.from({ length: 10 }, () => classifier.classify(analysis, context));
    for (const r of results) {
      expect(r).toEqual(results[0]);
    }
  });
});
