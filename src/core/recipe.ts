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
 * Lazy recipe registration entry.
 *
 * Stores all metadata and offline rendering capabilities eagerly, but
 * defers loading the Tone.js factory (which imports heavy dependencies)
 * until it is actually needed. This avoids importing all recipe modules
 * at startup when only one recipe is rendered.
 */
export interface LazyRecipeRegistration {
  /**
   * Async loader that returns the Tone.js factory on demand.
   * Called only when `getRecipe()` or `resolveFactory()` is used.
   */
  factoryLoader: () => Promise<RecipeFactory>;

  /** @see RecipeRegistration.getDuration */
  getDuration: (rng: Rng) => number;

  /** @see RecipeRegistration.buildOfflineGraph */
  buildOfflineGraph: (
    rng: Rng,
    ctx: OfflineAudioContext,
    duration: number,
  ) => void | Promise<void>;

  /** @see RecipeRegistration.description */
  description: string;

  /** @see RecipeRegistration.category */
  category: string;

  /** @see RecipeRegistration.tags */
  tags?: string[];

  /** @see RecipeRegistration.signalChain */
  signalChain: string;

  /** @see RecipeRegistration.params */
  params: ParamDescriptor[];

  /** @see RecipeRegistration.getParams */
  getParams: (rng: Rng) => Record<string, number>;
}

/** Internal entry type: either a fully resolved registration or a lazy one. */
type RegistryEntry =
  | { kind: "eager"; registration: RecipeRegistration }
  | { kind: "lazy"; lazy: LazyRecipeRegistration; resolved?: RecipeFactory };

/**
 * Registry of named recipe registrations.
 * Maps recipe names to their registration entries.
 *
 * Supports both eager registrations (factory provided up-front) and
 * lazy registrations (factory loaded on demand via dynamic import).
 * Lazy registration avoids importing heavy Tone.js dependencies at
 * module load time, reducing CLI startup latency.
 */
export class RecipeRegistry {
  private readonly entries = new Map<string, RegistryEntry>();

  /**
   * Register a recipe under the given name.
   *
   * Accepts either a full RecipeRegistration object (with offline
   * rendering capabilities), a bare RecipeFactory for backward
   * compatibility (browser-only recipes without offline support),
   * or a LazyRecipeRegistration for deferred factory loading.
   *
   * Overwrites any existing entry with the same name.
   */
  register(
    name: string,
    entry: RecipeRegistration | RecipeFactory | LazyRecipeRegistration,
  ): void {
    if (typeof entry === "function") {
      // Bare factory — wrap in a registration without offline support.
      // getDuration and buildOfflineGraph will throw if called.
      this.entries.set(name, {
        kind: "eager",
        registration: {
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
        },
      });
    } else if ("factoryLoader" in entry) {
      // Lazy registration — defer factory loading.
      this.entries.set(name, { kind: "lazy", lazy: entry });
    } else {
      this.entries.set(name, { kind: "eager", registration: entry });
    }
  }

  /**
   * Retrieve the Tone.js factory for a recipe by name (synchronous).
   *
   * For eager registrations, returns the factory immediately.
   * For lazy registrations, returns undefined unless the factory has
   * been previously resolved via `resolveFactory()`.
   *
   * Returns undefined if no recipe is registered under that name.
   */
  getRecipe(name: string): RecipeFactory | undefined {
    const entry = this.entries.get(name);
    if (!entry) return undefined;
    if (entry.kind === "eager") return entry.registration.factory;
    return entry.resolved;
  }

  /**
   * Resolve and return the Tone.js factory for a recipe by name.
   *
   * For lazy registrations, this triggers the dynamic import on first
   * call and caches the result for subsequent calls.
   *
   * Returns undefined if no recipe is registered under that name.
   */
  async resolveFactory(name: string): Promise<RecipeFactory | undefined> {
    const entry = this.entries.get(name);
    if (!entry) return undefined;
    if (entry.kind === "eager") return entry.registration.factory;
    if (entry.resolved) return entry.resolved;
    entry.resolved = await entry.lazy.factoryLoader();
    return entry.resolved;
  }

  /**
   * Retrieve the full registration entry for a recipe by name.
   *
   * For lazy registrations, the returned object has all metadata and
   * offline rendering fields populated. The `factory` field is a
   * placeholder that throws; use `resolveFactory()` to get the
   * actual Tone.js factory when needed.
   *
   * Returns undefined if no recipe is registered under that name.
   */
  getRegistration(name: string): RecipeRegistration | undefined {
    const entry = this.entries.get(name);
    if (!entry) return undefined;
    if (entry.kind === "eager") return entry.registration;

    // Return a view of the lazy registration with a factory placeholder.
    // The factory will throw if called directly — callers that need the
    // factory should use resolveFactory() instead.
    const lazy = entry.lazy;
    return {
      factory: entry.resolved ?? ((_rng: Rng) => {
        throw new Error(
          `Recipe "${name}" has a lazy factory. ` +
          `Use registry.resolveFactory("${name}") to load it first.`,
        );
      }),
      getDuration: lazy.getDuration,
      buildOfflineGraph: lazy.buildOfflineGraph,
      description: lazy.description,
      category: lazy.category,
      tags: lazy.tags,
      signalChain: lazy.signalChain,
      params: lazy.params,
      getParams: lazy.getParams,
    };
  }

  /**
   * List all registered recipe names.
   */
  list(): string[] {
    return [...this.entries.keys()];
  }

  /**
   * List all registered recipes with their one-line description.
   */
  listSummaries(): Array<{ name: string; description: string }> {
    return [...this.entries.entries()].map(([name, entry]) => ({
      name,
      description:
        entry.kind === "eager"
          ? entry.registration.description
          : entry.lazy.description,
    }));
  }
}
