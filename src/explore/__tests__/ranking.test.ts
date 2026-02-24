import { describe, it, expect } from "vitest";
import {
  extractMetricValue,
  normalizeValues,
  rankCandidates,
  keepTopN,
} from "../ranking.js";
import type { ExploreCandidate } from "../types.js";
import type { AnalysisResult } from "../../analyze/types.js";

/** Helper: create a minimal AnalysisResult with specified metric values. */
function makeAnalysis(
  overrides: Record<string, Record<string, number | boolean | string | null>> = {},
): AnalysisResult {
  return {
    analysisVersion: "1.0",
    sampleRate: 44100,
    sampleCount: 1000,
    metrics: {
      time: { duration: 1.0, peak: 0.9, rms: 0.3, crestFactor: 3.0 },
      spectral: { spectralCentroid: 1200 },
      envelope: { attackTime: 0.05 },
      quality: { clipping: false, silence: false },
      ...overrides,
    },
  };
}

/** Helper: create a minimal ExploreCandidate with specified analysis. */
function makeCandidate(
  id: string,
  analysis?: AnalysisResult,
): ExploreCandidate {
  return {
    id,
    recipe: "test-recipe",
    seed: 1,
    duration: 1.0,
    sampleRate: 44100,
    sampleCount: 1000,
    analysis: analysis ?? makeAnalysis(),
    score: 0,
    metricScores: {},
    cluster: -1,
    promoted: false,
    libraryId: null,
    params: {},
  };
}

describe("extractMetricValue", () => {
  it("extracts rms from time category", () => {
    const c = makeCandidate("a");
    expect(extractMetricValue(c, "rms")).toBe(0.3);
  });

  it("extracts spectral-centroid from spectral category", () => {
    const c = makeCandidate("a");
    expect(extractMetricValue(c, "spectral-centroid")).toBe(1200);
  });

  it("extracts transient-density (crestFactor) from time category", () => {
    const c = makeCandidate("a");
    expect(extractMetricValue(c, "transient-density")).toBe(3.0);
  });

  it("extracts attack-time from envelope category", () => {
    const c = makeCandidate("a");
    expect(extractMetricValue(c, "attack-time")).toBe(0.05);
  });

  it("returns null when category is missing", () => {
    const c = makeCandidate("a", {
      analysisVersion: "1.0",
      sampleRate: 44100,
      sampleCount: 1000,
      metrics: {},
    });
    expect(extractMetricValue(c, "rms")).toBeNull();
  });

  it("returns null when key is missing in category", () => {
    const c = makeCandidate("a", {
      analysisVersion: "1.0",
      sampleRate: 44100,
      sampleCount: 1000,
      metrics: { time: { duration: 1.0 } },
    });
    expect(extractMetricValue(c, "rms")).toBeNull();
  });

  it("returns null for non-finite values (NaN)", () => {
    const c = makeCandidate("a", makeAnalysis({ time: { rms: NaN, crestFactor: 3.0 } }));
    expect(extractMetricValue(c, "rms")).toBeNull();
  });

  it("returns null for non-finite values (Infinity)", () => {
    const c = makeCandidate("a", makeAnalysis({ time: { rms: Infinity, crestFactor: 3.0 } }));
    expect(extractMetricValue(c, "rms")).toBeNull();
  });
});

describe("normalizeValues", () => {
  it("normalizes a simple range to [0, 1]", () => {
    const result = normalizeValues([10, 20, 30]);
    expect(result).toEqual([0, 0.5, 1]);
  });

  it("handles all-equal values as 0.5", () => {
    const result = normalizeValues([5, 5, 5]);
    expect(result).toEqual([0.5, 0.5, 0.5]);
  });

  it("preserves null entries", () => {
    const result = normalizeValues([10, null, 30]);
    expect(result).toEqual([0, null, 1]);
  });

  it("returns all nulls when all values are null", () => {
    const result = normalizeValues([null, null]);
    expect(result).toEqual([null, null]);
  });

  it("handles empty array", () => {
    expect(normalizeValues([])).toEqual([]);
  });

  it("handles single non-null value as 0.5", () => {
    const result = normalizeValues([42]);
    expect(result).toEqual([0.5]);
  });

  it("handles mix of null and single value", () => {
    const result = normalizeValues([null, 100, null]);
    expect(result).toEqual([null, 0.5, null]);
  });

  it("handles negative values", () => {
    const result = normalizeValues([-10, 0, 10]);
    expect(result).toEqual([0, 0.5, 1]);
  });
});

describe("rankCandidates", () => {
  it("sorts candidates by single metric descending", () => {
    const a = makeCandidate("a", makeAnalysis({ time: { rms: 0.1, crestFactor: 3.0 } }));
    const b = makeCandidate("b", makeAnalysis({ time: { rms: 0.5, crestFactor: 3.0 } }));
    const c = makeCandidate("c", makeAnalysis({ time: { rms: 0.3, crestFactor: 3.0 } }));

    const result = rankCandidates([a, b, c], ["rms"]);

    expect(result[0]!.id).toBe("b");
    expect(result[1]!.id).toBe("c");
    expect(result[2]!.id).toBe("a");
  });

  it("assigns normalized scores to candidates", () => {
    const a = makeCandidate("a", makeAnalysis({ time: { rms: 0.0, crestFactor: 3.0 } }));
    const b = makeCandidate("b", makeAnalysis({ time: { rms: 1.0, crestFactor: 3.0 } }));

    rankCandidates([a, b], ["rms"]);

    expect(a.metricScores["rms"]).toBe(0);
    expect(b.metricScores["rms"]).toBe(1);
    expect(a.score).toBe(0);
    expect(b.score).toBe(1);
  });

  it("computes composite score from multiple metrics", () => {
    const a = makeCandidate("a", makeAnalysis({
      time: { rms: 1.0, crestFactor: 1.0 },
      spectral: { spectralCentroid: 500 },
    }));
    const b = makeCandidate("b", makeAnalysis({
      time: { rms: 0.0, crestFactor: 5.0 },
      spectral: { spectralCentroid: 2000 },
    }));

    rankCandidates([a, b], ["rms", "spectral-centroid"]);

    // With 2 candidates, one gets 0 and the other gets 1 for each metric
    // a: rms=1, spectral=0 → avg 0.5
    // b: rms=0, spectral=1 → avg 0.5
    expect(a.score).toBe(0.5);
    expect(b.score).toBe(0.5);
  });

  it("returns empty array unchanged", () => {
    const result = rankCandidates([], ["rms"]);
    expect(result).toEqual([]);
  });

  it("returns candidates unchanged with no metrics", () => {
    const a = makeCandidate("a");
    const result = rankCandidates([a], []);
    expect(result).toEqual([a]);
    expect(a.score).toBe(0);
  });

  it("handles candidates with missing metric values", () => {
    const a = makeCandidate("a", makeAnalysis({ time: { rms: 0.5, crestFactor: 3.0 } }));
    const b = makeCandidate("b", {
      analysisVersion: "1.0",
      sampleRate: 44100,
      sampleCount: 1000,
      metrics: {}, // no time category at all
    });

    rankCandidates([a, b], ["rms"]);

    // a has the only rms value → normalized to 0.5 (single value)
    expect(a.metricScores["rms"]).toBe(0.5);
    // b has no rms → should not have a metricScores entry for rms
    expect(b.metricScores["rms"]).toBeUndefined();
    expect(b.score).toBe(0);
  });
});

describe("keepTopN", () => {
  it("keeps only the top N candidates", () => {
    const candidates = [
      makeCandidate("a"),
      makeCandidate("b"),
      makeCandidate("c"),
    ];
    const result = keepTopN(candidates, 2);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("a");
    expect(result[1]!.id).toBe("b");
  });

  it("returns all candidates when N >= length", () => {
    const candidates = [makeCandidate("a"), makeCandidate("b")];
    const result = keepTopN(candidates, 5);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for keepTop 0", () => {
    const result = keepTopN([makeCandidate("a")], 0);
    expect(result).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(keepTopN([], 5)).toEqual([]);
  });
});
