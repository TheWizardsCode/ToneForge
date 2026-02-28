/**
 * Classification module type definitions.
 *
 * Defines the ClassificationResult output schema, the DimensionClassifier
 * interface for extensible rule-based classification, and the RecipeContext
 * type for passing recipe metadata to classifiers.
 *
 * Reference: docs/prd/CLASSIFY_PRD.md
 */

import type { AnalysisResult } from "../analyze/types.js";

/** Current classification output schema version. */
export const CLASSIFICATION_VERSION = "1.1";

/**
 * Recipe metadata context passed to dimension classifiers.
 *
 * When classifying from a recipe+seed or a WAV file with known provenance,
 * this context provides the recipe name, category, and tags for more
 * accurate classification. When classifying unknown WAV files, this
 * context is undefined and classifiers fall back to metric-only heuristics.
 */
export interface RecipeContext {
  /** Recipe name (e.g. "weapon-laser-zap"). */
  name: string;

  /** Sound category from recipe registration (e.g. "Weapon", "Footstep"). */
  category: string;

  /** Optional tags from recipe registration (e.g. ["laser", "zap", "sci-fi"]). */
  tags?: string[];
}

/**
 * Structured classification result for a single sound.
 *
 * Contains semantic labels derived from analysis metrics and optional
 * recipe metadata. Each field is populated by a registered
 * DimensionClassifier.
 */
export interface ClassificationResult {
  /** Source identifier (e.g. "weapon-laser-zap_seed-001"). */
  source: string;

  /** Primary sound category (e.g. "weapon", "footstep", "ui"). */
  category: string;

  /** Intensity level (e.g. "soft", "medium", "hard", "aggressive", "subtle"). */
  intensity: string;

  /** Array of 1-3 texture descriptors (e.g. ["sharp", "bright"]). */
  texture: string[];

  /** Best-effort material label, or null when undetermined. */
  material: string | null;

  /** Contextual use-case tags (e.g. ["sci-fi", "ranged", "laser"]). */
  tags: string[];

  /**
   * Numeric embedding vector for similarity search.
   *
   * Populated by the active EmbeddingProvider after dimension classifiers
   * run. Empty array when no provider is configured or embedding could
   * not be computed.
   */
  embedding: number[];

  /** Relative path to the source analysis JSON file. */
  analysisRef: string;
}

/**
 * Return type for a single dimension classifier.
 *
 * Each classifier populates one or more fields of the ClassificationResult.
 * The engine merges partial results from all classifiers into the final result.
 */
export type DimensionResult = Partial<
  Pick<ClassificationResult, "category" | "intensity" | "texture" | "material" | "tags">
>;

/** Distance function type recommended by an embedding provider. */
export type DistanceFunction = "cosine" | "euclidean";

/**
 * Interface for embedding providers.
 *
 * An embedding provider converts analysis metrics (and optional partial
 * classification data) into a fixed-length numeric vector suitable for
 * similarity search. Providers are pluggable: new implementations (ML-based,
 * external API) can be added without modifying the classification engine.
 *
 * The initial built-in implementation is the deterministic
 * `AnalysisMetricsProvider` that constructs vectors from expanded analysis
 * metrics.
 */
export interface EmbeddingProvider {
  /** Human-readable name of this provider (e.g. "analysis-metrics"). */
  readonly name: string;

  /**
   * Produce an embedding vector from analysis data.
   *
   * @param analysis - Structured analysis result with computed metrics.
   * @param classification - Optional partial classification result for
   *   providers that incorporate semantic labels into the embedding.
   * @returns Fixed-length numeric vector. Length must equal `dimensionality()`.
   */
  embed(
    analysis: AnalysisResult,
    classification?: Partial<ClassificationResult>,
  ): number[];

  /**
   * Return the fixed dimensionality of vectors produced by this provider.
   *
   * All vectors returned by `embed()` must have exactly this length.
   */
  dimensionality(): number;

  /**
   * Return the recommended distance function for comparing vectors
   * produced by this provider.
   */
  distanceFunction(): DistanceFunction;
}

/**
 * Interface for dimension classifiers.
 *
 * Each dimension classifier is responsible for one semantic dimension
 * (e.g. category, intensity, texture, material, tags). Classifiers are
 * registered with the ClassificationEngine and executed in order.
 *
 * New dimensions can be added by implementing this interface and
 * registering with the engine -- no modifications to existing classifiers
 * or the engine are needed.
 */
export interface DimensionClassifier {
  /** Human-readable name of this classifier (e.g. "category", "intensity"). */
  readonly name: string;

  /**
   * Classify a sound along this dimension.
   *
   * @param analysis - Structured analysis result with computed metrics.
   * @param context - Optional recipe metadata for more accurate classification.
   * @returns Partial classification result with fields this classifier populates.
   */
  classify(analysis: AnalysisResult, context?: RecipeContext): DimensionResult;
}
