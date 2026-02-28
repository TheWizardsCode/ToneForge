/**
 * Classification Module Public API
 *
 * Re-exports the engine, types, dimension classifiers, and embedding
 * providers for external consumers.
 */

export { ClassificationEngine, createClassificationEngine } from "./engine.js";
export { CLASSIFICATION_VERSION } from "./types.js";
export type {
  ClassificationResult,
  DistanceFunction,
  DimensionClassifier,
  DimensionResult,
  EmbeddingProvider,
  RecipeContext,
} from "./types.js";
export { registerBuiltinClassifiers } from "./dimensions/index.js";
export {
  CategoryClassifier,
  IntensityClassifier,
  TextureClassifier,
  MaterialClassifier,
  TagsClassifier,
} from "./dimensions/index.js";
export {
  AnalysisMetricsProvider,
  createAnalysisMetricsProvider,
} from "./embeddings/index.js";
