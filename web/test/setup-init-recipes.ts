/**
 * Vitest setup (web): initialize the recipe registry with file-backed recipes.
 *
 * Web unit tests validate demo/wizard commands against the shared registry,
 * which now requires an explicit async initialization pass to register
 * file-backed ToneGraph recipes (the previous top-level await was removed to
 * keep the browser build free of top-level await).
 */
import { initializeRecipeRegistry } from "../../src/recipes/index.js";

await initializeRecipeRegistry();
