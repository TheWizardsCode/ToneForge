/**
 * Offline Renderer
 *
 * Renders recipe audio to buffers using OfflineAudioContext.
 * Uses the cross-platform OfflineAudioContext abstraction from
 * `src/audio/web-audio.ts`: the browser-native Web Audio API in the browser
 * and node-web-audio-api in Node.js.
 *
 * Recipes are discovered via the RecipeRegistry — adding a new recipe
 * requires only registering it in src/recipes/index.ts; no changes to
 * this file are needed.
 *
 * Reference: docs/prd/CORE_PRD.md Section 8
 */

import { createRng } from "./rng.js";
import { registry, initializeRecipeRegistry } from "../recipes/index.js";
import { profiler } from "./profiler.js";
import { OfflineAudioContext } from "../audio/web-audio.js";

/**
 * Error thrown when `ctx.startRendering()` returns `null`.
 *
 * This occurs under heavy host contention when the `node-web-audio-api`
 * shim in Node.js is unable to complete the offline render (load average
 * ~10–25). It is not a genuine audio-graph failure — the graph is correct,
 * but the underlying library returns `null` instead of an `AudioBuffer`.
 *
 * **Remediation:** retry with reduced parallelism (fewer concurrent renders)
 * or re-run the test in a less loaded environment.
 *
 * @example
 * ```ts
 * try {
 *   const result = await renderRecipe("rattle-decay", 42);
 * } catch (err) {
 *   if (err instanceof RenderError && err.contention) {
 *     // retry with reduced parallelism
 *   }
 * }
 * ```
 */
export class RenderError extends Error {
  /** True when the error was caused by a contention-induced null return. */
  readonly contention: boolean;

  constructor(message: string, options?: { contention?: boolean }) {
    super(message);
    this.name = "RenderError";
    this.contention = options?.contention ?? false;
  }
}

/** Result of an offline render containing sample data. */
export interface RenderResult {
  /** Raw audio samples (mono, Float32Array). */
  samples: Float32Array;
  /** Sample rate in Hz. */
  sampleRate: number;
  /** Duration in seconds. */
  duration: number;
  /** Number of audio channels. */
  numberOfChannels: number;
}

/**
 * Renders a named recipe with the given seed to an audio buffer.
 *
 * Uses the cross-platform OfflineAudioContext abstraction to produce
 * deterministic output for the same recipe + seed combination.
 *
 * The recipe is looked up in the RecipeRegistry. Its `getDuration`
 * and `buildOfflineGraph` callables are used to construct the graph
 * — no per-recipe switch logic exists in this file.
 *
 * @param recipeName - Name of the registered recipe.
 * @param seed - Integer seed for deterministic RNG.
 * @param duration - Optional duration override in seconds. If not provided,
 *                   uses the recipe's natural duration.
 * @returns Promise resolving to the rendered audio data.
 * @throws If the recipe is not found in the registry, or if
 *         `startRendering()` returns `null` (see {@link RenderError}).
 */
/** Preset-shaped input accepted by {@link renderPreset}. */
export interface RenderPresetInput {
  /** Registered recipe name. */
  recipe: string;
  /** Deterministic integer seed. */
  seed: number;
  /**
   * Parameter overrides applied on top of the seed-derived baseline.
   *
   * Only declared parameters are honoured. File-backed recipes apply their
   * explicit declarative mappings after the base overrides, so a computed
   * mapping (for example `modulator.frequency = carrier.frequency *
   * modRatio`) sees the overridden value of every parameter it references.
   */
  overrides?: Record<string, number>;
}

export async function renderRecipe(
  recipeName: string,
  seed: number,
  duration?: number,
): Promise<RenderResult> {
  return renderRecipeInternal(recipeName, seed, duration, undefined);
}

/**
 * Renders a preset-shaped `{ recipe, seed, overrides }` input.
 *
 * Overrides replace the seed-derived value for the named parameters; an empty
 * or omitted `overrides` object produces output byte-identical to
 * `renderRecipe(recipe, seed)`.
 */
export async function renderPreset(
  input: RenderPresetInput,
  duration?: number,
): Promise<RenderResult> {
  return renderRecipeInternal(
    input.recipe,
    input.seed,
    duration,
    input.overrides,
  );
}

async function renderRecipeInternal(
  recipeName: string,
  seed: number,
  duration: number | undefined,
  overrides: Record<string, number> | undefined,
): Promise<RenderResult> {
  // File-backed recipes are discovered asynchronously; ensure they are
  // registered before resolving the recipe. Idempotent and cached.
  await initializeRecipeRegistry();

  const registration = registry.getRegistration(recipeName);
  if (!registration) {
    throw new Error(`Recipe not found: ${recipeName}`);
  }
  profiler.mark("recipe_resolution");

  // Use one RNG for duration, then a fresh RNG for graph building
  // so the parameter sequence is deterministic regardless of whether
  // a duration override is provided.
  const durationRng = createRng(seed);
  const renderDuration = duration ?? registration.getDuration(durationRng, overrides);
  const sampleRate = 44100;
  const length = Math.ceil(sampleRate * renderDuration);

  const ctx = new OfflineAudioContext(1, length, sampleRate);
  profiler.mark("context_creation");

  // Build the Web Audio graph — re-create the RNG to ensure
  // deterministic parameter generation from the same seed.
  // Await the result to support both sync recipes (returning void)
  // and async recipes (returning Promise<void>) that load samples.
  const graphRng = createRng(seed);
  await registration.buildOfflineGraph(graphRng, ctx, renderDuration, overrides);
  profiler.mark("graph_build");

  const audioBuffer = await ctx.startRendering();
  if (!audioBuffer) {
    throw new RenderError(
      `startRendering() returned null (recipe: ${recipeName}, seed: ${seed}). ` +
        `This can occur under host contention. Retry with reduced parallelism.`,
      { contention: true },
    );
  }
  profiler.mark("render");
  const samples = new Float32Array(audioBuffer.getChannelData(0));

  return {
    samples,
    sampleRate,
    duration: renderDuration,
    numberOfChannels: 1,
  };
}
