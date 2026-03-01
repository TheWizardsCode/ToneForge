import { describe, it, expect } from "vitest";
import { CategoryClassifier } from "../dimensions/category.js";
import type { AnalysisResult } from "../../analyze/types.js";
import type { RecipeContext } from "../types.js";

function makeAnalysis(overrides?: Record<string, Record<string, number | boolean | string | null>>): AnalysisResult {
  return {
    analysisVersion: "1.0",
    sampleRate: 44100,
    sampleCount: 44100,
    metrics: {
      time: { duration: 1.0, peak: 0.5, rms: 0.2, crestFactor: 2.5 },
      quality: { clipping: false, silence: false },
      envelope: { attackTime: 10 },
      spectral: { spectralCentroid: 2000 },
      ...overrides,
    },
  };
}

describe("CategoryClassifier", () => {
  const classifier = new CategoryClassifier();

  it("returns lowercase category from recipe context", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "weapon-laser-zap", category: "Weapon", tags: [] };
    expect(classifier.classify(analysis, context)).toEqual({ category: "weapon" });
  });

  it("maps weapon-laser-zap -> weapon", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "weapon-laser-zap", category: "Weapon" };
    expect(classifier.classify(analysis, context).category).toBe("weapon");
  });

  it("maps footstep-stone -> footstep", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "footstep-stone", category: "Footstep" };
    expect(classifier.classify(analysis, context).category).toBe("footstep");
  });

  it("maps ui-scifi-confirm -> ui", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "ui-scifi-confirm", category: "UI" };
    expect(classifier.classify(analysis, context).category).toBe("ui");
  });

  it("maps ambient-wind-gust -> ambient", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "ambient-wind-gust", category: "Ambient" };
    expect(classifier.classify(analysis, context).category).toBe("ambient");
  });

  it("maps character-jump -> character", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "character-jump", category: "Character" };
    expect(classifier.classify(analysis, context).category).toBe("character");
  });

  it("maps impact-crack -> impact", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "impact-crack", category: "Impact" };
    expect(classifier.classify(analysis, context).category).toBe("impact");
  });

  it("maps creature-vocal -> creature", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "creature-vocal", category: "Creature" };
    expect(classifier.classify(analysis, context).category).toBe("creature");
  });

  it("maps vehicle-engine -> vehicle", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "vehicle-engine", category: "Vehicle" };
    expect(classifier.classify(analysis, context).category).toBe("vehicle");
  });

  it("maps slam-transient -> impact via recipe name parsing", () => {
    const analysis = makeAnalysis();
    // Context has no category set, but has recipe name
    const context: RecipeContext = { name: "slam-transient", category: "" };
    // Empty category string means the first branch is falsy, falls to name parsing
    expect(classifier.classify(analysis, context).category).toBe("impact");
  });

  it("maps card-flip -> card-game via recipe name parsing", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "card-flip", category: "" };
    expect(classifier.classify(analysis, context).category).toBe("card-game");
  });

  it("maps card-coin-collect -> card-game via recipe name parsing", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "card-coin-collect", category: "" };
    expect(classifier.classify(analysis, context).category).toBe("card-game");
  });

  it("maps card-victory-fanfare -> card-game via recipe name parsing", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "card-victory-fanfare", category: "" };
    expect(classifier.classify(analysis, context).category).toBe("card-game");
  });

  it("does not classify non-card recipes as card-game", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "character-jump", category: "" };
    expect(classifier.classify(analysis, context).category).not.toBe("card-game");
  });

  it("falls back to metrics when no recipe metadata", () => {
    // Short duration, high peak, fast attack -> impact
    const analysis = makeAnalysis({
      time: { duration: 0.2, peak: 0.8, rms: 0.3, crestFactor: 2.5 },
      envelope: { attackTime: 3 },
      spectral: { spectralCentroid: 2000 },
    });

    expect(classifier.classify(analysis).category).toBe("impact");
  });

  it("infers ambient from long low-RMS sound", () => {
    const analysis = makeAnalysis({
      time: { duration: 5.0, peak: 0.2, rms: 0.05, crestFactor: 4 },
      envelope: { attackTime: 100 },
      spectral: { spectralCentroid: 800 },
    });

    expect(classifier.classify(analysis).category).toBe("ambient");
  });

  it("normalizes spaces in context category to hyphens", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "card-flip", category: "Card Game", tags: ["card", "card-game"] };
    expect(classifier.classify(analysis, context).category).toBe("card-game");
  });

  it("normalizes already-hyphenated context category", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "card-flip", category: "card-game", tags: ["card"] };
    expect(classifier.classify(analysis, context).category).toBe("card-game");
  });

  it("normalizes lowercase-with-spaces context category", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "card-flip", category: "card game", tags: [] };
    expect(classifier.classify(analysis, context).category).toBe("card-game");
  });

  it("is deterministic", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = { name: "weapon-laser-zap", category: "Weapon" };
    const results = Array.from({ length: 10 }, () => classifier.classify(analysis, context));
    for (const r of results) {
      expect(r).toEqual(results[0]);
    }
  });
});
