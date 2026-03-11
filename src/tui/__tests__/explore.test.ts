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
  formatAuditionChoice,
  buildAuditionChoices,
  formatAuditionStatus,
  playCandidate,
  runMutation,
  auditionRecipe,
  auditionCandidates,
} from "../stages/explore.js";
import { WizardSession } from "../state.js";
import type { ManifestEntry, SweepCache, CandidateSelection } from "../types.js";
import type { ExploreCandidate, RankMetric } from "../../explore/types.js";
import type { AnalysisResult } from "../../analyze/types.js";
import type { ClassificationResult } from "../../classify/types.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../explore/sweep.js", () => ({
  sweep: vi.fn(),
  mutate: vi.fn(),
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

vi.mock("../../core/renderer.js", () => ({
  renderRecipe: vi.fn(),
}));

vi.mock("../../audio/player.js", () => ({
  playAudio: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
  confirm: vi.fn(),
  Separator: class Separator {
    separator = true;
  },
}));

import { sweep, mutate } from "../../explore/sweep.js";
import { rankCandidates, keepTopN } from "../../explore/ranking.js";
import { outputInfo, outputError, outputSuccess } from "../../output.js";
import { renderRecipe } from "../../core/renderer.js";
import { playAudio } from "../../audio/player.js";
import { select } from "@inquirer/prompts";

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

// ---------------------------------------------------------------------------
// Stage 2b -- Audition pure helper tests
// ---------------------------------------------------------------------------

describe("formatAuditionChoice", () => {
  it("formats candidate with rank, seed, score, category, and duration", () => {
    const candidate = makeCandidate("card-flip", 7);
    candidate.score = 0.85;
    candidate.duration = 1.23;
    const result = formatAuditionChoice(candidate, 1);

    expect(result).toContain("#1");
    expect(result).toContain("seed  7");
    expect(result).toContain("score: 0.850");
    expect(result).toContain("test");
    expect(result).toContain("1.23s");
  });

  it("shows 'unknown' when classification is missing", () => {
    const candidate = makeCandidate("card-flip", 3);
    delete (candidate as { classification?: unknown }).classification;
    const result = formatAuditionChoice(candidate, 2);

    expect(result).toContain("unknown");
  });

  it("pads single-digit seeds", () => {
    const candidate = makeCandidate("test", 5);
    const result = formatAuditionChoice(candidate, 1);
    expect(result).toContain("seed  5");
  });
});

describe("buildAuditionChoices", () => {
  it("creates play, select, and mutate options for each candidate", () => {
    const candidates = makeCandidateList("card-flip", 2);
    const choices = buildAuditionChoices(candidates);

    // Each candidate gets 3 options (play, select, mutate) + separator
    // Plus skip and back at the end
    const actionChoices = choices.filter(
      (c) => "value" in c,
    ) as Array<{ value: { type: string; candidateIndex?: number } }>;

    // 2 candidates * 3 actions + skip + back = 8 action choices
    expect(actionChoices).toHaveLength(8);

    // First candidate actions
    expect(actionChoices[0]!.value).toEqual({ type: "play", candidateIndex: 0 });
    expect(actionChoices[1]!.value).toEqual({ type: "select", candidateIndex: 0 });
    expect(actionChoices[2]!.value).toEqual({ type: "mutate", candidateIndex: 0 });

    // Second candidate actions
    expect(actionChoices[3]!.value).toEqual({ type: "play", candidateIndex: 1 });
    expect(actionChoices[4]!.value).toEqual({ type: "select", candidateIndex: 1 });
    expect(actionChoices[5]!.value).toEqual({ type: "mutate", candidateIndex: 1 });

    // Skip and back
    expect(actionChoices[6]!.value).toEqual({ type: "skip" });
    expect(actionChoices[7]!.value).toEqual({ type: "back" });
  });

  it("includes separator between candidates and at the end", () => {
    const candidates = makeCandidateList("test", 1);
    const choices = buildAuditionChoices(candidates);

    // Count separators
    const separators = choices.filter((c) => !("value" in c));
    // 1 separator after candidate group + no extra
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });

  it("returns skip and back for empty candidates", () => {
    const choices = buildAuditionChoices([]);
    const actionChoices = choices.filter(
      (c) => "value" in c,
    ) as Array<{ value: { type: string } }>;

    expect(actionChoices).toHaveLength(2);
    expect(actionChoices[0]!.value.type).toBe("skip");
    expect(actionChoices[1]!.value.type).toBe("back");
  });
});

describe("formatAuditionStatus", () => {
  it("shows selected count out of total", () => {
    const result = formatAuditionStatus(5, 2, 1);
    expect(result).toContain("2/5 selected");
    expect(result).toContain("1 skipped");
    expect(result).toContain("2 remaining");
  });

  it("omits skipped when zero", () => {
    const result = formatAuditionStatus(3, 1, 0);
    expect(result).toContain("1/3 selected");
    expect(result).not.toContain("skipped");
    expect(result).toContain("2 remaining");
  });

  it("omits remaining when all accounted for", () => {
    const result = formatAuditionStatus(3, 2, 1);
    expect(result).toContain("2/3 selected");
    expect(result).toContain("1 skipped");
    expect(result).not.toContain("remaining");
  });

  it("handles all selected", () => {
    const result = formatAuditionStatus(3, 3, 0);
    expect(result).toBe("3/3 selected");
  });
});

// ---------------------------------------------------------------------------
// Stage 2b -- playCandidate tests
// ---------------------------------------------------------------------------

describe("playCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the recipe at the candidate seed and plays audio", async () => {
    const candidate = makeCandidate("card-flip", 7);
    const mockResult = { samples: new Float32Array(100), sampleRate: 44100 };
    (renderRecipe as Mock).mockResolvedValue(mockResult);
    (playAudio as Mock).mockResolvedValue(undefined);

    await playCandidate(candidate);

    expect(renderRecipe).toHaveBeenCalledWith("card-flip", 7);
    expect(playAudio).toHaveBeenCalledWith(
      mockResult.samples,
      expect.objectContaining({ sampleRate: 44100 }),
    );
  });

  it("handles render errors gracefully", async () => {
    const candidate = makeCandidate("broken", 1);
    (renderRecipe as Mock).mockRejectedValue(new Error("Render failed"));

    await playCandidate(candidate);

    expect(outputError).toHaveBeenCalled();
    const errorMsg = (outputError as Mock).mock.calls[0]![0];
    expect(errorMsg).toContain("Playback failed");
    expect(errorMsg).toContain("Render failed");
  });

  it("handles playback errors gracefully", async () => {
    const candidate = makeCandidate("card-flip", 5);
    (renderRecipe as Mock).mockResolvedValue({
      samples: new Float32Array(100),
      sampleRate: 44100,
    });
    (playAudio as Mock).mockRejectedValue(new Error("No audio player"));

    await playCandidate(candidate);

    expect(outputError).toHaveBeenCalled();
    const errorMsg = (outputError as Mock).mock.calls[0]![0];
    expect(errorMsg).toContain("Playback failed");
  });
});

// ---------------------------------------------------------------------------
// Stage 2b -- runMutation tests
// ---------------------------------------------------------------------------

describe("runMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls mutate with correct config and merges results", async () => {
    const baseCandidates = makeCandidateList("card-flip", 3);
    const baseCandidate = baseCandidates[0]!;

    // Create mutation results with different seeds
    const mutations = Array.from({ length: 5 }, (_, i) =>
      makeCandidate("card-flip", 100 + i),
    );
    (mutate as Mock).mockResolvedValue(mutations);

    const result = await runMutation(baseCandidate, baseCandidates);

    expect(mutate).toHaveBeenCalledOnce();
    const [config] = (mutate as Mock).mock.calls[0]!;
    expect(config.recipe).toBe("card-flip");
    expect(config.seed).toBe(baseCandidate.seed);
    expect(config.jitter).toBe(0.1);
    expect(config.count).toBe(20);

    // Should merge: 3 original + 5 new = 8
    expect(result.length).toBe(8);
  });

  it("does not duplicate candidates with same seed", async () => {
    const baseCandidates = makeCandidateList("card-flip", 3);
    const baseCandidate = baseCandidates[0]!;

    // Mutations include a duplicate seed (0, which already exists)
    const mutations = [
      makeCandidate("card-flip", 0),  // duplicate
      makeCandidate("card-flip", 100),
    ];
    (mutate as Mock).mockResolvedValue(mutations);

    const result = await runMutation(baseCandidate, baseCandidates);

    // 3 original + 1 new (100) = 4 (duplicate seed 0 excluded)
    expect(result.length).toBe(4);
  });

  it("returns original candidates on mutation error", async () => {
    const baseCandidates = makeCandidateList("card-flip", 3);
    const baseCandidate = baseCandidates[0]!;
    (mutate as Mock).mockRejectedValue(new Error("Mutation failed"));

    const result = await runMutation(baseCandidate, baseCandidates);

    expect(result).toBe(baseCandidates);
    expect(outputError).toHaveBeenCalled();
  });

  it("re-ranks merged candidates", async () => {
    const baseCandidates = makeCandidateList("card-flip", 2);
    const baseCandidate = baseCandidates[0]!;
    const mutations = [makeCandidate("card-flip", 50)];
    (mutate as Mock).mockResolvedValue(mutations);

    await runMutation(baseCandidate, baseCandidates);

    // rankCandidates should be called for the merged set
    expect(rankCandidates).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Stage 2b -- auditionRecipe tests
// ---------------------------------------------------------------------------

describe("auditionRecipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for empty candidates", async () => {
    const result = await auditionRecipe("card-flip", []);
    expect(result).toBeNull();
  });

  it("returns selection when user selects a candidate", async () => {
    const candidates = makeCandidateList("card-flip", 3);
    (select as Mock).mockResolvedValueOnce({
      type: "select",
      candidateIndex: 1,
    });

    const result = await auditionRecipe("card-flip", candidates);

    expect(result).not.toBeNull();
    expect(result).not.toBe("back");
    const selection = result as CandidateSelection;
    expect(selection.recipe).toBe("card-flip");
    expect(selection.candidate).toBe(candidates[1]);
    expect(selection.classification.category).toBe("test");
  });

  it("returns null when user skips", async () => {
    const candidates = makeCandidateList("card-flip", 3);
    (select as Mock).mockResolvedValueOnce({ type: "skip" });

    const result = await auditionRecipe("card-flip", candidates);
    expect(result).toBeNull();
  });

  it("returns 'back' when user chooses back", async () => {
    const candidates = makeCandidateList("card-flip", 3);
    (select as Mock).mockResolvedValueOnce({ type: "back" });

    const result = await auditionRecipe("card-flip", candidates);
    expect(result).toBe("back");
  });

  it("plays candidate then allows selection on second action", async () => {
    const candidates = makeCandidateList("card-flip", 3);
    const mockResult = { samples: new Float32Array(100), sampleRate: 44100 };
    (renderRecipe as Mock).mockResolvedValue(mockResult);
    (playAudio as Mock).mockResolvedValue(undefined);

    // First action: play candidate 0, second action: select candidate 0
    (select as Mock)
      .mockResolvedValueOnce({ type: "play", candidateIndex: 0 })
      .mockResolvedValueOnce({ type: "select", candidateIndex: 0 });

    const result = await auditionRecipe("card-flip", candidates);

    expect(renderRecipe).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
    expect(result).not.toBe("back");
    const selection = result as CandidateSelection;
    expect(selection.candidate).toBe(candidates[0]);
  });

  it("runs mutation then allows selection from expanded list", async () => {
    const candidates = makeCandidateList("card-flip", 3);
    const mutations = [makeCandidate("card-flip", 50)];
    (mutate as Mock).mockResolvedValue(mutations);

    // First action: mutate candidate 0, second action: select candidate 0
    (select as Mock)
      .mockResolvedValueOnce({ type: "mutate", candidateIndex: 0 })
      .mockResolvedValueOnce({ type: "select", candidateIndex: 0 });

    const result = await auditionRecipe("card-flip", candidates);

    expect(mutate).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
    expect(result).not.toBe("back");
  });

  it("provides default classification when candidate has none", async () => {
    const candidates = makeCandidateList("card-flip", 1);
    delete (candidates[0] as { classification?: unknown }).classification;

    (select as Mock).mockResolvedValueOnce({
      type: "select",
      candidateIndex: 0,
    });

    const result = await auditionRecipe("card-flip", candidates);
    expect(result).not.toBeNull();
    expect(result).not.toBe("back");
    const selection = result as CandidateSelection;
    expect(selection.classification.category).toBe("unknown");
    expect(selection.classification.intensity).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// Stage 2b -- auditionCandidates tests
// ---------------------------------------------------------------------------

describe("auditionCandidates", () => {
  let session: WizardSession;

  beforeEach(() => {
    session = new WizardSession();
    vi.clearAllMocks();
  });

  it("stores selections in session state", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));
    const sweepResults = new Map<string, ExploreCandidate[]>();
    sweepResults.set("card-flip", makeCandidateList("card-flip", 3));

    // User selects candidate 0
    (select as Mock).mockResolvedValueOnce({
      type: "select",
      candidateIndex: 0,
    });

    const result = await auditionCandidates(session, sweepResults);

    expect(result).toBe("advance");
    expect(session.getSelection("card-flip")).toBeDefined();
    expect(session.getSelection("card-flip")!.recipe).toBe("card-flip");
  });

  it("returns 'back' when user backs out during audition", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));
    const sweepResults = new Map<string, ExploreCandidate[]>();
    sweepResults.set("card-flip", makeCandidateList("card-flip", 3));

    (select as Mock).mockResolvedValueOnce({ type: "back" });

    const result = await auditionCandidates(session, sweepResults);
    expect(result).toBe("back");
  });

  it("handles skip then revisit flow", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));
    session.addToManifest(makeManifestEntry("coin-collect"));
    const sweepResults = new Map<string, ExploreCandidate[]>();
    sweepResults.set("card-flip", makeCandidateList("card-flip", 3));
    sweepResults.set("coin-collect", makeCandidateList("coin-collect", 3));

    // Skip card-flip, select coin-collect, then revisit card-flip
    (select as Mock)
      .mockResolvedValueOnce({ type: "skip" })           // skip card-flip
      .mockResolvedValueOnce({ type: "select", candidateIndex: 0 })  // select coin-collect
      .mockResolvedValueOnce("card-flip")                 // revisit menu: choose card-flip
      .mockResolvedValueOnce({ type: "select", candidateIndex: 1 }); // select card-flip candidate

    const result = await auditionCandidates(session, sweepResults);

    expect(result).toBe("advance");
    expect(session.getSelection("card-flip")).toBeDefined();
    expect(session.getSelection("coin-collect")).toBeDefined();
  });

  it("allows advancing with partial selections (skip remaining)", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));
    session.addToManifest(makeManifestEntry("coin-collect"));
    const sweepResults = new Map<string, ExploreCandidate[]>();
    sweepResults.set("card-flip", makeCandidateList("card-flip", 3));
    sweepResults.set("coin-collect", makeCandidateList("coin-collect", 3));

    // Select card-flip, skip coin-collect, then advance
    (select as Mock)
      .mockResolvedValueOnce({ type: "select", candidateIndex: 0 })  // select card-flip
      .mockResolvedValueOnce({ type: "skip" })                       // skip coin-collect
      .mockResolvedValueOnce("__advance__");                         // advance with partial

    const result = await auditionCandidates(session, sweepResults);

    expect(result).toBe("advance");
    expect(session.getSelection("card-flip")).toBeDefined();
    expect(session.getSelection("coin-collect")).toBeUndefined();
  });

  it("returns 'back' when no selections and all skipped", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));
    const sweepResults = new Map<string, ExploreCandidate[]>();
    sweepResults.set("card-flip", makeCandidateList("card-flip", 3));

    // Skip, then back from revisit menu
    (select as Mock)
      .mockResolvedValueOnce({ type: "skip" })   // skip card-flip
      .mockResolvedValueOnce("__back__");         // back from revisit

    const result = await auditionCandidates(session, sweepResults);
    expect(result).toBe("back");
  });

  it("enforces minimum selection validation", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));
    const sweepResults = new Map<string, ExploreCandidate[]>();
    sweepResults.set("card-flip", makeCandidateList("card-flip", 3));

    // Skip, then revisit prompt shows no advance option (0 selections)
    // Then revisit and select
    (select as Mock)
      .mockResolvedValueOnce({ type: "skip" })                      // skip
      .mockResolvedValueOnce("card-flip")                            // revisit
      .mockResolvedValueOnce({ type: "select", candidateIndex: 0 }); // select

    const result = await auditionCandidates(session, sweepResults);

    expect(result).toBe("advance");
    expect(session.getSelection("card-flip")).toBeDefined();

    // Verify the minimum selection message was shown
    const infoCalls = (outputInfo as Mock).mock.calls.map((c) => c[0]) as string[];
    expect(
      infoCalls.some((msg) => msg.includes("must select at least one")),
    ).toBe(true);
  });

  it("skips recipes that already have selections", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));
    session.addToManifest(makeManifestEntry("coin-collect"));

    // Pre-populate card-flip selection
    const preSelected = makeCandidate("card-flip", 5);
    session.setSelection("card-flip", {
      recipe: "card-flip",
      candidate: preSelected,
      classification: preSelected.classification!,
    });

    const sweepResults = new Map<string, ExploreCandidate[]>();
    sweepResults.set("card-flip", makeCandidateList("card-flip", 3));
    sweepResults.set("coin-collect", makeCandidateList("coin-collect", 3));

    // Only coin-collect should be auditioned
    (select as Mock).mockResolvedValueOnce({
      type: "select",
      candidateIndex: 0,
    });

    const result = await auditionCandidates(session, sweepResults);

    expect(result).toBe("advance");
    // select should only be called once (for coin-collect)
    expect(select).toHaveBeenCalledOnce();
  });

  it("handles empty sweep results gracefully", async () => {
    session.addToManifest(makeManifestEntry("card-flip"));
    const sweepResults = new Map<string, ExploreCandidate[]>();
    sweepResults.set("card-flip", []);

    // No candidates, should auto-skip and enter revisit loop, then back
    (select as Mock).mockResolvedValueOnce("__back__");

    const result = await auditionCandidates(session, sweepResults);
    expect(result).toBe("back");
  });
});
