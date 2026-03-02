/**
 * TUI Wizard Stage 2a -- Sweep and Ranking.
 *
 * For each recipe in the palette manifest, runs an automated sweep
 * over seed range 0:19 (20 seeds), ranks candidates by composite
 * metrics, and presents the top 5 results with progress feedback.
 *
 * Sweep results are cached in session state so re-entering the stage
 * does not re-sweep unless explicitly requested.
 *
 * Reference: Work item TF-0MM8S1JZX1GYYQT0
 * Parent epic: TF-0MM7HULM506CGSOP
 */

import { sweep, defaultConcurrency } from "../../explore/sweep.js";
import { rankCandidates, keepTopN } from "../../explore/ranking.js";
import type {
  ExploreCandidate,
  SweepConfig,
  RankMetric,
  ProgressCallback,
} from "../../explore/types.js";
import { VALID_RANK_METRICS } from "../../explore/types.js";
import { outputInfo, outputError, outputSuccess } from "../../output.js";
import type { WizardSession } from "../state.js";
import type { ManifestEntry, SweepCache } from "../types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default seed range start (inclusive). */
const SEED_START = 0;

/** Default seed range end (inclusive). */
const SEED_END = 19;

/** Number of top candidates to keep per recipe. */
const KEEP_TOP = 5;

/** Default rank metrics used for composite scoring. */
const DEFAULT_RANK_METRICS: RankMetric[] = [
  "rms",
  "spectral-centroid",
  "transient-density",
  "attack-time",
];

// ---------------------------------------------------------------------------
// Pure helpers (easily testable)
// ---------------------------------------------------------------------------

/**
 * Format a progress line for a single recipe sweep.
 *
 * Produces a string like: "  [3/20] Sweeping card-flip..."
 */
export function formatProgressLine(
  completed: number,
  total: number,
  recipe: string,
): string {
  return `  [${completed}/${total}] Sweeping ${recipe}...`;
}

/**
 * Format a single candidate for display in the ranked results list.
 *
 * Shows: seed number, RMS, spectral centroid, classification category.
 */
export function formatCandidateRow(candidate: ExploreCandidate): string {
  const seed = String(candidate.seed).padStart(2, " ");
  const rms = extractMetricDisplay(candidate, "rms");
  const centroid = extractMetricDisplay(candidate, "spectral-centroid");
  const category = candidate.classification?.category ?? "unknown";

  return `  seed ${seed} | RMS: ${rms} | Centroid: ${centroid} | Category: ${category}`;
}

/**
 * Extract a display-formatted metric value from a candidate.
 *
 * Returns "N/A" if the metric is not available.
 */
export function extractMetricDisplay(
  candidate: ExploreCandidate,
  metric: string,
): string {
  const metricPath = VALID_RANK_METRICS.find((m) => m === metric);
  if (!metricPath) return "N/A";

  // Look at metricScores (normalized 0-1) if available
  const normalized = candidate.metricScores[metric];
  if (typeof normalized === "number" && Number.isFinite(normalized)) {
    return normalized.toFixed(3);
  }

  return "N/A";
}

/**
 * Format the sweep results summary for a recipe.
 *
 * Displays the recipe name, candidate count, and a table of ranked candidates.
 */
export function formatSweepResults(
  recipe: string,
  candidates: ExploreCandidate[],
): string {
  if (candidates.length === 0) {
    return `  ${recipe}: No candidates produced.`;
  }

  const header = `  ${recipe} -- Top ${candidates.length} candidate${candidates.length === 1 ? "" : "s"}:`;
  const rows = candidates.map(
    (c, i) => `    ${i + 1}. ${formatCandidateRow(c).trimStart()}`,
  );

  return [header, ...rows].join("\n");
}

/**
 * Build a SweepConfig for a recipe using default settings.
 */
export function buildSweepConfig(recipe: string): SweepConfig {
  return {
    recipe,
    seedStart: SEED_START,
    seedEnd: SEED_END,
    rankBy: [...DEFAULT_RANK_METRICS],
    keepTop: KEEP_TOP,
    clusters: 3,
    concurrency: defaultConcurrency(),
  };
}

/**
 * Format the overall sweep progress across all manifest recipes.
 *
 * Produces: "Recipe 2/5: card-flip"
 */
export function formatManifestProgress(
  recipeIndex: number,
  totalRecipes: number,
  recipe: string,
): string {
  return `Recipe ${recipeIndex + 1}/${totalRecipes}: ${recipe}`;
}

// ---------------------------------------------------------------------------
// Sweep orchestration
// ---------------------------------------------------------------------------

/**
 * Sweep a single recipe: render seeds, rank, and keep top N.
 *
 * Uses the session sweep cache to avoid redundant sweeps.
 * Calls the progress callback once per seed rendered.
 *
 * @param recipe - Recipe name to sweep.
 * @param session - Wizard session for cache access.
 * @param onSeedProgress - Called after each seed is rendered.
 * @returns Top N ranked candidates for this recipe.
 */
export async function sweepRecipe(
  recipe: string,
  session: WizardSession,
  onSeedProgress?: ProgressCallback,
): Promise<ExploreCandidate[]> {
  // Check cache first
  const cached = session.getSweepCache(recipe);
  if (cached) {
    return cached.candidates;
  }

  const config = buildSweepConfig(recipe);

  // Run the sweep with progress callback
  const candidates = await sweep(config, onSeedProgress);

  // Rank candidates by composite metrics
  rankCandidates(candidates, config.rankBy);

  // Keep top N
  const top = keepTopN(candidates, config.keepTop);

  // Cache results in session
  const cache: SweepCache = {
    recipe,
    candidates: top,
  };
  session.setSweepCache(recipe, cache);

  return top;
}

/**
 * Sweep all recipes in the manifest, displaying progress.
 *
 * For each recipe:
 *   1. Checks the session cache (skips if already swept)
 *   2. Runs a sweep over seeds 0-19
 *   3. Ranks and keeps the top 5 candidates
 *   4. Displays progress and results
 *
 * @param session - Wizard session with manifest and cache.
 * @returns Map of recipe name to top ranked candidates.
 */
export async function sweepManifest(
  session: WizardSession,
): Promise<Map<string, ExploreCandidate[]>> {
  const entries = session.manifest.entries;
  const results = new Map<string, ExploreCandidate[]>();

  if (entries.length === 0) {
    outputError("No recipes in manifest. Cannot sweep.");
    return results;
  }

  outputInfo(
    `\nSweeping ${entries.length} recipe${entries.length === 1 ? "" : "s"} ` +
    `(seeds ${SEED_START}-${SEED_END}, ${SEED_END - SEED_START + 1} per recipe)...\n`,
  );

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const cached = session.hasSweepCache(entry.recipe);

    outputInfo(formatManifestProgress(i, entries.length, entry.recipe));

    if (cached) {
      const cachedResults = session.getSweepCache(entry.recipe)!;
      results.set(entry.recipe, cachedResults.candidates);
      outputInfo("  (cached -- skipping sweep)");
      outputInfo(formatSweepResults(entry.recipe, cachedResults.candidates));
      outputInfo("");
      continue;
    }

    // Create progress callback for this recipe
    const seedTotal = SEED_END - SEED_START + 1;
    const onProgress: ProgressCallback = (completed, total) => {
      outputInfo(formatProgressLine(completed, total, entry.recipe));
    };

    try {
      const candidates = await sweepRecipe(entry.recipe, session, onProgress);
      results.set(entry.recipe, candidates);

      outputSuccess(`  Sweep complete -- ${candidates.length} top candidate${candidates.length === 1 ? "" : "s"} selected.`);
      outputInfo(formatSweepResults(entry.recipe, candidates));
      outputInfo("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputError(`  Sweep failed for "${entry.recipe}": ${msg}`);
      results.set(entry.recipe, []);
    }
  }

  // Summary
  const totalCandidates = [...results.values()].reduce((sum, c) => sum + c.length, 0);
  outputSuccess(
    `\nSweep complete: ${totalCandidates} candidates across ${results.size} recipe${results.size === 1 ? "" : "s"}.\n`,
  );

  return results;
}

/**
 * Run the Explore stage (Stage 2a -- Sweep and Ranking).
 *
 * Sweeps all manifest recipes, displays ranked results, and
 * returns control to the wizard pipeline. The audition/selection
 * portion (Stage 2b) will extend this module.
 *
 * @returns "advance" to proceed to Stage 3, or "back" to return to Stage 1.
 */
export async function runExploreStage(
  session: WizardSession,
): Promise<"advance" | "back"> {
  outputInfo(
    "\nExploring seed variations for your palette recipes.\n" +
    "Each recipe will be swept across 20 seeds and ranked by audio quality metrics.\n",
  );

  // Run sweeps for all manifest recipes
  const results = await sweepManifest(session);

  // Check if we got any candidates
  const totalCandidates = [...results.values()].reduce((sum, c) => sum + c.length, 0);

  if (totalCandidates === 0) {
    outputError(
      "No candidates were produced. This may indicate a problem with the recipes.\n" +
      "Returning to the Define stage to review your palette.\n",
    );
    return "back";
  }

  // Stage 2b (audition and selection) will be added by TF-0MM8S1W4C0NQ1CW6.
  // For now, advance to the next stage after sweep completes.
  outputInfo(
    "Sweep and ranking complete. Candidate audition will be available in a future update.\n" +
    "Advancing to the Review stage...\n",
  );

  return "advance";
}
