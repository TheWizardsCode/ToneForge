/**
 * Classification Dimensions Index
 *
 * Re-exports all built-in dimension classifiers and provides a convenience
 * function to register them all with a ClassificationEngine.
 */

import type { ClassificationEngine } from "../engine.js";
import { CategoryClassifier } from "./category.js";
import { IntensityClassifier } from "./intensity.js";
import { TextureClassifier } from "./texture.js";
import { MaterialClassifier } from "./material.js";
import { TagsClassifier } from "./tags.js";

export { CategoryClassifier } from "./category.js";
export { IntensityClassifier } from "./intensity.js";
export { TextureClassifier } from "./texture.js";
export { MaterialClassifier } from "./material.js";
export { TagsClassifier } from "./tags.js";

/**
 * Register all built-in dimension classifiers with the given engine.
 *
 * Registration order matters: category must come before tags (tags
 * deduplicates against the category name). Material benefits from
 * running after category for category-based defaults.
 */
export function registerBuiltinClassifiers(engine: ClassificationEngine): void {
  engine.register(new CategoryClassifier());
  engine.register(new IntensityClassifier());
  engine.register(new TextureClassifier());
  engine.register(new MaterialClassifier());
  engine.register(new TagsClassifier());
}
