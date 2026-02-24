import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  saveRunResult,
  loadRunResult,
  listRunIds,
  listRuns,
  generateRunId,
} from "../persistence.js";
import type { ExploreRunResult } from "../types.js";

/** Helper: create a minimal ExploreRunResult. */
function makeRunResult(overrides: Partial<ExploreRunResult> = {}): ExploreRunResult {
  return {
    runId: overrides.runId ?? "run-test-001",
    startedAt: "2026-02-24T00:00:00.000Z",
    completedAt: "2026-02-24T00:01:00.000Z",
    durationMs: 60000,
    type: "sweep",
    config: {
      recipe: "test-recipe",
      seedStart: 1,
      seedEnd: 10,
      rankBy: ["rms"],
      keepTop: 5,
      clusters: 3,
      concurrency: 2,
    },
    totalCandidates: 10,
    candidates: [],
    clusterSummaries: [],
    exploreVersion: "1.0",
    ...overrides,
  };
}

describe("persistence", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "toneforge-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("generateRunId", () => {
    it("generates a unique ID with run- prefix", () => {
      const id = generateRunId();
      expect(id).toMatch(/^run-[a-z0-9]+-[a-f0-9]+$/);
    });

    it("generates different IDs on successive calls", () => {
      const id1 = generateRunId();
      const id2 = generateRunId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("saveRunResult", () => {
    it("saves a run result to disk", async () => {
      const result = makeRunResult();
      const path = await saveRunResult(result, tempDir);

      expect(path).toContain("run-test-001.json");
    });

    it("creates the directory structure if missing", async () => {
      const nestedDir = join(tempDir, "nested", "deep");
      const result = makeRunResult();
      const path = await saveRunResult(result, nestedDir);

      expect(path).toContain("run-test-001.json");
    });
  });

  describe("loadRunResult", () => {
    it("loads a previously saved run result", async () => {
      const original = makeRunResult();
      await saveRunResult(original, tempDir);

      const loaded = await loadRunResult("run-test-001", tempDir);

      expect(loaded).not.toBeNull();
      expect(loaded!.runId).toBe("run-test-001");
      expect(loaded!.type).toBe("sweep");
      expect(loaded!.totalCandidates).toBe(10);
      expect(loaded!.config.recipe).toBe("test-recipe");
    });

    it("returns null for non-existent run ID", async () => {
      const loaded = await loadRunResult("non-existent", tempDir);
      expect(loaded).toBeNull();
    });

    it("round-trips all fields correctly", async () => {
      const original = makeRunResult({
        runId: "run-roundtrip",
        candidates: [
          {
            id: "test_seed-00001",
            recipe: "test",
            seed: 1,
            duration: 1.0,
            sampleRate: 44100,
            sampleCount: 44100,
            analysis: {
              analysisVersion: "1.0",
              sampleRate: 44100,
              sampleCount: 44100,
              metrics: { time: { rms: 0.5 } },
            },
            score: 0.75,
            metricScores: { rms: 0.75 },
            cluster: 0,
            promoted: false,
            libraryId: null,
            params: { freq: 440 },
          },
        ],
        clusterSummaries: [
          {
            index: 0,
            size: 1,
            centroid: { rms: 0.5 },
            exemplars: ["test_seed-00001"],
          },
        ],
      });

      await saveRunResult(original, tempDir);
      const loaded = await loadRunResult("run-roundtrip", tempDir);

      expect(loaded).toEqual(original);
    });
  });

  describe("listRunIds", () => {
    it("returns empty array when no runs exist", async () => {
      const ids = await listRunIds(tempDir);
      expect(ids).toEqual([]);
    });

    it("returns run IDs sorted newest first", async () => {
      await saveRunResult(makeRunResult({ runId: "run-aaa" }), tempDir);
      await saveRunResult(makeRunResult({ runId: "run-bbb" }), tempDir);
      await saveRunResult(makeRunResult({ runId: "run-ccc" }), tempDir);

      const ids = await listRunIds(tempDir);

      expect(ids).toEqual(["run-ccc", "run-bbb", "run-aaa"]);
    });

    it("returns empty array when directory does not exist", async () => {
      const ids = await listRunIds(join(tempDir, "nonexistent"));
      expect(ids).toEqual([]);
    });
  });

  describe("listRuns", () => {
    it("returns empty array when no runs exist", async () => {
      const runs = await listRuns(tempDir);
      expect(runs).toEqual([]);
    });

    it("returns summary info for each run", async () => {
      await saveRunResult(
        makeRunResult({
          runId: "run-summary-test",
          type: "sweep",
          totalCandidates: 25,
          candidates: [
            {
              id: "c1",
              recipe: "test",
              seed: 1,
              duration: 1.0,
              sampleRate: 44100,
              sampleCount: 1000,
              analysis: {
                analysisVersion: "1.0",
                sampleRate: 44100,
                sampleCount: 1000,
                metrics: {},
              },
              score: 0,
              metricScores: {},
              cluster: -1,
              promoted: false,
              libraryId: null,
              params: {},
            },
          ],
        }),
        tempDir,
      );

      const runs = await listRuns(tempDir);

      expect(runs).toHaveLength(1);
      expect(runs[0]!.runId).toBe("run-summary-test");
      expect(runs[0]!.type).toBe("sweep");
      expect(runs[0]!.recipe).toBe("test-recipe");
      expect(runs[0]!.totalCandidates).toBe(25);
      expect(runs[0]!.keptCandidates).toBe(1);
    });
  });
});
