/**
 * ToneForge Intelligence — library loading and shared library heuristics.
 *
 * All Intelligence engines read library data through this module so they
 * share one deterministic ordering and one intensity-bucket vocabulary.
 */

import { loadIndex } from "../library/index-store.js";
import type { LibraryEntry } from "../library/types.js";

/**
 * Load library entries for a directory, sorted deterministically by id.
 *
 * @param libraryDir - Directory containing `index.json` and entry assets.
 */
export async function loadLibraryEntries(libraryDir: string): Promise<LibraryEntry[]> {
  const index = await loadIndex(libraryDir);
  return [...index.entries].sort((a, b) => a.id.localeCompare(b.id));
}

/** Coarse intensity bucket used for coverage analysis. */
export type IntensityBucket = "soft" | "medium" | "hard" | "unknown";

/**
 * Map a classifier intensity label to a coarse bucket.
 *
 * The classifier emits labels such as `soft`, `medium`, `hard`,
 * `aggressive`, `subtle`. Coverage analysis works on three coarse buckets
 * so it remains stable across small vocabulary changes.
 */
export function intensityBucket(intensity: string | null | undefined): IntensityBucket {
  const value = (intensity ?? "").toLowerCase();
  if (value === "soft" || value === "subtle" || value === "quiet" || value === "low") {
    return "soft";
  }
  if (value === "medium" || value === "moderate" || value === "mid") {
    return "medium";
  }
  if (value === "hard" || value === "aggressive" || value === "loud" || value === "high") {
    return "hard";
  }
  return "unknown";
}

/** Whether an entry has a usable embedding vector. */
export function hasEmbedding(entry: LibraryEntry): boolean {
  return (
    entry.classification !== null &&
    Array.isArray(entry.classification.embedding) &&
    entry.classification.embedding.length > 0
  );
}

/** Euclidean distance between two vectors (truncating to the shorter length). */
export function euclideanDistance(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Average a list of equally-sized vectors. */
export function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dims = vectors[0]!.length;
  const out = new Array<number>(dims).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < dims; i++) {
      out[i] = (out[i] ?? 0) + (vector[i] ?? 0);
    }
  }
  for (let i = 0; i < dims; i++) {
    out[i] = (out[i] ?? 0) / vectors.length;
  }
  return out;
}

/**
 * Greedily cluster entries by embedding proximity.
 *
 * Entries are visited in id order (already sorted by
 * {@link loadLibraryEntries}) and assigned to the nearest existing cluster
 * within `threshold`, or seed a new cluster. The result is deterministic for
 * a fixed input.
 *
 * @param entries - Library entries (id-sorted).
 * @param threshold - Maximum centroid distance for cluster membership.
 * @returns Clusters, each an id-sorted list of entries with embeddings.
 */
export function clusterByEmbedding(
  entries: LibraryEntry[],
  threshold: number,
): LibraryEntry[][] {
  const clusters: Array<{ members: LibraryEntry[]; centre: number[] }> = [];

  for (const entry of entries) {
    if (!hasEmbedding(entry)) continue;
    const embedding = entry.classification!.embedding;

    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < clusters.length; i++) {
      const distance = euclideanDistance(embedding, clusters[i]!.centre);
      if (distance <= threshold && distance < bestDistance) {
        bestIndex = i;
        bestDistance = distance;
      }
    }

    if (bestIndex >= 0) {
      const cluster = clusters[bestIndex]!;
      cluster.members.push(entry);
      cluster.centre = centroid(cluster.members.map((m) => m.classification!.embedding));
    } else {
      clusters.push({ members: [entry], centre: [...embedding] });
    }
  }

  return clusters.map((c) => c.members);
}

/** Convert an arbitrary string to a stable lowercase slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Clamp a number to the closed interval [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Round to a fixed number of decimal places for deterministic output.
 */
export function roundTo(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
