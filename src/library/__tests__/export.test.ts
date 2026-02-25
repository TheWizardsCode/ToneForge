import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { exportEntries } from "../export.js";
import type { ExportOptions } from "../export.js";
import { addToIndex, clearIndexCache } from "../index-store.js";
import type { LibraryEntry } from "../types.js";

/** Helper: create a minimal LibraryEntry. */
function makeEntry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: overrides.id ?? "lib-test_seed-00001",
    recipe: "test",
    seed: 1,
    category: overrides.category ?? "weapon",
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
      category: overrides.category ?? "weapon",
      intensity: "medium",
      texture: ["sharp", "metallic"],
      material: null,
      tags: ["sharp", "bright"],
      analysisRef: "test.json",
    },
    preset: { recipe: "test", seed: 1, params: {} },
    provenance: { toneforgeVersion: "0.1.0" },
    files: overrides.files ?? {
      wav: `${overrides.category ?? "weapon"}/${overrides.id ?? "lib-test_seed-00001"}.wav`,
      metadata: `${overrides.category ?? "weapon"}/${overrides.id ?? "lib-test_seed-00001"}.json`,
    },
    promotedAt: "2026-02-24T00:00:00.000Z",
    ...overrides,
  };
}

/** Helper: create a fake WAV file on disk in the library dir. */
async function createFakeWav(
  baseDir: string,
  relativePath: string,
  content: string = "RIFF-fake-wav",
): Promise<void> {
  const fullPath = resolve(baseDir, relativePath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, content);
}

describe("export", () => {
  let tempDir: string;
  let outputDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "toneforge-export-test-"));
    outputDir = join(tempDir, "output");
    clearIndexCache();
  });

  afterEach(async () => {
    clearIndexCache();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("exportEntries", () => {
    it("exports all entries when no category filter is set", async () => {
      const entry1 = makeEntry({ id: "lib-a", category: "weapon" });
      const entry2 = makeEntry({ id: "lib-b", category: "footstep" });
      await addToIndex(entry1, tempDir);
      await addToIndex(entry2, tempDir);

      // Create fake WAV files
      await createFakeWav(tempDir, entry1.files.wav, "wav-a");
      await createFakeWav(tempDir, entry2.files.wav, "wav-b");

      const result = await exportEntries(
        { outputDir, format: "wav" },
        tempDir,
      );

      expect(result.count).toBe(2);
      expect(result.files).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);
      expect(result.outputDir).toBe(resolve(outputDir));
    });

    it("creates category subdirectories in output", async () => {
      const entry = makeEntry({ id: "lib-a", category: "weapon" });
      await addToIndex(entry, tempDir);
      await createFakeWav(tempDir, entry.files.wav);

      await exportEntries({ outputDir, format: "wav" }, tempDir);

      expect(existsSync(join(outputDir, "weapon"))).toBe(true);
    });

    it("copies WAV files with correct naming", async () => {
      const entry = makeEntry({ id: "lib-sword", category: "weapon" });
      await addToIndex(entry, tempDir);
      await createFakeWav(tempDir, entry.files.wav, "sword-wav-content");

      await exportEntries({ outputDir, format: "wav" }, tempDir);

      const destPath = join(outputDir, "weapon", "lib-sword.wav");
      expect(existsSync(destPath)).toBe(true);

      const content = await readFile(destPath, "utf-8");
      expect(content).toBe("sword-wav-content");
    });

    it("filters by category when specified", async () => {
      const entry1 = makeEntry({ id: "lib-a", category: "weapon" });
      const entry2 = makeEntry({ id: "lib-b", category: "footstep" });
      const entry3 = makeEntry({ id: "lib-c", category: "weapon" });
      await addToIndex(entry1, tempDir);
      await addToIndex(entry2, tempDir);
      await addToIndex(entry3, tempDir);

      await createFakeWav(tempDir, entry1.files.wav);
      await createFakeWav(tempDir, entry2.files.wav);
      await createFakeWav(tempDir, entry3.files.wav);

      const result = await exportEntries(
        { outputDir, format: "wav", category: "weapon" },
        tempDir,
      );

      expect(result.count).toBe(2);
      expect(result.files.every((f) => f.startsWith("weapon/"))).toBe(true);
    });

    it("skips entries whose WAV file does not exist on disk", async () => {
      const entry1 = makeEntry({ id: "lib-exists", category: "weapon" });
      const entry2 = makeEntry({ id: "lib-missing", category: "weapon" });
      await addToIndex(entry1, tempDir);
      await addToIndex(entry2, tempDir);

      // Only create WAV for entry1
      await createFakeWav(tempDir, entry1.files.wav);

      const result = await exportEntries(
        { outputDir, format: "wav" },
        tempDir,
      );

      expect(result.count).toBe(1);
      expect(result.files).toHaveLength(1);
      expect(result.skipped).toEqual(["lib-missing"]);
    });

    it("returns empty result when library is empty", async () => {
      const result = await exportEntries(
        { outputDir, format: "wav" },
        tempDir,
      );

      expect(result.count).toBe(0);
      expect(result.files).toEqual([]);
      expect(result.skipped).toEqual([]);
    });

    it("returns empty result when category filter matches nothing", async () => {
      const entry = makeEntry({ id: "lib-a", category: "weapon" });
      await addToIndex(entry, tempDir);
      await createFakeWav(tempDir, entry.files.wav);

      const result = await exportEntries(
        { outputDir, format: "wav", category: "ambient" },
        tempDir,
      );

      expect(result.count).toBe(0);
      expect(result.files).toEqual([]);
    });

    it("handles multiple categories in output", async () => {
      const entries = [
        makeEntry({ id: "lib-a", category: "weapon" }),
        makeEntry({ id: "lib-b", category: "footstep" }),
        makeEntry({ id: "lib-c", category: "ambient" }),
      ];

      for (const entry of entries) {
        await addToIndex(entry, tempDir);
        await createFakeWav(tempDir, entry.files.wav);
      }

      const result = await exportEntries(
        { outputDir, format: "wav" },
        tempDir,
      );

      expect(result.count).toBe(3);
      expect(existsSync(join(outputDir, "weapon"))).toBe(true);
      expect(existsSync(join(outputDir, "footstep"))).toBe(true);
      expect(existsSync(join(outputDir, "ambient"))).toBe(true);
    });

    it("returns relative file paths in the files array", async () => {
      const entry = makeEntry({ id: "lib-a", category: "weapon" });
      await addToIndex(entry, tempDir);
      await createFakeWav(tempDir, entry.files.wav);

      const result = await exportEntries(
        { outputDir, format: "wav" },
        tempDir,
      );

      expect(result.files).toEqual(["weapon/lib-a.wav"]);
    });
  });
});
