import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Mocks — set up before importing the module under test
// ---------------------------------------------------------------------------

const mockRenderRecipe = vi.fn();
const mockEncodeWav = vi.fn();

vi.mock("../../core/renderer.js", () => ({
  renderRecipe: (...args: unknown[]) => mockRenderRecipe(...args),
}));

vi.mock("../../audio/wav-encoder.js", () => ({
  encodeWav: (...args: unknown[]) => mockEncodeWav(...args),
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks are wired)
// ---------------------------------------------------------------------------
import { regenerateEntry } from "../regenerate.js";
import type { RegenerateResult } from "../regenerate.js";
import { addToIndex, clearIndexCache, loadIndex } from "../index-store.js";
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
    files: {
      wav: "weapon/lib-test_seed-00001.wav",
      metadata: "weapon/lib-test_seed-00001.json",
    },
    promotedAt: "2026-02-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("regenerate", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "toneforge-regen-test-"));
    clearIndexCache();

    // Default mock implementations
    mockRenderRecipe.mockResolvedValue({
      samples: new Float32Array([0.1, 0.2, 0.3]),
      sampleRate: 44100,
      duration: 0.5,
      numberOfChannels: 1,
    });
    mockEncodeWav.mockReturnValue(Buffer.from("RIFF-fake-wav-data"));
  });

  afterEach(async () => {
    clearIndexCache();
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("regenerateEntry", () => {
    it("throws when entry ID is not found", async () => {
      await expect(
        regenerateEntry("lib-nonexistent", tempDir),
      ).rejects.toThrow("Library entry not found: lib-nonexistent");
    });

    it("calls renderRecipe with stored recipe and seed", async () => {
      const entry = makeEntry({
        id: "lib-regen-1",
        preset: { recipe: "laser", seed: 42, params: {} },
        files: { wav: "weapon/lib-regen-1.wav", metadata: "weapon/lib-regen-1.json" },
      });
      await addToIndex(entry, tempDir);

      // Create the WAV directory so writeFile succeeds
      await mkdir(join(tempDir, "weapon"), { recursive: true });

      await regenerateEntry("lib-regen-1", tempDir);

      expect(mockRenderRecipe).toHaveBeenCalledWith("laser", 42);
    });

    it("calls encodeWav with rendered samples and sampleRate", async () => {
      const fakeSamples = new Float32Array([0.5, -0.5, 0.0]);
      mockRenderRecipe.mockResolvedValue({
        samples: fakeSamples,
        sampleRate: 44100,
        duration: 0.5,
        numberOfChannels: 1,
      });

      const entry = makeEntry({ id: "lib-regen-2" });
      await addToIndex(entry, tempDir);
      await mkdir(join(tempDir, "weapon"), { recursive: true });

      await regenerateEntry("lib-regen-2", tempDir);

      expect(mockEncodeWav).toHaveBeenCalledWith(fakeSamples, {
        sampleRate: 44100,
      });
    });

    it("writes WAV file to the correct path", async () => {
      const entry = makeEntry({
        id: "lib-regen-3",
        files: { wav: "weapon/lib-regen-3.wav", metadata: "weapon/lib-regen-3.json" },
      });
      await addToIndex(entry, tempDir);
      await mkdir(join(tempDir, "weapon"), { recursive: true });

      const result = await regenerateEntry("lib-regen-3", tempDir);

      // Verify the WAV file was written
      const expectedPath = resolve(tempDir, "weapon/lib-regen-3.wav");
      expect(result.wavPath).toBe(expectedPath);

      const fileContent = await readFile(expectedPath);
      expect(fileContent.toString()).toBe("RIFF-fake-wav-data");
    });

    it("returns a successful RegenerateResult", async () => {
      const entry = makeEntry({ id: "lib-regen-4" });
      await addToIndex(entry, tempDir);
      await mkdir(join(tempDir, "weapon"), { recursive: true });

      const result = await regenerateEntry("lib-regen-4", tempDir);

      expect(result.success).toBe(true);
      expect(result.entryId).toBe("lib-regen-4");
      expect(result.wavPath).toBe(
        resolve(tempDir, "weapon/lib-test_seed-00001.wav"),
      );
      expect(result.regeneratedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });

    it("updates the index entry with regeneratedAt timestamp", async () => {
      const entry = makeEntry({ id: "lib-regen-5" });
      await addToIndex(entry, tempDir);
      await mkdir(join(tempDir, "weapon"), { recursive: true });

      const result = await regenerateEntry("lib-regen-5", tempDir);

      // Re-read the index to verify the timestamp was persisted
      clearIndexCache();
      const index = await loadIndex(tempDir);
      const updated = index.entries.find((e) => e.id === "lib-regen-5");

      expect(updated).toBeDefined();
      expect(
        (updated as LibraryEntry & { regeneratedAt?: string }).regeneratedAt,
      ).toBe(result.regeneratedAt);
    });

    it("replaces existing WAV file content", async () => {
      const entry = makeEntry({
        id: "lib-regen-6",
        files: { wav: "weapon/lib-regen-6.wav", metadata: "weapon/lib-regen-6.json" },
      });
      await addToIndex(entry, tempDir);
      await mkdir(join(tempDir, "weapon"), { recursive: true });

      // Write an initial WAV file
      const wavPath = resolve(tempDir, "weapon/lib-regen-6.wav");
      await writeFile(wavPath, "old-wav-content");

      // Mock returns new content
      mockEncodeWav.mockReturnValue(Buffer.from("new-regenerated-wav"));

      await regenerateEntry("lib-regen-6", tempDir);

      const newContent = await readFile(wavPath, "utf-8");
      expect(newContent).toBe("new-regenerated-wav");
    });

    it("propagates renderRecipe errors", async () => {
      const entry = makeEntry({ id: "lib-regen-err" });
      await addToIndex(entry, tempDir);

      mockRenderRecipe.mockRejectedValue(
        new Error("Recipe not found: unknown"),
      );

      await expect(
        regenerateEntry("lib-regen-err", tempDir),
      ).rejects.toThrow("Recipe not found: unknown");
    });
  });
});
