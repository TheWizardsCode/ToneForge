import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  loadIndex,
  saveIndex,
  addToIndex,
  getFromIndex,
  removeFromIndex,
  listFromIndex,
  clearIndexCache,
} from "../index-store.js";
import type { LibraryEntry, LibraryIndex } from "../types.js";
import { LIBRARY_VERSION } from "../types.js";

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
      texture: ["sharp"],
      material: null,
      tags: ["sharp", "bright"],
      embedding: [],
      analysisRef: "test.json",
    },
    preset: {
      recipe: "test",
      seed: 1,
      params: { freq: 440 },
    },
    provenance: {
      toneforgeVersion: "0.1.0",
    },
    files: {
      wav: "weapon/lib-test_seed-00001.wav",
      metadata: "weapon/lib-test_seed-00001.json",
    },
    promotedAt: "2026-02-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("index-store", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "toneforge-lib-test-"));
    clearIndexCache();
  });

  afterEach(async () => {
    clearIndexCache();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("loadIndex", () => {
    it("returns an empty index when no file exists", async () => {
      const index = await loadIndex(tempDir);

      expect(index.version).toBe(LIBRARY_VERSION);
      expect(index.entries).toEqual([]);
    });

    it("loads an existing index from disk", async () => {
      const existingIndex: LibraryIndex = {
        version: "1.0",
        entries: [makeEntry()],
      };
      const { writeFile: wf } = await import("node:fs/promises");
      const { mkdir: mkd } = await import("node:fs/promises");
      await mkd(tempDir, { recursive: true });
      await wf(
        join(tempDir, "index.json"),
        JSON.stringify(existingIndex, null, 2),
      );

      const index = await loadIndex(tempDir);

      expect(index.entries).toHaveLength(1);
      expect(index.entries[0]!.id).toBe("lib-test_seed-00001");
    });

    it("caches the index in memory after first load", async () => {
      const index1 = await loadIndex(tempDir);
      const index2 = await loadIndex(tempDir);

      expect(index1).toBe(index2); // Same reference
    });
  });

  describe("saveIndex", () => {
    it("writes the index to disk as JSON", async () => {
      const index: LibraryIndex = {
        version: "1.0",
        entries: [makeEntry()],
      };

      const path = await saveIndex(index, tempDir);

      expect(path).toContain("index.json");
      expect(existsSync(path)).toBe(true);

      const content = await readFile(path, "utf-8");
      const parsed = JSON.parse(content) as LibraryIndex;
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0]!.id).toBe("lib-test_seed-00001");
    });

    it("creates the directory structure if missing", async () => {
      const nestedDir = join(tempDir, "nested", "deep");
      const index: LibraryIndex = {
        version: "1.0",
        entries: [],
      };

      const path = await saveIndex(index, nestedDir);

      expect(existsSync(path)).toBe(true);
    });

    it("updates the cache after saving", async () => {
      const index: LibraryIndex = {
        version: "1.0",
        entries: [makeEntry()],
      };

      await saveIndex(index, tempDir);
      const loaded = await loadIndex(tempDir);

      expect(loaded).toBe(index); // Same reference from cache
    });
  });

  describe("addToIndex", () => {
    it("adds an entry and persists to disk", async () => {
      const entry = makeEntry();

      const result = await addToIndex(entry, tempDir);

      expect(result).toEqual(entry);

      // Verify persisted
      clearIndexCache(tempDir);
      const loaded = await loadIndex(tempDir);
      expect(loaded.entries).toHaveLength(1);
      expect(loaded.entries[0]!.id).toBe(entry.id);
    });

    it("is idempotent -- returns existing entry for duplicate ID", async () => {
      const entry1 = makeEntry({ promotedAt: "2026-02-24T00:00:00.000Z" });
      const entry2 = makeEntry({ promotedAt: "2026-02-25T00:00:00.000Z" });

      await addToIndex(entry1, tempDir);
      const result = await addToIndex(entry2, tempDir);

      // Returns the original entry, not the duplicate
      expect(result.promotedAt).toBe("2026-02-24T00:00:00.000Z");

      // Only one entry in the index
      const index = await loadIndex(tempDir);
      expect(index.entries).toHaveLength(1);
    });

    it("adds multiple distinct entries", async () => {
      const entry1 = makeEntry({ id: "lib-alpha" });
      const entry2 = makeEntry({ id: "lib-beta" });
      const entry3 = makeEntry({ id: "lib-gamma" });

      await addToIndex(entry1, tempDir);
      await addToIndex(entry2, tempDir);
      await addToIndex(entry3, tempDir);

      const index = await loadIndex(tempDir);
      expect(index.entries).toHaveLength(3);
    });
  });

  describe("getFromIndex", () => {
    it("returns an entry by ID", async () => {
      const entry = makeEntry();
      await addToIndex(entry, tempDir);

      const result = await getFromIndex(entry.id, tempDir);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(entry.id);
      expect(result!.recipe).toBe("test");
    });

    it("returns null for non-existent ID", async () => {
      const result = await getFromIndex("lib-nonexistent", tempDir);
      expect(result).toBeNull();
    });
  });

  describe("removeFromIndex", () => {
    it("removes an existing entry and persists", async () => {
      const entry = makeEntry();
      await addToIndex(entry, tempDir);

      const removed = await removeFromIndex(entry.id, tempDir);

      expect(removed).toBe(true);

      // Verify removed from disk
      clearIndexCache(tempDir);
      const loaded = await loadIndex(tempDir);
      expect(loaded.entries).toHaveLength(0);
    });

    it("returns false for non-existent ID", async () => {
      const removed = await removeFromIndex("lib-nonexistent", tempDir);
      expect(removed).toBe(false);
    });
  });

  describe("listFromIndex", () => {
    it("returns all entries when no filter is provided", async () => {
      await addToIndex(makeEntry({ id: "lib-a" }), tempDir);
      await addToIndex(makeEntry({ id: "lib-b" }), tempDir);

      const entries = await listFromIndex(undefined, tempDir);

      expect(entries).toHaveLength(2);
    });

    it("filters by category", async () => {
      await addToIndex(makeEntry({ id: "lib-a", category: "weapon" }), tempDir);
      await addToIndex(makeEntry({ id: "lib-b", category: "footstep" }), tempDir);
      await addToIndex(makeEntry({ id: "lib-c", category: "weapon" }), tempDir);

      const entries = await listFromIndex({ category: "weapon" }, tempDir);

      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.category === "weapon")).toBe(true);
    });

    it("filters by recipe", async () => {
      await addToIndex(makeEntry({ id: "lib-a", recipe: "alpha" }), tempDir);
      await addToIndex(makeEntry({ id: "lib-b", recipe: "beta" }), tempDir);

      const entries = await listFromIndex({ recipe: "alpha" }, tempDir);

      expect(entries).toHaveLength(1);
      expect(entries[0]!.recipe).toBe("alpha");
    });

    it("filters by tags (all must match)", async () => {
      await addToIndex(
        makeEntry({ id: "lib-a", tags: ["sharp", "bright", "metallic"] }),
        tempDir,
      );
      await addToIndex(
        makeEntry({ id: "lib-b", tags: ["soft", "warm"] }),
        tempDir,
      );
      await addToIndex(
        makeEntry({ id: "lib-c", tags: ["sharp", "metallic"] }),
        tempDir,
      );

      const entries = await listFromIndex(
        { tags: ["sharp", "metallic"] },
        tempDir,
      );

      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.id).sort()).toEqual(["lib-a", "lib-c"]);
    });

    it("returns empty array when no entries match", async () => {
      await addToIndex(makeEntry({ id: "lib-a", category: "weapon" }), tempDir);

      const entries = await listFromIndex({ category: "ui" }, tempDir);

      expect(entries).toEqual([]);
    });

    it("returns empty array when library is empty", async () => {
      const entries = await listFromIndex(undefined, tempDir);
      expect(entries).toEqual([]);
    });

    it("combines multiple filter criteria", async () => {
      await addToIndex(
        makeEntry({ id: "lib-a", category: "weapon", recipe: "laser", tags: ["sci-fi"] }),
        tempDir,
      );
      await addToIndex(
        makeEntry({ id: "lib-b", category: "weapon", recipe: "sword", tags: ["fantasy"] }),
        tempDir,
      );
      await addToIndex(
        makeEntry({ id: "lib-c", category: "footstep", recipe: "laser", tags: ["sci-fi"] }),
        tempDir,
      );

      const entries = await listFromIndex(
        { category: "weapon", recipe: "laser" },
        tempDir,
      );

      expect(entries).toHaveLength(1);
      expect(entries[0]!.id).toBe("lib-a");
    });
  });

  describe("clearIndexCache", () => {
    it("clears a specific directory cache", async () => {
      const index1 = await loadIndex(tempDir);
      clearIndexCache(tempDir);
      const index2 = await loadIndex(tempDir);

      expect(index1).not.toBe(index2); // Different references
    });

    it("clears the entire cache when no directory specified", async () => {
      await loadIndex(tempDir);
      clearIndexCache();
      const index = await loadIndex(tempDir);

      expect(index.entries).toEqual([]); // Fresh load
    });
  });
});
