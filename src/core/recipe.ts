/**
 * Recipe Interface & Registry
 *
 * A Recipe represents a Tone.js DSP graph that can be started, stopped,
 * and connected to a destination. Recipes are created by factory functions
 * that accept a seeded RNG for deterministic variation.
 *
 * The RecipeRegistry supports both simple factory registration (for
 * browser-only recipes) and full registration with offline rendering
 * capabilities (getDuration, buildOfflineGraph).
 *
 * Reference: docs/prd/CORE_PRD.md Section 4.1
 */

import type { OfflineAudioContext } from "node-web-audio-api";
import type { Rng } from "./rng.js";

/**
 * Describes a single recipe parameter with its name, range, and unit.
 * Used by `tf show` to display parameter metadata.
 */
export interface ParamDescriptor {
  /** Parameter name (must match the key returned by getParams). */
  name: string;
  /** Minimum value (inclusive). */
  min: number;
  /** Maximum value (exclusive). */
  max: number;
  /** Unit of measurement (e.g. "Hz", "s", "amplitude"). */
  unit: string;
}

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
 * Full recipe registration entry with offline rendering capabilities.
 *
 * Recipes registered with this shape can be rendered offline by the
 * renderer without hardcoded per-recipe logic.
 */
export interface RecipeRegistration {
  /** Tone.js factory for browser/interactive playback. */
  factory: RecipeFactory;

  /**
   * Compute the natural duration for this recipe from a seeded RNG.
   * Called by the renderer to determine the offline buffer length.
   */
  getDuration: (rng: Rng) => number;

  /**
   * Build the Web Audio API graph for offline rendering directly on
   * an OfflineAudioContext. This avoids importing Tone.js in the
   * Node.js offline render path.
   *
   * May return void (synchronous recipes) or Promise<void> (async
   * recipes that need to load samples via decodeAudioData).
   */
  buildOfflineGraph: (
    rng: Rng,
    ctx: OfflineAudioContext,
    duration: number,
  ) => void | Promise<void>;

  /** One-line human summary of the recipe. */
  description: string;

  /** Sound category (e.g. "UI", "Weapon", "Footstep", "Ambient"). */
  category: string;

  /** Optional tags for filtering/search. */
  tags?: string[];

  /**
   * Human-readable signal chain summary.
   * Example: "Sine Oscillator -> Lowpass Filter -> Amplitude Envelope -> Destination"
   */
  signalChain: string;

  /** Array of parameter descriptors with name, min, max, and unit. */
  params: ParamDescriptor[];

  /**
   * Extract seed-specific parameter values as a name-value map.
   * The keys must match the `name` fields in `params`.
   */
  getParams: (rng: Rng) => Record<string, number>;
}

/**
 * Registry of named recipe registrations.
 * Maps recipe names to their registration entries.
 */
export class RecipeRegistry {
  private readonly entries = new Map<string, RecipeRegistration>();

  /**
   * Register a recipe under the given name.
   *
   * Accepts either a full RecipeRegistration object (with offline
   * rendering capabilities) or a bare RecipeFactory for backward
   * compatibility (browser-only recipes without offline support).
   *
   * Overwrites any existing entry with the same name.
   */
  register(name: string, entry: RecipeRegistration | RecipeFactory): void {
    if (typeof entry === "function") {
      // Bare factory — wrap in a registration without offline support.
      // getDuration and buildOfflineGraph will throw if called.
      this.entries.set(name, {
        factory: entry,
        getDuration: () => {
          throw new Error(
            `Recipe "${name}" was registered without getDuration. ` +
            `Use a full RecipeRegistration to enable offline rendering.`,
          );
        },
        buildOfflineGraph: () => {
          throw new Error(
            `Recipe "${name}" was registered without buildOfflineGraph. ` +
            `Use a full RecipeRegistration to enable offline rendering.`,
          );
        },
        description: "",
        category: "",
        signalChain: "",
        params: [],
        getParams: () => ({}),
      });
    } else {
      this.entries.set(name, entry);
    }
  }

  /**
   * Retrieve the Tone.js factory for a recipe by name.
   * Returns undefined if no recipe is registered under that name.
   */
  getRecipe(name: string): RecipeFactory | undefined {
    return this.entries.get(name)?.factory;
  }

  /**
   * Retrieve the full registration entry for a recipe by name.
   * Returns undefined if no recipe is registered under that name.
   */
  getRegistration(name: string): RecipeRegistration | undefined {
    return this.entries.get(name);
  }

  /**
   * List all registered recipe names.
   */
  list(): string[] {
    return [...this.entries.keys()];
  }
}
