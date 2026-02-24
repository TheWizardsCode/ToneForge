/**
 * Analysis Extractors Index
 *
 * Re-exports all built-in metric extractors and provides a convenience
 * function to register them all with an AnalysisEngine.
 */

import type { AnalysisEngine } from "../engine.js";
import { TimeDomainExtractor } from "./time-domain.js";
import { QualityFlagsExtractor } from "./quality-flags.js";
import { AttackTimeExtractor } from "./attack-time.js";
import { SpectralCentroidExtractor } from "./spectral-centroid.js";

export { TimeDomainExtractor } from "./time-domain.js";
export { QualityFlagsExtractor } from "./quality-flags.js";
export { AttackTimeExtractor } from "./attack-time.js";
export { SpectralCentroidExtractor } from "./spectral-centroid.js";

/**
 * Register all built-in extractors with the given engine.
 *
 * Registration order determines the order of execution and the order
 * of categories in the output.
 */
export function registerBuiltinExtractors(engine: AnalysisEngine): void {
  engine.register(new TimeDomainExtractor());
  engine.register(new QualityFlagsExtractor());
  engine.register(new AttackTimeExtractor());
  engine.register(new SpectralCentroidExtractor());
}
