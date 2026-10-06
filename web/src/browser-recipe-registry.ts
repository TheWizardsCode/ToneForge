/**
 * Browser-safe recipe registry initialiser.
 *
 * In the browser `discoverFileBackedRecipes()` is a no-op because the
 * filesystem and `js-yaml` are unavailable; file-backed ToneGraph recipes
 * (e.g. `ui-scifi-confirm`) would therefore never be registered and
 * `renderAndPlay()` would log "Unknown recipe" without rendering.
 *
 * This module fills that gap: the Vite `yamlRecipePlugin` (see
 * `web/vite.config.ts`) converts every `presets/recipes/*.yaml` file into a
 * JSON module at build time, and `import.meta.glob` inlines those JSON
 * documents into the client bundle. Each document is validated with the
 * shared `validateToneGraph` schema and registered with the same
 * `createFileBackedRegistration` factory the Node path uses, so browser
 * renders behave identically to CLI renders.
 *
 * `initializeBrowserRecipeRegistry` is memoised — repeated calls reuse the
 * same registration result and never register duplicates.
 *
 * Work item: TF-0MUVK0MGO001P2OF.
 */

import { registry } from "@toneforge/recipes/index.js";
import { RecipeRegistry, createFileBackedRegistration } from "@toneforge/core/recipe.js";
import { validateToneGraph } from "@toneforge/core/tonegraph-schema.js";

/**
 * Eagerly import every recipe document as a parsed JSON object.
 *
 * The `.yaml` files are transformed to JSON by `yamlRecipePlugin` in the Vite
 * config before this glob is resolved. The glob keys are module paths (e.g.
 * `../../presets/recipes/ui-scifi-confirm.yaml`).
 */
const recipeModules = import.meta.glob<{ default: unknown }>(
  "../../presets/recipes/*.yaml",
  { eager: true },
);

/**
 * Register every inlined file-backed recipe into a registry.
 *
 * Recipes that fail schema validation are skipped with a warning so a single
 * malformed file cannot prevent the remaining recipes (and the app) from
 * loading — mirroring the Node discovery path's per-file error handling.
 *
 * @param target Registry to populate. Defaults to the shared application
 *   registry; tests can pass a fresh registry to observe browser registration
 *   in isolation from the Node discovery path.
 * @returns The names of the recipes that were successfully registered.
 */
export function registerBrowserRecipes(
  target: RecipeRegistry = registry,
): string[] {
  const registered: string[] = [];

  for (const [path, module] of Object.entries(recipeModules)) {
    const fileName = path.split("/").pop() ?? path;
    const recipeName = fileName.replace(/\.(yaml|yml)$/, "");

    try {
      const rawDoc = module.default;
      const graph = validateToneGraph(rawDoc);
      target.register(
        recipeName,
        createFileBackedRegistration(recipeName, graph, rawDoc),
      );
      registered.push(recipeName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `Skipping browser recipe ${fileName}: ${message}`,
      );
    }
  }

  return registered;
}

/**
 * Cached promise for the one-time browser recipe registration pass.
 *
 * Kept module-scoped so repeated calls reuse the same registration result
 * (idempotent, no duplicate registration).
 */
let browserRecipesPromise: Promise<string[]> | undefined;

/**
 * Initialise the file-backed recipe registry for the browser environment.
 *
 * This is the browser equivalent of `initializeRecipeRegistry()` from
 * `@toneforge/recipes/index.js`, which is a no-op outside Node. Call it once
 * during application initialisation, before any audio rendering occurs.
 *
 * The returned promise resolves with the list of registered recipe names.
 */
export function initializeBrowserRecipeRegistry(): Promise<string[]> {
  if (browserRecipesPromise === undefined) {
    browserRecipesPromise = Promise.resolve(registerBrowserRecipes());
  }
  return browserRecipesPromise;
}
