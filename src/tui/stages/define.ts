/**
 * TUI Wizard Stage 1 -- Define Your Palette.
 *
 * Stage 1a: Provides interactive recipe browsing by category with
 * filtering and inline play/stop preview at a default seed.
 *
 * Stage 1b: Builds, reviews, and confirms the palette manifest.
 * The user can add/remove recipes, review the manifest as a numbered
 * list, and confirm before advancing to Stage 2.
 *
 * Reference: Work items TF-0MM8S0Y021PI6KW1, TF-0MM8S17RQ0U4Y4H1
 * Parent epic: TF-0MM7HULM506CGSOP
 */

import { select, input, confirm, Separator } from "@inquirer/prompts";
import type { RecipeDetailedSummary, RecipeFilterQuery } from "../../core/recipe.js";
import { registry } from "../../recipes/index.js";
import { renderRecipe } from "../../core/renderer.js";
import { playAudio } from "../../audio/player.js";
import type { PlaybackLifecycleHooks } from "../../audio/player.js";
import { outputInfo, outputError, outputSuccess } from "../../output.js";
import type { WizardSession } from "../state.js";
import type { ManifestEntry } from "../types.js";
import { trackProcess, trackTempFile, untrackTempFile } from "../cleanup.js";

/** Default seed for recipe preview playback. */
const PREVIEW_SEED = 0;

/** Lifecycle hooks that wire playAudio into the TUI cleanup handler. */
const cleanupHooks: PlaybackLifecycleHooks = {
  onProcessSpawned: trackProcess,
  onTempFileCreated: trackTempFile,
  onTempFileRemoved: untrackTempFile,
};

// ---------------------------------------------------------------------------
// Pure helpers (easily testable)
// ---------------------------------------------------------------------------

/**
 * Group recipes by category.
 *
 * Returns a Map where keys are category names (sorted) and values
 * are the recipes belonging to that category.
 */
export function groupByCategory(
  recipes: RecipeDetailedSummary[],
): Map<string, RecipeDetailedSummary[]> {
  const groups = new Map<string, RecipeDetailedSummary[]>();
  for (const r of recipes) {
    const cat = r.category || "uncategorized";
    let list = groups.get(cat);
    if (!list) {
      list = [];
      groups.set(cat, list);
    }
    list.push(r);
  }
  // Sort keys alphabetically
  const sorted = new Map(
    [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
  return sorted;
}

/**
 * Extract unique sorted category names from a recipe list.
 */
export function extractCategories(recipes: RecipeDetailedSummary[]): string[] {
  const cats = new Set<string>();
  for (const r of recipes) {
    if (r.category) cats.add(r.category);
  }
  return [...cats].sort();
}

/**
 * Format a recipe for display as a select choice label.
 *
 * Shows: name | description (truncated) | [tags]
 */
export function formatRecipeChoice(recipe: RecipeDetailedSummary): string {
  const desc =
    recipe.description.length > 50
      ? recipe.description.slice(0, 47) + "..."
      : recipe.description;
  const tags =
    recipe.tags.length > 0 ? ` [${recipe.tags.slice(0, 3).join(", ")}]` : "";
  return `${recipe.name} -- ${desc}${tags}`;
}

/**
 * Convert a RecipeDetailedSummary to a ManifestEntry.
 */
export function toManifestEntry(recipe: RecipeDetailedSummary): ManifestEntry {
  return {
    recipe: recipe.name,
    description: recipe.description,
    category: recipe.category,
    tags: [...recipe.tags],
  };
}

/**
 * Build a RecipeFilterQuery from user-provided search text.
 *
 * If the text is empty or whitespace-only, returns undefined (no filter).
 */
export function buildFilterQuery(
  searchText: string,
): RecipeFilterQuery | undefined {
  const trimmed = searchText.trim();
  if (trimmed.length === 0) return undefined;
  return { search: trimmed };
}

/**
 * Format the palette manifest as a numbered summary string.
 *
 * Each line shows: index. recipe-name (category)
 * Returns an empty string if the manifest is empty.
 */
export function formatManifestSummary(entries: ManifestEntry[]): string {
  if (entries.length === 0) return "";
  return entries
    .map((e, i) => `  ${i + 1}. ${e.recipe} (${e.category || "uncategorized"})`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Interactive browsing
// ---------------------------------------------------------------------------

/** Action the user can take from the main browse menu. */
type BrowseAction = "category" | "search" | "done";

/** Action the user can take when viewing a recipe. */
type RecipeAction = "preview" | "add" | "back";

/**
 * Run the recipe browsing stage.
 *
 * This is the main entry point for Stage 1a. It presents the user
 * with a menu to browse by category or search, preview recipes,
 * and add them to the palette manifest.
 *
 * @returns "advance" to proceed to manifest building, or "back" to exit the wizard.
 */
export async function browseRecipes(
  session: WizardSession,
): Promise<"advance" | "back"> {
  outputInfo(
    "\nBrowse recipes to build your sound palette.\n" +
      "You can browse by category or search by keyword.\n",
  );

  while (true) {
    const manifestCount = session.manifestSize;
    const manifestLabel =
      manifestCount > 0 ? ` (${manifestCount} selected)` : "";

    const action = await select<BrowseAction>({
      message: "What would you like to do?",
      choices: [
        { value: "category" as const, name: "Browse by category" },
        { value: "search" as const, name: "Search recipes" },
        new Separator(),
        {
          value: "done" as const,
          name: `Done browsing${manifestLabel} -- build palette`,
        },
      ],
    });

    switch (action) {
      case "category":
        await browseByCategory(session);
        break;
      case "search":
        await searchRecipes(session);
        break;
      case "done":
        return "advance";
    }
  }
}

/**
 * Browse recipes by category.
 *
 * Shows a category selector, then lists recipes in the chosen category.
 */
async function browseByCategory(session: WizardSession): Promise<void> {
  const allRecipes = registry.listDetailed();
  const categories = extractCategories(allRecipes);

  if (categories.length === 0) {
    outputError("No recipe categories found.");
    return;
  }

  const category = await select<string | "__back__">({
    message: "Select a category:",
    choices: [
      ...categories.map((cat) => {
        const count = allRecipes.filter((r) => r.category === cat).length;
        return { value: cat, name: `${cat} (${count} recipes)` };
      }),
      new Separator(),
      { value: "__back__", name: "Back to menu" },
    ],
    pageSize: 15,
  });

  if (category === "__back__") return;

  const filtered = allRecipes.filter((r) => r.category === category);
  await presentRecipeList(filtered, session, `Category: ${category}`);
}

/**
 * Search recipes by keyword.
 *
 * Prompts the user for search text, then filters recipes using
 * the registry's listDetailed() with a RecipeFilterQuery.
 */
async function searchRecipes(session: WizardSession): Promise<void> {
  const searchText = await input({
    message: "Search recipes (name, description, category, or tags):",
  });

  const filter = buildFilterQuery(searchText);
  if (!filter) {
    outputInfo("No search text entered. Returning to menu.");
    return;
  }

  const results = registry.listDetailed(filter);
  if (results.length === 0) {
    outputInfo(`No recipes found matching "${searchText}".`);
    return;
  }

  await presentRecipeList(results, session, `Search: "${searchText}"`);
}

/**
 * Present a list of recipes for selection and actions.
 *
 * Shows the recipe list and allows the user to preview, add to
 * manifest, or go back.
 */
async function presentRecipeList(
  recipes: RecipeDetailedSummary[],
  session: WizardSession,
  heading: string,
): Promise<void> {
  outputInfo(`\n${heading} -- ${recipes.length} recipe(s)\n`);

  while (true) {
    const selected = await select<string | "__back__">({
      message: "Select a recipe to preview or add:",
      choices: [
        ...recipes.map((r) => {
          const inManifest = session.manifest.entries.some(
            (e) => e.recipe === r.name,
          );
          const marker = inManifest ? " [in palette]" : "";
          return {
            value: r.name,
            name: `${formatRecipeChoice(r)}${marker}`,
            description: inManifest
              ? "Already in your palette"
              : r.description,
          };
        }),
        new Separator(),
        { value: "__back__", name: "Back to menu" },
      ],
      pageSize: 15,
    });

    if (selected === "__back__") return;

    const recipe = recipes.find((r) => r.name === selected);
    if (!recipe) continue;

    await recipeActions(recipe, session);
  }
}

/**
 * Show actions for a selected recipe: preview, add to palette, back.
 */
async function recipeActions(
  recipe: RecipeDetailedSummary,
  session: WizardSession,
): Promise<void> {
  const inManifest = session.manifest.entries.some(
    (e) => e.recipe === recipe.name,
  );

  outputInfo(
    `\nRecipe: ${recipe.name}\n` +
      `  Category: ${recipe.category}\n` +
      `  Description: ${recipe.description}\n` +
      `  Tags: ${recipe.tags.join(", ") || "none"}\n`,
  );

  while (true) {
    const choices: Array<{ value: RecipeAction | "remove"; name: string }> = [
      { value: "preview", name: "Preview (play at seed 0)" },
    ];

    const currentlyInManifest = session.manifest.entries.some(
      (e) => e.recipe === recipe.name,
    );

    if (currentlyInManifest) {
      choices.push({ value: "remove", name: "Remove from palette" });
    } else {
      choices.push({ value: "add", name: "Add to palette" });
    }
    choices.push({ value: "back", name: "Back to list" });

    const action = await select<RecipeAction | "remove">({
      message: `${recipe.name}:`,
      choices,
    });

    switch (action) {
      case "preview":
        await previewRecipe(recipe.name);
        break;
      case "add": {
        const entry = toManifestEntry(recipe);
        session.addToManifest(entry);
        outputSuccess(
          `Added "${recipe.name}" to palette (${session.manifestSize} total).`,
        );
        return;
      }
      case "remove":
        session.removeFromManifest(recipe.name);
        outputInfo(
          `Removed "${recipe.name}" from palette (${session.manifestSize} total).`,
        );
        return;
      case "back":
        return;
    }
  }
}

/**
 * Preview a recipe by rendering at seed 0 and playing audio.
 *
 * Catches render/playback errors and displays a friendly message
 * rather than crashing the wizard.
 */
export async function previewRecipe(recipeName: string): Promise<void> {
  try {
    outputInfo(`Rendering "${recipeName}" at seed ${PREVIEW_SEED}...`);
    const result = await renderRecipe(recipeName, PREVIEW_SEED);
    outputInfo("Playing preview...");
    await playAudio(result.samples, { sampleRate: result.sampleRate, lifecycle: cleanupHooks });
    outputInfo("Preview complete.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    outputError(`Preview failed for "${recipeName}": ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Stage 1b -- Palette Manifest Builder
// ---------------------------------------------------------------------------

/** Action the user can take from the manifest review menu. */
type ManifestAction = "confirm" | "add_more" | "remove" | "back";

/**
 * Build and confirm the palette manifest.
 *
 * Presents the user with a review of their selected recipes and
 * allows them to confirm, add more recipes, remove entries, or
 * go back to browsing.
 *
 * @returns "advance" to proceed to Stage 2, or "back" to return to browsing.
 */
export async function buildManifest(
  session: WizardSession,
): Promise<"advance" | "back"> {
  while (true) {
    const entries = session.manifest.entries;

    // Minimum-1 validation
    if (entries.length === 0) {
      outputInfo(
        "\nYour palette is empty. You need at least 1 recipe to continue.\n" +
          "Returning to recipe browsing...\n",
      );
      return "back";
    }

    // Display manifest summary
    outputInfo(
      `\nYour palette manifest (${entries.length} recipe${entries.length === 1 ? "" : "s"}):\n`,
    );
    outputInfo(formatManifestSummary(entries));
    outputInfo("");

    const action = await select<ManifestAction>({
      message: "What would you like to do?",
      choices: [
        { value: "confirm" as const, name: "Confirm palette and continue to exploration" },
        { value: "add_more" as const, name: "Add more recipes (return to browsing)" },
        { value: "remove" as const, name: "Remove a recipe from the palette" },
        new Separator(),
        { value: "back" as const, name: "Back to browsing (keep selections)" },
      ],
    });

    switch (action) {
      case "confirm": {
        const proceed = await confirm({
          message: `Proceed with ${entries.length} recipe${entries.length === 1 ? "" : "s"} to seed exploration?`,
          default: true,
        });
        if (proceed) {
          outputSuccess(
            `\nPalette confirmed with ${entries.length} recipe${entries.length === 1 ? "" : "s"}.\n`,
          );
          return "advance";
        }
        // User said no -- stay in manifest review
        break;
      }
      case "add_more":
        return "back";

      case "remove": {
        if (entries.length === 1) {
          outputInfo(
            "Cannot remove the last recipe. Your palette must have at least 1 recipe.",
          );
          break;
        }
        const toRemove = await select<string | "__cancel__">({
          message: "Select a recipe to remove:",
          choices: [
            ...entries.map((e) => ({
              value: e.recipe,
              name: `${e.recipe} (${e.category || "uncategorized"})`,
            })),
            new Separator(),
            { value: "__cancel__", name: "Cancel" },
          ],
        });
        if (toRemove !== "__cancel__") {
          session.removeFromManifest(toRemove);
          outputInfo(
            `Removed "${toRemove}" from palette (${session.manifestSize} remaining).`,
          );
        }
        break;
      }
      case "back":
        return "back";
    }
  }
}

/**
 * Run the full Define stage (Stage 1).
 *
 * Orchestrates the browse -> manifest build -> confirm flow.
 * Loops between browsing and manifest review until the user
 * confirms or cancels.
 *
 * @returns "advance" to proceed to Stage 2, or "quit" to exit the wizard.
 */
export async function runDefineStage(
  session: WizardSession,
): Promise<"advance" | "quit"> {
  while (true) {
    // Stage 1a: Browse recipes
    const browseResult = await browseRecipes(session);

    if (browseResult === "back") {
      // At Stage 1, "back" from browsing means the user wants to quit
      const quitConfirm = await confirm({
        message: "Exit the wizard? Your selections will be lost.",
        default: false,
      });
      if (quitConfirm) return "quit";
      // User chose not to quit -- continue browsing
      continue;
    }

    // Stage 1b: Build and confirm manifest
    const manifestResult = await buildManifest(session);

    if (manifestResult === "advance") {
      return "advance";
    }

    // manifestResult === "back" -- return to browsing loop
    // All selections are preserved in session state
  }
}
