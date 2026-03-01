/**
 * Category Dimension Classifier
 *
 * Derives a primary category from recipe name/metadata when available,
 * with metric-based fallback heuristics for unknown sources.
 *
 * Categories are always lowercase strings matching the vocabulary:
 * weapon, footstep, ui, ambient, character, creature, vehicle, impact, card-game.
 *
 * Reference: docs/prd/CLASSIFY_PRD.md
 */

import type { AnalysisResult } from "../../analyze/types.js";
import type { DimensionClassifier, DimensionResult, RecipeContext } from "../types.js";

/**
 * Known category prefixes extracted from recipe names.
 *
 * When a recipe name starts with one of these prefixes (before the first `-`
 * or as a known multi-segment prefix), the corresponding category is assigned.
 */
const RECIPE_NAME_CATEGORY_MAP: Record<string, string> = {
  weapon: "weapon",
  footstep: "footstep",
  ui: "ui",
  ambient: "ambient",
  character: "character",
  creature: "creature",
  vehicle: "vehicle",
  impact: "impact",
  slam: "impact",
  rumble: "impact",
  debris: "impact",
  rattle: "impact",
  resonance: "impact",
  card: "card-game",
};

/**
 * Infer category from analysis metrics when no recipe metadata is available.
 *
 * Uses duration, attack time, RMS, and spectral centroid to make a
 * best-effort category guess. This is inherently less accurate than
 * recipe-metadata-based classification.
 */
function inferCategoryFromMetrics(analysis: AnalysisResult): string {
  const time = analysis.metrics["time"] ?? {};
  const envelope = analysis.metrics["envelope"] ?? {};
  const spectral = analysis.metrics["spectral"] ?? {};

  const duration = typeof time["duration"] === "number" ? time["duration"] : 0;
  const rms = typeof time["rms"] === "number" ? time["rms"] : 0;
  const peak = typeof time["peak"] === "number" ? time["peak"] : 0;
  const attackTime = typeof envelope["attackTime"] === "number" ? envelope["attackTime"] : 50;
  const centroid = typeof spectral["spectralCentroid"] === "number" ? spectral["spectralCentroid"] : 1000;

  // Short, high-peak transient -> impact
  if (duration < 0.3 && attackTime < 10 && peak > 0.6) {
    return "impact";
  }

  // Very short, high centroid, low-medium RMS -> ui
  if (duration < 0.5 && centroid > 2000 && rms < 0.25) {
    return "ui";
  }

  // Short, high RMS, high centroid -> weapon
  if (duration < 1.0 && rms > 0.15 && centroid > 1500) {
    return "weapon";
  }

  // Medium duration, low centroid, moderate attack -> footstep
  if (duration < 0.5 && centroid < 1500 && attackTime < 20) {
    return "footstep";
  }

  // Long, low RMS -> ambient
  if (duration > 2.0 && rms < 0.15) {
    return "ambient";
  }

  // Moderate duration, moderate RMS -> character
  if (duration >= 0.1 && duration <= 1.5) {
    return "character";
  }

  return "unknown";
}

/**
 * Category dimension classifier.
 *
 * Uses recipe metadata as the primary signal for category, with
 * analysis-metric-based fallback for unknown sources.
 */
export class CategoryClassifier implements DimensionClassifier {
  readonly name = "category";

  classify(analysis: AnalysisResult, context?: RecipeContext): DimensionResult {
    // Primary signal: recipe metadata
    // Normalize to lowercase hyphenated form (e.g. "Card Game" -> "card-game")
    // to match the canonical vocabulary used in RECIPE_NAME_CATEGORY_MAP.
    if (context?.category) {
      return { category: context.category.toLowerCase().replace(/\s+/g, "-") };
    }

    // Secondary signal: recipe name parsing
    if (context?.name) {
      const firstSegment = context.name.split("-")[0]!;
      const mapped = RECIPE_NAME_CATEGORY_MAP[firstSegment];
      if (mapped) {
        return { category: mapped };
      }
    }

    // Fallback: metric-based heuristics
    return { category: inferCategoryFromMetrics(analysis) };
  }
}
