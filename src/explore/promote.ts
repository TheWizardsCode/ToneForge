/**
 * Promote Integration
 *
 * Promotes exploration candidates directly into the persistent Library
 * by re-rendering audio and writing to `.toneforge-library/` via the
 * Library module's `addEntry()` function.
 *
 * This replaces the previous staging-area approach that wrote to
 * `.exploration/promoted/`.
 *
 * Reference: docs/prd/EXPLORE_PRD.md Section 8
 * Reference: docs/prd/LIBRARY_PRD.md Sections 4-7
 */

import { renderRecipe } from "../core/renderer.js";
import { encodeWav } from "../audio/wav-encoder.js";
import type { ExploreCandidate, ExploreRunResult } from "./types.js";
import { loadRunResult, saveRunResult } from "./persistence.js";
import { addEntry, entryId } from "../library/storage.js";
import { DEFAULT_LIBRARY_DIR } from "../library/types.js";

/**
 * Result of a promote operation.
 */
export interface PromoteResult {
  /** Whether the promotion was successful. */
  success: boolean;

  /** Candidate ID that was promoted. */
  candidateId: string;

  /** Library entry ID (`lib-<candidateId>`). */
  libraryId: string;

  /** Path to the library WAV file (relative to library root). */
  wavPath: string;

  /** Path to the library metadata JSON (relative to library root). */
  metadataPath: string;

  /** Whether this was a duplicate (already promoted). */
  duplicate: boolean;
}

/**
 * Options for the promote operation.
 */
export interface PromoteOptions {
  /** Override the classification-derived category. */
  category?: string;

  /** Base directory for library storage. */
  libraryDir?: string;
}

/**
 * Promote a candidate from an exploration run to the Library.
 *
 * 1. Finds the candidate in the run result
 * 2. Re-renders the audio deterministically
 * 3. Writes WAV + metadata to the Library via addEntry()
 * 4. Marks the candidate as promoted in the run index
 *
 * If the candidate is already promoted, returns a duplicate result.
 *
 * @param runId - ID of the exploration run containing the candidate.
 * @param candidateId - ID of the candidate to promote.
 * @param baseDir - Base directory for exploration data.
 * @param options - Promote options (category override, library dir).
 * @returns PromoteResult with paths and status.
 */
export async function promoteCandidate(
  runId: string,
  candidateId: string,
  baseDir: string = ".exploration",
  options?: PromoteOptions,
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

  // Compute the library ID
  const libId = entryId(candidateId);

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

  const libraryDir = options?.libraryDir ?? DEFAULT_LIBRARY_DIR;

  // Re-render the audio deterministically
  const renderResult = await renderRecipe(candidate.recipe, candidate.seed);
  const wavBuffer = encodeWav(renderResult.samples, {
    sampleRate: renderResult.sampleRate,
  });

  // Write to the Library via addEntry()
  const entry = await addEntry(
    candidate,
    wavBuffer,
    libraryDir,
    { categoryOverride: options?.category },
  );

  // Update the candidate in the run index
  candidate.promoted = true;
  candidate.libraryId = entry.id;

  // Persist the updated run
  await saveRunResult(run, baseDir);

  return {
    success: true,
    candidateId,
    libraryId: entry.id,
    wavPath: entry.files.wav,
    metadataPath: entry.files.metadata,
    duplicate: false,
  };
}
