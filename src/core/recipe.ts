/**
 * Recipe Interface & Registry
 *
 * A Recipe represents a Tone.js DSP graph that can be started, stopped,
 * and connected to a destination. Recipes are created by factory functions
 * that accept a seeded RNG for deterministic variation.
 *
 * Reference: docs/prd/CORE_PRD.md Section 4.1
 */

import type { Rng } from "./rng.js";

/**
 * A constructed Tone.js DSP graph ready for rendering or playback.
 */
export interface Recipe {
  /** Start the recipe at the given time (seconds). */
  start(time: number): void;

  /** Stop the recipe at the given time (seconds). */
  stop(time: number): void;

  /** Connect the recipe output to the audio destination. */
  toDestination(): void;

  /** Duration of the recipe in seconds. */
  readonly duration: number;
}

/**
 * A factory function that creates a Recipe instance from a seeded RNG.
 */
export type RecipeFactory = (rng: Rng) => Recipe;

/**
 * Registry of named recipe factories.
 * Maps recipe names to their factory functions.
 */
export class RecipeRegistry {
  private readonly factories = new Map<string, RecipeFactory>();

  /**
   * Register a recipe factory under the given name.
   * Overwrites any existing factory with the same name.
   */
  register(name: string, factory: RecipeFactory): void {
    this.factories.set(name, factory);
  }

  /**
   * Retrieve a recipe factory by name.
   * Returns undefined if no recipe is registered under that name.
   */
  getRecipe(name: string): RecipeFactory | undefined {
    return this.factories.get(name);
  }

  /**
   * List all registered recipe names.
   */
  list(): string[] {
    return [...this.factories.keys()];
  }
}
