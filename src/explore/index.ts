/**
 * Explore Module Public API
 *
 * Re-exports the sweep runner, ranking, clustering, persistence,
 * and promotion modules for external consumers.
 */

export {
  sweep,
  mutate,
  runBatch,
  renderAndAnalyze,
  generateMutatedSeeds,
  defaultConcurrency,
} from "./sweep.js";

export {
  rankCandidates,
  keepTopN,
  extractMetricValue,
  normalizeValues,
} from "./ranking.js";

export { clusterCandidates } from "./clustering.js";

export {
  saveRunResult,
  loadRunResult,
  listRunIds,
  listRuns,
  generateRunId,
} from "./persistence.js";

export { promoteCandidate } from "./promote.js";
export type { PromoteResult } from "./promote.js";

export { EXPLORE_VERSION } from "./types.js";
export { VALID_RANK_METRICS, RANK_METRIC_PATHS } from "./types.js";
export type {
  ExploreCandidate,
  SweepConfig,
  MutateConfig,
  ExploreRunResult,
  ClusterSummary,
  RankMetric,
  ProgressCallback,
} from "./types.js";
