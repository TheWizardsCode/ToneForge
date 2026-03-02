import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  formatProgressLine,
  formatCandidateRow,
  extractMetricDisplay,
  formatSweepResults,
  buildSweepConfig,
  formatManifestProgress,
  sweepRecipe,
  sweepManifest,
} from "../stages/explore.js";
import { WizardSession } from "../state.js";
import type { ManifestEntry, SweepCache } from "../types.js";
import type { ExploreCandidate, RankMetric } from "../../explore/types.js";
import type { AnalysisResult } from "../../analyze/types.js";
import type { ClassificationResult } from "../../classify/types.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../explore/sweep.js", () => ({
  sweep: vi.fn(),
  defaultConcurrency: vi.fn(() => 2),
}));

vi.mock("../../explore/ranking.js", () => ({
  rankCandidates: vi.fn((candidates: ExploreCandidate[]) => {
    // Simulate scoring: assign a descending score
    for (let i = 0; i < candidates.length; i++) {
      candidates[i]!.score = 1 - i * 0.1;
      candidates[i]!.metricScores = {
        rms: 0.8 - i * 0.1,
        "spectral-centroid": 0.7 - i * 0.1,
        "transient-density": 0.6 - i * 0.05,
        "attack-time": 0.5 - i * 0.05,
      };
    }
    return candidates;
  }),
  keepTopN: vi.fn((candidates: ExploreCandidate[], n: number) =>
    candidates.slice(0, n),
  ),
}));

vi.mock("../../output.js", () => ({
  outputInfo: vi.fn(),
  outputError: vi.fn(),
  outputSuccess: vi.fn(),
}));

import { sweep } from "../../explore/sweep.js";
import { rankCandidates, keepTopN } from "../../explore/ranking.js";
import { outputInfo, outputError, outputSuccess } from "../../output.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeAnalysis(): AnalysisResult {
  return {
    analysisVersion: "1.0",
    sampleRate: 44100,
    sampleCount: 1000,
    metrics: {
      time: { duration: 1.0, peak: 0.9, rms: 0.3, crestFactor: 3.0 },
      spectral: { spectralCentroid: 1200 },
      envelope: { attackTime: 0.05 },
      quality: { clipping: false, silence: false },
    },
  };
}

function makeCandidate(recipe: string, seed: number): ExploreCandidate {
  return {
    id: `${recipe}_seed-${String(seed).padStart(5, "0")}`,
    recipe,
    seed,
    duration: 1.0,
    sampleRate: 44100,
    sampleCount: 44100,
    analysis: makeAnalysis(),
    classification: {
      source: `${recipe}_seed-${seed}`,
      category: "test",
      intensity: "medium",
      texture: ["smooth"],
      material: null,
      tags: ["test"],
      embedding: [],
      analysisRef: "",
    },
    score: 0.85,
    metricScores: {
      rms: 0.75,
      "spectral-centroid": 0.62,
      "transient-density": 0.55,
      "attack-time": 0.48,
    },
    cluster: -1,
    promoted: false,
    libraryId: null,
    params: {},
  };
}

function makeManifestEntry(recipe: string): ManifestEntry {
  return {
    recipe,
    description: `Description for ${recipe}`,
    category: "test",
    tags: ["test-tag"],
  };
}

function makeCandidateList(recipe: string, count: number): ExploreCandidate[] {
  return Array.from({ length: count }, (_, i) => makeCandidate(recipe, i));
}

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

describe("formatProgressLine", () => {
  it("formats a progress line with completed/total and recipe name", () => {
    const result = formatProgressLine(3, 20, "card-flip");
    expect(result).toBe("  [3/20] Sweeping card-flip...");
  });

  it("handles completion (all seeds done)", () => {
    const result = formatProgressLine(20, 20, "laser-zap");
    expect(result).toBe("  [20/20] Sweeping laser-zap...");
  });

  it("handles first seed", () => {
    const result = formatProgressLine(1, 20, "coin-collect");
    expect(result).toBe("  [1/20] Sweeping coin-collect...");
  });
});

describe("formatCandidateRow", () => {
  it("displays seed, RMS, centroid, and classification category", () => {
    const candidate = makeCandidate("card-flip", 7);
    const result = formatCandidateRow(candidate);

    expect(result).toContain("seed  7");
    expect(result).toContain("RMS:");
    expect(result).toContain("Centroid:");
    expect(result).toContain("Category: test");
  });

  it("shows 'unknown' when classification is missing", () => {
    const candidate = makeCandidate("card-flip", 3);
    delete (candidate as { classification?: unknown }).classification;
    const result = formatCandidateRow(candidate);

    expect(result).toContain("Category: unknown");
  });

  it("pads single-digit seed numbers with a leading space", () => {
    const candidate = makeCandidate("test", 5);
    const result = formatCandidateRow(candidate);
    expect(result).toContain("seed  5");
  });

  it("does not pad double-digit seed numbers", () => {
    const candidate = makeCandidate("test", 15);
    const result = formatCandidateRow(candidate);
    expect(result).toContain("seed 15");
  });
});

describe("extractMetricDisplay", () => {
  it("returns formatted normalized score for a valid metric", () => {
    const candidate = makeCandidate("test", 0);
    candidate.metricScores["rms"] = 0.756;
    const result = extractMetricDisplay(candidate, "rms");
    expect(result).toBe("0.756");
  });

  it("returns N/A for an invalid metric name", () => {
    const candidate = makeCandidate("test", 0);
    const result = extractMetricDisplay(candidate, "nonexistent-metric");
    expect(result).toBe("N/A");
  });

  it("returns N/A when metric score is not present", () => {
    const candidate = makeCandidate("test", 0);
    candidate.metricScores = {};
    const result = extractMetricDisplay(candidate, "rms");
    expect(result).toBe("N/A");
  });
});

describe("formatSweepResults", () => {
  it("formats results with header and numbered candidate rows", () => {
    const candidates = makeCandidateList("card-flip", 3);
    const result = formatSweepResults("card-flip", candidates);

    expect(result).toContain("card-flip -- Top 3 candidates:");
    expect(result).toContain("1.");
    expect(result).toContain("2.");
    expect(result).toContain("3.");
  });

  it("handles singular candidate", () => {
    const candidates = makeCandidateList("card-flip", 1);
    const result = formatSweepResults("card-flip", candidates);
    expect(result).toContain("Top 1 candidate:");
  });

  it("shows message for empty candidates", () => {
    const result = formatSweepResults("card-flip", []);
    expect(result).toContain("No candidates produced");
  });
});

describe("buildSweepConfig", () => {
  it("builds a config with default seed range 0-19", () => {
    const config = buildSweepConfig("card-flip");
    expect(config.recipe).toBe("card-flip");
    expect(config.seedStart).toBe(0);
    expect(config.seedEnd).toBe(19);
  });

  it("keeps top 5 candidates", () => {
    const config = buildSweepConfig("test");
    expect(config.keepTop).toBe(5);
  });

  it("uses all four default rank metrics", () => {
    const config = buildSweepConfig("test");
    expect(config.rankBy).toEqual([
      "rms",
      "spectral-centroid",
      "transient-density",
      "attack-time",
    ]);
  });

  it("returns independent rankBy array (not shared reference)", () => {
    const config1 = buildSweepConfig("a");
    const config2 = buildSweepConfig("b");
    config1.rankBy.push("rms" as RankMetric);
    expect(config2.rankBy).toHaveLength(4);
  });
});

describe("formatManifestProgress", () => {
  it("formats 1-based recipe index", () => {
    expect(formatManifestProgress(0, 5, "card-flip")).toBe(
      "Recipe 1/5: card-flip",
    );
  });

  it("formats last recipe correctly", () => {
    expect(formatManifestProgress(4, 5, "laser-zap")).toBe(
      "Recipe 5/5: laser-zap",
    );
  });
});

// ---------------------------------------------------------------------------
// Sweep orchestration tests (with mocked sweep/ranking)
// ---------------------------------------------------------------------------

describe("sweepRecipe", () => {
  let session: WizardSession;

  beforeEach(() => {
    session = new WizardSession();
    vi.clearAllMocks();
  });

  it("calls sweep() with correct config and progress callback", async () => {
    const candidates = makeCandidateList("card-flip", 20);
    (sweep as Mock).mockResolvedValue(candidates);

    const progressCb = vi.fn();
    await sweepRecipe("card-flip", session, progressCb);

    expect(sweep).toHaveBeenCalledOnce();
    const [config, cb] = (sweep as Mock).mock.calls[0]!;
    expect(config.recipe).toBe("card-flip");
    expect(config.seedStart).toBe(0);
    expect(config.seedEnd).toBe(19);
    expect(cb).toBe(progressCb);
  });

  it("calls rankCandidates and keepTopN after sweep", async () => {
    const candidates = makeCandidateList("card-flip", 20);
    (sweep as Mock).mockResolvedValue(candidates);

    const result = await sweepRecipe("card-flip", session);

    expect(rankCandidates).toHaveBeenCalledOnce();
    expect(keepTopN).toHaveBeenCalledOnce();
    expect((keepTopN as Mock).mock.calls[0]![1]).toBe(5);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("caches sweep results in session state", async () => {
    const candidates = makeCandidateList("card-flip", 20);
    (sweep as Mock).mockResolvedValue(candidates);

    await sweepRecipe("card-flip", session);

    expect(session.hasSweepCache("card-flip")).toBe(true);
    const cached = session.getSweepCache("card-flip");
    expect(cached).toBeDefined();
    expect(cached!.recipe).toBe("card-flip");
    expect(cached!.candidates.length).toBeLessThanOrEqual(5);
  });

  it("returns cached results without calling sweep again", async () => {
    // Pre-populate cache
    const cachedCandidates = makeCandidateList("card-flip", 3);
    session.setSweepCache("card-flip", {
      recipe: "card-flip",
      candidates: cachedCandidates,
    });

    const result = await sweepRecipe("card-flip", session);

    expect(sweep).not.toHaveBeenCalled();
    expect(result).toBe(cachedCandidates);
  });

  it("passes progress callback to sweep function", async () => {
    const candidates = makeCandidateList("test", 5);
    (sweep as Mock).mockImplementation(async (_config, onProgress) => {
      // Simulate progress callbacks
      onProgress?.(1, 20);
      onProgress?.(2, 20);
      return candidates;
    });

    const progressCb = vi.fn();
    await sweepRecipe("test", session, progressCb);

    expect(progressCb).toHaveBeenCalledTimes(2);
    expect(progressCb).toHaveBeenCalledWith(1, 20);
    expect(progressCb).toHaveBeenCalledWith(2, 20);
  });
});

describe("sweepManifest", () => {
  let session: WizardSession;

  beforeEach(() => {
    session = new WizardSession();
    vi.clearAllMocks();
  });

  it("sweeps all manifest recipes and returns results map", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));
    session.addToManifest(makeManifestEntry("coin-collect"));

    const flipCandidates = makeCandidateList("card-flip", 20);
    const coinCandidates = makeCandidateList("coin-collect", 20);

    (sweep as Mock)
      .mockResolvedValueOnce(flipCandidates)
      .mockResolvedValueOnce(coinCandidates);

    const results = await sweepManifest(session);

    expect(results.size).toBe(2);
    expect(results.has("card-flip")).toBe(true);
    expect(results.has("coin-collect")).toBe(true);
    expect(sweep).toHaveBeenCalledTimes(2);
  });

  it("uses cached results for previously swept recipes", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));
    session.addToManifest(makeManifestEntry("coin-collect"));

    // Pre-cache card-flip
    const cachedCandidates = makeCandidateList("card-flip", 3);
    session.setSweepCache("card-flip", {
      recipe: "card-flip",
      candidates: cachedCandidates,
    });

    // Only coin-collect needs sweeping
    const coinCandidates = makeCandidateList("coin-collect", 20);
    (sweep as Mock).mockResolvedValue(coinCandidates);

    const results = await sweepManifest(session);

    expect(results.size).toBe(2);
    // sweep() should only be called once (for coin-collect)
    expect(sweep).toHaveBeenCalledOnce();
    expect(results.get("card-flip")).toBe(cachedCandidates);
  });

  it("displays progress for each recipe", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));
    (sweep as Mock).mockResolvedValue(makeCandidateList("card-flip", 20));

    await sweepManifest(session);

    // Should output recipe progress
    const infoCalls = (outputInfo as Mock).mock.calls.map((c) => c[0]);
    expect(infoCalls.some((msg: string) => msg.includes("Recipe 1/1: card-flip"))).toBe(true);
  });

  it("handles empty manifest gracefully", async () => {
    const results = await sweepManifest(session);

    expect(results.size).toBe(0);
    expect(outputError).toHaveBeenCalledWith(
      "No recipes in manifest. Cannot sweep.",
    );
    expect(sweep).not.toHaveBeenCalled();
  });

  it("handles sweep errors gracefully without crashing", async () => {
    session.addToManifest(makeManifestEntry("broken-recipe"));
    (sweep as Mock).mockRejectedValue(new Error("Recipe not found: broken-recipe"));

    const results = await sweepManifest(session);

    expect(results.size).toBe(1);
    expect(results.get("broken-recipe")).toEqual([]);
    const errorCalls = (outputError as Mock).mock.calls.map((c) => c[0]);
    expect(
      errorCalls.some((msg: string) => msg.includes("Sweep failed")),
    ).toBe(true);
  });

  it("displays summary after all sweeps complete", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));
    (sweep as Mock).mockResolvedValue(makeCandidateList("card-flip", 20));

    await sweepManifest(session);

    const successCalls = (outputSuccess as Mock).mock.calls.map((c) => c[0]);
    expect(
      successCalls.some((msg: string) => msg.includes("Sweep complete")),
    ).toBe(true);
  });

  it("invokes progress callback at least once per seed", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));

    let progressCallCount = 0;
    (sweep as Mock).mockImplementation(async (_config, onProgress) => {
      // Simulate one progress call per seed
      for (let i = 1; i <= 20; i++) {
        onProgress?.(i, 20);
        progressCallCount++;
      }
      return makeCandidateList("card-flip", 20);
    });

    await sweepManifest(session);

    // At least 20 progress calls (one per seed)
    expect(progressCallCount).toBe(20);
  });
});
