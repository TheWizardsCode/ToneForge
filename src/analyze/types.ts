/**
 * Analysis module type definitions.
 *
 * Defines the MetricExtractor interface and AnalysisResult type used
 * by the extensible analysis engine.
 *
 * Reference: docs/prd/ANALYZE_PRD.md
 */

/** Current analysis output schema version. */
export const ANALYSIS_VERSION = "1.0";

/**
 * Interface for metric extractors.
 *
 * Each extractor computes a set of related metrics from raw audio samples.
 * Extractors are registered with the AnalysisEngine and executed in order.
 * New metric categories can be added by implementing this interface and
 * registering with the engine -- no modifications to existing extractors
 * or the engine are needed.
 */
export interface MetricExtractor {
  /** Human-readable name of the extractor (e.g. "time-domain"). */
  readonly name: string;

  /** Category grouping for the extracted metrics (e.g. "time", "spectral"). */
  readonly category: string;

  /**
   * Extract metrics from raw audio samples.
   *
   * @param samples - Float32Array of mono audio samples in [-1, 1] range.
   * @param sampleRate - Sample rate in Hz (e.g. 44100).
   * @returns Record of metric name to value. Values may be numbers,
   *          booleans, strings, or null (for metrics that cannot be computed).
   */
  extract(
    samples: Float32Array,
    sampleRate: number,
  ): Record<string, number | boolean | string | null>;
}

/**
 * Structured analysis result returned by the engine.
 *
 * Contains metadata (version, sample info) and metric results grouped
 * by extractor category.
 */
export interface AnalysisResult {
  /** Schema version for forward compatibility. */
  analysisVersion: string;

  /** Sample rate of the analyzed audio. */
  sampleRate: number;

  /** Number of samples in the analyzed audio. */
  sampleCount: number;

  /** Metrics grouped by extractor category. */
  metrics: Record<string, Record<string, number | boolean | string | null>>;
}
