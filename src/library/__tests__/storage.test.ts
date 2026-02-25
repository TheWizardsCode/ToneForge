import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  addEntry,
  getEntry,
  listEntries,
  removeEntry,
  countEntries,
  buildEntry,
  entryId,
  readEntryMetadata,
  entryWavExists,
} from "../storage.js";
import { clearIndexCache } from "../index-store.js";
import type { ExploreCandidate } from "../../explore/types.js";

/** Helper: create a minimal ExploreCandidate. */
function makeCandidate(
  overrides: Partial<ExploreCandidate> = {},
): ExploreCandidate {
  return {
    id: overrides.id ?? "creature_seed-00042",
    recipe: "creature",
    seed: 42,
    duration: 1.2,
    sampleRate: 44100,
    sampleCount: 52920,
    analysis: {
      analysisVersion: "1.0",
      sampleRate: 44100,
      sampleCount: 52920,
      metrics: {
        time: { rms: 0.45, crestFactor: 3.2 },
        spectral: { spectralCentroid: 2400 },
      },
    },
    classification: {
      source: "creature_seed-00042",
      category: "creature",
      intensity: "medium",
      texture: ["growling", "deep"],
      material: null,
      tags: ["monster", "organic"],
      analysisRef: "creature_seed-00042.json",
    },
    score: 0.82,
    metricScores: { rms: 0.9, "spectral-centroid": 0.74 },
    cluster: 1,
    promoted: false,
    libraryId: null,
    params: { pitch: 220, growl: 0.7 },
    ...overrides,
  };
}

/** Helper: create dummy WAV data. */
function dummyWav(): Buffer {
  return Buffer.from("RIFF\x00\x00\x00\x00WAVEfmt ", "binary");
}

describe("storage", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "toneforge-lib-storage-"));
    clearIndexCache();
  });

  afterEach(async () => {
    clearIndexCache();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("entryId", () => {
    it("prefixes candidate ID with lib-", () => {
      expect(entryId("creature_seed-00042")).toBe("lib-creature_seed-00042");
    });
  });

  describe("buildEntry", () => {
    it("builds a LibraryEntry from an ExploreCandidate", () => {
      const candidate = makeCandidate();
      const entry = buildEntry(candidate);

      expect(entry.id).toBe("lib-creature_seed-00042");
      expect(entry.recipe).toBe("creature");
      expect(entry.seed).toBe(42);
      expect(entry.category).toBe("creature");
      expect(entry.duration).toBe(1.2);
      expect(entry.tags).toContain("monster");
      expect(entry.tags).toContain("organic");
      expect(entry.tags).toContain("growling");
      expect(entry.tags).toContain("deep");
      expect(entry.preset.recipe).toBe("creature");
      expect(entry.preset.seed).toBe(42);
      expect(entry.preset.params).toEqual({ pitch: 220, growl: 0.7 });
      expect(entry.provenance.toneforgeVersion).toBeTruthy();
      expect(entry.files.wav).toBe(
        "creature/lib-creature_seed-00042.wav",
      );
      expect(entry.files.metadata).toBe(
        "creature/lib-creature_seed-00042.json",
      );
      expect(entry.promotedAt).toBeTruthy();
    });

    it("uses 'uncategorized' when classification is absent", () => {
      const candidate = makeCandidate({ classification: undefined });
      const entry = buildEntry(candidate);

      expect(entry.category).toBe("uncategorized");
      expect(entry.classification).toBeNull();
      expect(entry.tags).toEqual([]);
    });

    it("uses 'uncategorized' when classification has no category", () => {
      const candidate = makeCandidate();
      // Remove the classification entirely
      delete (candidate as unknown as Record<string, unknown>).classification;
      const entry = buildEntry(candidate);

      expect(entry.category).toBe("uncategorized");
    });

    it("does not duplicate tags from texture", () => {
      const candidate = makeCandidate({
        classification: {
          source: "test",
          category: "weapon",
          intensity: "hard",
          texture: ["sharp"], // "sharp" is also in tags
          material: null,
          tags: ["sharp", "metallic"],
          analysisRef: "test.json",
        },
      });

      const entry = buildEntry(candidate);

      const sharpCount = entry.tags.filter((t) => t === "sharp").length;
      expect(sharpCount).toBe(1);
    });
  });

  describe("addEntry", () => {
    it("writes WAV and metadata to category directory", async () => {
      const candidate = makeCandidate();
      const wav = dummyWav();

      const entry = await addEntry(candidate, wav, tempDir);

      // WAV file exists
      const wavPath = resolve(tempDir, entry.files.wav);
      expect(existsSync(wavPath)).toBe(true);
      const wavContent = await readFile(wavPath);
      expect(wavContent).toEqual(wav);

      // Metadata JSON exists
      const metadataPath = resolve(tempDir, entry.files.metadata);
      expect(existsSync(metadataPath)).toBe(true);
      const metadata = JSON.parse(await readFile(metadataPath, "utf-8"));
      expect(metadata.id).toBe("lib-creature_seed-00042");
      expect(metadata.recipe).toBe("creature");
    });

    it("creates the category directory if missing", async () => {
      const candidate = makeCandidate();
      const entry = await addEntry(candidate, dummyWav(), tempDir);

      const categoryDir = resolve(tempDir, entry.category);
      expect(existsSync(categoryDir)).toBe(true);
    });

    it("updates the index", async () => {
      const candidate = makeCandidate();
      await addEntry(candidate, dummyWav(), tempDir);

      const retrieved = await getEntry("lib-creature_seed-00042", tempDir);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.recipe).toBe("creature");
    });

    it("is idempotent -- returns existing entry for duplicate", async () => {
      const candidate = makeCandidate();

      const entry1 = await addEntry(candidate, dummyWav(), tempDir);
      const entry2 = await addEntry(candidate, dummyWav(), tempDir);

      expect(entry1.id).toBe(entry2.id);
      expect(entry1.promotedAt).toBe(entry2.promotedAt);

      // Only one entry in the index
      const count = await countEntries(tempDir);
      expect(count).toBe(1);
    });

    it("stores entries in correct category subdirectory", async () => {
      const weaponCandidate = makeCandidate({
        id: "weapon_seed-001",
        classification: {
          source: "weapon_seed-001",
          category: "weapon",
          intensity: "hard",
          texture: ["sharp"],
          material: "metal",
          tags: ["sword"],
          analysisRef: "weapon.json",
        },
      });
      const footstepCandidate = makeCandidate({
        id: "footstep_seed-002",
        classification: {
          source: "footstep_seed-002",
          category: "footstep",
          intensity: "soft",
          texture: ["crunchy"],
          material: "gravel",
          tags: ["outdoor"],
          analysisRef: "footstep.json",
        },
      });

      const e1 = await addEntry(weaponCandidate, dummyWav(), tempDir);
      const e2 = await addEntry(footstepCandidate, dummyWav(), tempDir);

      expect(e1.category).toBe("weapon");
      expect(e2.category).toBe("footstep");
      expect(existsSync(resolve(tempDir, "weapon"))).toBe(true);
      expect(existsSync(resolve(tempDir, "footstep"))).toBe(true);
    });
  });

  describe("getEntry", () => {
    it("retrieves an entry by ID", async () => {
      const candidate = makeCandidate();
      await addEntry(candidate, dummyWav(), tempDir);

      const entry = await getEntry("lib-creature_seed-00042", tempDir);

      expect(entry).not.toBeNull();
      expect(entry!.recipe).toBe("creature");
      expect(entry!.seed).toBe(42);
    });

    it("returns null for non-existent ID", async () => {
      const entry = await getEntry("lib-nonexistent", tempDir);
      expect(entry).toBeNull();
    });
  });

  describe("listEntries", () => {
    it("returns all entries when no filter", async () => {
      await addEntry(makeCandidate({ id: "a" }), dummyWav(), tempDir);
      await addEntry(makeCandidate({ id: "b" }), dummyWav(), tempDir);

      const entries = await listEntries(undefined, tempDir);

      expect(entries).toHaveLength(2);
    });

    it("filters entries by category", async () => {
      await addEntry(
        makeCandidate({
          id: "w1",
          classification: {
            source: "w1",
            category: "weapon",
            intensity: "hard",
            texture: [],
            material: null,
            tags: [],
            analysisRef: "",
          },
        }),
        dummyWav(),
        tempDir,
      );
      await addEntry(
        makeCandidate({
          id: "f1",
          classification: {
            source: "f1",
            category: "footstep",
            intensity: "soft",
            texture: [],
            material: null,
            tags: [],
            analysisRef: "",
          },
        }),
        dummyWav(),
        tempDir,
      );

      const weapons = await listEntries({ category: "weapon" }, tempDir);

      expect(weapons).toHaveLength(1);
      expect(weapons[0]!.category).toBe("weapon");
    });

    it("returns empty array when library is empty", async () => {
      const entries = await listEntries(undefined, tempDir);
      expect(entries).toEqual([]);
    });
  });

  describe("removeEntry", () => {
    it("removes an entry from the index", async () => {
      await addEntry(makeCandidate(), dummyWav(), tempDir);

      const removed = await removeEntry("lib-creature_seed-00042", tempDir);

      expect(removed).toBe(true);

      const entry = await getEntry("lib-creature_seed-00042", tempDir);
      expect(entry).toBeNull();
    });

    it("returns false for non-existent ID", async () => {
      const removed = await removeEntry("lib-nonexistent", tempDir);
      expect(removed).toBe(false);
    });
  });

  describe("countEntries", () => {
    it("returns 0 for empty library", async () => {
      const count = await countEntries(tempDir);
      expect(count).toBe(0);
    });

    it("returns correct count after adds", async () => {
      await addEntry(makeCandidate({ id: "a" }), dummyWav(), tempDir);
      await addEntry(makeCandidate({ id: "b" }), dummyWav(), tempDir);
      await addEntry(makeCandidate({ id: "c" }), dummyWav(), tempDir);

      const count = await countEntries(tempDir);
      expect(count).toBe(3);
    });
  });

  describe("readEntryMetadata", () => {
    it("reads metadata JSON from disk", async () => {
      const candidate = makeCandidate();
      const entry = await addEntry(candidate, dummyWav(), tempDir);

      const metadata = await readEntryMetadata(entry, tempDir);

      expect(metadata.id).toBe(entry.id);
      expect(metadata.recipe).toBe("creature");
      expect(metadata.preset.seed).toBe(42);
    });
  });

  describe("entryWavExists", () => {
    it("returns true when WAV file exists", async () => {
      const candidate = makeCandidate();
      const entry = await addEntry(candidate, dummyWav(), tempDir);

      expect(entryWavExists(entry, tempDir)).toBe(true);
    });

    it("returns false when WAV file does not exist", async () => {
      const entry = buildEntry(makeCandidate());

      expect(entryWavExists(entry, tempDir)).toBe(false);
    });
  });

  describe("round-trip persistence", () => {
    it("survives cache clear and reload from disk", async () => {
      const candidate = makeCandidate();
      await addEntry(candidate, dummyWav(), tempDir);

      // Clear cache to force reload from disk
      clearIndexCache(tempDir);

      const entry = await getEntry("lib-creature_seed-00042", tempDir);
      expect(entry).not.toBeNull();
      expect(entry!.recipe).toBe("creature");
      expect(entry!.category).toBe("creature");
      expect(entry!.preset.params).toEqual({ pitch: 220, growl: 0.7 });
    });

    it("persists multiple entries across cache clears", async () => {
      await addEntry(makeCandidate({ id: "a" }), dummyWav(), tempDir);
      await addEntry(makeCandidate({ id: "b" }), dummyWav(), tempDir);

      clearIndexCache(tempDir);

      const entries = await listEntries(undefined, tempDir);
      expect(entries).toHaveLength(2);
    });
  });
});
