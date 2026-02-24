import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promoteCandidate } from "../promote.js";
import { saveRunResult } from "../persistence.js";
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

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "toneforge-promote-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("promotes a candidate and writes WAV + metadata", async () => {
    const candidate = makeCandidate("impact-crack_seed-00042");
    const run = makeRun("run-promote-test", [candidate]);
    await saveRunResult(run, tempDir);

    const result = await promoteCandidate(
      "run-promote-test",
      "impact-crack_seed-00042",
      tempDir,
    );

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.candidateId).toBe("impact-crack_seed-00042");
    expect(result.libraryId).toBe("lib-impact-crack-42");

    // Verify WAV file exists
    expect(existsSync(result.wavPath)).toBe(true);

    // Verify metadata JSON exists and has expected fields
    expect(existsSync(result.metadataPath)).toBe(true);
    const metadata = JSON.parse(await readFile(result.metadataPath, "utf-8"));
    expect(metadata.libraryId).toBe("lib-impact-crack-42");
    expect(metadata.recipe).toBe("impact-crack");
    expect(metadata.seed).toBe(42);
    expect(metadata.params).toEqual({ freq: 440, gain: 0.9 });
  });

  it("marks the candidate as promoted in the run index", async () => {
    const candidate = makeCandidate("impact-crack_seed-00042");
    const run = makeRun("run-mark-test", [candidate]);
    await saveRunResult(run, tempDir);

    await promoteCandidate(
      "run-mark-test",
      "impact-crack_seed-00042",
      tempDir,
    );

    // Reload the run to verify the candidate was marked
    const { loadRunResult } = await import("../persistence.js");
    const updatedRun = await loadRunResult("run-mark-test", tempDir);
    const updatedCandidate = updatedRun!.candidates.find(
      (c) => c.id === "impact-crack_seed-00042",
    );
    expect(updatedCandidate!.promoted).toBe(true);
    expect(updatedCandidate!.libraryId).toBe("lib-impact-crack-42");
  });

  it("returns duplicate result for already-promoted candidate", async () => {
    const candidate = makeCandidate("impact-crack_seed-00042");
    candidate.promoted = true;
    candidate.libraryId = "lib-impact-crack-42";
    const run = makeRun("run-dup-test", [candidate]);
    await saveRunResult(run, tempDir);

    const result = await promoteCandidate(
      "run-dup-test",
      "impact-crack_seed-00042",
      tempDir,
    );

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(result.libraryId).toBe("lib-impact-crack-42");
  });

  it("throws for non-existent run", async () => {
    await expect(
      promoteCandidate("non-existent-run", "some-candidate", tempDir),
    ).rejects.toThrow("Run not found: non-existent-run");
  });

  it("throws for non-existent candidate in a valid run", async () => {
    const run = makeRun("run-no-candidate", []);
    await saveRunResult(run, tempDir);

    await expect(
      promoteCandidate("run-no-candidate", "missing-candidate", tempDir),
    ).rejects.toThrow(
      "Candidate 'missing-candidate' not found in run 'run-no-candidate'",
    );
  });

  it("writes to custom export directory when specified", async () => {
    const candidate = makeCandidate("impact-crack_seed-00042");
    const run = makeRun("run-export-test", [candidate]);
    await saveRunResult(run, tempDir);

    const exportDir = join(tempDir, "custom-export");

    const result = await promoteCandidate(
      "run-export-test",
      "impact-crack_seed-00042",
      tempDir,
      exportDir,
    );

    expect(result.wavPath).toContain("custom-export");
    expect(existsSync(result.wavPath)).toBe(true);
    expect(existsSync(result.metadataPath)).toBe(true);
  });
});
