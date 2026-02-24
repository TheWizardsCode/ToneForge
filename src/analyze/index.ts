/**
 * Analysis Module Public API
 *
 * Re-exports the engine, types, and extractors for external consumers.
 */

export { AnalysisEngine, createAnalysisEngine } from "./engine.js";
export { ANALYSIS_VERSION } from "./types.js";
export type { MetricExtractor, AnalysisResult } from "./types.js";
export { registerBuiltinExtractors } from "./extractors/index.js";
export {
  TimeDomainExtractor,
  QualityFlagsExtractor,
  AttackTimeExtractor,
  SpectralCentroidExtractor,
} from "./extractors/index.js";
