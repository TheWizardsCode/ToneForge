import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  buildExportFilename,
  buildManifestEntry,
  buildManifestJson,
  formatExportProgress,
  formatExportSummary,
  runExportStage,
} from "../stages/export.js";
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

vi.mock("../../audio/wav-encoder.js", () => ({
  encodeWav: vi.fn(),
}));

vi.mock("../../library/storage.js", () => ({
  addEntry: vi.fn(),
  entryId: vi.fn((id: string) => `lib-${id}`),
}));

vi.mock("../../audio/player.js", () => ({
  playAudio: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  input: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  Separator: class Separator {
    separator = true;
  },
}));

import { outputInfo, outputError, outputSuccess } from "../../output.js";
import { renderRecipe } from "../../core/renderer.js";
import { encodeWav } from "../../audio/wav-encoder.js";
import { addEntry } from "../../library/storage.js";
import { input, confirm } from "@inquirer/prompts";
import { mkdir, writeFile } from "node:fs/promises";

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
      category: "card-game",
      intensity: "medium",
      texture: ["smooth"],
      material: null,
      tags: ["card", "ui"],
      embedding: [],
      analysisRef: "",
    },
    score: 0.85,
    metricScores: { rms: 0.8 },
    cluster: 0,
    promoted: false,
    libraryId: null,
    params: { freq: 440 },
  };
}

function makeSelection(recipe: string, seed: number): CandidateSelection {
  const candidate = makeCandidate(recipe, seed);
  return {
    recipe,
    candidate,
    classification: candidate.classification!,
  };
}

function setupSession(...selections: CandidateSelection[]): WizardSession {
  const session = new WizardSession();
  for (const sel of selections) {
    session.addToManifest({
      recipe: sel.recipe,
      description: `${sel.recipe} desc`,
      category: sel.classification.category,
      tags: sel.classification.tags,
    });
    session.setSelection(sel.recipe, sel);
  }
  // Advance to export stage
  session.advance(); // define -> explore
  session.advance(); // explore -> review
  session.advance(); // review -> export
  return session;
}

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

describe("buildExportFilename", () => {
  it("returns flat filename when byCategory is false", () => {
    const result = buildExportFilename("card-flip", 42, "card-game", false);
    expect(result).toBe("card-flip_seed-00042.wav");
  });

  it("returns category-prefixed path when byCategory is true", () => {
    const result = buildExportFilename("card-flip", 42, "card-game", true);
    expect(result).toBe("card-game/card-flip_seed-00042.wav");
  });

  it("zero-pads seed to 5 digits", () => {
    const result = buildExportFilename("weapon-laser", 3, "weapon", false);
    expect(result).toBe("weapon-laser_seed-00003.wav");
  });

  it("handles large seed numbers", () => {
    const result = buildExportFilename("ambient-wind", 99999, "ambient", false);
    expect(result).toBe("ambient-wind_seed-99999.wav");
  });

  it("uses uncategorized as category when provided", () => {
    const result = buildExportFilename("test", 1, "uncategorized", true);
    expect(result).toBe("uncategorized/test_seed-00001.wav");
  });
});

describe("buildManifestEntry", () => {
  it("creates manifest entry with all fields", () => {
    const sel = makeSelection("card-flip", 42);
    const entry = buildManifestEntry(sel, "card-game/card-flip_seed-00042.wav");

    expect(entry.recipe).toBe("card-flip");
    expect(entry.seed).toBe(42);
    expect(entry.category).toBe("card-game");
    expect(entry.intensity).toBe("medium");
    expect(entry.texture).toEqual(["smooth"]);
    expect(entry.tags).toEqual(["card", "ui"]);
    expect(entry.filename).toBe("card-game/card-flip_seed-00042.wav");
  });

  it("uses uncategorized for missing category", () => {
    const sel = makeSelection("test", 1);
    sel.classification = {
      ...sel.classification,
      category: "",
    };
    const entry = buildManifestEntry(sel, "test.wav");
    expect(entry.category).toBe("uncategorized");
  });

  it("uses unknown for missing intensity", () => {
    const sel = makeSelection("test", 1);
    sel.classification = {
      ...sel.classification,
      intensity: "",
    };
    const entry = buildManifestEntry(sel, "test.wav");
    expect(entry.intensity).toBe("unknown");
  });

  it("returns empty arrays for missing texture and tags", () => {
    const sel = makeSelection("test", 1);
    sel.classification = {
      ...sel.classification,
      texture: [],
      tags: [],
    };
    const entry = buildManifestEntry(sel, "test.wav");
    expect(entry.texture).toEqual([]);
    expect(entry.tags).toEqual([]);
  });

  it("creates defensive copies of texture and tags arrays", () => {
    const sel = makeSelection("card-flip", 42);
    const entry = buildManifestEntry(sel, "test.wav");
    entry.texture.push("extra");
    entry.tags.push("extra");
    // Original should not be affected
    expect(sel.classification.texture).toEqual(["smooth"]);
    expect(sel.classification.tags).toEqual(["card", "ui"]);
  });
});

describe("buildManifestJson", () => {
  it("builds manifest for multiple selections with category organisation", () => {
    const selections = [
      makeSelection("card-flip", 42),
      makeSelection("card-draw", 7),
    ];
    const manifest = buildManifestJson(selections, true);

    expect(manifest).toHaveLength(2);
    expect(manifest[0]!.recipe).toBe("card-flip");
    expect(manifest[0]!.filename).toBe("card-game/card-flip_seed-00042.wav");
    expect(manifest[1]!.recipe).toBe("card-draw");
    expect(manifest[1]!.filename).toBe("card-game/card-draw_seed-00007.wav");
  });

  it("builds manifest without category organisation", () => {
    const selections = [makeSelection("card-flip", 42)];
    const manifest = buildManifestJson(selections, false);

    expect(manifest).toHaveLength(1);
    expect(manifest[0]!.filename).toBe("card-flip_seed-00042.wav");
  });

  it("returns empty array for empty selections", () => {
    const manifest = buildManifestJson([], true);
    expect(manifest).toEqual([]);
  });

  it("all entries have required schema fields", () => {
    const selections = [
      makeSelection("card-flip", 42),
      makeSelection("weapon-laser", 100),
    ];
    const manifest = buildManifestJson(selections, true);

    for (const entry of manifest) {
      expect(entry).toHaveProperty("recipe");
      expect(entry).toHaveProperty("seed");
      expect(entry).toHaveProperty("category");
      expect(entry).toHaveProperty("intensity");
      expect(entry).toHaveProperty("texture");
      expect(entry).toHaveProperty("tags");
      expect(entry).toHaveProperty("filename");
      expect(typeof entry.recipe).toBe("string");
      expect(typeof entry.seed).toBe("number");
      expect(typeof entry.category).toBe("string");
      expect(typeof entry.intensity).toBe("string");
      expect(Array.isArray(entry.texture)).toBe(true);
      expect(Array.isArray(entry.tags)).toBe(true);
      expect(typeof entry.filename).toBe("string");
    }
  });

  it("manifest is valid JSON (round-trips through stringify/parse)", () => {
    const selections = [
      makeSelection("card-flip", 42),
      makeSelection("card-draw", 7),
    ];
    const manifest = buildManifestJson(selections, true);
    const json = JSON.stringify(manifest, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(manifest);
  });
});

describe("formatExportProgress", () => {
  it("formats progress with 1-based index", () => {
    const line = formatExportProgress(1, 5, "card-flip");
    expect(line).toBe('  [1/5] Exporting "card-flip"...');
  });

  it("formats last item progress", () => {
    const line = formatExportProgress(5, 5, "ambient-wind");
    expect(line).toBe('  [5/5] Exporting "ambient-wind"...');
  });

  it("handles single item", () => {
    const line = formatExportProgress(1, 1, "test-recipe");
    expect(line).toBe('  [1/1] Exporting "test-recipe"...');
  });
});

describe("formatExportSummary", () => {
  it("formats summary with no failures", () => {
    const summary = formatExportSummary(5, 0, "./output");
    expect(summary).toContain("Exported 5 WAV files to ./output");
    expect(summary).toContain("Manifest written to");
    expect(summary).not.toContain("failed");
  });

  it("formats summary with failures", () => {
    const summary = formatExportSummary(3, 2, "./output");
    expect(summary).toContain("Exported 3 WAV files to ./output");
    expect(summary).toContain("2 files failed to export");
  });

  it("uses singular for 1 file", () => {
    const summary = formatExportSummary(1, 0, "./out");
    expect(summary).toContain("Exported 1 WAV file to ./out");
  });

  it("uses singular for 1 failure", () => {
    const summary = formatExportSummary(0, 1, "./out");
    expect(summary).toContain("1 file failed to export");
  });

  it("includes manifest path", () => {
    const summary = formatExportSummary(1, 0, "./my-dir");
    expect(summary).toContain("my-dir/manifest.json");
  });
});

// ---------------------------------------------------------------------------
// Interactive flow tests
// ---------------------------------------------------------------------------

describe("runExportStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock setup for successful export
    (renderRecipe as Mock).mockResolvedValue({
      samples: new Float32Array([0.1, 0.2, 0.3]),
      sampleRate: 44100,
      duration: 1.0,
      numberOfChannels: 1,
    });
    (encodeWav as Mock).mockReturnValue(Buffer.from("fake-wav"));
    (addEntry as Mock).mockResolvedValue({
      id: "lib-test",
      files: { wav: "test.wav", metadata: "test.json" },
    });
    (mkdir as Mock).mockResolvedValue(undefined);
    (writeFile as Mock).mockResolvedValue(undefined);
  });

  it("returns 'back' when no selections exist", async () => {
    const session = new WizardSession();
    session.advance(); // define -> explore
    session.advance(); // explore -> review
    session.advance(); // review -> export

    const result = await runExportStage(session);
    expect(result).toBe("back");
    expect(outputInfo).toHaveBeenCalledWith(
      expect.stringContaining("No selections to export"),
    );
  });

  it("returns 'back' when user declines to proceed", async () => {
    const session = setupSession(makeSelection("card-flip", 42));
    (input as Mock).mockResolvedValue("./test-output");
    (confirm as Mock)
      .mockResolvedValueOnce(true) // category organisation
      .mockResolvedValueOnce(false); // decline to proceed

    const result = await runExportStage(session);
    expect(result).toBe("back");
  });

  it("exports successfully and returns 'advance'", async () => {
    const session = setupSession(makeSelection("card-flip", 42));
    (input as Mock).mockResolvedValue("./test-output");
    (confirm as Mock)
      .mockResolvedValueOnce(true) // category organisation
      .mockResolvedValueOnce(true); // proceed

    const result = await runExportStage(session);
    expect(result).toBe("advance");

    // Verify render was called
    expect(renderRecipe).toHaveBeenCalledWith("card-flip", 42);

    // Verify WAV encoding
    expect(encodeWav).toHaveBeenCalledWith(
      expect.any(Float32Array),
      { sampleRate: 44100 },
    );

    // Verify library promotion
    expect(addEntry).toHaveBeenCalled();

    // Verify directory creation
    expect(mkdir).toHaveBeenCalledWith("./test-output", { recursive: true });

    // Verify WAV file was written
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("card-flip_seed-00042.wav"),
      expect.any(Buffer),
    );

    // Verify manifest.json was written
    const writeFileCalls = (writeFile as Mock).mock.calls;
    const manifestCall = writeFileCalls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).endsWith("manifest.json"),
    );
    expect(manifestCall).toBeDefined();

    // Verify manifest content is valid JSON
    const manifestContent = JSON.parse(manifestCall![1] as string);
    expect(manifestContent).toHaveLength(1);
    expect(manifestContent[0].recipe).toBe("card-flip");
    expect(manifestContent[0].seed).toBe(42);
    expect(manifestContent[0].category).toBe("card-game");
    expect(manifestContent[0].intensity).toBe("medium");
    expect(manifestContent[0].texture).toEqual(["smooth"]);
    expect(manifestContent[0].tags).toEqual(["card", "ui"]);
    expect(manifestContent[0].filename).toContain("card-flip_seed-00042.wav");
  });

  it("exports multiple selections", async () => {
    const session = setupSession(
      makeSelection("card-flip", 42),
      makeSelection("card-draw", 7),
    );
    (input as Mock).mockResolvedValue("./multi-output");
    (confirm as Mock)
      .mockResolvedValueOnce(true) // category organisation
      .mockResolvedValueOnce(true); // proceed

    const result = await runExportStage(session);
    expect(result).toBe("advance");
    expect(renderRecipe).toHaveBeenCalledTimes(2);
    expect(renderRecipe).toHaveBeenCalledWith("card-flip", 42);
    expect(renderRecipe).toHaveBeenCalledWith("card-draw", 7);

    // Verify manifest has 2 entries
    const writeFileCalls = (writeFile as Mock).mock.calls;
    const manifestCall = writeFileCalls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).endsWith("manifest.json"),
    );
    const manifestContent = JSON.parse(manifestCall![1] as string);
    expect(manifestContent).toHaveLength(2);
  });

  it("exports without category organisation", async () => {
    const session = setupSession(makeSelection("card-flip", 42));
    (input as Mock).mockResolvedValue("./flat-output");
    (confirm as Mock)
      .mockResolvedValueOnce(false) // no category organisation
      .mockResolvedValueOnce(true); // proceed

    const result = await runExportStage(session);
    expect(result).toBe("advance");

    // WAV file should be written directly in output root
    const writeFileCalls = (writeFile as Mock).mock.calls;
    const wavCall = writeFileCalls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).endsWith(".wav"),
    );
    expect(wavCall![0]).toBe("flat-output/card-flip_seed-00042.wav");
  });

  it("creates category subdirectories when byCategory is true", async () => {
    const session = setupSession(makeSelection("card-flip", 42));
    (input as Mock).mockResolvedValue("./cat-output");
    (confirm as Mock)
      .mockResolvedValueOnce(true) // category organisation
      .mockResolvedValueOnce(true); // proceed

    await runExportStage(session);

    // Should create category subdirectory
    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining("card-game"),
      { recursive: true },
    );
  });

  it("handles render failure gracefully", async () => {
    const session = setupSession(
      makeSelection("card-flip", 42),
      makeSelection("card-draw", 7),
    );
    // First render fails, second succeeds
    (renderRecipe as Mock)
      .mockRejectedValueOnce(new Error("Render timeout"))
      .mockResolvedValueOnce({
        samples: new Float32Array([0.1]),
        sampleRate: 44100,
        duration: 1.0,
        numberOfChannels: 1,
      });

    (input as Mock).mockResolvedValue("./test-output");
    (confirm as Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const result = await runExportStage(session);
    expect(result).toBe("advance");

    // Error message should name the recipe and seed
    expect(outputError).toHaveBeenCalledWith(
      expect.stringContaining("card-flip"),
    );
    expect(outputError).toHaveBeenCalledWith(
      expect.stringContaining("seed 42"),
    );
    expect(outputError).toHaveBeenCalledWith(
      expect.stringContaining("Render timeout"),
    );

    // Manifest should only have the successful entry
    const writeFileCalls = (writeFile as Mock).mock.calls;
    const manifestCall = writeFileCalls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).endsWith("manifest.json"),
    );
    const manifestContent = JSON.parse(manifestCall![1] as string);
    expect(manifestContent).toHaveLength(1);
    expect(manifestContent[0].recipe).toBe("card-draw");
  });

  it("saves export preferences to session", async () => {
    const session = setupSession(makeSelection("card-flip", 42));
    (input as Mock).mockResolvedValue("./my-custom-dir");
    (confirm as Mock)
      .mockResolvedValueOnce(false) // no category
      .mockResolvedValueOnce(true); // proceed

    await runExportStage(session);

    expect(session.exportDir).toBe("./my-custom-dir");
    expect(session.exportByCategory).toBe(false);
  });

  it("uses session's existing export dir as default", async () => {
    const session = setupSession(makeSelection("card-flip", 42));
    session.exportDir = "./previously-used";
    (input as Mock).mockResolvedValue("./previously-used");
    (confirm as Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await runExportStage(session);

    expect(input).toHaveBeenCalledWith(
      expect.objectContaining({ default: "./previously-used" }),
    );
  });

  it("displays progress feedback during export", async () => {
    const session = setupSession(
      makeSelection("card-flip", 42),
      makeSelection("card-draw", 7),
    );
    (input as Mock).mockResolvedValue("./test-output");
    (confirm as Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await runExportStage(session);

    expect(outputInfo).toHaveBeenCalledWith(
      expect.stringContaining('[1/2] Exporting "card-flip"'),
    );
    expect(outputInfo).toHaveBeenCalledWith(
      expect.stringContaining('[2/2] Exporting "card-draw"'),
    );
  });

  it("shows success summary on completion", async () => {
    const session = setupSession(makeSelection("card-flip", 42));
    (input as Mock).mockResolvedValue("./test-output");
    (confirm as Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await runExportStage(session);

    expect(outputSuccess).toHaveBeenCalledWith(
      expect.stringContaining("Palette export complete"),
    );
  });

  it("manifest.json is parseable by JSON.parse", async () => {
    const session = setupSession(makeSelection("card-flip", 42));
    (input as Mock).mockResolvedValue("./test-output");
    (confirm as Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await runExportStage(session);

    const writeFileCalls = (writeFile as Mock).mock.calls;
    const manifestCall = writeFileCalls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).endsWith("manifest.json"),
    );
    expect(manifestCall).toBeDefined();
    // Should not throw
    expect(() => JSON.parse(manifestCall![1] as string)).not.toThrow();
  });

  it("manifest entries have all required fields", async () => {
    const session = setupSession(
      makeSelection("card-flip", 42),
    );
    (input as Mock).mockResolvedValue("./test-output");
    (confirm as Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await runExportStage(session);

    const writeFileCalls = (writeFile as Mock).mock.calls;
    const manifestCall = writeFileCalls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).endsWith("manifest.json"),
    );
    const entries = JSON.parse(manifestCall![1] as string);
    for (const entry of entries) {
      expect(entry).toHaveProperty("recipe");
      expect(entry).toHaveProperty("seed");
      expect(entry).toHaveProperty("category");
      expect(entry).toHaveProperty("intensity");
      expect(entry).toHaveProperty("texture");
      expect(entry).toHaveProperty("tags");
      expect(entry).toHaveProperty("filename");
    }
  });

  it("handles all renders failing", async () => {
    const session = setupSession(makeSelection("card-flip", 42));
    (renderRecipe as Mock).mockRejectedValue(new Error("Audio error"));
    (input as Mock).mockResolvedValue("./test-output");
    (confirm as Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const result = await runExportStage(session);
    expect(result).toBe("advance");

    // Manifest should be empty
    const writeFileCalls = (writeFile as Mock).mock.calls;
    const manifestCall = writeFileCalls.find(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).endsWith("manifest.json"),
    );
    const manifestContent = JSON.parse(manifestCall![1] as string);
    expect(manifestContent).toHaveLength(0);

    // Should display error
    expect(outputError).toHaveBeenCalledWith(
      expect.stringContaining("card-flip"),
    );
  });
});
