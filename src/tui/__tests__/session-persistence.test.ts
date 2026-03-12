import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  saveSession,
  loadSession,
  detectSessionFile,
  deleteSessionFile,
  listBackups,
  SESSION_SCHEMA_VERSION,
  SessionVersionMismatchError,
  SessionCorruptedError,
} from "../session-persistence.js";
import type {
  WizardSessionData,
  CandidateSelection,
  ManifestEntry,
} from "../types.js";
import type { ExploreCandidate } from "../../explore/types.js";
import type { ClassificationResult } from "../../classify/types.js";
import type { AnalysisResult } from "../../analyze/types.js";

// ---------------------------------------------------------------------------
// Test helpers -- reused from state.test.ts patterns
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
    score: 0.85,
    metricScores: { rms: 0.8, centroid: 0.7 },
    cluster: -1,
    promoted: false,
    libraryId: null,
    params: { freq: 440, decay: 0.5 },
  };
}

function makeClassification(recipe: string): ClassificationResult {
  return {
    source: recipe,
    category: "card-game",
    intensity: "medium",
    texture: ["smooth", "bright"],
    material: null,
    tags: ["card", "ui"],
    embedding: [0.1, 0.2, 0.3],
    analysisRef: "analysis-ref-1",
  };
}

function makeSelection(recipe: string, seed: number): CandidateSelection {
  return {
    recipe,
    candidate: makeCandidate(recipe, seed),
    classification: makeClassification(recipe),
  };
}

function makeManifestEntry(recipe: string): ManifestEntry {
  return {
    recipe,
    description: `Description for ${recipe}`,
    category: "card-game",
    tags: ["card", "ui"],
  };
}

function makeSessionData(overrides?: Partial<WizardSessionData>): WizardSessionData {
  const selections = new Map<string, CandidateSelection>();
  selections.set("card-flip", makeSelection("card-flip", 42));
  selections.set("coin-collect", makeSelection("coin-collect", 7));

  return {
    currentStage: "review",
    manifest: {
      entries: [
        makeManifestEntry("card-flip"),
        makeManifestEntry("coin-collect"),
      ],
    },
    selections,
    sweepCache: new Map(),
    exportDir: "./output",
    exportByCategory: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("session-persistence", () => {
  let tmpDir: string;
  let sessionPath: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "toneforge-session-test-"));
    sessionPath = join(tmpDir, ".toneforge-session.json");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Save / Load round-trip
  // -------------------------------------------------------------------------

  describe("save and load round-trip", () => {
    it("round-trips session data correctly", async () => {
      const data = makeSessionData();
      await saveSession(data, sessionPath);
      const loaded = await loadSession(sessionPath);

      expect(loaded.currentStage).toBe(data.currentStage);
      expect(loaded.manifest).toEqual(data.manifest);
      expect(loaded.exportDir).toBe(data.exportDir);
      expect(loaded.exportByCategory).toBe(data.exportByCategory);

      // selections Map round-trips correctly
      expect(loaded.selections.size).toBe(2);
      expect(loaded.selections.get("card-flip")!.recipe).toBe("card-flip");
      expect(loaded.selections.get("card-flip")!.candidate.seed).toBe(42);
      expect(loaded.selections.get("coin-collect")!.recipe).toBe("coin-collect");
      expect(loaded.selections.get("coin-collect")!.candidate.seed).toBe(7);

      // sweepCache is always empty after load (excluded from persistence)
      expect(loaded.sweepCache.size).toBe(0);
    });

    it("preserves nested candidate fields through serialization", async () => {
      const data = makeSessionData();
      await saveSession(data, sessionPath);
      const loaded = await loadSession(sessionPath);

      const sel = loaded.selections.get("card-flip")!;

      // ExploreCandidate fields
      expect(sel.candidate.id).toBe("card-flip_seed-00042");
      expect(sel.candidate.sampleRate).toBe(44100);
      expect(sel.candidate.metricScores).toEqual({ rms: 0.8, centroid: 0.7 });
      expect(sel.candidate.params).toEqual({ freq: 440, decay: 0.5 });

      // AnalysisResult nested
      expect(sel.candidate.analysis.analysisVersion).toBe("1.0");
      expect(sel.candidate.analysis.metrics.time).toEqual({
        duration: 1.0, peak: 0.9, rms: 0.3, crestFactor: 3.0,
      });

      // ClassificationResult fields
      expect(sel.classification.category).toBe("card-game");
      expect(sel.classification.texture).toEqual(["smooth", "bright"]);
      expect(sel.classification.embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it("handles empty selections map", async () => {
      const data = makeSessionData({
        selections: new Map(),
        manifest: { entries: [] },
        currentStage: "define",
      });
      await saveSession(data, sessionPath);
      const loaded = await loadSession(sessionPath);

      expect(loaded.selections.size).toBe(0);
      expect(loaded.currentStage).toBe("define");
    });

    it("excludes sweepCache from saved file", async () => {
      const data = makeSessionData();
      data.sweepCache.set("card-flip", {
        recipe: "card-flip",
        candidates: [makeCandidate("card-flip", 1)],
      });

      await saveSession(data, sessionPath);

      // Read the raw JSON to verify sweepCache is not present
      const raw = JSON.parse(await readFile(sessionPath, "utf-8"));
      expect(raw.sweepCache).toBeUndefined();
      expect(raw.schemaVersion).toBe(SESSION_SCHEMA_VERSION);

      // Loaded data has empty sweepCache
      const loaded = await loadSession(sessionPath);
      expect(loaded.sweepCache.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Schema version
  // -------------------------------------------------------------------------

  describe("schema version", () => {
    it("includes schemaVersion in saved file", async () => {
      await saveSession(makeSessionData(), sessionPath);
      const raw = JSON.parse(await readFile(sessionPath, "utf-8"));
      expect(raw.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
    });

    it("throws SessionVersionMismatchError for wrong version", async () => {
      const raw = {
        schemaVersion: 999,
        currentStage: "define",
        manifest: { entries: [] },
        selections: {},
        exportDir: null,
        exportByCategory: true,
      };
      await writeFile(sessionPath, JSON.stringify(raw));

      await expect(loadSession(sessionPath)).rejects.toThrow(
        SessionVersionMismatchError,
      );

      try {
        await loadSession(sessionPath);
      } catch (err) {
        expect(err).toBeInstanceOf(SessionVersionMismatchError);
        const e = err as SessionVersionMismatchError;
        expect(e.fileVersion).toBe(999);
        expect(e.expectedVersion).toBe(SESSION_SCHEMA_VERSION);
        expect(e.message).toContain("version 999");
        expect(e.message).toContain(`version ${SESSION_SCHEMA_VERSION}`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Corrupted file handling
  // -------------------------------------------------------------------------

  describe("corrupted file handling", () => {
    it("throws SessionCorruptedError for invalid JSON", async () => {
      await writeFile(sessionPath, "not valid json {{{");

      await expect(loadSession(sessionPath)).rejects.toThrow(
        SessionCorruptedError,
      );
    });

    it("throws SessionCorruptedError for missing required fields", async () => {
      await writeFile(sessionPath, JSON.stringify({
        schemaVersion: SESSION_SCHEMA_VERSION,
        // missing currentStage, manifest, selections
      }));

      await expect(loadSession(sessionPath)).rejects.toThrow(
        SessionCorruptedError,
      );
    });

    it("throws SessionCorruptedError for non-existent file", async () => {
      await expect(loadSession(join(tmpDir, "nonexistent.json"))).rejects.toThrow(
        SessionCorruptedError,
      );
    });

    it("error message includes file path", async () => {
      await writeFile(sessionPath, "broken");

      try {
        await loadSession(sessionPath);
      } catch (err) {
        expect((err as Error).message).toContain(sessionPath);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Detect session file
  // -------------------------------------------------------------------------

  describe("detectSessionFile", () => {
    it("returns false when no file exists", () => {
      expect(detectSessionFile(sessionPath)).toBe(false);
    });

    it("returns true when file exists", async () => {
      await saveSession(makeSessionData(), sessionPath);
      expect(detectSessionFile(sessionPath)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Delete session file
  // -------------------------------------------------------------------------

  describe("deleteSessionFile", () => {
    it("deletes the session file and all backups", async () => {
      const data = makeSessionData();

      // Save multiple times to create backups
      await saveSession(data, sessionPath);
      await sleep(50); // small delay for unique timestamps
      await saveSession(data, sessionPath);
      await sleep(50);
      await saveSession(data, sessionPath);

      // Verify files exist
      expect(existsSync(sessionPath)).toBe(true);
      const backupsBefore = await listBackups(sessionPath);
      expect(backupsBefore.length).toBeGreaterThanOrEqual(1);

      // Delete all
      await deleteSessionFile(sessionPath);

      expect(existsSync(sessionPath)).toBe(false);
      const backupsAfter = await listBackups(sessionPath);
      expect(backupsAfter.length).toBe(0);
    });

    it("does not throw when file does not exist", async () => {
      await expect(deleteSessionFile(sessionPath)).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Backup rotation
  // -------------------------------------------------------------------------

  describe("backup rotation", () => {
    it("creates a backup on save when file already exists", async () => {
      await saveSession(makeSessionData(), sessionPath);
      const backupsBefore = await listBackups(sessionPath);
      expect(backupsBefore.length).toBe(0); // First save has no previous file to back up

      await sleep(50);
      await saveSession(makeSessionData(), sessionPath);
      const backupsAfter = await listBackups(sessionPath);
      expect(backupsAfter.length).toBe(1);
    });

    it("retains max 3 backups and prunes older ones", async () => {
      const data = makeSessionData();

      // Create initial save (no backup created)
      await saveSession(data, sessionPath);

      // Create 5 more saves, each creating a backup
      for (let i = 0; i < 5; i++) {
        await sleep(50); // Ensure unique timestamps
        await saveSession(data, sessionPath);
      }

      const backups = await listBackups(sessionPath);
      expect(backups.length).toBeLessThanOrEqual(3);
    });

    it("backup files contain valid session data", async () => {
      const data = makeSessionData();
      await saveSession(data, sessionPath);
      await sleep(50);
      await saveSession(data, sessionPath);

      const backups = await listBackups(sessionPath);
      expect(backups.length).toBe(1);

      // The backup should be loadable
      const backupContent = JSON.parse(await readFile(backups[0]!, "utf-8"));
      expect(backupContent.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
      expect(backupContent.currentStage).toBe("review");
    });
  });
});

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
