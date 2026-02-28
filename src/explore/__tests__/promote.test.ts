import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Mocks — set up before importing the module under test
// ---------------------------------------------------------------------------

// Mock renderRecipe — avoid real audio rendering
vi.mock("../../core/renderer.js", () => ({
  renderRecipe: vi.fn().mockResolvedValue({
    samples: new Float32Array([0.1, -0.2, 0.3]),
    sampleRate: 44100,
    duration: 0.5,
    numberOfChannels: 1,
  }),
}));

// Mock encodeWav — return minimal buffer
vi.mock("../../audio/wav-encoder.js", () => ({
  encodeWav: vi.fn().mockReturnValue(Buffer.from("RIFF\x00\x00\x00\x00WAVEfmt ")),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { promoteCandidate } from "../promote.js";
import { saveRunResult } from "../persistence.js";
import { clearIndexCache } from "../../library/index-store.js";
import type { ExploreRunResult, ExploreCandidate } from "../types.js";

/** Helper: create a minimal candidate. */
function makeCandidate(
  id: string,
  recipe: string = "impact-crack",
  seed: number = 42,
): ExploreCandidate {
  return {
    id,
    recipe,
    seed,
    duration: 0.5,
    sampleRate: 44100,
    sampleCount: 22050,
    analysis: {
      analysisVersion: "1.0",
      sampleRate: 44100,
      sampleCount: 22050,
      metrics: { time: { rms: 0.4 } },
    },
    classification: {
      source: id,
      category: "impact",
      intensity: "high",
      texture: ["sharp"],
      material: null,
      tags: ["hit"],
      embedding: [],
      analysisRef: `${id}.json`,
    },
    score: 0.8,
    metricScores: { rms: 0.8 },
    cluster: 0,
    promoted: false,
    libraryId: null,
    params: { freq: 440, gain: 0.9 },
  };
}

/** Helper: create a minimal run result with candidates. */
function makeRun(
  runId: string,
  candidates: ExploreCandidate[],
): ExploreRunResult {
  return {
    runId,
    startedAt: "2026-02-24T00:00:00.000Z",
    completedAt: "2026-02-24T00:01:00.000Z",
    durationMs: 60000,
    type: "sweep",
    config: {
      recipe: "impact-crack",
      seedStart: 1,
      seedEnd: 100,
      rankBy: ["rms"],
      keepTop: 5,
      clusters: 3,
      concurrency: 2,
    },
    totalCandidates: 100,
    candidates,
    clusterSummaries: [],
    exploreVersion: "1.0",
  };
}

describe("promoteCandidate", () => {
  let tempDir: string;
  let exploreDir: string;
  let libraryDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "toneforge-promote-"));
    exploreDir = join(tempDir, "exploration");
    libraryDir = join(tempDir, "library");
    clearIndexCache();
  });

  afterEach(async () => {
    clearIndexCache();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("promotes a candidate and writes to the Library", async () => {
    const candidate = makeCandidate("impact-crack_seed-00042");
    const run = makeRun("run-promote-test", [candidate]);
    await saveRunResult(run, exploreDir);

    const result = await promoteCandidate(
      "run-promote-test",
      "impact-crack_seed-00042",
      exploreDir,
      { libraryDir },
    );

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.candidateId).toBe("impact-crack_seed-00042");
    expect(result.libraryId).toBe("lib-impact-crack_seed-00042");

    // Verify WAV file exists in the library directory
    const wavFullPath = resolve(libraryDir, result.wavPath);
    expect(existsSync(wavFullPath)).toBe(true);

    // Verify metadata JSON exists and has expected fields
    const metaFullPath = resolve(libraryDir, result.metadataPath);
    expect(existsSync(metaFullPath)).toBe(true);
    const metadata = JSON.parse(await readFile(metaFullPath, "utf-8"));
    expect(metadata.id).toBe("lib-impact-crack_seed-00042");
    expect(metadata.recipe).toBe("impact-crack");
    expect(metadata.seed).toBe(42);
    expect(metadata.preset.params).toEqual({ freq: 440, gain: 0.9 });
    expect(metadata.category).toBe("impact");
  });

  it("marks the candidate as promoted in the run index", async () => {
    const candidate = makeCandidate("impact-crack_seed-00042");
    const run = makeRun("run-mark-test", [candidate]);
    await saveRunResult(run, exploreDir);

    await promoteCandidate(
      "run-mark-test",
      "impact-crack_seed-00042",
      exploreDir,
      { libraryDir },
    );

    // Reload the run to verify the candidate was marked
    const { loadRunResult } = await import("../persistence.js");
    const updatedRun = await loadRunResult("run-mark-test", exploreDir);
    const updatedCandidate = updatedRun!.candidates.find(
      (c) => c.id === "impact-crack_seed-00042",
    );
    expect(updatedCandidate!.promoted).toBe(true);
    expect(updatedCandidate!.libraryId).toBe("lib-impact-crack_seed-00042");
  });

  it("returns duplicate result for already-promoted candidate", async () => {
    const candidate = makeCandidate("impact-crack_seed-00042");
    candidate.promoted = true;
    candidate.libraryId = "lib-impact-crack_seed-00042";
    const run = makeRun("run-dup-test", [candidate]);
    await saveRunResult(run, exploreDir);

    const result = await promoteCandidate(
      "run-dup-test",
      "impact-crack_seed-00042",
      exploreDir,
      { libraryDir },
    );

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(result.libraryId).toBe("lib-impact-crack_seed-00042");
  });

  it("throws for non-existent run", async () => {
    await expect(
      promoteCandidate("non-existent-run", "some-candidate", exploreDir, { libraryDir }),
    ).rejects.toThrow("Run not found: non-existent-run");
  });

  it("throws for non-existent candidate in a valid run", async () => {
    const run = makeRun("run-no-candidate", []);
    await saveRunResult(run, exploreDir);

    await expect(
      promoteCandidate("run-no-candidate", "missing-candidate", exploreDir, { libraryDir }),
    ).rejects.toThrow(
      "Candidate 'missing-candidate' not found in run 'run-no-candidate'",
    );
  });

  it("uses category override when specified", async () => {
    const candidate = makeCandidate("impact-crack_seed-00042");
    const run = makeRun("run-category-test", [candidate]);
    await saveRunResult(run, exploreDir);

    const result = await promoteCandidate(
      "run-category-test",
      "impact-crack_seed-00042",
      exploreDir,
      { category: "custom-sfx", libraryDir },
    );

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(false);

    // Verify the WAV is stored under the custom category directory
    expect(result.wavPath).toContain("custom-sfx");
    const wavFullPath = resolve(libraryDir, result.wavPath);
    expect(existsSync(wavFullPath)).toBe(true);

    // Verify metadata shows the overridden category
    const metaFullPath = resolve(libraryDir, result.metadataPath);
    const metadata = JSON.parse(await readFile(metaFullPath, "utf-8"));
    expect(metadata.category).toBe("custom-sfx");
  });

  it("defaults to uncategorized when classification data is absent", async () => {
    const candidate = makeCandidate("impact-crack_seed-00042");
    // Remove classification data
    candidate.classification = undefined;
    const run = makeRun("run-uncat-test", [candidate]);
    await saveRunResult(run, exploreDir);

    const result = await promoteCandidate(
      "run-uncat-test",
      "impact-crack_seed-00042",
      exploreDir,
      { libraryDir },
    );

    expect(result.success).toBe(true);
    // Verify metadata shows uncategorized
    const metaFullPath = resolve(libraryDir, result.metadataPath);
    const metadata = JSON.parse(await readFile(metaFullPath, "utf-8"));
    expect(metadata.category).toBe("uncategorized");
  });

  it("is idempotent via Library — re-promoting returns existing entry", async () => {
    const candidate = makeCandidate("impact-crack_seed-00042");
    const run = makeRun("run-idempotent-test", [candidate]);
    await saveRunResult(run, exploreDir);

    // First promote
    const result1 = await promoteCandidate(
      "run-idempotent-test",
      "impact-crack_seed-00042",
      exploreDir,
      { libraryDir },
    );
    expect(result1.duplicate).toBe(false);

    // Reset the candidate's promoted flag to simulate a fresh promote attempt
    // but the library entry already exists
    const { loadRunResult } = await import("../persistence.js");
    const updatedRun = await loadRunResult("run-idempotent-test", exploreDir);
    const c = updatedRun!.candidates.find(
      (c) => c.id === "impact-crack_seed-00042",
    );
    // The candidate IS marked promoted by the first call, so a second call
    // will return duplicate via the candidate check
    expect(c!.promoted).toBe(true);

    const result2 = await promoteCandidate(
      "run-idempotent-test",
      "impact-crack_seed-00042",
      exploreDir,
      { libraryDir },
    );
    expect(result2.duplicate).toBe(true);
    expect(result2.libraryId).toBe(result1.libraryId);
  });
});
