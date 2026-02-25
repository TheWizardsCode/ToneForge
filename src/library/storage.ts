/**
 * Library Storage
 *
 * High-level storage operations that coordinate file-system writes
 * (WAV + metadata JSON) with the index store. Provides the primary
 * public API for adding, retrieving, and listing library entries.
 *
 * Storage layout:
 *   .toneforge-library/
 *     index.json
 *     <category>/
 *       <id>.wav
 *       <id>.json
 *
 * Reference: docs/prd/LIBRARY_PRD.md Sections 5-6
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { ExploreCandidate } from "../explore/types.js";
import type { LibraryEntry, LibraryFilter, LibraryPreset, LibraryFiles } from "./types.js";
import { DEFAULT_LIBRARY_DIR } from "./types.js";
import { VERSION } from "../index.js";
import {
  addToIndex,
  getFromIndex,
  listFromIndex,
  removeFromIndex,
  loadIndex,
} from "./index-store.js";

/**
 * Derive the library entry ID from a candidate ID.
 *
 * Format: `lib-<candidateId>`
 */
export function entryId(candidateId: string): string {
  return `lib-${candidateId}`;
}

/**
 * Derive the category for a library entry from classification data.
 *
 * Uses the classification category if present, otherwise falls back
 * to "uncategorized".
 */
function deriveCategory(candidate: ExploreCandidate): string {
  return candidate.classification?.category ?? "uncategorized";
}

/**
 * Derive tags for a library entry from classification data.
 *
 * Combines classification tags with texture descriptors.
 */
function deriveTags(candidate: ExploreCandidate): string[] {
  const tags: string[] = [];
  if (candidate.classification) {
    if (candidate.classification.tags) {
      tags.push(...candidate.classification.tags);
    }
    if (candidate.classification.texture) {
      for (const t of candidate.classification.texture) {
        if (!tags.includes(t)) tags.push(t);
      }
    }
  }
  return tags;
}

/**
 * Build the relative file paths for an entry's assets.
 */
function buildFilePaths(category: string, id: string): LibraryFiles {
  return {
    wav: join(category, `${id}.wav`),
    metadata: join(category, `${id}.json`),
  };
}

/**
 * Options for building a library entry.
 */
export interface BuildEntryOptions {
  /** Override the derived category. */
  categoryOverride?: string;
}

/**
 * Build a LibraryEntry from an ExploreCandidate.
 *
 * Does not write any files -- this is a pure data transformation.
 *
 * @param candidate - The exploration candidate.
 * @param options - Optional build options (category override).
 */
export function buildEntry(
  candidate: ExploreCandidate,
  options?: BuildEntryOptions,
): LibraryEntry {
  const id = entryId(candidate.id);
  const category = options?.categoryOverride ?? deriveCategory(candidate);
  const tags = deriveTags(candidate);
  const files = buildFilePaths(category, id);

  const preset: LibraryPreset = {
    recipe: candidate.recipe,
    seed: candidate.seed,
    params: { ...candidate.params },
  };

  return {
    id,
    recipe: candidate.recipe,
    seed: candidate.seed,
    category,
    duration: candidate.duration,
    tags,
    analysis: candidate.analysis,
    classification: candidate.classification ?? null,
    preset,
    provenance: {
      toneforgeVersion: VERSION,
    },
    files,
    promotedAt: new Date().toISOString(),
  };
}

/**
 * Options for adding an entry to the library.
 */
export interface AddEntryOptions {
  /** Override the derived category. */
  categoryOverride?: string;
}

/**
 * Add a candidate to the library.
 *
 * 1. Builds the LibraryEntry from the candidate
 * 2. Writes WAV audio to the category directory
 * 3. Writes metadata JSON alongside the WAV
 * 4. Adds the entry to the index
 *
 * If an entry with the same ID already exists (idempotent), returns
 * the existing entry without writing any files.
 *
 * @param candidate - The exploration candidate to add.
 * @param wavData - The WAV file contents as a Buffer.
 * @param baseDir - Base directory for library storage.
 * @param options - Optional add options (category override).
 * @returns The created or existing library entry.
 */
export async function addEntry(
  candidate: ExploreCandidate,
  wavData: Buffer,
  baseDir: string = DEFAULT_LIBRARY_DIR,
  options?: AddEntryOptions,
): Promise<LibraryEntry> {
  const id = entryId(candidate.id);

  // Check for idempotent duplicate
  const existing = await getFromIndex(id, baseDir);
  if (existing) return existing;

  const entry = buildEntry(candidate, {
    categoryOverride: options?.categoryOverride,
  });

  // Create the category directory
  const categoryDir = resolve(baseDir, entry.category);
  await mkdir(categoryDir, { recursive: true });

  // Write WAV file
  const wavPath = resolve(baseDir, entry.files.wav);
  await writeFile(wavPath, wavData);

  // Write metadata JSON (entry without the files field duplicated)
  const metadataPath = resolve(baseDir, entry.files.metadata);
  await writeFile(metadataPath, JSON.stringify(entry, null, 2));

  // Add to index
  await addToIndex(entry, baseDir);

  return entry;
}

/**
 * Retrieve a library entry by ID.
 *
 * @param id - The entry ID (e.g. "lib-creature_seed-4821").
 * @param baseDir - Base directory for library storage.
 * @returns The entry, or null if not found.
 */
export async function getEntry(
  id: string,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<LibraryEntry | null> {
  return getFromIndex(id, baseDir);
}

/**
 * List library entries, optionally filtered.
 *
 * @param filter - Optional filter criteria (category, recipe, tags).
 * @param baseDir - Base directory for library storage.
 * @returns Array of matching entries.
 */
export async function listEntries(
  filter?: LibraryFilter,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<LibraryEntry[]> {
  return listFromIndex(filter, baseDir);
}

/**
 * Remove a library entry by ID.
 *
 * Removes the entry from the index. Does NOT delete the on-disk
 * WAV and metadata files (preserves data safety).
 *
 * @param id - The entry ID to remove.
 * @param baseDir - Base directory for library storage.
 * @returns True if the entry was found and removed, false otherwise.
 */
export async function removeEntry(
  id: string,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<boolean> {
  return removeFromIndex(id, baseDir);
}

/**
 * Get the total count of entries in the library.
 *
 * @param baseDir - Base directory for library storage.
 * @returns Number of entries.
 */
export async function countEntries(
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<number> {
  const index = await loadIndex(baseDir);
  return index.entries.length;
}

/**
 * Read the metadata JSON for an entry from disk.
 *
 * @param entry - The library entry whose metadata to read.
 * @param baseDir - Base directory for library storage.
 * @returns The parsed metadata object.
 */
export async function readEntryMetadata(
  entry: LibraryEntry,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<LibraryEntry> {
  const metadataPath = resolve(baseDir, entry.files.metadata);
  const content = await readFile(metadataPath, "utf-8");
  return JSON.parse(content) as LibraryEntry;
}

/**
 * Check whether a WAV file exists on disk for an entry.
 *
 * @param entry - The library entry to check.
 * @param baseDir - Base directory for library storage.
 * @returns True if the WAV file exists.
 */
export function entryWavExists(
  entry: LibraryEntry,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): boolean {
  return existsSync(resolve(baseDir, entry.files.wav));
}
