/**
 * Material Dimension Classifier
 *
 * Best-effort material inference from recipe metadata and spectral
 * characteristics. Returns null when no reasonable determination is possible.
 *
 * Labels: metal, wood, stone, organic, synthetic, energy, mechanical, magical
 *
 * Reference: docs/prd/CLASSIFY_PRD.md Section 5.2
 */

import type { AnalysisResult } from "../../analyze/types.js";
import type { DimensionClassifier, DimensionResult, RecipeContext } from "../types.js";

/**
 * Mapping from recipe name segments and tags to material labels.
 */
const TAG_MATERIAL_MAP: Record<string, string> = {
  stone: "stone",
  gravel: "stone",
  metal: "metal",
  wood: "wood",
  organic: "organic",
  vocal: "organic",
  growl: "organic",
  mechanical: "mechanical",
  engine: "mechanical",
  laser: "energy",
  energy: "energy",
  zap: "energy",
  magical: "magical",
  nature: "organic",
  wind: "organic",
};

/**
 * Category-based default materials when tags don't provide a signal.
 */
const CATEGORY_MATERIAL_MAP: Record<string, string> = {
  weapon: "energy",
  footstep: "stone",
  creature: "organic",
  vehicle: "mechanical",
  ambient: "organic",
};

/**
 * Material dimension classifier.
 *
 * Uses recipe tags and name segments as primary signal, category as
 * secondary signal, and spectral characteristics as tertiary refinement.
 * Returns null when no reasonable determination can be made.
 */
export class MaterialClassifier implements DimensionClassifier {
  readonly name = "material";

  classify(analysis: AnalysisResult, context?: RecipeContext): DimensionResult {
    // Primary signal: recipe tags
    if (context?.tags) {
      for (const tag of context.tags) {
        const material = TAG_MATERIAL_MAP[tag.toLowerCase()];
        if (material) {
          return { material };
        }
      }
    }

    // Secondary signal: recipe name segments
    if (context?.name) {
      const segments = context.name.toLowerCase().split("-");
      for (const segment of segments) {
        const material = TAG_MATERIAL_MAP[segment];
        if (material) {
          return { material };
        }
      }
    }

    // Tertiary signal: category-based defaults
    if (context?.category) {
      const material = CATEGORY_MATERIAL_MAP[context.category.toLowerCase()];
      if (material) {
        return { material };
      }
    }

    // Metric-based fallback: very high spectral centroid suggests metal
    const spectral = analysis.metrics["spectral"] ?? {};
    const centroid = typeof spectral["spectralCentroid"] === "number"
      ? spectral["spectralCentroid"]
      : 0;

    if (centroid > 6000) {
      return { material: "metal" };
    }

    // No reasonable determination possible
    return { material: null };
  }
}
