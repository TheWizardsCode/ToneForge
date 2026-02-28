/**
 * Library Similarity -- Embedding Distance
 *
 * Ranks Library entries by perceptual similarity using Euclidean
 * distance on pre-normalized classification embedding vectors,
 * with tag/label Jaccard overlap as tiebreaker.
 *
 * Embedding vectors are produced by the active EmbeddingProvider
 * during classification (7-dim by default). Entries without
 * embeddings are excluded with a stderr warning.
 *
 * Reference: docs/prd/LIBRARY_PRD.md Section 8.2
 */

import type { LibraryEntry } from "./types.js";
import { loadIndex } from "./index-store.js";
import { DEFAULT_LIBRARY_DIR } from "./types.js";

/**
 * Result of a similarity query for a single entry.
 */
export interface SimilarityResult {
  /** The matching library entry. */
  entry: LibraryEntry;

  /** Combined distance score (lower = more similar). */
  distance: number;

  /** Euclidean embedding distance component. */
  metricDistance: number;

  /** Jaccard tag similarity (0-1, higher = more similar). */
  tagSimilarity: number;
}

/**
 * Options for similarity search.
 */
export interface SimilarityOptions {
  /** Maximum number of results to return. Default: 10. */
  limit?: number;
}

/**
 * Check whether an entry has a usable embedding vector.
 *
 * An embedding is usable when the classification exists and
 * the embedding array has at least one element.
 */
function hasEmbedding(entry: LibraryEntry): boolean {
  return (
    entry.classification !== null &&
    entry.classification !== undefined &&
    Array.isArray(entry.classification.embedding) &&
    entry.classification.embedding.length > 0
  );
}

/**
 * Compute Euclidean distance between two vectors.
 */
function euclidean(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Compute Jaccard similarity between two tag sets.
 *
 * Jaccard = |intersection| / |union|
 * Returns 0 if both sets are empty.
 */
function jaccardSimilarity(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 && tagsB.length === 0) return 0;

  const setA = new Set(tagsA.map((t) => t.toLowerCase()));
  const setB = new Set(tagsB.map((t) => t.toLowerCase()));

  let intersection = 0;
  for (const tag of setA) {
    if (setB.has(tag)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Find Library entries most similar to a given entry.
 *
 * Similarity is computed using:
 * 1. Euclidean distance on pre-normalized embedding vectors
 *    from ClassificationResult.embedding.
 * 2. Tag Jaccard similarity as tiebreaker.
 *
 * Combined distance = embeddingDistance - (tagSimilarity * 0.01)
 * This ensures embedding distance dominates while tags break ties.
 *
 * Entries without embeddings (empty or missing) are excluded from
 * results and a warning is logged to stderr for each.
 *
 * @param id - The query entry ID.
 * @param options - Similarity search options.
 * @param baseDir - Base directory for library storage.
 * @returns Sorted array of similarity results (most similar first).
 */
export async function findSimilar(
  id: string,
  options?: SimilarityOptions,
  baseDir: string = DEFAULT_LIBRARY_DIR,
): Promise<SimilarityResult[]> {
  const limit = options?.limit ?? 10;
  const index = await loadIndex(baseDir);

  // Find the query entry
  const queryEntry = index.entries.find((e) => e.id === id);
  if (!queryEntry) return [];

  // Need at least 2 entries for meaningful comparison
  if (index.entries.length < 2) return [];

  // Query entry must have an embedding
  if (!hasEmbedding(queryEntry)) return [];

  const queryEmbedding = queryEntry.classification!.embedding;
  const queryTags = queryEntry.tags;

  // Compute distances for entries with embeddings
  const results: SimilarityResult[] = [];

  for (const entry of index.entries) {
    if (entry.id === id) continue; // skip self

    if (!hasEmbedding(entry)) {
      process.stderr.write(
        `Warning: entry ${entry.id} has no embedding vector and is excluded from similarity results.\n`,
      );
      continue;
    }

    const entryEmbedding = entry.classification!.embedding;
    const metricDistance = euclidean(queryEmbedding, entryEmbedding);
    const tagSimilarity = jaccardSimilarity(queryTags, entry.tags);

    // Combined: embedding distance dominates, tag similarity breaks ties
    const distance = metricDistance - tagSimilarity * 0.01;

    results.push({
      entry,
      distance,
      metricDistance,
      tagSimilarity,
    });
  }

  // Sort by combined distance (ascending = most similar first)
  results.sort((a, b) => a.distance - b.distance);

  return results.slice(0, limit);
}
