import { describe, it, expect, beforeEach } from "vitest";
import { WizardSession } from "../state.js";
import type { ManifestEntry, CandidateSelection, SweepCache } from "../types.js";
import type { ExploreCandidate } from "../../explore/types.js";
import type { ClassificationResult } from "../../classify/types.js";
import type { AnalysisResult } from "../../analyze/types.js";

/** Helper: create a minimal ManifestEntry. */
function makeManifestEntry(recipe: string): ManifestEntry {
  return {
    recipe,
    description: `Description for ${recipe}`,
    category: "test",
    tags: ["test-tag"],
  };
}

/** Helper: create a minimal AnalysisResult. */
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

/** Helper: create a minimal ExploreCandidate. */
function makeCandidate(recipe: string, seed: number): ExploreCandidate {
  return {
    id: `${recipe}_seed-${String(seed).padStart(5, "0")}`,
    recipe,
    seed,
    duration: 1.0,
    sampleRate: 44100,
    sampleCount: 44100,
    analysis: makeAnalysis(),
    score: 0.85,
    metricScores: {},
    cluster: -1,
    promoted: false,
    libraryId: null,
    params: {},
  };
}

/** Helper: create a minimal ClassificationResult. */
function makeClassification(recipe: string): ClassificationResult {
  return {
    source: recipe,
    category: "test",
    intensity: "medium",
    texture: ["smooth"],
    material: null,
    tags: ["test"],
    embedding: [],
    analysisRef: "",
  };
}

/** Helper: create a CandidateSelection. */
function makeSelection(recipe: string, seed: number): CandidateSelection {
  return {
    recipe,
    candidate: makeCandidate(recipe, seed),
    classification: makeClassification(recipe),
  };
}

describe("WizardSession", () => {
  let session: WizardSession;

  beforeEach(() => {
    session = new WizardSession();
  });

  // -------------------------------------------------------------------------
  // Stage navigation
  // -------------------------------------------------------------------------

  describe("stage navigation", () => {
    it("starts at the 'define' stage", () => {
      expect(session.currentStage).toBe("define");
      expect(session.currentStageNumber).toBe(1);
    });

    it("reports correct total stages", () => {
      expect(session.totalStages).toBe(4);
    });

    it("advances through all stages in order", () => {
      expect(session.currentStage).toBe("define");

      expect(session.advance()).toBe(true);
      expect(session.currentStage).toBe("explore");
      expect(session.currentStageNumber).toBe(2);

      expect(session.advance()).toBe(true);
      expect(session.currentStage).toBe("review");
      expect(session.currentStageNumber).toBe(3);

      expect(session.advance()).toBe(true);
      expect(session.currentStage).toBe("export");
      expect(session.currentStageNumber).toBe(4);
    });

    it("returns false when advancing past the last stage", () => {
      session.advance(); // -> explore
      session.advance(); // -> review
      session.advance(); // -> export

      expect(session.advance()).toBe(false);
      expect(session.currentStage).toBe("export");
    });

    it("goes back through stages in reverse order", () => {
      session.advance(); // -> explore
      session.advance(); // -> review

      expect(session.goBack()).toBe(true);
      expect(session.currentStage).toBe("explore");

      expect(session.goBack()).toBe(true);
      expect(session.currentStage).toBe("define");
    });

    it("returns false when going back past the first stage", () => {
      expect(session.goBack()).toBe(false);
      expect(session.currentStage).toBe("define");
    });

    it("reports isFirstStage and isLastStage correctly", () => {
      expect(session.isFirstStage).toBe(true);
      expect(session.isLastStage).toBe(false);

      session.advance(); // -> explore
      expect(session.isFirstStage).toBe(false);
      expect(session.isLastStage).toBe(false);

      session.advance(); // -> review
      session.advance(); // -> export
      expect(session.isFirstStage).toBe(false);
      expect(session.isLastStage).toBe(true);
    });

    it("preserves state across forward and backward navigation", () => {
      // Add manifest entry in stage 1
      session.addToManifest(makeManifestEntry("recipe-a"));
      expect(session.manifestSize).toBe(1);

      // Advance to explore
      session.advance();
      session.setSelection("recipe-a", makeSelection("recipe-a", 42));
      expect(session.selections.size).toBe(1);

      // Go back to define
      session.goBack();
      expect(session.currentStage).toBe("define");
      expect(session.manifestSize).toBe(1);

      // Advance again -- selections preserved
      session.advance();
      expect(session.selections.size).toBe(1);
      expect(session.getSelection("recipe-a")).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Manifest management
  // -------------------------------------------------------------------------

  describe("manifest management", () => {
    it("starts with an empty manifest", () => {
      expect(session.manifest.entries).toEqual([]);
      expect(session.hasManifestEntries).toBe(false);
      expect(session.manifestSize).toBe(0);
    });

    it("adds entries to the manifest", () => {
      session.addToManifest(makeManifestEntry("recipe-a"));
      session.addToManifest(makeManifestEntry("recipe-b"));

      expect(session.manifestSize).toBe(2);
      expect(session.hasManifestEntries).toBe(true);
      expect(session.manifest.entries[0].recipe).toBe("recipe-a");
      expect(session.manifest.entries[1].recipe).toBe("recipe-b");
    });

    it("prevents duplicate entries by recipe name", () => {
      session.addToManifest(makeManifestEntry("recipe-a"));
      session.addToManifest(makeManifestEntry("recipe-a"));

      expect(session.manifestSize).toBe(1);
    });

    it("removes entries from the manifest", () => {
      session.addToManifest(makeManifestEntry("recipe-a"));
      session.addToManifest(makeManifestEntry("recipe-b"));

      expect(session.removeFromManifest("recipe-a")).toBe(true);
      expect(session.manifestSize).toBe(1);
      expect(session.manifest.entries[0].recipe).toBe("recipe-b");
    });

    it("returns false when removing a non-existent entry", () => {
      expect(session.removeFromManifest("nonexistent")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Selections management
  // -------------------------------------------------------------------------

  describe("selections management", () => {
    it("starts with no selections", () => {
      expect(session.selections.size).toBe(0);
    });

    it("sets and gets selections by recipe name", () => {
      const selection = makeSelection("recipe-a", 42);
      session.setSelection("recipe-a", selection);

      expect(session.getSelection("recipe-a")).toBe(selection);
      expect(session.getSelection("nonexistent")).toBeUndefined();
    });

    it("removes selections", () => {
      session.setSelection("recipe-a", makeSelection("recipe-a", 42));
      expect(session.removeSelection("recipe-a")).toBe(true);
      expect(session.getSelection("recipe-a")).toBeUndefined();
    });

    it("tracks allRecipesSelected correctly", () => {
      session.addToManifest(makeManifestEntry("recipe-a"));
      session.addToManifest(makeManifestEntry("recipe-b"));

      expect(session.allRecipesSelected).toBe(false);

      session.setSelection("recipe-a", makeSelection("recipe-a", 1));
      expect(session.allRecipesSelected).toBe(false);

      session.setSelection("recipe-b", makeSelection("recipe-b", 2));
      expect(session.allRecipesSelected).toBe(true);
    });

    it("reports unselected recipes", () => {
      session.addToManifest(makeManifestEntry("recipe-a"));
      session.addToManifest(makeManifestEntry("recipe-b"));
      session.addToManifest(makeManifestEntry("recipe-c"));

      session.setSelection("recipe-b", makeSelection("recipe-b", 2));

      expect(session.unselectedRecipes).toEqual(["recipe-a", "recipe-c"]);
    });
  });

  // -------------------------------------------------------------------------
  // Sweep cache management
  // -------------------------------------------------------------------------

  describe("sweep cache management", () => {
    it("starts with no cached sweeps", () => {
      expect(session.hasSweepCache("recipe-a")).toBe(false);
      expect(session.getSweepCache("recipe-a")).toBeUndefined();
    });

    it("caches and retrieves sweep results", () => {
      const cache: SweepCache = {
        recipe: "recipe-a",
        candidates: [makeCandidate("recipe-a", 1), makeCandidate("recipe-a", 2)],
      };
      session.setSweepCache("recipe-a", cache);

      expect(session.hasSweepCache("recipe-a")).toBe(true);
      expect(session.getSweepCache("recipe-a")).toBe(cache);
    });
  });

  // -------------------------------------------------------------------------
  // Export settings
  // -------------------------------------------------------------------------

  describe("export settings", () => {
    it("defaults to null exportDir and true exportByCategory", () => {
      expect(session.exportDir).toBeNull();
      expect(session.exportByCategory).toBe(true);
    });

    it("sets and gets export directory", () => {
      session.exportDir = "./my-export/";
      expect(session.exportDir).toBe("./my-export/");
    });

    it("sets and gets exportByCategory", () => {
      session.exportByCategory = false;
      expect(session.exportByCategory).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  describe("serialization", () => {
    it("toData returns a snapshot of session state", () => {
      session.addToManifest(makeManifestEntry("recipe-a"));
      session.advance();

      const data = session.toData();
      expect(data.currentStage).toBe("explore");
      expect(data.manifest.entries).toHaveLength(1);
      expect(data.manifest.entries[0].recipe).toBe("recipe-a");
    });
  });
});
