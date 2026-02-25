/**
 * Library Export -- WAV by Category
 *
 * Copies Library WAV files to an output directory organized by
 * category. Preserves file integrity via copy (not re-encode).
 *
 * Reference: docs/prd/LIBRARY_PRD.md Section 10
 */

import { mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { LibraryEntry } from "./types.js";
import { DEFAULT_LIBRARY_DIR } from "./types.js";
import { listFromIndex } from "./index-store.js";

/**
 * Options for export operations.
 */
export interface ExportOptions {
  /** Filter by category (exports only this category). */
  category?: string;

  /** Output directory for exported files. */
  outputDir: string;

  /** Format (currently only "wav" is supported). */
  format: "wav";
}

/**
 * Result of an export operation.
 */
export interface ExportResult {
  /** Number of files exported. */
  count: number;

  /** Output directory where files were written. */
  outputDir: string;

  /** Exported file paths relative to outputDir. */
  files: string[];

  /** Entries that were skipped (missing WAV file on disk). */
  skipped: string[];
}

/**
 * Export Library entries as WAV files organized by category.
 *
 * Copies WAV files from the Library to the specified output directory,
 * preserving the category-based directory structure.
 *
 * If `--category` is specified, exports only that category.
 * Otherwise exports all entries.
 *
 * @param options - Export options (outputDir, category, format).
 * @param baseDir - Base directory for library storage.
 * @returns ExportResult with count and file paths.
 */
export async function exportEntries(
  options: ExportOptions,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<ExportResult> {
  const filter = options.category ? { category: options.category } : undefined;
  const entries = await listFromIndex(filter, baseDir);

  const outputDir = resolve(options.outputDir);
  const files: string[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    const srcPath = resolve(baseDir, entry.files.wav);

    // Skip entries whose WAV file doesn't exist on disk
    if (!existsSync(srcPath)) {
      skipped.push(entry.id);
      continue;
    }

    // Create category subdirectory in output
    const categoryDir = join(outputDir, entry.category);
    await mkdir(categoryDir, { recursive: true });

    // Copy WAV file
    const destFileName = `${entry.id}.wav`;
    const destPath = join(categoryDir, destFileName);
    await copyFile(srcPath, destPath);

    files.push(join(entry.category, destFileName));
  }

  return {
    count: files.length,
    outputDir,
    files,
    skipped,
  };
}
