/**
 * Offline Renderer
 *
 * Renders recipe audio to buffers using OfflineAudioContext.
 * Uses node-web-audio-api for Node.js compatibility.
 *
 * Recipes are discovered via the RecipeRegistry — adding a new recipe
 * requires only registering it in src/recipes/index.ts; no changes to
 * this file are needed.
 *
 * Reference: docs/prd/CORE_PRD.md Section 8
 */

import { OfflineAudioContext } from "node-web-audio-api";
import { createRng } from "./rng.js";
import { registry } from "../recipes/index.js";
import { profiler } from "./profiler.js";

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
 * Uses OfflineAudioContext (via node-web-audio-api) to produce
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
 * @throws If the recipe is not found in the registry.
 */
export async function renderRecipe(
  recipeName: string,
  seed: number,
  duration?: number,
): Promise<RenderResult> {
  const registration = registry.getRegistration(recipeName);
  if (!registration) {
    throw new Error(`Recipe not found: ${recipeName}`);
  }
  profiler.mark("recipe_resolution");

  // Use one RNG for duration, then a fresh RNG for graph building
  // so the parameter sequence is deterministic regardless of whether
  // a duration override is provided.
  const durationRng = createRng(seed);
  const renderDuration = duration ?? registration.getDuration(durationRng);
  const sampleRate = 44100;
  const length = Math.ceil(sampleRate * renderDuration);

  const ctx = new OfflineAudioContext(1, length, sampleRate);
  profiler.mark("context_creation");

  // Build the Web Audio graph — re-create the RNG to ensure
  // deterministic parameter generation from the same seed.
  // Await the result to support both sync recipes (returning void)
  // and async recipes (returning Promise<void>) that load samples.
  const graphRng = createRng(seed);
  await registration.buildOfflineGraph(graphRng, ctx, renderDuration);
  profiler.mark("graph_build");

  const audioBuffer = await ctx.startRendering();
  profiler.mark("render");
  const samples = new Float32Array(audioBuffer.getChannelData(0));

  return {
    samples,
    sampleRate,
    duration: renderDuration,
    numberOfChannels: 1,
  };
}
