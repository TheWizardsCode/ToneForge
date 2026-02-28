/**
 * AnalysisMetricsProvider -- Default Embedding Provider
 *
 * Deterministic embedding provider that constructs a fixed 7-dimensional
 * vector from analysis metrics, normalized to [0, 1] using domain-appropriate
 * ranges. Missing metrics default to 0.
 *
 * Vector dimensions (in order):
 *   [0] RMS               -- metrics.time.rms
 *   [1] Peak amplitude    -- metrics.time.peak
 *   [2] Crest factor      -- metrics.time.crestFactor
 *   [3] Spectral centroid -- metrics.spectral.spectralCentroid
 *   [4] Duration          -- metrics.time.duration
 *   [5] Zero-crossing rate -- metrics.time.zeroCrossingRate
 *   [6] Attack time       -- metrics.envelope.attackTime
 *
 * Reference: docs/prd/CLASSIFY_PRD.md (Section 8)
 */

import type { AnalysisResult } from "../../analyze/types.js";
import type {
  ClassificationResult,
  DistanceFunction,
  EmbeddingProvider,
} from "../types.js";

/** Number of dimensions in the embedding vector. */
const DIMENSIONALITY = 7;

/**
 * Domain-appropriate normalization ranges for each metric.
 *
 * Each entry defines [min, max] for clamping and linear normalization
 * to the [0, 1] range. Values outside the range are clamped to 0 or 1.
 *
 * Rationale for chosen ranges:
 * - RMS [0, 1]: Audio samples are in [-1, 1], so RMS is in [0, 1].
 * - Peak [0, 1]: Absolute peak of samples in [-1, 1] range.
 * - Crest factor [0, 20]: Typical crest factors range from ~1 (square wave)
 *   to ~20 (very transient/impulsive). Values above 20 are rare.
 * - Spectral centroid [0, 20000]: Frequency range up to Nyquist at 44.1kHz.
 *   Most audio content has centroid well below 20kHz.
 * - Duration [0, 30]: Sound effects typically range from a few ms to ~30s.
 *   Longer sounds are clamped to 1.
 * - Zero-crossing rate [0, 1]: Rate is expressed as crossings per sample,
 *   bounded by [0, 1].
 * - Attack time [0, 1]: Attack time in seconds. Most transients resolve
 *   within 1 second. Values above 1s are clamped.
 */
const NORMALIZATION_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // RMS
  [0, 1], // Peak
  [0, 20], // Crest factor
  [0, 20000], // Spectral centroid (Hz)
  [0, 30], // Duration (seconds)
  [0, 1], // Zero-crossing rate
  [0, 1], // Attack time (seconds)
] as const;

/**
 * Metric extraction descriptors.
 *
 * Each entry maps a vector dimension to its location in AnalysisResult.metrics
 * using [category, key] pairs.
 */
const METRIC_PATHS: ReadonlyArray<readonly [string, string]> = [
  ["time", "rms"],
  ["time", "peak"],
  ["time", "crestFactor"],
  ["spectral", "spectralCentroid"],
  ["time", "duration"],
  ["time", "zeroCrossingRate"],
  ["envelope", "attackTime"],
] as const;

/**
 * Normalize a raw metric value to [0, 1] using linear min-max scaling.
 *
 * Values outside [min, max] are clamped. If min === max, returns 0.
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Extract a numeric metric value from an AnalysisResult.
 *
 * Returns the value if it is a finite number, otherwise returns null
 * to signal that the metric is missing or non-numeric.
 */
function extractMetric(
  analysis: AnalysisResult,
  category: string,
  key: string,
): number | null {
  const group = analysis.metrics[category];
  if (!group) return null;
  const value = group[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/**
 * Deterministic embedding provider based on analysis metrics.
 *
 * Produces a fixed 7-dimensional vector by extracting metrics from an
 * AnalysisResult and normalizing each to [0, 1]. Missing or non-numeric
 * metrics default to 0. Recommends Euclidean distance for comparisons.
 */
export class AnalysisMetricsProvider implements EmbeddingProvider {
  readonly name = "analysis-metrics";

  /**
   * Produce a 7-dimensional embedding vector from analysis metrics.
   *
   * @param analysis - Structured analysis result with computed metrics.
   * @param _classification - Unused by this provider (reserved for future
   *   providers that incorporate semantic labels).
   * @returns 7-element number[] with values in [0, 1].
   */
  embed(
    analysis: AnalysisResult,
    _classification?: Partial<ClassificationResult>,
  ): number[] {
    const vector: number[] = new Array(DIMENSIONALITY);

    for (let i = 0; i < DIMENSIONALITY; i++) {
      const [category, key] = METRIC_PATHS[i];
      const raw = extractMetric(analysis, category, key);
      const [min, max] = NORMALIZATION_RANGES[i];
      vector[i] = raw !== null ? normalize(raw, min, max) : 0;
    }

    return vector;
  }

  /** Returns 7 (fixed dimensionality). */
  dimensionality(): number {
    return DIMENSIONALITY;
  }

  /** Returns "euclidean" as the recommended distance function. */
  distanceFunction(): DistanceFunction {
    return "euclidean";
  }
}

/**
 * Create a new AnalysisMetricsProvider instance.
 *
 * Convenience factory matching the pattern used elsewhere in the codebase.
 */
export function createAnalysisMetricsProvider(): AnalysisMetricsProvider {
  return new AnalysisMetricsProvider();
}
