/**
 * Classification Module Public API
 *
 * Re-exports the engine, types, and dimension classifiers for external consumers.
 */

export { ClassificationEngine, createClassificationEngine } from "./engine.js";
export { CLASSIFICATION_VERSION } from "./types.js";
export type {
  ClassificationResult,
  DimensionClassifier,
  DimensionResult,
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
