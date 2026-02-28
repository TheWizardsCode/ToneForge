/**
 * Classification Engine
 *
 * Extensible engine that accepts registered DimensionClassifier implementations,
 * runs them against analysis data and optional recipe context, and produces a
 * structured ClassificationResult.
 *
 * Follows the same extensible pattern as the analysis engine
 * (src/analyze/engine.ts).
 *
 * Reference: docs/prd/CLASSIFY_PRD.md
 */

import type { AnalysisResult } from "../analyze/types.js";
import type {
  ClassificationResult,
  DimensionClassifier,
  DimensionResult,
  EmbeddingProvider,
  RecipeContext,
} from "./types.js";

/**
 * Core classification engine.
 *
 * Maintains an ordered list of DimensionClassifier instances. When
 * `classify()` is called, each classifier is run in registration order
 * and its partial results are merged into the final ClassificationResult.
 */
export class ClassificationEngine {
  private readonly classifiers: DimensionClassifier[] = [];
  private embeddingProvider: EmbeddingProvider | null = null;

  /**
   * Register a dimension classifier with the engine.
   *
   * Classifiers are executed in registration order during classification.
   */
  register(classifier: DimensionClassifier): void {
    this.classifiers.push(classifier);
  }

  /**
   * Set the embedding provider for the engine.
   *
   * When set, the provider is invoked after all dimension classifiers
   * and its output is attached to the ClassificationResult's `embedding`
   * field. If not set, `embedding` defaults to an empty array.
   */
  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  /**
   * Classify a sound using all registered dimension classifiers.
   *
   * @param analysis - Structured analysis result from the analysis engine.
   * @param source - Source identifier for the classification result.
   * @param analysisRef - Relative path to the source analysis JSON file.
   * @param context - Optional recipe metadata for more accurate classification.
   * @returns Fully populated ClassificationResult.
   */
  classify(
    analysis: AnalysisResult,
    source: string,
    analysisRef: string,
    context?: RecipeContext,
  ): ClassificationResult {
    // Start with default empty values
    const result: ClassificationResult = {
      source,
      category: "",
      intensity: "",
      texture: [],
      material: null,
      tags: [],
      embedding: [],
      analysisRef,
    };

    // Run each classifier in registration order and merge results
    for (const classifier of this.classifiers) {
      try {
        const partial: DimensionResult = classifier.classify(analysis, context);
        this.mergeResult(result, partial);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Classifier '${classifier.name}' failed: ${msg}`,
        );
      }
    }

    // Compute embedding vector if a provider is configured
    if (this.embeddingProvider) {
      try {
        result.embedding = this.embeddingProvider.embed(analysis, result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `EmbeddingProvider '${this.embeddingProvider.name}' failed: ${msg}`,
        );
      }
    }

    return result;
  }

  /**
   * Merge a partial dimension result into the accumulating classification result.
   *
   * String fields overwrite; array fields replace (not append) to allow
   * each classifier full control over its dimension.
   */
  private mergeResult(
    target: ClassificationResult,
    partial: DimensionResult,
  ): void {
    if (partial.category !== undefined) {
      target.category = partial.category;
    }
    if (partial.intensity !== undefined) {
      target.intensity = partial.intensity;
    }
    if (partial.texture !== undefined) {
      target.texture = partial.texture;
    }
    if (partial.material !== undefined) {
      target.material = partial.material;
    }
    if (partial.tags !== undefined) {
      target.tags = partial.tags;
    }
  }
}

/**
 * Create a new ClassificationEngine instance.
 *
 * This is a convenience factory that mirrors `createAnalysisEngine()`.
 * Built-in dimension classifiers are registered separately via
 * `registerBuiltinClassifiers()`.
 */
export function createClassificationEngine(): ClassificationEngine {
  return new ClassificationEngine();
}
