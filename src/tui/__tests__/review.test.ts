import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  intensityIndex,
  textureIndex,
  median,
  medianIntensity,
  selectionTextureIndex,
  medianTextureIndex,
  flagCoherenceOutliers,
  buildSummaryRows,
  summaryColumns,
  getOrderedSelections,
  runReviewStage,
} from "../stages/review.js";
import { WizardSession } from "../state.js";
import type { ManifestEntry, CandidateSelection } from "../types.js";
import type { ExploreCandidate } from "../../explore/types.js";
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
  rankCandidates: vi.fn((candidates: ExploreCandidate[]) => candidates),
  keepTopN: vi.fn((candidates: ExploreCandidate[], n: number) =>
    candidates.slice(0, n),
  ),
}));

vi.mock("../../output.js", () => ({
  outputInfo: vi.fn(),
  outputError: vi.fn(),
  outputSuccess: vi.fn(),
  outputTable: vi.fn(),
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

import { outputInfo, outputError, outputSuccess, outputTable } from "../../output.js";
import { select, confirm } from "@inquirer/prompts";

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
    },
    cluster: -1,
    promoted: false,
    libraryId: null,
    params: {},
  };
}

function makeClassification(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return {
    source: "test",
    category: "test",
    intensity: "medium",
    texture: ["smooth"],
    material: null,
    tags: ["test"],
    embedding: [],
    analysisRef: "",
    ...overrides,
  };
}

function makeSelection(
  recipe: string,
  seed: number,
  classOverrides: Partial<ClassificationResult> = {},
): CandidateSelection {
  return {
    recipe,
    candidate: makeCandidate(recipe, seed),
    classification: makeClassification({ source: `${recipe}_seed-${seed}`, ...classOverrides }),
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

function buildSession(
  recipes: string[],
  selectionOverrides?: Map<string, Partial<ClassificationResult>>,
): WizardSession {
  const session = new WizardSession();
  for (const recipe of recipes) {
    session.addToManifest(makeManifestEntry(recipe));
    const classOverrides = selectionOverrides?.get(recipe) ?? {};
    const sel = makeSelection(recipe, 5, classOverrides);
    session.setSelection(recipe, sel);
  }
  return session;
}

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

describe("intensityIndex", () => {
  it("returns correct index for all known values", () => {
    expect(intensityIndex("subtle")).toBe(0);
    expect(intensityIndex("soft")).toBe(1);
    expect(intensityIndex("medium")).toBe(2);
    expect(intensityIndex("hard")).toBe(3);
    expect(intensityIndex("aggressive")).toBe(4);
  });

  it("returns -1 for unknown labels", () => {
    expect(intensityIndex("unknown")).toBe(-1);
    expect(intensityIndex("")).toBe(-1);
    expect(intensityIndex("loud")).toBe(-1);
  });

  it("is case-insensitive", () => {
    expect(intensityIndex("Medium")).toBe(2);
    expect(intensityIndex("HARD")).toBe(3);
  });
});

describe("textureIndex", () => {
  it("returns correct index for all known values", () => {
    expect(textureIndex("bright")).toBe(0);
    expect(textureIndex("crunchy")).toBe(1);
    expect(textureIndex("dark")).toBe(2);
    expect(textureIndex("harsh")).toBe(3);
    expect(textureIndex("noisy")).toBe(4);
    expect(textureIndex("sharp")).toBe(5);
    expect(textureIndex("smooth")).toBe(6);
    expect(textureIndex("tonal")).toBe(7);
    expect(textureIndex("warm")).toBe(8);
  });

  it("returns -1 for unknown labels", () => {
    expect(textureIndex("unknown")).toBe(-1);
    expect(textureIndex("")).toBe(-1);
    expect(textureIndex("fuzzy")).toBe(-1);
  });

  it("is case-insensitive", () => {
    expect(textureIndex("Bright")).toBe(0);
    expect(textureIndex("WARM")).toBe(8);
  });
});

describe("median", () => {
  it("returns -1 for empty array", () => {
    expect(median([])).toBe(-1);
  });

  it("returns the single value for a 1-element array", () => {
    expect(median([5])).toBe(5);
  });

  it("returns the lower middle for even-length arrays", () => {
    expect(median([1, 3])).toBe(1);
    expect(median([2, 4, 6, 8])).toBe(4);
  });

  it("returns the middle value for odd-length arrays", () => {
    expect(median([1, 3, 5])).toBe(3);
    expect(median([2, 4, 6, 8, 10])).toBe(6);
  });

  it("sorts the array before computing", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([9, 1, 5, 3, 7])).toBe(5);
  });
});

describe("medianIntensity", () => {
  it("returns the median intensity index for odd count", () => {
    const selections = [
      makeSelection("a", 1, { intensity: "soft" }),       // 1
      makeSelection("b", 2, { intensity: "medium" }),     // 2
      makeSelection("c", 3, { intensity: "hard" }),       // 3
    ];
    expect(medianIntensity(selections)).toBe(2); // medium
  });

  it("returns the lower middle for even count", () => {
    const selections = [
      makeSelection("a", 1, { intensity: "soft" }),       // 1
      makeSelection("b", 2, { intensity: "medium" }),     // 2
      makeSelection("c", 3, { intensity: "hard" }),       // 3
      makeSelection("d", 4, { intensity: "aggressive" }), // 4
    ];
    expect(medianIntensity(selections)).toBe(2); // medium
  });

  it("returns the single value for one entry", () => {
    const selections = [
      makeSelection("a", 1, { intensity: "aggressive" }), // 4
    ];
    expect(medianIntensity(selections)).toBe(4);
  });

  it("returns -1 for empty selections", () => {
    expect(medianIntensity([])).toBe(-1);
  });

  it("filters out unknown intensities", () => {
    const selections = [
      makeSelection("a", 1, { intensity: "soft" }),     // 1
      makeSelection("b", 2, { intensity: "unknown" }),   // -1, filtered
      makeSelection("c", 3, { intensity: "hard" }),      // 3
    ];
    expect(medianIntensity(selections)).toBe(1); // lower middle of [1, 3]
  });
});

describe("selectionTextureIndex", () => {
  it("returns the median texture index for single texture", () => {
    const sel = makeSelection("a", 1, { texture: ["smooth"] }); // 6
    expect(selectionTextureIndex(sel)).toBe(6);
  });

  it("returns the median texture index for multiple textures", () => {
    const sel = makeSelection("a", 1, { texture: ["bright", "dark", "warm"] }); // 0, 2, 8
    expect(selectionTextureIndex(sel)).toBe(2); // median of [0, 2, 8]
  });

  it("returns -1 for empty texture array", () => {
    const sel = makeSelection("a", 1, { texture: [] });
    expect(selectionTextureIndex(sel)).toBe(-1);
  });

  it("filters out unknown texture labels", () => {
    const sel = makeSelection("a", 1, { texture: ["bright", "unknown"] }); // 0, -1
    expect(selectionTextureIndex(sel)).toBe(0); // only "bright" (0) remains
  });
});

describe("medianTextureIndex", () => {
  it("computes palette median of representative texture indices", () => {
    const selections = [
      makeSelection("a", 1, { texture: ["bright"] }),   // rep: 0
      makeSelection("b", 2, { texture: ["dark"] }),     // rep: 2
      makeSelection("c", 3, { texture: ["smooth"] }),   // rep: 6
    ];
    expect(medianTextureIndex(selections)).toBe(2); // median of [0, 2, 6]
  });

  it("returns -1 for empty selections", () => {
    expect(medianTextureIndex([])).toBe(-1);
  });

  it("handles single entry", () => {
    const selections = [
      makeSelection("a", 1, { texture: ["warm"] }), // rep: 8
    ];
    expect(medianTextureIndex(selections)).toBe(8);
  });
});

describe("flagCoherenceOutliers", () => {
  it("returns empty set for fewer than 3 entries", () => {
    const selections = [
      makeSelection("a", 1, { intensity: "soft", texture: ["bright"] }),
      makeSelection("b", 2, { intensity: "aggressive", texture: ["warm"] }),
    ];
    expect(flagCoherenceOutliers(selections).size).toBe(0);
  });

  it("returns empty set when all entries are the same", () => {
    const selections = [
      makeSelection("a", 1, { intensity: "medium", texture: ["smooth"] }),
      makeSelection("b", 2, { intensity: "medium", texture: ["smooth"] }),
      makeSelection("c", 3, { intensity: "medium", texture: ["smooth"] }),
    ];
    expect(flagCoherenceOutliers(selections).size).toBe(0);
  });

  it("flags intensity outlier deviating by more than 1 step", () => {
    // median intensity: medium (2)
    const selections = [
      makeSelection("a", 1, { intensity: "medium", texture: ["smooth"] }),     // 2
      makeSelection("b", 2, { intensity: "medium", texture: ["smooth"] }),     // 2
      makeSelection("c", 3, { intensity: "aggressive", texture: ["smooth"] }), // 4, deviation = 2
    ];
    const outliers = flagCoherenceOutliers(selections);
    expect(outliers.has("c")).toBe(true);
    expect(outliers.size).toBe(1);
  });

  it("does not flag intensity deviation of exactly 1 step", () => {
    // median intensity: medium (2)
    const selections = [
      makeSelection("a", 1, { intensity: "medium", texture: ["smooth"] }),  // 2
      makeSelection("b", 2, { intensity: "medium", texture: ["smooth"] }),  // 2
      makeSelection("c", 3, { intensity: "hard", texture: ["smooth"] }),    // 3, deviation = 1
    ];
    const outliers = flagCoherenceOutliers(selections);
    expect(outliers.size).toBe(0);
  });

  it("flags texture outlier deviating by more than 1 step", () => {
    // median texture: smooth (6) for all 3
    // Actually let's set it up so median is "dark" (2) and outlier is "warm" (8)
    const selections = [
      makeSelection("a", 1, { intensity: "medium", texture: ["dark"] }),   // tex rep: 2
      makeSelection("b", 2, { intensity: "medium", texture: ["crunchy"] }), // tex rep: 1
      makeSelection("c", 3, { intensity: "medium", texture: ["warm"] }),   // tex rep: 8
    ];
    // median texture: median of [2, 1, 8] = sorted [1, 2, 8] => 2
    // c deviation: |8 - 2| = 6 > 1
    const outliers = flagCoherenceOutliers(selections);
    expect(outliers.has("c")).toBe(true);
  });

  it("does not flag texture deviation of exactly 1 step", () => {
    const selections = [
      makeSelection("a", 1, { intensity: "medium", texture: ["dark"] }),   // tex rep: 2
      makeSelection("b", 2, { intensity: "medium", texture: ["dark"] }),   // tex rep: 2
      makeSelection("c", 3, { intensity: "medium", texture: ["harsh"] }),  // tex rep: 3, dev = 1
    ];
    const outliers = flagCoherenceOutliers(selections);
    expect(outliers.size).toBe(0);
  });

  it("flags entries with both intensity and texture deviations", () => {
    // median intensity: medium (2), median texture: dark (2)
    const selections = [
      makeSelection("a", 1, { intensity: "medium", texture: ["dark"] }),       // int: 2, tex: 2
      makeSelection("b", 2, { intensity: "medium", texture: ["dark"] }),       // int: 2, tex: 2
      makeSelection("c", 3, { intensity: "aggressive", texture: ["warm"] }),   // int: 4, tex: 8
    ];
    const outliers = flagCoherenceOutliers(selections);
    expect(outliers.has("c")).toBe(true);
    // Only counted once despite both deviating
    expect(outliers.size).toBe(1);
  });

  it("flags multiple outliers", () => {
    // median intensity: medium (2)
    const selections = [
      makeSelection("a", 1, { intensity: "medium", texture: ["smooth"] }),     // 2
      makeSelection("b", 2, { intensity: "medium", texture: ["smooth"] }),     // 2
      makeSelection("c", 3, { intensity: "medium", texture: ["smooth"] }),     // 2
      makeSelection("d", 4, { intensity: "subtle", texture: ["smooth"] }),     // 0, deviation = 2
      makeSelection("e", 5, { intensity: "aggressive", texture: ["smooth"] }), // 4, deviation = 2
    ];
    const outliers = flagCoherenceOutliers(selections);
    expect(outliers.has("d")).toBe(true);
    expect(outliers.has("e")).toBe(true);
    expect(outliers.size).toBe(2);
  });
});

describe("buildSummaryRows", () => {
  it("builds rows with recipe, seed, category, intensity, texture, tags", () => {
    const selections = [
      makeSelection("card-flip", 7, {
        category: "card-game",
        intensity: "medium",
        texture: ["smooth", "warm"],
        tags: ["card", "flip"],
      }),
    ];
    const rows = buildSummaryRows(selections, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0]![0]).toBe("card-flip");
    expect(rows[0]![1]).toBe("7");
    expect(rows[0]![2]).toBe("card-game");
    expect(rows[0]![3]).toBe("medium");
    expect(rows[0]![4]).toBe("smooth, warm");
    expect(rows[0]![5]).toBe("card, flip");
  });

  it("adds warning indicator for flagged recipes", () => {
    const selections = [
      makeSelection("loud-one", 3, { intensity: "aggressive" }),
    ];
    const outliers = new Set(["loud-one"]);
    const rows = buildSummaryRows(selections, outliers);
    expect(rows[0]![0]).toContain("!!");
    expect(rows[0]![0]).toContain("loud-one");
  });

  it("does not add warning for unflagged recipes", () => {
    const selections = [
      makeSelection("normal-one", 3, { intensity: "medium" }),
    ];
    const outliers = new Set<string>();
    const rows = buildSummaryRows(selections, outliers);
    expect(rows[0]![0]).toBe("normal-one");
    expect(rows[0]![0]).not.toContain("!!");
  });

  it("shows dash for empty texture and tags", () => {
    const selections = [
      makeSelection("empty", 1, { texture: [], tags: [] }),
    ];
    const rows = buildSummaryRows(selections, new Set());
    expect(rows[0]![4]).toBe("-");
    expect(rows[0]![5]).toBe("-");
  });
});

describe("summaryColumns", () => {
  it("has 6 columns", () => {
    expect(summaryColumns).toHaveLength(6);
  });

  it("has expected headers", () => {
    const headers = summaryColumns.map((c) => c.header);
    expect(headers).toEqual(["Recipe", "Seed", "Category", "Intensity", "Texture", "Tags"]);
  });
});

describe("getOrderedSelections", () => {
  it("returns selections in manifest order", () => {
    const session = new WizardSession();
    session.addToManifest(makeManifestEntry("first"));
    session.addToManifest(makeManifestEntry("second"));
    session.addToManifest(makeManifestEntry("third"));

    // Add selections in reverse order
    session.setSelection("third", makeSelection("third", 3));
    session.setSelection("first", makeSelection("first", 1));
    session.setSelection("second", makeSelection("second", 2));

    const ordered = getOrderedSelections(session);
    expect(ordered.map((s) => s.recipe)).toEqual(["first", "second", "third"]);
  });

  it("excludes manifest entries without selections", () => {
    const session = new WizardSession();
    session.addToManifest(makeManifestEntry("selected"));
    session.addToManifest(makeManifestEntry("skipped"));
    session.setSelection("selected", makeSelection("selected", 1));

    const ordered = getOrderedSelections(session);
    expect(ordered).toHaveLength(1);
    expect(ordered[0]!.recipe).toBe("selected");
  });

  it("returns empty array when no selections", () => {
    const session = new WizardSession();
    session.addToManifest(makeManifestEntry("a"));
    expect(getOrderedSelections(session)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Interactive flow tests
// ---------------------------------------------------------------------------

describe("runReviewStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 'advance' when user confirms", async () => {
    const session = buildSession(["recipe-a", "recipe-b", "recipe-c"]);

    // User selects "confirm" from action menu, then confirms
    (select as Mock).mockResolvedValueOnce({ type: "confirm" });
    (confirm as Mock).mockResolvedValueOnce(true);

    const result = await runReviewStage(session);
    expect(result).toBe("advance");
    expect(outputTable).toHaveBeenCalled();
    expect(outputSuccess).toHaveBeenCalled();
  });

  it("returns 'back' when user selects back", async () => {
    const session = buildSession(["recipe-a", "recipe-b", "recipe-c"]);

    (select as Mock).mockResolvedValueOnce({ type: "back" });

    const result = await runReviewStage(session);
    expect(result).toBe("back");
  });

  it("returns 'back' when user selects add (to go to Define)", async () => {
    const session = buildSession(["recipe-a", "recipe-b", "recipe-c"]);

    (select as Mock).mockResolvedValueOnce({ type: "add" });

    const result = await runReviewStage(session);
    expect(result).toBe("back");
    expect(outputInfo).toHaveBeenCalledWith(
      expect.stringContaining("Returning to Define stage"),
    );
  });

  it("loops back to menu when user declines confirmation", async () => {
    const session = buildSession(["recipe-a", "recipe-b", "recipe-c"]);

    // First: user selects confirm, then declines
    (select as Mock)
      .mockResolvedValueOnce({ type: "confirm" })
      .mockResolvedValueOnce({ type: "back" }); // Then goes back
    (confirm as Mock).mockResolvedValueOnce(false);

    const result = await runReviewStage(session);
    expect(result).toBe("back");
    // select was called twice (confirm menu + back menu)
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("handles remove flow and removes recipe from session", async () => {
    const session = buildSession(["recipe-a", "recipe-b", "recipe-c"]);

    // User selects "remove", picks "recipe-b", confirms removal, then confirms palette
    (select as Mock)
      .mockResolvedValueOnce({ type: "remove" })       // action menu: remove
      .mockResolvedValueOnce("recipe-b")                // pick recipe to remove
      .mockResolvedValueOnce({ type: "confirm" });      // action menu: confirm
    (confirm as Mock)
      .mockResolvedValueOnce(true)  // confirm removal
      .mockResolvedValueOnce(true); // confirm palette

    const result = await runReviewStage(session);
    expect(result).toBe("advance");

    // Verify recipe-b was removed
    expect(session.getSelection("recipe-b")).toBeUndefined();
    expect(session.manifest.entries.find((e) => e.recipe === "recipe-b")).toBeUndefined();
  });

  it("handles remove cancellation", async () => {
    const session = buildSession(["recipe-a", "recipe-b", "recipe-c"]);

    // User selects "remove", cancels, then confirms palette
    (select as Mock)
      .mockResolvedValueOnce({ type: "remove" })
      .mockResolvedValueOnce("__cancel__")         // cancel removal
      .mockResolvedValueOnce({ type: "confirm" }); // confirm palette
    (confirm as Mock).mockResolvedValueOnce(true);

    const result = await runReviewStage(session);
    expect(result).toBe("advance");

    // All recipes still present
    expect(session.selections.size).toBe(3);
  });

  it("shows coherence skip message for fewer than 3 entries", async () => {
    const session = buildSession(["recipe-a", "recipe-b"]);

    (select as Mock).mockResolvedValueOnce({ type: "confirm" });
    (confirm as Mock).mockResolvedValueOnce(true);

    await runReviewStage(session);

    expect(outputInfo).toHaveBeenCalledWith(
      expect.stringContaining("Coherence check skipped"),
    );
  });

  it("shows coherence warnings for flagged entries", async () => {
    const overrides = new Map<string, Partial<ClassificationResult>>([
      ["recipe-a", { intensity: "medium", texture: ["smooth"] }],
      ["recipe-b", { intensity: "medium", texture: ["smooth"] }],
      ["recipe-c", { intensity: "aggressive", texture: ["smooth"] }], // outlier
    ]);
    const session = buildSession(["recipe-a", "recipe-b", "recipe-c"], overrides);

    (select as Mock).mockResolvedValueOnce({ type: "confirm" });
    (confirm as Mock).mockResolvedValueOnce(true);

    await runReviewStage(session);

    expect(outputInfo).toHaveBeenCalledWith(
      expect.stringContaining("Coherence warnings"),
    );
    expect(outputInfo).toHaveBeenCalledWith(
      expect.stringContaining("recipe-c"),
    );
  });

  it("shows no coherence warnings when all entries are similar", async () => {
    const overrides = new Map<string, Partial<ClassificationResult>>([
      ["recipe-a", { intensity: "medium", texture: ["smooth"] }],
      ["recipe-b", { intensity: "medium", texture: ["smooth"] }],
      ["recipe-c", { intensity: "hard", texture: ["smooth"] }], // 1 step = ok
    ]);
    const session = buildSession(["recipe-a", "recipe-b", "recipe-c"], overrides);

    (select as Mock).mockResolvedValueOnce({ type: "confirm" });
    (confirm as Mock).mockResolvedValueOnce(true);

    await runReviewStage(session);

    expect(outputSuccess).toHaveBeenCalledWith(
      expect.stringContaining("all entries are within expected range"),
    );
  });

  it("handles swap flow with cached candidates", async () => {
    const session = buildSession(["recipe-a", "recipe-b", "recipe-c"]);

    // Add sweep cache for recipe-b
    const candidates = [makeCandidate("recipe-b", 10), makeCandidate("recipe-b", 11)];
    session.setSweepCache("recipe-b", { recipe: "recipe-b", candidates });

    const newSelection: CandidateSelection = makeSelection("recipe-b", 10);

    // User selects "swap", picks "recipe-b", auditionRecipe returns new selection, then confirms
    (select as Mock)
      .mockResolvedValueOnce({ type: "swap" })     // action menu: swap
      .mockResolvedValueOnce("recipe-b")           // pick recipe to swap
      // auditionRecipe will call select internally for candidate action
      .mockResolvedValueOnce({ type: "select", candidateIndex: 0 }) // select first candidate
      .mockResolvedValueOnce({ type: "confirm" }); // action menu: confirm palette
    (confirm as Mock).mockResolvedValueOnce(true);

    const result = await runReviewStage(session);
    expect(result).toBe("advance");

    // Verify selection was updated (seed 10 instead of original 5)
    const sel = session.getSelection("recipe-b");
    expect(sel).toBeDefined();
    expect(sel!.candidate.seed).toBe(10);
  });

  it("handles swap cancellation", async () => {
    const session = buildSession(["recipe-a", "recipe-b", "recipe-c"]);

    // User selects "swap", cancels, then confirms palette
    (select as Mock)
      .mockResolvedValueOnce({ type: "swap" })
      .mockResolvedValueOnce("__cancel__")         // cancel swap
      .mockResolvedValueOnce({ type: "confirm" }); // confirm palette
    (confirm as Mock).mockResolvedValueOnce(true);

    const result = await runReviewStage(session);
    expect(result).toBe("advance");
  });

  it("warns and shows empty palette after removing all entries", async () => {
    const session = buildSession(["recipe-only"]);

    // User removes the only entry, then goes back
    (select as Mock)
      .mockResolvedValueOnce({ type: "remove" })       // action menu: remove
      .mockResolvedValueOnce("recipe-only")             // pick recipe
      .mockResolvedValueOnce({ type: "back" });         // nothing to confirm, go back
    (confirm as Mock).mockResolvedValueOnce(true);      // confirm removal

    const result = await runReviewStage(session);
    expect(result).toBe("back");

    expect(session.selections.size).toBe(0);
    expect(outputInfo).toHaveBeenCalledWith(
      expect.stringContaining("Palette is now empty"),
    );
  });

  it("handles swap with no cached candidates gracefully", async () => {
    const session = buildSession(["recipe-a", "recipe-b", "recipe-c"]);
    // No sweep cache set for recipe-a

    (select as Mock)
      .mockResolvedValueOnce({ type: "swap" })
      .mockResolvedValueOnce("recipe-a")           // pick recipe with no cache
      .mockResolvedValueOnce({ type: "confirm" }); // confirm palette
    (confirm as Mock).mockResolvedValueOnce(true);

    const result = await runReviewStage(session);
    expect(result).toBe("advance");
    expect(outputError).toHaveBeenCalledWith(
      expect.stringContaining("No cached candidates"),
    );
  });

  it("displays palette table on each loop iteration", async () => {
    const session = buildSession(["recipe-a", "recipe-b", "recipe-c"]);

    // Two iterations: first back declines, second advances
    (select as Mock)
      .mockResolvedValueOnce({ type: "confirm" })
      .mockResolvedValueOnce({ type: "confirm" });
    (confirm as Mock)
      .mockResolvedValueOnce(false)  // decline first
      .mockResolvedValueOnce(true);  // accept second

    await runReviewStage(session);

    // outputTable should have been called twice (once per loop)
    expect(outputTable).toHaveBeenCalledTimes(2);
  });
});
