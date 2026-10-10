/**
 * ToneForge Intelligence — exploration suggestion engine.
 *
 * `suggestExploration` looks at how a recipe is currently represented in the
 * library (which seeds are covered, how tightly the entries cluster) and
 * proposes concrete, runnable exploration targets: adjacent seed windows, a
 * distant seed region for diversity, and parameter jitter for tightly
 * clustered recipes.
 *
 * Every suggestion names the recipe, carries an explicit seed range and a
 * confidence in [0, 1], and references a real `toneforge explore` command.
 *
 * Reference: docs/prd/INTELLIGENCE_PRD.md §5.3 (Guided Exploration),
 * §5.4 (Variant Generation Suggestions).
 */

import type { LibraryEntry } from "../library/types.js";
import { exploreMutateCommand, exploreSweepCommand } from "./commands.js";
import {
  clamp,
  euclideanDistance,
  hasEmbedding,
  loadLibraryEntries,
  roundTo,
} from "./library.js";
import type { ExplorationSuggestion, SuggestExplorationReport } from "./types.js";
import { INTELLIGENCE_VERSION } from "./types.js";

/** Options for {@link buildExplorationSuggestions}. */
export interface SuggestExplorationOptions {
  /**
   * Size of a proposed seed window. Defaults to the current coverage span
   * (at least 100 seeds).
   */
  windowSize?: number;

  /** Embedding spread below which entries are considered tightly clustered. Default: 0.1. */
  tightnessThreshold?: number;
}

const DEFAULT_WINDOW = 100;
const DEFAULT_TIGHTNESS = 0.1;

/** Sort recipe entries deterministically by seed, then id. */
function recipeEntriesFor(entries: LibraryEntry[], recipe: string): LibraryEntry[] {
  return entries
    .filter((entry) => entry.recipe === recipe)
    .sort((a, b) => {
      if (a.seed !== b.seed) return a.seed - b.seed;
      return a.id.localeCompare(b.id);
    });
}

/** Average pairwise embedding distance across entries (0 when < 2 embeddings). */
function averagePairwiseDistance(entries: LibraryEntry[]): number {
  const withEmbeddings = entries.filter(hasEmbedding);
  if (withEmbeddings.length < 2) return 0;

  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < withEmbeddings.length; i++) {
    for (let j = i + 1; j < withEmbeddings.length; j++) {
      sum += euclideanDistance(
        withEmbeddings[i]!.classification!.embedding,
        withEmbeddings[j]!.classification!.embedding,
      );
      pairs++;
    }
  }
  return pairs > 0 ? sum / pairs : 0;
}

/**
 * Build exploration suggestions from in-memory entries (pure; no I/O).
 */
export function buildExplorationSuggestions(
  entries: LibraryEntry[],
  recipe: string,
  options?: SuggestExplorationOptions,
): SuggestExplorationReport {
  const recipeEntries = recipeEntriesFor(entries, recipe);
  const suggestions: ExplorationSuggestion[] = [];

  if (recipeEntries.length === 0) {
    suggestions.push({
      recipe,
      seedRange: { start: 0, end: 99 },
      confidence: 0.6,
      rationale:
        `No library entries currently use recipe '${recipe}'; sweep a modest ` +
        `seed range to find representative variants.`,
      suggestedCommand: exploreSweepCommand(recipe, 0, 99, "rms"),
    });
    return {
      command: "intelligence suggest-exploration",
      version: INTELLIGENCE_VERSION,
      readOnly: true,
      dryRun: true,
      recipe,
      suggestions,
    };
  }

  const seeds = recipeEntries.map((entry) => entry.seed);
  const minSeed = Math.min(...seeds);
  const maxSeed = Math.max(...seeds);
  const span = maxSeed - minSeed + 1;
  const window = Math.max(
    DEFAULT_WINDOW,
    options?.windowSize ?? span,
  );

  // 1. Adjacent seed window — extend beyond current coverage.
  const nextStart = maxSeed + 1;
  const nextEnd = maxSeed + window;
  suggestions.push({
    recipe,
    seedRange: { start: nextStart, end: nextEnd },
    confidence: roundTo(clamp(0.5 + Math.min(0.4, recipeEntries.length * 0.05), 0, 1), 4),
    rationale:
      `Current coverage spans seeds ${minSeed}-${maxSeed} ` +
      `(${recipeEntries.length} entr${recipeEntries.length === 1 ? "y" : "ies"}); ` +
      `explore the adjacent range ${nextStart}-${nextEnd} for new variants.`,
    suggestedCommand: exploreSweepCommand(recipe, nextStart, nextEnd, "rms"),
  });

  // 2. Distant seed region — for perceptual diversity.
  const farStart = Math.max(nextEnd + 1, 1000);
  const farEnd = farStart + window - 1;
  suggestions.push({
    recipe,
    seedRange: { start: farStart, end: farEnd },
    confidence: 0.5,
    rationale:
      `Seeds far from the explored region often yield distinct timbres; ` +
      `sample the distant range ${farStart}-${farEnd}.`,
    suggestedCommand: exploreSweepCommand(recipe, farStart, farEnd, "rms"),
  });

  // 3. Parameter jitter — widen tightly clustered entries.
  const spread = averagePairwiseDistance(recipeEntries);
  const mutationSeed = maxSeed;
  if (recipeEntries.length >= 2 && spread < (options?.tightnessThreshold ?? DEFAULT_TIGHTNESS)) {
    suggestions.push({
      recipe,
      seedRange: { start: mutationSeed, end: mutationSeed },
      confidence: 0.7,
      rationale:
        `Entries cluster tightly (average embedding distance ` +
        `${roundTo(spread, 3)}); increase parameter jitter around seed ` +
        `${mutationSeed} to widen the timbre.`,
      suggestedCommand: exploreMutateCommand(recipe, mutationSeed, 0.25, 20),
    });
  } else {
    suggestions.push({
      recipe,
      seedRange: { start: mutationSeed, end: mutationSeed },
      confidence: 0.55,
      rationale:
        `Mutate around the highest covered seed ${mutationSeed} to probe ` +
        `nearby parameter variations.`,
      suggestedCommand: exploreMutateCommand(recipe, mutationSeed, 0.15, 20),
    });
  }

  return {
    command: "intelligence suggest-exploration",
    version: INTELLIGENCE_VERSION,
    readOnly: true,
    dryRun: true,
    recipe,
    suggestions,
  };
}

/**
 * Suggest exploration targets for a recipe.
 *
 * Read-only: never writes to the library.
 *
 * @param recipe - Recipe name to explore.
 * @param libraryDir - Directory containing `index.json`.
 * @param options - Optional engine tuning.
 */
export async function suggestExploration(
  recipe: string,
  libraryDir: string,
  options?: SuggestExplorationOptions,
): Promise<SuggestExplorationReport> {
  const entries = await loadLibraryEntries(libraryDir);
  return buildExplorationSuggestions(entries, recipe, options);
}
