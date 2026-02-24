/**
 * Clustering Engine
 *
 * Groups exploration candidates into k clusters using k-means
 * on normalized metric vectors. Produces cluster summaries with
 * centroid metrics and exemplar member IDs.
 *
 * Uses a simple k-means implementation suitable for the expected
 * data sizes (tens to thousands of candidates).
 *
 * Reference: docs/prd/EXPLORE_PRD.md Section 5.4
 */

import type { ExploreCandidate, ClusterSummary, RankMetric } from "./types.js";
import { extractMetricValue, normalizeValues } from "./ranking.js";

/** Maximum iterations for k-means convergence. */
const MAX_ITERATIONS = 50;

/** Convergence threshold: stop when centroid movement is below this. */
const CONVERGENCE_THRESHOLD = 1e-6;

/**
 * Build a feature vector for a candidate using the specified metrics.
 *
 * Missing values are replaced with 0.5 (neutral).
 */
function buildFeatureVector(
  candidate: ExploreCandidate,
  metrics: RankMetric[],
): number[] {
  return metrics.map((m) => candidate.metricScores[m] ?? 0.5);
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
 * Initialize centroids using k-means++ strategy.
 *
 * Selects the first centroid uniformly at random (deterministically
 * using the first candidate), then each subsequent centroid is chosen
 * proportional to squared distance from nearest existing centroid.
 */
function initCentroids(
  vectors: number[][],
  k: number,
): number[][] {
  const centroids: number[][] = [];
  if (vectors.length === 0 || k === 0) return centroids;

  // First centroid: use the first vector (deterministic)
  centroids.push([...vectors[0]!]);

  for (let c = 1; c < k && c < vectors.length; c++) {
    // Compute squared distances to nearest centroid
    const distances = vectors.map((v) => {
      const minDist = Math.min(...centroids.map((cent) => euclidean(v, cent)));
      return minDist * minDist;
    });

    // Select the vector with maximum distance (deterministic greedy)
    let maxIdx = 0;
    let maxDist = -1;
    for (let i = 0; i < distances.length; i++) {
      if (distances[i]! > maxDist) {
        maxDist = distances[i]!;
        maxIdx = i;
      }
    }

    centroids.push([...vectors[maxIdx]!]);
  }

  return centroids;
}

/**
 * Assign each vector to its nearest centroid.
 */
function assignClusters(
  vectors: number[][],
  centroids: number[][],
): number[] {
  return vectors.map((v) => {
    let minDist = Infinity;
    let bestCluster = 0;
    for (let c = 0; c < centroids.length; c++) {
      const d = euclidean(v, centroids[c]!);
      if (d < minDist) {
        minDist = d;
        bestCluster = c;
      }
    }
    return bestCluster;
  });
}

/**
 * Recompute centroids from assigned clusters.
 */
function recomputeCentroids(
  vectors: number[][],
  assignments: number[],
  k: number,
  dims: number,
): number[][] {
  const centroids: number[][] = Array.from({ length: k }, () =>
    new Array(dims).fill(0),
  );
  const counts = new Array(k).fill(0) as number[];

  for (let i = 0; i < vectors.length; i++) {
    const cluster = assignments[i]!;
    counts[cluster]!++;
    for (let d = 0; d < dims; d++) {
      centroids[cluster]![d]! += vectors[i]![d]!;
    }
  }

  for (let c = 0; c < k; c++) {
    if (counts[c]! > 0) {
      for (let d = 0; d < dims; d++) {
        centroids[c]![d]! /= counts[c]!;
      }
    }
  }

  return centroids;
}

/**
 * Run k-means clustering on candidates.
 *
 * Clusters candidates based on their normalized metric scores.
 * Mutates candidates in place to set the `cluster` field.
 *
 * @param candidates - Array of candidates with metricScores already populated.
 * @param metrics - Metrics used for feature vectors.
 * @param k - Number of clusters (clamped to [1, candidates.length]).
 * @returns Array of cluster summaries.
 */
export function clusterCandidates(
  candidates: ExploreCandidate[],
  metrics: RankMetric[],
  k: number,
): ClusterSummary[] {
  if (candidates.length === 0) return [];

  // Clamp k to valid range
  const effectiveK = Math.max(1, Math.min(k, candidates.length));
  const dims = metrics.length;

  if (dims === 0) {
    // No metrics to cluster on — put everything in one cluster
    for (const c of candidates) c.cluster = 0;
    return [{
      index: 0,
      size: candidates.length,
      centroid: {},
      exemplars: candidates.slice(0, 3).map((c) => c.id),
    }];
  }

  // Build feature vectors
  const vectors = candidates.map((c) => buildFeatureVector(c, metrics));

  // Initialize centroids
  let centroids = initCentroids(vectors, effectiveK);
  let assignments = assignClusters(vectors, centroids);

  // Iterate until convergence
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const newCentroids = recomputeCentroids(vectors, assignments, effectiveK, dims);

    // Check convergence
    let maxMove = 0;
    for (let c = 0; c < effectiveK; c++) {
      const move = euclidean(centroids[c]!, newCentroids[c]!);
      if (move > maxMove) maxMove = move;
    }

    centroids = newCentroids;

    if (maxMove < CONVERGENCE_THRESHOLD) break;

    assignments = assignClusters(vectors, centroids);
  }

  // Final assignment
  assignments = assignClusters(vectors, centroids);

  // Set cluster on each candidate
  for (let i = 0; i < candidates.length; i++) {
    candidates[i]!.cluster = assignments[i]!;
  }

  // Build summaries
  const summaries: ClusterSummary[] = [];
  for (let c = 0; c < effectiveK; c++) {
    const members = candidates.filter((_, i) => assignments[i] === c);
    if (members.length === 0) continue;

    // Build centroid as metric name -> centroid value
    const centroidMap: Record<string, number> = {};
    for (let d = 0; d < dims; d++) {
      centroidMap[metrics[d]!] = Math.round(centroids[c]![d]! * 1_000_000) / 1_000_000;
    }

    // Pick exemplars: top-scoring members (up to 3)
    const sorted = [...members].sort((a, b) => b.score - a.score);
    const exemplars = sorted.slice(0, 3).map((m) => m.id);

    summaries.push({
      index: c,
      size: members.length,
      centroid: centroidMap,
      exemplars,
    });
  }

  return summaries;
}
