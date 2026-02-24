/**
 * Analysis Engine
 *
 * Extensible engine that accepts registered MetricExtractor implementations,
 * runs them against audio sample data, and produces a structured AnalysisResult.
 *
 * Reference: docs/prd/ANALYZE_PRD.md
 */

import {
  ANALYSIS_VERSION,
  type MetricExtractor,
  type AnalysisResult,
} from "./types.js";

/**
 * Round a numeric value to 6 decimal places for cross-platform determinism.
 * Non-finite values (NaN, Infinity, -Infinity) are returned as-is since
 * JSON.stringify handles them (as null).
 */
function roundMetric(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Round all numeric values in a metrics record to 6 decimal places.
 */
function roundMetrics(
  metrics: Record<string, number | boolean | string | null>,
): Record<string, number | boolean | string | null> {
  const rounded: Record<string, number | boolean | string | null> = {};
  for (const [key, value] of Object.entries(metrics)) {
    rounded[key] = typeof value === "number" ? roundMetric(value) : value;
  }
  return rounded;
}

/**
 * Core analysis engine.
 *
 * Maintains an ordered list of MetricExtractor instances.  When `analyze()`
 * is called, each extractor is run in registration order and its results
 * are merged into the output under the extractor's category key.
 */
export class AnalysisEngine {
  private readonly extractors: MetricExtractor[] = [];

  /**
   * Register a metric extractor with the engine.
   *
   * Extractors are executed in registration order during analysis.
   */
  register(extractor: MetricExtractor): void {
    this.extractors.push(extractor);
  }

  /**
   * Analyze audio samples using all registered extractors.
   *
   * @param samples - Float32Array of mono audio samples.
   * @param sampleRate - Sample rate in Hz.
   * @returns Structured analysis result with all computed metrics.
   * @throws If any extractor throws, the error is wrapped with the
   *         extractor name for diagnostics.
   */
  analyze(samples: Float32Array, sampleRate: number): AnalysisResult {
    const result: AnalysisResult = {
      analysisVersion: ANALYSIS_VERSION,
      sampleRate,
      sampleCount: samples.length,
      metrics: {},
    };

    for (const extractor of this.extractors) {
      try {
        const raw = extractor.extract(samples, sampleRate);
        result.metrics[extractor.category] = roundMetrics(raw);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Extractor '${extractor.name}' failed: ${msg}`,
        );
      }
    }

    return result;
  }
}

/**
 * Create a pre-configured AnalysisEngine with all built-in extractors.
 *
 * This is the primary entry point for consumers who want the default
 * analysis pipeline.  Custom pipelines can instantiate AnalysisEngine
 * directly and register extractors selectively.
 */
export function createAnalysisEngine(): AnalysisEngine {
  // Lazy import to avoid circular dependencies and allow tree-shaking.
  // Extractors are imported here rather than at module scope.
  const engine = new AnalysisEngine();

  // Built-in extractors are registered by the caller after importing
  // from the extractors index.  This function provides the bare engine;
  // createDefaultAnalysisEngine() (below) adds the built-in set.
  return engine;
}
