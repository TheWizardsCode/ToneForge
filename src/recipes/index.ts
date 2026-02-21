/**
 * Recipe Registry Index
 *
 * Registers all built-in recipes and exports the shared registry instance.
 */

import { RecipeRegistry } from "../core/recipe.js";
import { createUiSciFiConfirm } from "./ui-scifi-confirm.js";

/** The global recipe registry instance with all built-in recipes registered. */
export const registry = new RecipeRegistry();

// Register built-in recipes
registry.register("ui-scifi-confirm", createUiSciFiConfirm);
