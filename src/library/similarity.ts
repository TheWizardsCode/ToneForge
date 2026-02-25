/**
 * Library Similarity -- Hybrid Distance
 *
 * Ranks Library entries by perceptual similarity using a hybrid
 * approach: normalized analysis-metric Euclidean distance as primary,
 * with tag/label Jaccard overlap as tiebreaker.
 *
 * Metrics used: RMS, spectralCentroid, duration, zeroCrossingRate
 * (when available in analysis data).
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

  /** Euclidean metric distance component. */
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
 * Metric keys used for similarity feature vectors.
 *
 * Maps to analysis.metrics paths:
 * - rms -> time.rms
 * - spectralCentroid -> spectral.spectralCentroid
 * - duration -> (entry.duration)
 * - zeroCrossingRate -> time.zeroCrossingRate
 */
const SIMILARITY_METRICS: Array<{
  name: string;
  extract: (entry: LibraryEntry) => number | null;
}> = [
  {
    name: "rms",
    extract: (e) => {
      const v = e.analysis?.metrics?.["time"]?.["rms"];
      return typeof v === "number" ? v : null;
    },
  },
  {
    name: "spectralCentroid",
    extract: (e) => {
      const v = e.analysis?.metrics?.["spectral"]?.["spectralCentroid"];
      return typeof v === "number" ? v : null;
    },
  },
  {
    name: "duration",
    extract: (e) => (typeof e.duration === "number" ? e.duration : null),
  },
  {
    name: "zeroCrossingRate",
    extract: (e) => {
      const v = e.analysis?.metrics?.["time"]?.["zeroCrossingRate"];
      return typeof v === "number" ? v : null;
    },
  },
];

/**
 * Extract a raw feature vector from an entry.
 *
 * Returns null if no metrics can be extracted (entry is unusable
 * for similarity comparison).
 */
function extractFeatures(entry: LibraryEntry): number[] | null {
  const values: number[] = [];
  let hasAny = false;

  for (const metric of SIMILARITY_METRICS) {
    const v = metric.extract(entry);
    if (v !== null) {
      values.push(v);
      hasAny = true;
    } else {
      values.push(0); // placeholder for missing
    }
  }

  return hasAny ? values : null;
}

/**
 * Min-max normalize feature vectors in place.
 *
 * Each dimension is scaled to [0, 1] based on the min/max across
 * all entries. Dimensions with zero range are set to 0.5.
 */
function normalizeFeatures(vectors: number[][]): void {
  if (vectors.length === 0) return;

  const dims = vectors[0]!.length;

  for (let d = 0; d < dims; d++) {
    let min = Infinity;
    let max = -Infinity;

    for (const v of vectors) {
      if (v[d]! < min) min = v[d]!;
      if (v[d]! > max) max = v[d]!;
    }

    const range = max - min;
    for (const v of vectors) {
      v[d] = range > 0 ? (v[d]! - min) / range : 0.5;
    }
  }
}

/**
 * Compute Euclidean distance between two vectors.
 */
function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
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
 * 1. Euclidean distance on min-max normalized analysis metrics
 *    (RMS, spectral centroid, duration, zero-crossing rate)
 * 2. Tag Jaccard similarity as tiebreaker
 *
 * Combined distance = metricDistance - (tagSimilarity * 0.01)
 * This ensures metric distance dominates while tags break ties.
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

  // Extract features for all entries (including query)
  const usable: Array<{ entry: LibraryEntry; features: number[] }> = [];

  for (const entry of index.entries) {
    const features = extractFeatures(entry);
    if (features) {
      usable.push({ entry, features });
    }
  }

  // Find query in usable set
  const queryIdx = usable.findIndex((u) => u.entry.id === id);
  if (queryIdx === -1) return []; // query entry has no extractable features

  // Normalize features across all usable entries
  const vectors = usable.map((u) => u.features);
  normalizeFeatures(vectors);

  const queryVector = vectors[queryIdx]!;
  const queryTags = queryEntry.tags;

  // Compute distances
  const results: SimilarityResult[] = [];

  for (let i = 0; i < usable.length; i++) {
    if (i === queryIdx) continue; // skip self

    const metricDistance = euclidean(queryVector, vectors[i]!);
    const tagSimilarity = jaccardSimilarity(queryTags, usable[i]!.entry.tags);

    // Combined: metric distance dominates, tag similarity breaks ties
    const distance = metricDistance - tagSimilarity * 0.01;

    results.push({
      entry: usable[i]!.entry,
      distance,
      metricDistance,
      tagSimilarity,
    });
  }

  // Sort by combined distance (ascending = most similar first)
  results.sort((a, b) => a.distance - b.distance);

  return results.slice(0, limit);
}
