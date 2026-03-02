/**
 * TUI Wizard Stage 3 -- Review and Refine.
 *
 * Displays the full palette summary with classification attributes
 * (category, intensity, texture, tags), flags coherence outliers via
 * simple median deviation, and allows swapping, adding, or removing
 * selections before advancing to Export.
 *
 * Reference: Work item TF-0MM8S29GD0JJ1WTC
 * Parent epic: TF-0MM7HULM506CGSOP
 */

import { select, confirm } from "@inquirer/prompts";
import { outputInfo, outputError, outputSuccess, outputTable } from "../../output.js";
import type { TableColumn } from "../../output.js";
import type { WizardSession } from "../state.js";
import type { CandidateSelection } from "../types.js";
import { auditionRecipe } from "./explore.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Ordered intensity scale from least to most intense.
 *
 * Index position is used for median calculation and deviation checks.
 * "subtle" is the lowest energy (ambient textures with low peak but
 * moderate spectral centroid) and "aggressive" is the highest.
 */
const INTENSITY_SCALE: readonly string[] = [
  "subtle",
  "soft",
  "medium",
  "hard",
  "aggressive",
] as const;

/**
 * Ordered texture scale (alphabetical).
 *
 * Index position is used for median calculation. Since textures are
 * multi-valued (each entry can have 1-3 labels), we use the median
 * index of each entry's texture array as its representative value,
 * then compute the palette median across entries.
 */
const TEXTURE_SCALE: readonly string[] = [
  "bright",
  "crunchy",
  "dark",
  "harsh",
  "noisy",
  "sharp",
  "smooth",
  "tonal",
  "warm",
] as const;

/** Minimum palette size for coherence checking. */
const MIN_COHERENCE_SIZE = 3;

/** Maximum deviation (in ordinal steps) before flagging. */
const COHERENCE_THRESHOLD = 1;

// ---------------------------------------------------------------------------
// Pure helpers (easily testable)
// ---------------------------------------------------------------------------

/**
 * Map an intensity label to its ordinal index on the intensity scale.
 *
 * @returns 0-based index, or -1 for unknown/unrecognised labels.
 */
export function intensityIndex(label: string): number {
  const idx = INTENSITY_SCALE.indexOf(label.toLowerCase());
  return idx;
}

/**
 * Map a texture label to its ordinal index on the texture scale.
 *
 * @returns 0-based index, or -1 for unknown/unrecognised labels.
 */
export function textureIndex(label: string): number {
  const idx = TEXTURE_SCALE.indexOf(label.toLowerCase());
  return idx;
}

/**
 * Compute the median of an array of numbers.
 *
 * For an even-length array, returns the lower of the two middle values
 * (integer median -- no interpolation). Returns -1 for an empty array.
 */
export function median(values: number[]): number {
  if (values.length === 0) return -1;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor((sorted.length - 1) / 2);
  return sorted[mid]!;
}

/**
 * Compute the palette median intensity index.
 *
 * Extracts the intensity label from each selection's classification,
 * converts to ordinal indices, filters out unknowns (-1), and
 * returns the median index.
 */
export function medianIntensity(selections: CandidateSelection[]): number {
  const indices = selections
    .map((s) => intensityIndex(s.classification.intensity))
    .filter((i) => i >= 0);
  return median(indices);
}

/**
 * Compute the representative texture index for a single selection.
 *
 * Takes the median of the ordinal indices of all texture labels in
 * the selection's classification. Returns -1 if no valid textures.
 */
export function selectionTextureIndex(selection: CandidateSelection): number {
  const indices = (selection.classification.texture ?? [])
    .map((t) => textureIndex(t))
    .filter((i) => i >= 0);
  return median(indices);
}

/**
 * Compute the palette median texture index.
 *
 * For each selection, computes a representative texture index (median
 * of its texture labels), then returns the median across all selections.
 */
export function medianTextureIndex(selections: CandidateSelection[]): number {
  const indices = selections
    .map((s) => selectionTextureIndex(s))
    .filter((i) => i >= 0);
  return median(indices);
}

/**
 * Flag palette entries whose intensity or texture deviates more than
 * COHERENCE_THRESHOLD ordinal steps from the palette median.
 *
 * If the palette has fewer than MIN_COHERENCE_SIZE entries,
 * returns an empty set (coherence check is skipped).
 *
 * @returns Set of recipe names that are flagged as outliers.
 */
export function flagCoherenceOutliers(
  selections: CandidateSelection[],
): Set<string> {
  const outliers = new Set<string>();

  if (selections.length < MIN_COHERENCE_SIZE) {
    return outliers;
  }

  const medInt = medianIntensity(selections);
  const medTex = medianTextureIndex(selections);

  for (const sel of selections) {
    const intIdx = intensityIndex(sel.classification.intensity);
    const texIdx = selectionTextureIndex(sel);

    // Flag if intensity deviates by more than threshold
    if (intIdx >= 0 && medInt >= 0 && Math.abs(intIdx - medInt) > COHERENCE_THRESHOLD) {
      outliers.add(sel.recipe);
      continue;
    }

    // Flag if texture deviates by more than threshold
    if (texIdx >= 0 && medTex >= 0 && Math.abs(texIdx - medTex) > COHERENCE_THRESHOLD) {
      outliers.add(sel.recipe);
    }
  }

  return outliers;
}

/** Column definitions for the palette summary table. */
export const summaryColumns: TableColumn[] = [
  { header: "Recipe", width: 30 },
  { header: "Seed", width: 6 },
  { header: "Category", width: 12 },
  { header: "Intensity", width: 12 },
  { header: "Texture", width: 25 },
  { header: "Tags", width: 25 },
];

/**
 * Build table rows for the palette summary.
 *
 * Each row contains: recipe name (with warning indicator if flagged),
 * seed, category, intensity, texture labels, and tags.
 *
 * @param selections - Ordered list of candidate selections.
 * @param outliers - Set of recipe names flagged as coherence outliers.
 * @returns Array of string arrays suitable for formatTable/outputTable.
 */
export function buildSummaryRows(
  selections: CandidateSelection[],
  outliers: Set<string>,
): string[][] {
  return selections.map((sel) => {
    const isFlagged = outliers.has(sel.recipe);
    const recipeName = isFlagged ? `!! ${sel.recipe}` : sel.recipe;
    const seed = String(sel.candidate.seed);
    const category = sel.classification.category || "unknown";
    const intensity = sel.classification.intensity || "unknown";
    const texture = (sel.classification.texture ?? []).join(", ") || "-";
    const tags = (sel.classification.tags ?? []).join(", ") || "-";

    return [recipeName, seed, category, intensity, texture, tags];
  });
}

// ---------------------------------------------------------------------------
// Interactive flow
// ---------------------------------------------------------------------------

/** Action types for the review menu. */
type ReviewAction =
  | { type: "confirm" }
  | { type: "swap" }
  | { type: "add" }
  | { type: "remove" }
  | { type: "back" };

/**
 * Display the palette summary table and coherence check results.
 *
 * @param session - Wizard session with selections.
 * @returns The set of outlier recipe names (empty if skipped).
 */
function displayPaletteSummary(session: WizardSession): Set<string> {
  const selections = getOrderedSelections(session);

  if (selections.length === 0) {
    outputInfo("  No selections in palette.\n");
    return new Set();
  }

  // Compute coherence outliers
  const outliers = flagCoherenceOutliers(selections);

  // Build and display summary table
  const rows = buildSummaryRows(selections, outliers);
  outputTable(summaryColumns, rows);

  // Display coherence results
  if (selections.length < MIN_COHERENCE_SIZE) {
    outputInfo(
      `\n  Coherence check skipped (need at least ${MIN_COHERENCE_SIZE} entries, have ${selections.length}).\n`,
    );
  } else if (outliers.size === 0) {
    outputSuccess("  Palette coherence: all entries are within expected range.\n");
  } else {
    outputInfo(
      `\n  Coherence warnings: ${outliers.size} entr${outliers.size === 1 ? "y" : "ies"} flagged:\n`,
    );
    for (const recipe of outliers) {
      const sel = session.getSelection(recipe);
      if (sel) {
        outputInfo(
          `    - "${recipe}": intensity=${sel.classification.intensity}, ` +
          `texture=[${(sel.classification.texture ?? []).join(", ")}]`,
        );
      }
    }
    outputInfo(
      "\n  Consider swapping flagged entries for better palette coherence.\n",
    );
  }

  return outliers;
}

/**
 * Get selections in manifest order.
 *
 * Returns the selections as an ordered array following the manifest
 * entry order, excluding any manifest entries without selections.
 */
export function getOrderedSelections(session: WizardSession): CandidateSelection[] {
  return session.manifest.entries
    .map((entry) => session.getSelection(entry.recipe))
    .filter((sel): sel is CandidateSelection => sel !== undefined);
}

/**
 * Run the Review and Refine stage.
 *
 * Displays the palette summary with coherence checking and provides
 * an action menu for swapping, adding, removing, confirming, or
 * going back.
 *
 * @param session - Wizard session with manifest and selections.
 * @returns "advance" to proceed to Export, or "back" to return to Explore.
 */
export async function runReviewStage(
  session: WizardSession,
): Promise<"advance" | "back"> {
  while (true) {
    // Display palette summary and coherence check
    displayPaletteSummary(session);

    const selections = getOrderedSelections(session);

    // Build the review action menu
    const choices: Array<{ value: ReviewAction; name: string }> = [];

    if (selections.length > 0) {
      choices.push({
        value: { type: "confirm" },
        name: `Confirm palette (${selections.length} sound${selections.length === 1 ? "" : "s"}) and advance to Export`,
      });
      choices.push({
        value: { type: "swap" },
        name: "Swap a selection (re-audition a recipe)",
      });
    }

    choices.push({
      value: { type: "add" },
      name: "Add more recipes (return to Define stage)",
    });

    if (selections.length > 0) {
      choices.push({
        value: { type: "remove" },
        name: "Remove a recipe from the palette",
      });
    }

    choices.push({
      value: { type: "back" },
      name: "Back to Explore stage",
    });

    const action = await select<ReviewAction>({
      message: "What would you like to do?",
      choices,
    });

    switch (action.type) {
      case "confirm": {
        const proceed = await confirm({
          message: `Finalise palette with ${selections.length} sound${selections.length === 1 ? "" : "s"} and advance to Export?`,
          default: true,
        });
        if (proceed) {
          outputSuccess(
            `\nPalette confirmed with ${selections.length} sound${selections.length === 1 ? "" : "s"}. Advancing to Export...\n`,
          );
          return "advance";
        }
        // User declined -- loop back to menu
        break;
      }

      case "swap": {
        await handleSwap(session);
        break;
      }

      case "add": {
        outputInfo("\nReturning to Define stage to add more recipes...\n");
        return "back";
      }

      case "remove": {
        await handleRemove(session);
        break;
      }

      case "back": {
        return "back";
      }
    }
  }
}

/**
 * Handle the swap action: let the user pick a recipe to re-audition.
 *
 * Presents a selection menu of current palette entries, then runs
 * auditionRecipe for the chosen recipe using cached sweep results.
 */
async function handleSwap(session: WizardSession): Promise<void> {
  const selections = getOrderedSelections(session);

  if (selections.length === 0) {
    outputInfo("  No selections to swap.\n");
    return;
  }

  const recipeChoices = selections.map((sel) => ({
    value: sel.recipe,
    name: `${sel.recipe} (seed ${sel.candidate.seed}, ${sel.classification.category}, ${sel.classification.intensity})`,
  }));

  recipeChoices.push({
    value: "__cancel__",
    name: "Cancel",
  });

  const recipe = await select<string>({
    message: "Which recipe would you like to re-audition?",
    choices: recipeChoices,
  });

  if (recipe === "__cancel__") return;

  // Get cached sweep results for this recipe
  const cache = session.getSweepCache(recipe);
  const candidates = cache?.candidates ?? [];

  if (candidates.length === 0) {
    outputError(`  No cached candidates for "${recipe}". Cannot re-audition.\n`);
    return;
  }

  outputInfo(`\nRe-auditioning "${recipe}"...\n`);

  const result = await auditionRecipe(recipe, candidates);

  if (result === "back" || result === null) {
    outputInfo(`  Keeping original selection for "${recipe}".\n`);
    return;
  }

  // Update the selection
  session.setSelection(recipe, result);
  outputSuccess(`  Updated selection for "${recipe}" to seed ${result.candidate.seed}.\n`);
}

/**
 * Handle the remove action: let the user pick a recipe to remove.
 *
 * Removes the selection and manifest entry for the chosen recipe.
 * Warns if removing the last entry.
 */
async function handleRemove(session: WizardSession): Promise<void> {
  const selections = getOrderedSelections(session);

  if (selections.length === 0) {
    outputInfo("  No selections to remove.\n");
    return;
  }

  if (selections.length === 1) {
    outputInfo(
      "  Warning: This is your only selection. Removing it will leave the palette empty.\n",
    );
  }

  const recipeChoices = selections.map((sel) => ({
    value: sel.recipe,
    name: `${sel.recipe} (seed ${sel.candidate.seed}, ${sel.classification.category})`,
  }));

  recipeChoices.push({
    value: "__cancel__",
    name: "Cancel",
  });

  const recipe = await select<string>({
    message: "Which recipe would you like to remove?",
    choices: recipeChoices,
  });

  if (recipe === "__cancel__") return;

  const doRemove = await confirm({
    message: `Remove "${recipe}" from the palette?`,
    default: false,
  });

  if (!doRemove) return;

  session.removeSelection(recipe);
  session.removeFromManifest(recipe);
  outputSuccess(`  Removed "${recipe}" from the palette.\n`);

  if (session.selections.size === 0) {
    outputInfo(
      "  Warning: Palette is now empty. Add recipes or go back to rebuild your palette.\n",
    );
  }
}
