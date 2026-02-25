/**
 * Library Search -- Attribute Queries
 *
 * Filters Library entries by attribute queries (intensity, texture,
 * tags, category) using AND logic. Mirrors the classify search
 * filter design for CLI consistency.
 *
 * Reference: docs/prd/LIBRARY_PRD.md Section 8
 */

import type { LibraryEntry } from "./types.js";
import { loadIndex } from "./index-store.js";
import { DEFAULT_LIBRARY_DIR } from "./types.js";

/**
 * Search query for attribute-based filtering.
 */
export interface SearchQuery {
  /** Filter by category (exact match, case-insensitive). */
  category?: string;

  /** Filter by intensity (exact match, case-insensitive). */
  intensity?: string;

  /** Filter by texture (partial/substring match, case-insensitive). */
  texture?: string;

  /** Filter by tags (AND logic -- entry must contain all, case-insensitive). */
  tags?: string[];
}

/**
 * Search the Library index by attribute queries.
 *
 * All specified filters are combined with AND logic. Empty query
 * returns all entries. Results are sorted by ID for deterministic output.
 *
 * Filter behavior:
 * - category: exact match (case-insensitive)
 * - intensity: exact match against classification.intensity (case-insensitive)
 * - texture: substring match against any classification.texture entry (case-insensitive)
 * - tags: AND logic -- all specified tags must be present on the entry (case-insensitive)
 *
 * @param query - Attribute filter criteria.
 * @param baseDir - Base directory for library storage.
 * @returns Matching entries sorted by ID.
 */
export async function searchEntries(
  query: SearchQuery,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<LibraryEntry[]> {
  const index = await loadIndex(baseDir);

  const matches = index.entries.filter((entry) => {
    // Category: exact match (case-insensitive)
    if (query.category !== undefined) {
      if (entry.category.toLowerCase() !== query.category.toLowerCase()) {
        return false;
      }
    }

    // Intensity: exact match against classification.intensity (case-insensitive)
    if (query.intensity !== undefined) {
      const entryIntensity = entry.classification?.intensity;
      if (!entryIntensity) return false;
      if (entryIntensity.toLowerCase() !== query.intensity.toLowerCase()) {
        return false;
      }
    }

    // Texture: substring match against any classification.texture entry (case-insensitive)
    if (query.texture !== undefined) {
      const textures = entry.classification?.texture ?? [];
      const queryTexture = query.texture.toLowerCase();
      const hasMatch = textures.some(
        (t) => t.toLowerCase().includes(queryTexture),
      );
      if (!hasMatch) return false;
    }

    // Tags: AND logic -- all specified tags must be present (case-insensitive)
    if (query.tags && query.tags.length > 0) {
      const entryTagsLower = entry.tags.map((t) => t.toLowerCase());
      const allPresent = query.tags.every(
        (tag) => entryTagsLower.includes(tag.toLowerCase()),
      );
      if (!allPresent) return false;
    }

    return true;
  });

  // Sort by ID for deterministic output
  return matches.sort((a, b) => a.id.localeCompare(b.id));
}
