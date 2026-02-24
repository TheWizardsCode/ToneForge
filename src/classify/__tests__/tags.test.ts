import { describe, it, expect } from "vitest";
import { TagsClassifier } from "../dimensions/tags.js";
import type { AnalysisResult } from "../../analyze/types.js";
import type { RecipeContext } from "../types.js";

function makeAnalysis(): AnalysisResult {
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
  };
}

describe("TagsClassifier", () => {
  const classifier = new TagsClassifier();

  it("uses recipe tags as primary source, removing category duplicate", () => {
    const context: RecipeContext = {
      name: "weapon-laser-zap",
      category: "Weapon",
      tags: ["laser", "zap", "sci-fi", "weapon"],
    };
    const result = classifier.classify(makeAnalysis(), context);
    // "weapon" should be removed as it duplicates the category
    expect(result.tags).toEqual(["laser", "sci-fi", "zap"]);
    expect(result.tags).not.toContain("weapon");
  });

  it("sorts tags alphabetically", () => {
    const context: RecipeContext = {
      name: "footstep-stone",
      category: "Footstep",
      tags: ["stone", "impact", "foley", "footstep"],
    };
    const result = classifier.classify(makeAnalysis(), context);
    const sorted = [...result.tags!].sort();
    expect(result.tags).toEqual(sorted);
  });

  it("deduplicates tags", () => {
    const context: RecipeContext = {
      name: "test",
      category: "Test",
      tags: ["foo", "foo", "bar"],
    };
    const result = classifier.classify(makeAnalysis(), context);
    expect(result.tags).toEqual(["bar", "foo"]);
  });

  it("limits tags to 5", () => {
    const context: RecipeContext = {
      name: "test",
      category: "Other",
      tags: ["a", "b", "c", "d", "e", "f", "g"],
    };
    const result = classifier.classify(makeAnalysis(), context);
    expect(result.tags!.length).toBeLessThanOrEqual(5);
  });

  it("falls back to category-based tags for impact", () => {
    const context: RecipeContext = {
      name: "impact-crack",
      category: "Impact",
      tags: [],
    };
    const result = classifier.classify(makeAnalysis(), context);
    expect(result.tags).toEqual(["collision", "destruction"]);
  });

  it("falls back to category-based tags when no context", () => {
    // Without any context, we get "unknown" category fallback
    const result = classifier.classify(makeAnalysis());
    expect(result.tags).toEqual(["unclassified"]);
  });

  it("returns all-lowercase tags", () => {
    const context: RecipeContext = {
      name: "test",
      category: "Test",
      tags: ["Foo", "BAR"],
    };
    const result = classifier.classify(makeAnalysis(), context);
    for (const tag of result.tags!) {
      expect(tag).toBe(tag.toLowerCase());
    }
  });

  it("is deterministic", () => {
    const analysis = makeAnalysis();
    const context: RecipeContext = {
      name: "weapon-laser-zap",
      category: "Weapon",
      tags: ["laser", "zap", "sci-fi", "weapon"],
    };
    const results = Array.from({ length: 10 }, () => classifier.classify(analysis, context));
    for (const r of results) {
      expect(r).toEqual(results[0]);
    }
  });
});
