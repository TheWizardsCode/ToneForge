import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchEntries } from "../search.js";
import { addToIndex, clearIndexCache } from "../index-store.js";
import type { LibraryEntry } from "../types.js";

/** Helper: create a minimal LibraryEntry. */
function makeEntry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: overrides.id ?? "lib-test_seed-00001",
    recipe: "test",
    seed: 1,
    category: "weapon",
    duration: 0.5,
    tags: ["sharp", "bright"],
    analysis: {
      analysisVersion: "1.0",
      sampleRate: 44100,
      sampleCount: 22050,
      metrics: { time: { rms: 0.5 } },
    },
    classification: {
      source: "test_seed-00001",
      category: "weapon",
      intensity: "medium",
      texture: ["sharp", "metallic"],
      material: null,
      tags: ["sharp", "bright"],
      embedding: [],
      analysisRef: "test.json",
    },
    preset: { recipe: "test", seed: 1, params: {} },
    provenance: { toneforgeVersion: "0.1.0" },
    files: { wav: "weapon/lib-test_seed-00001.wav", metadata: "weapon/lib-test_seed-00001.json" },
    promotedAt: "2026-02-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("search", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "toneforge-search-test-"));
    clearIndexCache();
  });

  afterEach(async () => {
    clearIndexCache();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("searchEntries", () => {
    it("returns all entries when query is empty", async () => {
      await addToIndex(makeEntry({ id: "lib-a" }), tempDir);
      await addToIndex(makeEntry({ id: "lib-b" }), tempDir);

      const results = await searchEntries({}, tempDir);

      expect(results).toHaveLength(2);
    });

    it("filters by category (exact match, case-insensitive)", async () => {
      await addToIndex(makeEntry({ id: "lib-a", category: "weapon" }), tempDir);
      await addToIndex(makeEntry({ id: "lib-b", category: "footstep" }), tempDir);
      await addToIndex(makeEntry({ id: "lib-c", category: "weapon" }), tempDir);

      const results = await searchEntries({ category: "Weapon" }, tempDir);

      expect(results).toHaveLength(2);
      expect(results.every((e) => e.category === "weapon")).toBe(true);
    });

    it("filters by intensity (exact match, case-insensitive)", async () => {
      await addToIndex(
        makeEntry({
          id: "lib-a",
           classification: {
            source: "a", category: "weapon", intensity: "hard",
            texture: [], material: null, tags: [], embedding: [], analysisRef: "",
          },
        }),
        tempDir,
      );
      await addToIndex(
        makeEntry({
          id: "lib-b",
          classification: {
            source: "b", category: "weapon", intensity: "soft",
            texture: [], material: null, tags: [], embedding: [], analysisRef: "",
          },
        }),
        tempDir,
      );

      const results = await searchEntries({ intensity: "Hard" }, tempDir);

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe("lib-a");
    });

    it("excludes entries with no classification when intensity filter is set", async () => {
      await addToIndex(
        makeEntry({ id: "lib-a", classification: null }),
        tempDir,
      );

      const results = await searchEntries({ intensity: "medium" }, tempDir);

      expect(results).toHaveLength(0);
    });

    it("filters by texture (substring match, case-insensitive)", async () => {
      await addToIndex(
        makeEntry({
          id: "lib-a",
          classification: {
            source: "a", category: "weapon", intensity: "hard",
            texture: ["sharp", "metallic"], material: null, tags: [], embedding: [], analysisRef: "",
          },
        }),
        tempDir,
      );
      await addToIndex(
        makeEntry({
          id: "lib-b",
          classification: {
            source: "b", category: "weapon", intensity: "soft",
            texture: ["warm", "smooth"], material: null, tags: [], embedding: [], analysisRef: "",
          },
        }),
        tempDir,
      );

      const results = await searchEntries({ texture: "metal" }, tempDir);

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe("lib-a");
    });

    it("filters by tags (AND logic, case-insensitive)", async () => {
      await addToIndex(
        makeEntry({ id: "lib-a", tags: ["sharp", "bright", "metallic"] }),
        tempDir,
      );
      await addToIndex(
        makeEntry({ id: "lib-b", tags: ["warm", "soft"] }),
        tempDir,
      );
      await addToIndex(
        makeEntry({ id: "lib-c", tags: ["Sharp", "Metallic"] }),
        tempDir,
      );

      const results = await searchEntries(
        { tags: ["sharp", "metallic"] },
        tempDir,
      );

      expect(results).toHaveLength(2);
      expect(results.map((e) => e.id)).toEqual(["lib-a", "lib-c"]);
    });

    it("combines multiple filters with AND logic", async () => {
      await addToIndex(
        makeEntry({
          id: "lib-a",
          category: "weapon",
          tags: ["sci-fi"],
          classification: {
            source: "a", category: "weapon", intensity: "hard",
            texture: ["sharp"], material: null, tags: ["sci-fi"], embedding: [], analysisRef: "",
          },
        }),
        tempDir,
      );
      await addToIndex(
        makeEntry({
          id: "lib-b",
          category: "weapon",
          tags: ["fantasy"],
          classification: {
            source: "b", category: "weapon", intensity: "soft",
            texture: ["warm"], material: null, tags: ["fantasy"], embedding: [], analysisRef: "",
          },
        }),
        tempDir,
      );
      await addToIndex(
        makeEntry({
          id: "lib-c",
          category: "footstep",
          tags: ["sci-fi"],
          classification: {
            source: "c", category: "footstep", intensity: "hard",
            texture: ["sharp"], material: null, tags: ["sci-fi"], embedding: [], analysisRef: "",
          },
        }),
        tempDir,
      );

      const results = await searchEntries(
        { category: "weapon", intensity: "hard" },
        tempDir,
      );

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe("lib-a");
    });

    it("returns results sorted by ID", async () => {
      await addToIndex(makeEntry({ id: "lib-charlie" }), tempDir);
      await addToIndex(makeEntry({ id: "lib-alpha" }), tempDir);
      await addToIndex(makeEntry({ id: "lib-bravo" }), tempDir);

      const results = await searchEntries({}, tempDir);

      expect(results.map((e) => e.id)).toEqual([
        "lib-alpha",
        "lib-bravo",
        "lib-charlie",
      ]);
    });

    it("returns empty array when no entries match", async () => {
      await addToIndex(makeEntry({ id: "lib-a", category: "weapon" }), tempDir);

      const results = await searchEntries({ category: "footstep" }, tempDir);

      expect(results).toEqual([]);
    });

    it("returns empty array when library is empty", async () => {
      const results = await searchEntries({}, tempDir);
      expect(results).toEqual([]);
    });
  });
});
