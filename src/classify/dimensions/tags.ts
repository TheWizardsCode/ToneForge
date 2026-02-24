/**
 * Tags Dimension Classifier
 *
 * Generates contextual use-case tags from recipe metadata and the
 * assigned category. When recipe tags exist, they are used as the
 * primary source (with deduplication of the category name). When no
 * recipe metadata exists, tags are derived from the category and
 * intensity dimensions.
 *
 * Reference: docs/prd/CLASSIFY_PRD.md Section 5.5
 */

import type { AnalysisResult } from "../../analyze/types.js";
import type { DimensionClassifier, DimensionResult, RecipeContext } from "../types.js";

/**
 * Category-based fallback tag generation.
 * Used when no recipe metadata is available.
 */
const CATEGORY_FALLBACK_TAGS: Record<string, string[]> = {
  weapon: ["combat", "action"],
  footstep: ["movement", "environment"],
  ui: ["interface", "feedback"],
  ambient: ["environment", "atmosphere"],
  character: ["action", "movement"],
  creature: ["creature", "organic"],
  vehicle: ["vehicle", "mechanical"],
  impact: ["collision", "destruction"],
  unknown: ["unclassified"],
};

/**
 * Tags dimension classifier.
 *
 * When recipe metadata is available, recipe tags are the primary source.
 * Tags that duplicate the category name are removed. The result is
 * deduplicated, lowercased, and alphabetically sorted.
 *
 * When no recipe metadata is available, tags are derived from the
 * category using a fallback lookup table.
 */
export class TagsClassifier implements DimensionClassifier {
  readonly name = "tags";

  classify(analysis: AnalysisResult, context?: RecipeContext): DimensionResult {
    // Determine the category (already set by a prior classifier)
    // We use context.category for filtering, lowercased
    const categoryLower = context?.category?.toLowerCase() ?? "";

    // Primary source: recipe tags
    if (context?.tags && context.tags.length > 0) {
      const filtered = context.tags
        .map((t) => t.toLowerCase())
        .filter((t) => t !== categoryLower)
        .filter((t) => {
          // Also filter out tags that are just the category name
          // (e.g. "weapon" tag when category is "weapon")
          return t !== categoryLower;
        });

      // Deduplicate and sort
      const unique = [...new Set(filtered)].sort();
      return { tags: unique.slice(0, 5) };
    }

    // Fallback: category-based tags
    const fallback = CATEGORY_FALLBACK_TAGS[categoryLower] ?? CATEGORY_FALLBACK_TAGS["unknown"]!;
    return { tags: [...fallback].sort() };
  }
}
