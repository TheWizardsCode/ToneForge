import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findSimilar } from "../similarity.js";
import { addToIndex, clearIndexCache } from "../index-store.js";
import type { LibraryEntry } from "../types.js";

/** Helper: create a minimal LibraryEntry with configurable embedding. */
function makeEntry(overrides: Partial<LibraryEntry> & {
  embedding?: number[];
} = {}): LibraryEntry {
  const { embedding, ...rest } = overrides;
  return {
    id: rest.id ?? "lib-test_seed-00001",
    recipe: "test",
    seed: 1,
    category: "weapon",
    duration: rest.duration ?? 0.5,
    tags: rest.tags ?? ["sharp"],
    analysis: rest.analysis ?? {
      analysisVersion: "1.0",
      sampleRate: 44100,
      sampleCount: 22050,
      metrics: {
        time: { rms: 0.5 },
        spectral: { spectralCentroid: 2000 },
      },
    },
    classification: rest.classification ?? {
      source: "test",
      category: "weapon",
      intensity: "medium",
      texture: [],
      material: null,
      tags: ["sharp"],
      embedding: embedding ?? [0.5, 0.5, 0.25, 0.1, 0.017, 0, 0],
      analysisRef: "",
    },
    preset: rest.preset ?? { recipe: "test", seed: 1, params: {} },
    provenance: rest.provenance ?? { toneforgeVersion: "0.1.0" },
    files: rest.files ?? { wav: "weapon/test.wav", metadata: "weapon/test.json" },
    promotedAt: rest.promotedAt ?? "2026-02-24T00:00:00.000Z",
  };
}

describe("similarity", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "toneforge-similar-test-"));
    clearIndexCache();
  });

  afterEach(async () => {
    clearIndexCache();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("findSimilar", () => {
    it("returns empty when entry ID not found", async () => {
      const results = await findSimilar("lib-nonexistent", {}, tempDir);
      expect(results).toEqual([]);
    });

    it("returns empty when library has fewer than 2 entries", async () => {
      await addToIndex(makeEntry({ id: "lib-only" }), tempDir);

      const results = await findSimilar("lib-only", {}, tempDir);

      expect(results).toEqual([]);
    });

    it("returns results sorted by distance (most similar first)", async () => {
      // Query: embedding at [0.5, 0.5, 0.25, 0.1, 0.017, 0, 0]
      await addToIndex(
        makeEntry({ id: "lib-query", embedding: [0.5, 0.5, 0.25, 0.1, 0.017, 0, 0] }),
        tempDir,
      );
      // Very similar: small perturbation
      await addToIndex(
        makeEntry({ id: "lib-close", embedding: [0.51, 0.5, 0.25, 0.1, 0.017, 0, 0] }),
        tempDir,
      );
      // Quite different: large perturbation
      await addToIndex(
        makeEntry({ id: "lib-far", embedding: [0.9, 0.8, 0.5, 0.5, 0.067, 0.3, 0.2] }),
        tempDir,
      );

      const results = await findSimilar("lib-query", {}, tempDir);

      expect(results).toHaveLength(2);
      expect(results[0]!.entry.id).toBe("lib-close");
      expect(results[1]!.entry.id).toBe("lib-far");
      expect(results[0]!.distance).toBeLessThan(results[1]!.distance);
    });

    it("excludes the query entry from results", async () => {
      await addToIndex(makeEntry({ id: "lib-a" }), tempDir);
      await addToIndex(makeEntry({ id: "lib-b" }), tempDir);

      const results = await findSimilar("lib-a", {}, tempDir);

      expect(results.every((r) => r.entry.id !== "lib-a")).toBe(true);
    });

    it("respects the limit option", async () => {
      await addToIndex(makeEntry({ id: "lib-query", embedding: [0.5, 0.5, 0.25, 0.1, 0.017, 0, 0] }), tempDir);
      await addToIndex(makeEntry({ id: "lib-a", embedding: [0.51, 0.5, 0.25, 0.1, 0.017, 0, 0] }), tempDir);
      await addToIndex(makeEntry({ id: "lib-b", embedding: [0.52, 0.5, 0.25, 0.1, 0.017, 0, 0] }), tempDir);
      await addToIndex(makeEntry({ id: "lib-c", embedding: [0.53, 0.5, 0.25, 0.1, 0.017, 0, 0] }), tempDir);

      const results = await findSimilar("lib-query", { limit: 2 }, tempDir);

      expect(results).toHaveLength(2);
    });

    it("uses tag Jaccard similarity as tiebreaker", async () => {
      // Query and both entries have identical embeddings
      const sameEmb: number[] = [0.5, 0.5, 0.25, 0.1, 0.017, 0, 0];
      await addToIndex(
        makeEntry({ id: "lib-query", embedding: sameEmb, tags: ["laser", "sci-fi"] }),
        tempDir,
      );
      await addToIndex(
        makeEntry({ id: "lib-same-tags", embedding: sameEmb, tags: ["laser", "sci-fi"] }),
        tempDir,
      );
      await addToIndex(
        makeEntry({ id: "lib-diff-tags", embedding: sameEmb, tags: ["sword", "fantasy"] }),
        tempDir,
      );

      const results = await findSimilar("lib-query", {}, tempDir);

      expect(results).toHaveLength(2);
      // Same tags should rank higher (lower distance) due to Jaccard tiebreaker
      expect(results[0]!.entry.id).toBe("lib-same-tags");
      expect(results[0]!.tagSimilarity).toBeGreaterThan(results[1]!.tagSimilarity);
    });

    it("includes distance metrics in results", async () => {
      await addToIndex(makeEntry({ id: "lib-a", embedding: [0.5, 0.5, 0.25, 0.1, 0.017, 0, 0] }), tempDir);
      await addToIndex(makeEntry({ id: "lib-b", embedding: [0.7, 0.5, 0.25, 0.1, 0.017, 0, 0] }), tempDir);

      const results = await findSimilar("lib-a", {}, tempDir);

      expect(results).toHaveLength(1);
      expect(results[0]!.metricDistance).toBeGreaterThanOrEqual(0);
      expect(results[0]!.tagSimilarity).toBeGreaterThanOrEqual(0);
      expect(results[0]!.tagSimilarity).toBeLessThanOrEqual(1);
      expect(typeof results[0]!.distance).toBe("number");
    });

    it("excludes entries with empty embeddings", async () => {
      await addToIndex(
        makeEntry({ id: "lib-query", embedding: [0.5, 0.5, 0.25, 0.1, 0.017, 0, 0] }),
        tempDir,
      );
      // Entry with empty embedding should be excluded
      await addToIndex(
        makeEntry({ id: "lib-no-embedding", embedding: [] }),
        tempDir,
      );
      await addToIndex(
        makeEntry({ id: "lib-normal", embedding: [0.6, 0.5, 0.25, 0.1, 0.017, 0, 0] }),
        tempDir,
      );

      const results = await findSimilar("lib-query", {}, tempDir);

      // Only lib-normal should appear; lib-no-embedding excluded
      expect(results).toHaveLength(1);
      expect(results[0]!.entry.id).toBe("lib-normal");
    });

    it("returns empty when query entry has no embedding", async () => {
      await addToIndex(
        makeEntry({ id: "lib-query", embedding: [] }),
        tempDir,
      );
      await addToIndex(
        makeEntry({ id: "lib-other", embedding: [0.5, 0.5, 0.25, 0.1, 0.017, 0, 0] }),
        tempDir,
      );

      const results = await findSimilar("lib-query", {}, tempDir);

      expect(results).toEqual([]);
    });

    it("defaults limit to 10", async () => {
      await addToIndex(makeEntry({ id: "lib-query", embedding: [0.5, 0.5, 0.25, 0.1, 0.017, 0, 0] }), tempDir);
      for (let i = 0; i < 15; i++) {
        await addToIndex(
          makeEntry({ id: `lib-${i}`, embedding: [0.5 + i * 0.01, 0.5, 0.25, 0.1, 0.017, 0, 0] }),
          tempDir,
        );
      }

      const results = await findSimilar("lib-query", undefined, tempDir);

      expect(results).toHaveLength(10);
    });
  });
});
