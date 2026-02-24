/**
 * Promote Integration
 *
 * Promotes exploration candidates into the persistent Library
 * by writing canonical audio (WAV) and metadata (JSON) to the
 * library directory.
 *
 * The Library (TF-0MLXF8A901W1Y176) is not yet implemented, so
 * promotion writes to a local `.exploration/promoted/` directory
 * as a staging area. When the Library is available, this module
 * will integrate with its import API.
 *
 * Reference: docs/prd/EXPLORE_PRD.md Section 8
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderRecipe } from "../core/renderer.js";
import { encodeWav } from "../audio/wav-encoder.js";
import type { ExploreCandidate, ExploreRunResult } from "./types.js";
import { loadRunResult, saveRunResult } from "./persistence.js";

/** Default directory for promoted entries. */
const DEFAULT_PROMOTED_DIR = ".exploration/promoted";

/**
 * Result of a promote operation.
 */
export interface PromoteResult {
  /** Whether the promotion was successful. */
  success: boolean;

  /** Candidate ID that was promoted. */
  candidateId: string;

  /** Library entry ID (placeholder until Library is implemented). */
  libraryId: string;

  /** Path to the promoted WAV file. */
  wavPath: string;

  /** Path to the promoted metadata JSON. */
  metadataPath: string;

  /** Whether this was a duplicate (already promoted). */
  duplicate: boolean;
}

/**
 * Promote a candidate from an exploration run to the library.
 *
 * 1. Finds the candidate in the run result
 * 2. Re-renders the audio deterministically
 * 3. Writes WAV + metadata JSON to the promoted directory
 * 4. Marks the candidate as promoted in the run index
 *
 * If the candidate is already promoted, returns a duplicate result.
 *
 * @param runId - ID of the exploration run containing the candidate.
 * @param candidateId - ID of the candidate to promote.
 * @param baseDir - Base directory for exploration data.
 * @param exportDir - Optional directory for exported files.
 * @returns PromoteResult with paths and status.
 */
export async function promoteCandidate(
  runId: string,
  candidateId: string,
  baseDir: string = ".exploration",
  exportDir?: string,
): Promise<PromoteResult> {
  // Load the run result
  const run = await loadRunResult(runId, baseDir);
  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  // Find the candidate
  const candidate = run.candidates.find((c) => c.id === candidateId);
  if (!candidate) {
    throw new Error(
      `Candidate '${candidateId}' not found in run '${runId}'`,
    );
  }

  // Check for duplicate promotion
  if (candidate.promoted && candidate.libraryId) {
    return {
      success: true,
      candidateId,
      libraryId: candidate.libraryId,
      wavPath: "",
      metadataPath: "",
      duplicate: true,
    };
  }

  // Generate a library ID
  const libraryId = `lib-${candidate.recipe}-${candidate.seed}`;

  // Determine output directory
  const promoteDir = resolve(exportDir ?? resolve(baseDir, "promoted"));
  await mkdir(promoteDir, { recursive: true });

  // Re-render the audio deterministically
  const renderResult = await renderRecipe(candidate.recipe, candidate.seed);
  const wavBuffer = encodeWav(renderResult.samples, {
    sampleRate: renderResult.sampleRate,
  });

  // Write WAV file
  const wavPath = resolve(promoteDir, `${candidate.id}.wav`);
  await writeFile(wavPath, wavBuffer);

  // Write metadata JSON
  const metadata = {
    libraryId,
    candidateId: candidate.id,
    recipe: candidate.recipe,
    seed: candidate.seed,
    duration: candidate.duration,
    sampleRate: candidate.sampleRate,
    params: candidate.params,
    analysis: candidate.analysis,
    classification: candidate.classification ?? null,
    score: candidate.score,
    metricScores: candidate.metricScores,
    cluster: candidate.cluster,
    runId,
    promotedAt: new Date().toISOString(),
  };

  const metadataPath = resolve(promoteDir, `${candidate.id}.json`);
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  // Update the candidate in the run index
  candidate.promoted = true;
  candidate.libraryId = libraryId;

  // Persist the updated run
  await saveRunResult(run, baseDir);

  return {
    success: true,
    candidateId,
    libraryId,
    wavPath,
    metadataPath,
    duplicate: false,
  };
}
