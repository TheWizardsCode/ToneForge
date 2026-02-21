/**
 * Offline Renderer
 *
 * Renders recipe audio to buffers using OfflineAudioContext.
 * Uses node-web-audio-api for Node.js compatibility.
 *
 * Reference: docs/prd/CORE_PRD.md Section 8
 */

import { OfflineAudioContext } from "node-web-audio-api";
import { createRng } from "./rng.js";
import type { Rng } from "./rng.js";
import { registry } from "../recipes/index.js";
import { getUiSciFiConfirmParams } from "../recipes/ui-scifi-confirm.js";

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
  const factory = registry.getRecipe(recipeName);
  if (!factory) {
    throw new Error(`Recipe not found: ${recipeName}`);
  }

  const rng = createRng(seed);

  // Get recipe parameters to determine duration and build the graph
  // Currently we only support ui-scifi-confirm, so we can use its params directly
  const renderDuration = duration ?? getRecipeDuration(recipeName, rng);
  const sampleRate = 44100;
  const length = Math.ceil(sampleRate * renderDuration);

  const ctx = new OfflineAudioContext(1, length, sampleRate);

  // Build the Web Audio graph based on the recipe name and seed
  // We re-create the RNG to ensure deterministic parameter generation
  const paramRng = createRng(seed);
  buildRecipeGraph(recipeName, paramRng, ctx, renderDuration);

  const audioBuffer = await ctx.startRendering();
  const samples = new Float32Array(audioBuffer.getChannelData(0));

  return {
    samples,
    sampleRate,
    duration: renderDuration,
    numberOfChannels: 1,
  };
}

/**
 * Get the natural duration for a recipe using its seed-derived parameters.
 */
function getRecipeDuration(recipeName: string, rng: Rng): number {
  if (recipeName === "ui-scifi-confirm") {
    const params = getUiSciFiConfirmParams(rng);
    return params.attack + params.decay;
  }
  return 0.5; // Default duration
}

/**
 * Build the Web Audio API graph for a recipe directly on the OfflineAudioContext.
 *
 * This constructs equivalent graphs to the Tone.js-based recipes
 * but using native Web Audio API nodes for Node.js offline rendering.
 */
function buildRecipeGraph(
  recipeName: string,
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  if (recipeName === "ui-scifi-confirm") {
    buildUiSciFiConfirmGraph(rng, ctx, duration);
  } else {
    throw new Error(`No offline graph builder for recipe: ${recipeName}`);
  }
}

/**
 * Build the ui-scifi-confirm graph using native Web Audio API.
 *
 * Mirrors the Tone.js recipe: Oscillator -> BiquadFilter -> GainNode (envelope)
 */
function buildUiSciFiConfirmGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getUiSciFiConfirmParams(rng);

  // Create oscillator
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = params.frequency;

  // Create lowpass filter
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = params.filterCutoff;

  // Create gain node for amplitude envelope
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, 0);
  // Attack: ramp up
  gain.gain.linearRampToValueAtTime(1, params.attack);
  // Decay: ramp down
  gain.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  // Connect: osc -> filter -> gain -> destination
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  // Schedule
  osc.start(0);
  osc.stop(duration);
}
