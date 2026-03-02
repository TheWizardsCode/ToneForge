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

/**
 * Filter query for recipe search/filtering.
 *
 * All specified filters are combined with AND logic. Empty or
 * whitespace-only values are ignored (treated as if not provided).
 */
export interface RecipeFilterQuery {
  /**
   * Case-insensitive substring match across name, description,
   * category, and tag strings. A recipe matches if any field
   * contains the search string.
   */
  search?: string;

  /**
   * Exact category match after normalization. Both sides are
   * lowercased and spaces are replaced with hyphens, so
   * "Card Game", "card-game", and "card game" all match.
   */
  category?: string;

  /**
   * Exact case-insensitive tag match with AND logic. All specified
   * tags must be present on the recipe. "laser" matches tag "laser"
   * but NOT "laser-beam".
   */
  tags?: string[];
}

/**
 * Detailed recipe summary including category and tags.
 */
export interface RecipeDetailedSummary {
  name: string;
  description: string;
  category: string;
  tags: string[];
  /** Tags that contributed to the current filter match (empty when unfiltered). */
  matchedTags: string[];
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

  /**
   * List all registered recipes with detailed metadata (name, description,
   * category, tags), optionally filtered by search, category, and/or tags.
   *
   * All filters combine with AND logic. Empty or whitespace-only filter
   * values are ignored (treated as if not provided).
   *
   * Filter behavior:
   * - search: case-insensitive substring match across name, description,
   *   category, and tag strings (any field match = recipe included)
   * - category: exact match after normalization (lowercase + spaces-to-hyphens)
   * - tags: exact case-insensitive match with AND logic (all specified tags
   *   must be present; "laser" matches "laser" but NOT "laser-beam")
   */
  listDetailed(filter?: RecipeFilterQuery): RecipeDetailedSummary[] {
    const results: RecipeDetailedSummary[] = [];

    // Pre-process filter values (ignore empty/whitespace-only)
    const searchTerm =
      filter?.search?.trim() ? filter.search.trim().toLowerCase() : undefined;
    const categoryTerm =
      filter?.category?.trim()
        ? normalizeCategory(filter.category.trim())
        : undefined;
    const tagTerms =
      filter?.tags && filter.tags.filter((t) => t.trim().length > 0).length > 0
        ? filter.tags
            .filter((t) => t.trim().length > 0)
            .map((t) => t.trim().toLowerCase())
        : undefined;

    for (const [name, entry] of this.entries) {
      const description =
        entry.kind === "eager"
          ? entry.registration.description
          : entry.lazy.description;
      const category =
        entry.kind === "eager"
          ? (entry.registration.category ?? "")
          : (entry.lazy.category ?? "");
      const tags =
        entry.kind === "eager"
          ? (entry.registration.tags ?? [])
          : (entry.lazy.tags ?? []);

      // Apply search filter: case-insensitive substring across all fields
      if (searchTerm !== undefined) {
        const nameLower = name.toLowerCase();
        const descLower = description.toLowerCase();
        const catLower = category.toLowerCase();
        const tagsLower = tags.map((t) => t.toLowerCase());
        const matchesSearch =
          nameLower.includes(searchTerm) ||
          descLower.includes(searchTerm) ||
          catLower.includes(searchTerm) ||
          tagsLower.some((t) => t.includes(searchTerm));
        if (!matchesSearch) continue;
      }

      // Apply category filter: exact match after normalization
      if (categoryTerm !== undefined) {
        if (normalizeCategory(category) !== categoryTerm) continue;
      }

      // Apply tags filter: exact case-insensitive AND logic
      if (tagTerms !== undefined) {
        const entryTagsLower = tags.map((t) => t.toLowerCase());
        const allPresent = tagTerms.every((tag) =>
          entryTagsLower.includes(tag),
        );
        if (!allPresent) continue;
      }

      // Compute matchedTags: union of tags matching --tags and --search filters
      const matchedTags: string[] = [];
      if (searchTerm !== undefined || tagTerms !== undefined) {
        const seen = new Set<string>();
        for (const tag of tags) {
          const tagLower = tag.toLowerCase();
          let matched = false;
          // --tags: exact case-insensitive match
          if (tagTerms !== undefined && tagTerms.includes(tagLower)) {
            matched = true;
          }
          // --search: substring case-insensitive match
          if (searchTerm !== undefined && tagLower.includes(searchTerm)) {
            matched = true;
          }
          if (matched && !seen.has(tagLower)) {
            seen.add(tagLower);
            matchedTags.push(tag);
          }
        }
      }

      results.push({ name, description, category, tags, matchedTags });
    }

    return results;
  }
}

/**
 * Normalize a category string for comparison: lowercase and
 * replace whitespace sequences with hyphens.
 *
 * e.g. "Card Game" -> "card-game", "card game" -> "card-game"
 */
function normalizeCategory(category: string): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}
