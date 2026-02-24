/**
 * Ranking Engine
 *
 * Scores and ranks exploration candidates by selected analysis metrics.
 * Supports multi-metric ranking with normalized composite scores.
 *
 * Metrics are extracted from AnalysisResult.metrics using the
 * RANK_METRIC_PATHS mapping, normalized to [0, 1] across the
 * candidate set, and averaged into a composite score.
 *
 * Reference: docs/prd/EXPLORE_PRD.md Section 4.3
 */

import type { ExploreCandidate } from "./types.js";
import { RANK_METRIC_PATHS, type RankMetric } from "./types.js";

/**
 * Extract a raw metric value from a candidate's analysis result.
 *
 * Returns null if the metric is not available (e.g. attackTime
 * could not be computed for the audio).
 */
export function extractMetricValue(
  candidate: ExploreCandidate,
  metric: RankMetric,
): number | null {
  const path = RANK_METRIC_PATHS[metric];
  const categoryMetrics = candidate.analysis.metrics[path.category];
  if (!categoryMetrics) return null;

  const value = categoryMetrics[path.key];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  return value;
}

/**
 * Normalize a set of values to [0, 1] using min-max normalization.
 *
 * Values that are null are left as null. If all non-null values are
 * equal, the normalized value is 0.5 (midpoint).
 */
export function normalizeValues(
  values: (number | null)[],
): (number | null)[] {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return values.map(() => null);

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min;

  return values.map((v) => {
    if (v === null) return null;
    if (range === 0) return 0.5;
    return (v - min) / range;
  });
}

/**
 * Rank candidates by the specified metrics.
 *
 * For each metric:
 *   1. Extract raw values from all candidates
 *   2. Normalize to [0, 1]
 *   3. Store per-metric normalized scores on each candidate
 *
 * The composite score is the average of all available metric scores.
 * Candidates with no computable metrics get a score of 0.
 *
 * Candidates are sorted in descending order by composite score.
 *
 * @param candidates - Array of candidates to rank (mutated in place).
 * @param metrics - Array of 1-4 metrics to rank by.
 * @returns The same array, sorted by score descending.
 */
export function rankCandidates(
  candidates: ExploreCandidate[],
  metrics: RankMetric[],
): ExploreCandidate[] {
  if (candidates.length === 0 || metrics.length === 0) return candidates;

  // For each metric, extract and normalize values
  for (const metric of metrics) {
    const rawValues = candidates.map((c) => extractMetricValue(c, metric));
    const normalized = normalizeValues(rawValues);

    // Store normalized score on each candidate
    for (let i = 0; i < candidates.length; i++) {
      const norm = normalized[i];
      if (norm !== null) {
        candidates[i]!.metricScores[metric] = norm;
      }
    }
  }

  // Compute composite score as average of available metric scores
  for (const candidate of candidates) {
    const scores = Object.values(candidate.metricScores);
    if (scores.length === 0) {
      candidate.score = 0;
    } else {
      candidate.score = scores.reduce((a, b) => a + b, 0) / scores.length;
    }
  }

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}

/**
 * Keep only the top N candidates after ranking.
 *
 * @param candidates - Pre-sorted array (descending by score).
 * @param keepTop - Maximum number of candidates to retain.
 * @returns Truncated array.
 */
export function keepTopN(
  candidates: ExploreCandidate[],
  keepTop: number,
): ExploreCandidate[] {
  return candidates.slice(0, keepTop);
}
