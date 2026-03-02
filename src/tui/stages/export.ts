/**
 * TUI Wizard Stage 4 -- Export.
 *
 * Promotes selected candidates to the library, renders audio,
 * exports WAV files to a user-specified output directory with
 * optional category organisation, and writes a manifest.json
 * alongside the exported audio.
 *
 * Reference: Work item TF-0MM8S2LKQ1WM38F4
 * Parent epic: TF-0MM7HULM506CGSOP
 */

import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { input, confirm } from "@inquirer/prompts";
import { renderRecipe } from "../../core/renderer.js";
import { encodeWav } from "../../audio/wav-encoder.js";
import { addEntry } from "../../library/storage.js";
import { outputInfo, outputError, outputSuccess } from "../../output.js";
import type { WizardSession } from "../state.js";
import type { CandidateSelection } from "../types.js";
import { getOrderedSelections } from "./review.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single entry in the exported manifest.json.
 *
 * Contains the metadata needed to identify and use each exported WAV
 * in a game project.
 */
export interface ManifestJsonEntry {
  /** Recipe name used to generate the sound. */
  recipe: string;

  /** Seed used for deterministic generation. */
  seed: number;

  /** Sound category from classification. */
  category: string;

  /** Intensity level from classification. */
  intensity: string;

  /** Texture descriptors from classification. */
  texture: string[];

  /** Contextual tags from classification. */
  tags: string[];

  /** Relative filename within the output directory. */
  filename: string;
}

/**
 * Result of a single export operation (one selection).
 */
export interface SingleExportResult {
  /** Whether the export succeeded. */
  success: boolean;

  /** Recipe name. */
  recipe: string;

  /** Seed number. */
  seed: number;

  /** Relative filename within the output directory (if successful). */
  filename: string;

  /** Error message (if failed). */
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default output directory suggested to the user. */
const DEFAULT_OUTPUT_DIR = "./palette-export";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testability)
// ---------------------------------------------------------------------------

/**
 * Build the relative filename for an exported WAV file.
 *
 * When byCategory is true, the file is placed in a category
 * subdirectory (e.g. "card-game/card-flip_seed-00042.wav").
 * Otherwise it is placed directly in the output root.
 *
 * @param recipe - Recipe name.
 * @param seed - Seed number.
 * @param category - Sound category.
 * @param byCategory - Whether to organise by category subdirectory.
 * @returns Relative filename within the output directory.
 */
export function buildExportFilename(
  recipe: string,
  seed: number,
  category: string,
  byCategory: boolean,
): string {
  const baseName = `${recipe}_seed-${String(seed).padStart(5, "0")}.wav`;
  return byCategory ? join(category, baseName) : baseName;
}

/**
 * Build a manifest entry for a single selection.
 *
 * @param selection - The candidate selection.
 * @param filename - The relative filename in the output directory.
 * @returns A ManifestJsonEntry.
 */
export function buildManifestEntry(
  selection: CandidateSelection,
  filename: string,
): ManifestJsonEntry {
  return {
    recipe: selection.recipe,
    seed: selection.candidate.seed,
    category: selection.classification.category || "uncategorized",
    intensity: selection.classification.intensity || "unknown",
    texture: [...(selection.classification.texture ?? [])],
    tags: [...(selection.classification.tags ?? [])],
    filename,
  };
}

/**
 * Build the complete manifest JSON object for all selections.
 *
 * @param selections - Ordered list of candidate selections.
 * @param byCategory - Whether files are organised by category.
 * @returns Array of ManifestJsonEntry objects.
 */
export function buildManifestJson(
  selections: CandidateSelection[],
  byCategory: boolean,
): ManifestJsonEntry[] {
  return selections.map((sel) => {
    const filename = buildExportFilename(
      sel.recipe,
      sel.candidate.seed,
      sel.classification.category || "uncategorized",
      byCategory,
    );
    return buildManifestEntry(sel, filename);
  });
}

/**
 * Format a progress feedback line during export.
 *
 * @param current - 1-based index of the current item.
 * @param total - Total number of items to export.
 * @param recipe - Recipe name being exported.
 * @returns Formatted progress string.
 */
export function formatExportProgress(
  current: number,
  total: number,
  recipe: string,
): string {
  return `  [${current}/${total}] Exporting "${recipe}"...`;
}

/**
 * Format the export summary message.
 *
 * @param exported - Number of successfully exported files.
 * @param failed - Number of failed exports.
 * @param outputDir - The output directory path.
 * @returns Formatted summary string.
 */
export function formatExportSummary(
  exported: number,
  failed: number,
  outputDir: string,
): string {
  const parts: string[] = [];
  parts.push(
    `\nExported ${exported} WAV file${exported === 1 ? "" : "s"} to ${outputDir}`,
  );
  if (failed > 0) {
    parts.push(
      `  ${failed} file${failed === 1 ? "" : "s"} failed to export (see errors above)`,
    );
  }
  parts.push(`  Manifest written to ${join(outputDir, "manifest.json")}`);
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Interactive flow
// ---------------------------------------------------------------------------

/**
 * Run the Export stage.
 *
 * Prompts for an output directory and category organisation preference,
 * then renders, encodes, promotes, and exports each selection as a WAV
 * file. Writes a manifest.json alongside the exported audio.
 *
 * @param session - Wizard session with confirmed palette selections.
 * @returns "advance" when export completes, or "back" to return to Review.
 */
export async function runExportStage(
  session: WizardSession,
): Promise<"advance" | "back"> {
  const selections = getOrderedSelections(session);

  if (selections.length === 0) {
    outputInfo("  No selections to export. Returning to Review stage.\n");
    return "back";
  }

  // Prompt for output directory
  const outputDir = await input({
    message: "Output directory:",
    default: session.exportDir ?? DEFAULT_OUTPUT_DIR,
  });

  // Prompt for category organisation
  const byCategory = await confirm({
    message: "Organise files by category subdirectories?",
    default: session.exportByCategory,
  });

  // Save preferences to session
  session.exportDir = outputDir;
  session.exportByCategory = byCategory;

  // Confirm before proceeding
  const proceed = await confirm({
    message: `Export ${selections.length} sound${selections.length === 1 ? "" : "s"} to "${outputDir}"?`,
    default: true,
  });

  if (!proceed) {
    return "back";
  }

  // Create output directory
  await mkdir(outputDir, { recursive: true });

  // Export each selection
  const results: SingleExportResult[] = [];
  const total = selections.length;

  for (let i = 0; i < total; i++) {
    const sel = selections[i]!;
    const idx = i + 1;

    outputInfo(formatExportProgress(idx, total, sel.recipe));

    try {
      // 1. Re-render the audio deterministically
      const renderResult = await renderRecipe(sel.recipe, sel.candidate.seed);

      // 2. Encode as WAV
      const wavBuffer = encodeWav(renderResult.samples, {
        sampleRate: renderResult.sampleRate,
      });

      // 3. Promote to library (idempotent -- safe to call multiple times)
      await addEntry(sel.candidate, wavBuffer);

      // 4. Build output filename and write WAV to output directory
      const category = sel.classification.category || "uncategorized";
      const filename = buildExportFilename(
        sel.recipe,
        sel.candidate.seed,
        category,
        byCategory,
      );

      const fullPath = join(outputDir, filename);

      // Ensure subdirectory exists (for category-organised layout)
      if (byCategory) {
        await mkdir(join(outputDir, category), { recursive: true });
      }

      await writeFile(fullPath, wavBuffer);

      results.push({
        success: true,
        recipe: sel.recipe,
        seed: sel.candidate.seed,
        filename,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      outputError(
        `  Failed to export "${sel.recipe}" (seed ${sel.candidate.seed}): ${message}`,
      );
      results.push({
        success: false,
        recipe: sel.recipe,
        seed: sel.candidate.seed,
        filename: "",
        error: message,
      });
    }
  }

  // 5. Write manifest.json
  const successfulResults = results.filter((r) => r.success);
  const manifestEntries = successfulResults.map((r) => {
    const sel = selections.find((s) => s.recipe === r.recipe)!;
    return buildManifestEntry(sel, r.filename);
  });

  const manifestPath = join(outputDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifestEntries, null, 2));

  // 6. Display summary
  const exported = successfulResults.length;
  const failed = results.length - exported;
  const summary = formatExportSummary(exported, failed, outputDir);

  if (failed > 0) {
    outputInfo(summary + "\n");
  } else {
    outputSuccess(summary + "\n");
  }

  outputSuccess("\nPalette export complete! Your sounds are ready to use.\n");

  return "advance";
}
