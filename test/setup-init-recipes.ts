/**
 * Vitest setup: initialize the recipe registry with file-backed recipes.
 *
 * The shared registry no longer performs file-backed discovery via a
 * top-level `await` (browser build targets reject top-level await). Node test
 * suites that assert against the shared registry must therefore await
 * `initializeRecipeRegistry()` so file-backed ToneGraph recipes are registered,
 * matching production CLI behaviour.
 */
import { initializeRecipeRegistry } from "../src/recipes/index.js";

await initializeRecipeRegistry();
