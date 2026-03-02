/**
 * TUI Wizard Stage 2 -- Sweep, Ranking, Audition, and Mutation.
 *
 * Stage 2a: For each recipe in the palette manifest, runs an automated
 * sweep over seed range 0:19 (20 seeds), ranks candidates by composite
 * metrics, and presents the top 5 results with progress feedback.
 *
 * Stage 2b: Interactive candidate audition with play/stop preview and
 * optional seed mutation for finer refinement. The user can select one
 * candidate per recipe, skip recipes to revisit later, and trigger
 * jitter-based mutations around a promising seed.
 *
 * Sweep results are cached in session state so re-entering the stage
 * does not re-sweep unless explicitly requested.
 *
 * Reference: Work items TF-0MM8S1JZX1GYYQT0, TF-0MM8S1W4C0NQ1CW6
 * Parent epic: TF-0MM7HULM506CGSOP
 */

import { select, confirm, Separator } from "@inquirer/prompts";
import { sweep, mutate, defaultConcurrency } from "../../explore/sweep.js";
import { rankCandidates, keepTopN } from "../../explore/ranking.js";
import { renderRecipe } from "../../core/renderer.js";
import { playAudio } from "../../audio/player.js";
import type {
  ExploreCandidate,
  SweepConfig,
  MutateConfig,
  RankMetric,
  ProgressCallback,
} from "../../explore/types.js";
import { VALID_RANK_METRICS } from "../../explore/types.js";
import { outputInfo, outputError, outputSuccess } from "../../output.js";
import type { WizardSession } from "../state.js";
import type { ManifestEntry, CandidateSelection, SweepCache } from "../types.js";

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

  // Stage 2b -- Audition and Selection
  const auditionResult = await auditionCandidates(session, results);

  return auditionResult;
}

// ---------------------------------------------------------------------------
// Stage 2b -- Audition and Mutation
// ---------------------------------------------------------------------------

/** Default jitter factor for seed mutation (0-1). */
const DEFAULT_JITTER = 0.1;

/** Default number of mutation variations to generate. */
const DEFAULT_MUTATION_COUNT = 20;

/** Maximum number of top mutation candidates to present. */
const MUTATION_KEEP_TOP = 5;

/** Action the user can take during candidate audition. */
export type AuditionAction =
  | { type: "select"; candidateIndex: number }
  | { type: "play"; candidateIndex: number }
  | { type: "mutate"; candidateIndex: number }
  | { type: "skip" }
  | { type: "back" };

/**
 * Format a candidate choice label for the audition select menu.
 *
 * Shows: rank, seed number, score, classification category, and duration.
 */
export function formatAuditionChoice(
  candidate: ExploreCandidate,
  rank: number,
): string {
  const seed = String(candidate.seed).padStart(2, " ");
  const score = candidate.score.toFixed(3);
  const category = candidate.classification?.category ?? "unknown";
  const duration = candidate.duration.toFixed(2);
  return `#${rank} seed ${seed} | score: ${score} | ${category} | ${duration}s`;
}

/**
 * Build the inquirer select choices for a recipe's audition menu.
 *
 * Produces choices for each candidate (play preview, select, mutate)
 * plus skip and back options.
 */
export function buildAuditionChoices(
  candidates: ExploreCandidate[],
): Array<{ value: AuditionAction; name: string } | InstanceType<typeof Separator>> {
  const choices: Array<{ value: AuditionAction; name: string } | InstanceType<typeof Separator>> = [];

  for (let i = 0; i < candidates.length; i++) {
    const label = formatAuditionChoice(candidates[i]!, i + 1);
    choices.push({
      value: { type: "play", candidateIndex: i } as AuditionAction,
      name: `Play  ${label}`,
    });
    choices.push({
      value: { type: "select", candidateIndex: i } as AuditionAction,
      name: `Select  ${label}`,
    });
    choices.push({
      value: { type: "mutate", candidateIndex: i } as AuditionAction,
      name: `Mutate  ${label}`,
    });
    choices.push(new Separator());
  }

  choices.push({
    value: { type: "skip" } as AuditionAction,
    name: "Skip this recipe (come back later)",
  });
  choices.push({
    value: { type: "back" } as AuditionAction,
    name: "Back to Define stage",
  });

  return choices;
}

/**
 * Format the audition status summary showing selected/skipped/remaining counts.
 */
export function formatAuditionStatus(
  totalRecipes: number,
  selectedCount: number,
  skippedCount: number,
): string {
  const remaining = totalRecipes - selectedCount - skippedCount;
  const parts: string[] = [];
  parts.push(`${selectedCount}/${totalRecipes} selected`);
  if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
  if (remaining > 0) parts.push(`${remaining} remaining`);
  return parts.join(", ");
}

/**
 * Play a candidate's audio for preview.
 *
 * Renders the recipe at the candidate's seed and plays the audio.
 * Catches errors gracefully to avoid crashing the wizard.
 */
export async function playCandidate(candidate: ExploreCandidate): Promise<void> {
  try {
    outputInfo(`Playing "${candidate.recipe}" at seed ${candidate.seed}...`);
    const result = await renderRecipe(candidate.recipe, candidate.seed);
    await playAudio(result.samples, { sampleRate: result.sampleRate });
    outputInfo("Playback complete.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    outputError(`Playback failed for seed ${candidate.seed}: ${msg}`);
  }
}

/**
 * Run seed mutation around a selected candidate.
 *
 * Generates jitter-based variations using mutate(), ranks them,
 * and returns the top candidates merged with the original set.
 *
 * @param candidate - The base candidate to mutate around.
 * @param existingCandidates - Current candidates to merge with.
 * @returns Updated candidate list with mutations merged in and re-ranked.
 */
export async function runMutation(
  candidate: ExploreCandidate,
  existingCandidates: ExploreCandidate[],
): Promise<ExploreCandidate[]> {
  outputInfo(
    `\nMutating around seed ${candidate.seed} (jitter: ${DEFAULT_JITTER}, count: ${DEFAULT_MUTATION_COUNT})...\n`,
  );

  const config: MutateConfig = {
    recipe: candidate.recipe,
    seed: candidate.seed,
    jitter: DEFAULT_JITTER,
    count: DEFAULT_MUTATION_COUNT,
    rankBy: [...DEFAULT_RANK_METRICS],
    concurrency: defaultConcurrency(),
  };

  const onProgress: ProgressCallback = (completed, total) => {
    outputInfo(`  [${completed}/${total}] Mutating ${candidate.recipe}...`);
  };

  try {
    const mutations = await mutate(config, onProgress);
    rankCandidates(mutations, config.rankBy);
    const topMutations = keepTopN(mutations, MUTATION_KEEP_TOP);

    outputSuccess(
      `  Mutation complete -- ${topMutations.length} variation${topMutations.length === 1 ? "" : "s"} produced.`,
    );

    // Merge mutations with existing candidates, avoiding duplicates by seed
    const existingSeeds = new Set(existingCandidates.map((c) => c.seed));
    const newMutations = topMutations.filter((m) => !existingSeeds.has(m.seed));
    const merged = [...existingCandidates, ...newMutations];

    // Re-rank the merged set
    rankCandidates(merged, config.rankBy);

    outputInfo(
      `  ${newMutations.length} new candidate${newMutations.length === 1 ? "" : "s"} added (${merged.length} total).`,
    );

    return merged;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    outputError(`  Mutation failed: ${msg}`);
    return existingCandidates;
  }
}

/**
 * Run the audition loop for a single recipe.
 *
 * Presents the recipe's top candidates in an interactive menu where
 * the user can play, select, mutate, or skip. Returns the selected
 * candidate or null if the recipe was skipped.
 *
 * @param recipe - Recipe name to audition.
 * @param initialCandidates - Pre-ranked candidates from the sweep.
 * @returns The selected candidate, or null if the user skipped.
 *          Returns "back" if the user wants to return to Stage 1.
 */
export async function auditionRecipe(
  recipe: string,
  initialCandidates: ExploreCandidate[],
): Promise<CandidateSelection | null | "back"> {
  let candidates = [...initialCandidates];

  if (candidates.length === 0) {
    outputInfo(`  No candidates available for "${recipe}". Skipping.`);
    return null;
  }

  while (true) {
    outputInfo(`\nAuditioning ${candidates.length} candidate${candidates.length === 1 ? "" : "s"} for "${recipe}":\n`);

    // Display ranked candidates summary
    for (let i = 0; i < candidates.length; i++) {
      outputInfo(`  ${formatAuditionChoice(candidates[i]!, i + 1)}`);
    }
    outputInfo("");

    const choices = buildAuditionChoices(candidates);
    const action = await select<AuditionAction>({
      message: `"${recipe}" -- Choose an action:`,
      choices,
    });

    switch (action.type) {
      case "play": {
        const candidate = candidates[action.candidateIndex]!;
        await playCandidate(candidate);
        break;
      }

      case "select": {
        const candidate = candidates[action.candidateIndex]!;
        const classification = candidate.classification ?? {
          source: candidate.id,
          category: "unknown",
          intensity: "unknown",
          texture: [],
          material: null,
          tags: [],
          embedding: [],
          analysisRef: "",
        };

        outputSuccess(
          `Selected seed ${candidate.seed} for "${recipe}" (score: ${candidate.score.toFixed(3)}, category: ${classification.category}).`,
        );

        return {
          recipe,
          candidate,
          classification,
        };
      }

      case "mutate": {
        const candidate = candidates[action.candidateIndex]!;
        candidates = await runMutation(candidate, candidates);
        break;
      }

      case "skip":
        outputInfo(`  Skipping "${recipe}" -- you can revisit it later.`);
        return null;

      case "back":
        return "back";
    }
  }
}

/**
 * Run the audition stage for all manifest recipes.
 *
 * Iterates through each recipe in the manifest, presenting candidates
 * for audition. Skipped recipes can be revisited. The user must select
 * at least one candidate before advancing to Stage 3.
 *
 * @param session - Wizard session with manifest and selections.
 * @param sweepResults - Map of recipe name to ranked candidates.
 * @returns "advance" to proceed to Stage 3, or "back" to return to Stage 1.
 */
export async function auditionCandidates(
  session: WizardSession,
  sweepResults: Map<string, ExploreCandidate[]>,
): Promise<"advance" | "back"> {
  const entries = session.manifest.entries;
  const skippedRecipes = new Set<string>();

  outputInfo(
    "\nTime to audition candidates! For each recipe, you can:\n" +
    "  - Play a candidate to hear it\n" +
    "  - Select a candidate as your choice\n" +
    "  - Mutate around a promising seed for fine-tuned variations\n" +
    "  - Skip a recipe to return to it later\n",
  );

  // First pass: go through all recipes in order
  for (const entry of entries) {
    // Skip recipes that already have a selection (from a previous pass or back-navigation)
    if (session.getSelection(entry.recipe)) {
      outputInfo(`  "${entry.recipe}" already selected -- skipping.`);
      continue;
    }

    const candidates = sweepResults.get(entry.recipe) ?? [];
    const status = formatAuditionStatus(
      entries.length,
      session.selections.size,
      skippedRecipes.size,
    );
    outputInfo(`\n[${status}]`);

    const result = await auditionRecipe(entry.recipe, candidates);

    if (result === "back") {
      return "back";
    }

    if (result === null) {
      skippedRecipes.add(entry.recipe);
    } else {
      session.setSelection(entry.recipe, result);
      skippedRecipes.delete(entry.recipe);
    }
  }

  // Revisit loop: handle skipped recipes
  while (skippedRecipes.size > 0) {
    const allSelected = session.allRecipesSelected;
    if (allSelected) break;

    const status = formatAuditionStatus(
      entries.length,
      session.selections.size,
      skippedRecipes.size,
    );
    outputInfo(`\n[${status}]`);

    if (session.selections.size === 0) {
      outputInfo(
        "\nYou must select at least one candidate before advancing.\n" +
        "Please revisit your skipped recipes.\n",
      );
    }

    // Ask the user what to do with skipped recipes
    const skippedList = [...skippedRecipes];
    const revisitChoices: Array<{ value: string; name: string } | InstanceType<typeof Separator>> = [];

    for (const recipe of skippedList) {
      revisitChoices.push({
        value: recipe,
        name: `Revisit "${recipe}"`,
      });
    }

    revisitChoices.push(new Separator());

    if (session.selections.size > 0) {
      revisitChoices.push({
        value: "__advance__",
        name: `Continue with ${session.selections.size} selection${session.selections.size === 1 ? "" : "s"} (skip remaining)`,
      });
    }

    revisitChoices.push({
      value: "__back__",
      name: "Back to Define stage",
    });

    const choice = await select<string>({
      message: `${skippedRecipes.size} recipe${skippedRecipes.size === 1 ? "" : "s"} skipped. What would you like to do?`,
      choices: revisitChoices,
    });

    if (choice === "__advance__") {
      break;
    }

    if (choice === "__back__") {
      return "back";
    }

    // Revisit the selected recipe
    const candidates = sweepResults.get(choice) ?? [];
    const result = await auditionRecipe(choice, candidates);

    if (result === "back") {
      return "back";
    }

    if (result === null) {
      // Still skipped -- leave in the set
    } else {
      session.setSelection(choice, result);
      skippedRecipes.delete(choice);
    }
  }

  // Final validation: must have at least one selection
  if (session.selections.size === 0) {
    outputError(
      "No candidates were selected. You must select at least one before advancing.\n" +
      "Returning to the Define stage.\n",
    );
    return "back";
  }

  // Summary
  const selectedCount = session.selections.size;
  const totalCount = entries.length;
  const skippedCount = totalCount - selectedCount;

  outputSuccess(
    `\nAudition complete: ${selectedCount}/${totalCount} recipe${totalCount === 1 ? "" : "s"} selected.`,
  );

  if (skippedCount > 0) {
    const skippedNames = entries
      .filter((e) => !session.getSelection(e.recipe))
      .map((e) => e.recipe);
    outputInfo(
      `  ${skippedCount} recipe${skippedCount === 1 ? "" : "s"} skipped: ${skippedNames.join(", ")}`,
    );
  }

  outputInfo("\nAdvancing to the Review stage...\n");

  return "advance";
}
