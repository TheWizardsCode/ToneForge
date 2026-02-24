/**
 * Explore module type definitions.
 *
 * Defines types for exploration runs, sweep results, ranking,
 * clustering, and promotion workflows.
 *
 * Reference: docs/prd/EXPLORE_PRD.md
 */

import type { AnalysisResult } from "../analyze/types.js";
import type { ClassificationResult } from "../classify/types.js";

/** Current explore output schema version. */
export const EXPLORE_VERSION = "1.0";

/**
 * Supported ranking metrics that map to analysis result fields.
 *
 * Each metric name maps to a category.metric path in the AnalysisResult.
 */
export type RankMetric =
  | "transient-density"
  | "spectral-centroid"
  | "rms"
  | "attack-time";

/** Maps a RankMetric name to its category.key path in AnalysisResult.metrics. */
export const RANK_METRIC_PATHS: Record<RankMetric, { category: string; key: string }> = {
  "transient-density": { category: "time", key: "crestFactor" },
  "spectral-centroid": { category: "spectral", key: "spectralCentroid" },
  "rms": { category: "time", key: "rms" },
  "attack-time": { category: "envelope", key: "attackTime" },
};

/** All valid rank metric names. */
export const VALID_RANK_METRICS: readonly RankMetric[] = Object.keys(
  RANK_METRIC_PATHS,
) as RankMetric[];

/**
 * A single candidate produced by the sweep or mutate pipeline.
 */
export interface ExploreCandidate {
  /** Unique identifier for this candidate (e.g. "creature_seed-4821"). */
  id: string;

  /** Recipe name used to generate this candidate. */
  recipe: string;

  /** Seed used for deterministic generation. */
  seed: number;

  /** Duration of the rendered audio in seconds. */
  duration: number;

  /** Sample rate of the rendered audio. */
  sampleRate: number;

  /** Number of audio samples. */
  sampleCount: number;

  /** Analysis result with computed metrics. */
  analysis: AnalysisResult;

  /** Optional classification result. */
  classification?: ClassificationResult;

  /** Composite ranking score (0-1, higher is better). */
  score: number;

  /** Per-metric normalized scores used to compute the composite score. */
  metricScores: Record<string, number>;

  /** Cluster assignment index (-1 if not clustered). */
  cluster: number;

  /** Whether this candidate has been promoted to the Library. */
  promoted: boolean;

  /** Library entry ID if promoted, null otherwise. */
  libraryId: string | null;

  /** Rendered parameters for deterministic regeneration. */
  params: Record<string, number>;
}

/**
 * Configuration for a sweep run.
 */
export interface SweepConfig {
  /** Recipe name to sweep. */
  recipe: string;

  /** Start of seed range (inclusive). */
  seedStart: number;

  /** End of seed range (inclusive). */
  seedEnd: number;

  /** Metrics to rank by (1-4 metrics). */
  rankBy: RankMetric[];

  /** Number of top results to keep. */
  keepTop: number;

  /** Number of clusters (3-8). */
  clusters: number;

  /** Maximum concurrency for rendering. */
  concurrency: number;
}

/**
 * Configuration for a mutate run.
 */
export interface MutateConfig {
  /** Recipe name. */
  recipe: string;

  /** Base seed to mutate from. */
  seed: number;

  /** Jitter factor (0-1) controlling parameter variance. */
  jitter: number;

  /** Number of variations to generate. */
  count: number;

  /** Metrics to rank by. */
  rankBy: RankMetric[];

  /** Maximum concurrency. */
  concurrency: number;
}

/**
 * Result of a completed exploration run (sweep or mutate).
 */
export interface ExploreRunResult {
  /** Unique run identifier. */
  runId: string;

  /** ISO timestamp of run start. */
  startedAt: string;

  /** ISO timestamp of run completion. */
  completedAt: string;

  /** Duration of the run in milliseconds. */
  durationMs: number;

  /** Type of exploration run. */
  type: "sweep" | "mutate";

  /** Configuration used for this run. */
  config: SweepConfig | MutateConfig;

  /** Total candidates generated. */
  totalCandidates: number;

  /** Top candidates after ranking and filtering. */
  candidates: ExploreCandidate[];

  /** Cluster summaries (empty if clustering was not applied). */
  clusterSummaries: ClusterSummary[];

  /** Explore module version. */
  exploreVersion: string;
}

/**
 * Summary of a cluster of candidates.
 */
export interface ClusterSummary {
  /** Cluster index (0-based). */
  index: number;

  /** Number of candidates in this cluster. */
  size: number;

  /** Centroid metric values (averaged from members). */
  centroid: Record<string, number>;

  /** IDs of representative members (up to 3). */
  exemplars: string[];
}

/**
 * Progress callback for sweep/mutate operations.
 */
export type ProgressCallback = (completed: number, total: number) => void;
