/**
 * Library Regenerate -- Re-render from Preset
 *
 * Re-renders a Library entry from its stored preset (recipe + seed)
 * and replaces the stored WAV file. Supports verification that
 * presets remain valid and re-rendering with updated ToneForge code.
 *
 * Reference: docs/prd/LIBRARY_PRD.md Section 9
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderRecipe } from "../core/renderer.js";
import { encodeWav } from "../audio/wav-encoder.js";
import type { LibraryEntry } from "./types.js";
import { DEFAULT_LIBRARY_DIR } from "./types.js";
import { getFromIndex, loadIndex, saveIndex } from "./index-store.js";

/**
 * Result of a regenerate operation.
 */
export interface RegenerateResult {
  /** Whether the regeneration was successful. */
  success: boolean;

  /** The entry ID that was regenerated. */
  entryId: string;

  /** Path to the regenerated WAV file. */
  wavPath: string;

  /** ISO timestamp of when the regeneration occurred. */
  regeneratedAt: string;
}

/**
 * Regenerate a Library entry from its stored preset.
 *
 * 1. Looks up the entry by ID
 * 2. Re-renders using renderRecipe(recipe, seed)
 * 3. Encodes to WAV
 * 4. Replaces the stored WAV file
 * 5. Updates the index with a regeneratedAt timestamp
 *
 * Does not perform checksum comparison -- simply re-renders and replaces.
 *
 * @param id - The entry ID to regenerate.
 * @param baseDir - Base directory for library storage.
 * @returns RegenerateResult with success status and file path.
 * @throws Error if the entry ID is not found.
 */
export async function regenerateEntry(
  id: string,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<RegenerateResult> {
  // Look up the entry
  const entry = await getFromIndex(id, baseDir);
  if (!entry) {
    throw new Error(`Library entry not found: ${id}`);
  }

  // Re-render the audio from the stored preset
  const renderResult = await renderRecipe(entry.preset.recipe, entry.preset.seed);
  const wavBuffer = encodeWav(renderResult.samples, {
    sampleRate: renderResult.sampleRate,
  });

  // Replace the stored WAV file
  const wavPath = resolve(baseDir, entry.files.wav);
  await writeFile(wavPath, wavBuffer);

  // Update the index entry with regeneratedAt timestamp
  const regeneratedAt = new Date().toISOString();
  const index = await loadIndex(baseDir);
  const indexEntry = index.entries.find((e) => e.id === id);
  if (indexEntry) {
    (indexEntry as LibraryEntry & { regeneratedAt?: string }).regeneratedAt =
      regeneratedAt;
    await saveIndex(index, baseDir);
  }

  return {
    success: true,
    entryId: id,
    wavPath,
    regeneratedAt,
  };
}
