/**
 * Stack Wrapper Recipe Factory
 *
 * Produces a `RecipeRegistration` that wraps an existing `StackDefinition`,
 * enabling a stack preset to be used as a single event inside a sequence
 * preset. The wrapper derives a deterministic numeric seed from the recipe's
 * `Rng` function, calls `renderStack()` to produce the mixed audio buffer,
 * then injects those samples into the caller's `OfflineAudioContext` as a
 * buffer source so the normal `renderRecipe()` path can render it.
 *
 * This pattern solves the problem that sequence events resolve recipes only
 * (`renderSequence()` calls `registry.getRegistration(evt.event)` and then
 * `renderRecipe()`), while stack presets are rendered by the separate
 * `renderStack()` path.
 *
 * Reference: docs/guides/gamedev-workflow-example.md (stack-in-sequence section)
 * Work item: TF-0MMSYF0G20PY7GMB
 */

import type { OfflineAudioContext } from "../audio/web-audio.js";
import type { ParamDescriptor, RecipeRegistration } from "../core/recipe.js";
import { applyOverrides } from "../core/recipe.js";
import type { Rng } from "../core/rng.js";
import { createRng } from "../core/rng.js";
import type { StackDefinition } from "../stack/renderer.js";
import { renderStack } from "../stack/renderer.js";
import { registry } from "./index.js";

/**
 * Options for creating a stack-wrapper recipe registration.
 */
export interface StackWrapperOptions {
  /** The registered recipe name this wrapper will use. */
  name: string;
  /** The stack definition to wrap. */
  stack: StackDefinition;
  /** Human-readable description. */
  description: string;
  /** Category string for grouping/filtering. */
  category: string;
  /** Optional tags for search. */
  tags?: string[];
  /** Signal chain description for tooling display. */
  signalChain: string;
  /** Parameter descriptors (e.g. an output `gain`). */
  params: ParamDescriptor[];
}

/** Values derived from a single recipe `Rng` when rendering the wrapper. */
interface DerivedWrapperInputs {
  /** Numeric seed passed to `renderStack()`. */
  seed: number;
  /** Seed-derived parameter values (overrides already applied). */
  params: Record<string, number>;
}

/**
 * Compute the duration of a stack analytically without rendering.
 *
 * Iterates over all layers, resolves each layer's duration (explicit or
 * via registry lookup), and returns the maximum `layer.startTime + layerDuration`.
 *
 * This mirrors `renderStack()`'s duration calculation so the wrapper's
 * `getDuration()` never under-reports (which would cause `renderRecipe()`
 * to truncate the wrapped stack).
 */
function computeStackDuration(
  stackDef: StackDefinition,
  seed: number,
): number {
  let totalDuration = 0;

  for (let i = 0; i < stackDef.layers.length; i++) {
    const layer = stackDef.layers[i]!;
    const layerSeed = seed + i;

    let layerDuration: number;
    if (layer.duration !== undefined) {
      layerDuration = layer.duration;
    } else {
      const reg = registry.getRegistration(layer.recipe);
      if (reg) {
        layerDuration = reg.getDuration(createRng(layerSeed));
      } else {
        layerDuration = 1.0; // fallback if recipe not found
      }
    }

    const layerEnd = layer.startTime + layerDuration;
    if (layerEnd > totalDuration) {
      totalDuration = layerEnd;
    }
  }

  return totalDuration > 0 ? totalDuration : 1.0;
}

/**
 * Derive the wrapper's runtime inputs from a single `Rng`.
 *
 * The stack seed is taken from the **first** `rng()` call so
 * `getDuration()` and `buildOfflineGraph()` agree for the same event seed.
 * Each declared parameter is then derived from subsequent calls and
 * overrides are applied on top (following the `applyOverrides` convention).
 */
function deriveInputs(
  rng: Rng,
  paramDecls: ParamDescriptor[],
  overrides?: Record<string, number>,
): DerivedWrapperInputs {
  const raw = rng();
  const seed = Math.floor(raw * Number.MAX_SAFE_INTEGER);

  const params: Record<string, number> = {};
  for (const p of paramDecls) {
    const value = p.min + rng() * (p.max - p.min);
    params[p.name] = value;
  }

  return { seed, params: applyOverrides(params, overrides) };
}

/**
 * Create a `RecipeRegistration` that wraps the given stack definition.
 *
 * The returned registration conforms to the `RecipeRegistration` interface:
 *
 * - `getDuration()` derives the stack seed from `rng()` and returns the
 *   stack's analytical duration (>= the actual `renderStack()` duration),
 *   so `renderRecipe()` allocates a buffer large enough for the whole stack.
 * - `buildOfflineGraph()` derives the same seed, calls `renderStack()` to
 *   produce the mixed audio, applies the declared output-gain parameter, and
 *   injects the samples into the caller's `OfflineAudioContext` as a
 *   `BufferSource` scheduled at time 0.
 *
 * @param options - Configuration for the wrapper recipe.
 * @returns A `RecipeRegistration` ready for registry registration.
 */
export function createStackWrapperRecipe(
  options: StackWrapperOptions,
): RecipeRegistration {
  const stack = options.stack;
  const params = options.params;

  return {
    getDuration(rng: Rng, overrides?: Record<string, number>): number {
      const { seed } = deriveInputs(rng, params, overrides);
      return computeStackDuration(stack, seed);
    },

    async buildOfflineGraph(
      rng: Rng,
      ctx: OfflineAudioContext,
      duration: number,
      overrides?: Record<string, number>,
    ): Promise<void> {
      const { seed, params: derived } = deriveInputs(rng, params, overrides);
      const gain = derived["gain"] ?? 1.0;

      // Render the wrapped stack. `renderStack()` creates its own
      // OfflineAudioContext, mixes all layers, and returns the result.
      const result = await renderStack(stack, seed);

      // Copy the mixed samples into a buffer in the caller's context,
      // applying the output gain.
      const audioCtx = ctx as unknown as BaseAudioContext;
      const audioBuffer = audioCtx.createBuffer(
        result.numberOfChannels,
        result.samples.length,
        result.sampleRate,
      );

      for (let ch = 0; ch < result.numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < result.samples.length; i++) {
          channelData[i] = result.samples[i]! * gain;
        }
      }

      // Schedule the wrapped stack at the start of the event.
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start(0);
      source.stop(duration);
    },

    description: options.description,
    category: options.category,
    tags: options.tags,
    signalChain: options.signalChain,
    params: options.params,
    getParams: (rng: Rng) => deriveInputs(rng, params).params,
  };
}
