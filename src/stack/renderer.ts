/**
 * Stack Renderer
 *
 * Renders a stack definition — multiple recipe layers with independent timing
 * offsets and gain levels — into a single mixed mono audio buffer.
 *
 * Each layer is rendered independently via the existing `renderRecipe()`
 * infrastructure. The resulting Float32Array buffers are mixed together
 * with sample-accurate timing alignment and gain scaling.
 *
 * Reference: docs/prd/STACK_PRD.md, docs/prd/DEMO_ROADMAP.md (Demo 3)
 */

import { renderRecipe } from "../core/renderer.js";
import type { RenderResult } from "../core/renderer.js";
import { registry } from "../recipes/index.js";
import { createRng } from "../core/rng.js";

// ── Interfaces ────────────────────────────────────────────────────

/** A single layer in a stack definition. */
export interface StackLayer {
  /** Name of the registered recipe to render for this layer. */
  recipe: string;

  /** Start time offset in seconds from the beginning of the stack. */
  startTime: number;

  /**
   * Duration override in seconds. If omitted, the recipe's natural
   * duration (from `getDuration`) is used.
   */
  duration?: number;

  /**
   * Gain multiplier for this layer (default: 1.0).
   * Values > 1 amplify; values < 1 attenuate.
   */
  gain?: number;
}

/** A complete stack definition describing all layers to render and mix. */
export interface StackDefinition {
  /** Optional human-readable name for the stack. */
  name?: string;

  /** Array of layers to render and mix together. */
  layers: StackLayer[];
}

// ── Rendering ─────────────────────────────────────────────────────

const SAMPLE_RATE = 44100;

/**
 * Resolve the duration for a single layer.
 *
 * If the layer specifies an explicit duration, that value is used.
 * Otherwise the recipe's `getDuration()` is called with a deterministic
 * RNG derived from the layer seed.
 */
function resolveLayerDuration(layer: StackLayer, layerSeed: number): number {
  if (layer.duration !== undefined) {
    return layer.duration;
  }

  const registration = registry.getRegistration(layer.recipe);
  if (!registration) {
    throw new Error(`Recipe not found: ${layer.recipe}`);
  }

  const rng = createRng(layerSeed);
  return registration.getDuration(rng);
}

/**
 * Render a stack definition into a single mixed mono audio buffer.
 *
 * Algorithm:
 * 1. Derive per-layer seeds deterministically: `layerSeed = globalSeed + layerIndex`
 * 2. Resolve each layer's duration (explicit or recipe-derived)
 * 3. Compute total stack duration as `max(layer.startTime + layer.duration)`
 * 4. Render each layer independently via `renderRecipe()`
 * 5. Allocate a single output buffer and mix layers in with timing offsets and gain
 * 6. Clamp the final output to [-1, 1]
 *
 * @param definition - The stack definition with layers to render.
 * @param seed - Global seed for deterministic rendering.
 * @returns Promise resolving to the mixed audio data.
 * @throws If no layers are provided or a recipe is not found.
 */
export async function renderStack(
  definition: StackDefinition,
  seed: number,
): Promise<RenderResult> {
  if (!definition.layers || definition.layers.length === 0) {
    throw new Error("Stack definition must contain at least one layer.");
  }

  // Validate all recipe names exist before rendering
  for (const layer of definition.layers) {
    if (!registry.getRegistration(layer.recipe)) {
      throw new Error(`Recipe not found: ${layer.recipe}`);
    }
  }

  // Step 1-2: Derive per-layer seeds and resolve durations
  const layerDurations: number[] = [];
  for (let i = 0; i < definition.layers.length; i++) {
    const layer = definition.layers[i]!;
    const layerSeed = seed + i;
    layerDurations.push(resolveLayerDuration(layer, layerSeed));
  }

  // Step 3: Compute total stack duration
  let totalDuration = 0;
  for (let i = 0; i < definition.layers.length; i++) {
    const layer = definition.layers[i]!;
    const layerEnd = layer.startTime + layerDurations[i]!;
    if (layerEnd > totalDuration) {
      totalDuration = layerEnd;
    }
  }

  // Step 4: Render each layer independently
  const layerResults: RenderResult[] = [];
  for (let i = 0; i < definition.layers.length; i++) {
    const layer = definition.layers[i]!;
    const layerSeed = seed + i;
    const result = await renderRecipe(layer.recipe, layerSeed, layerDurations[i]);
    layerResults.push(result);
  }

  // Step 5: Allocate output buffer and mix layers
  const totalSamples = Math.ceil(totalDuration * SAMPLE_RATE);
  const output = new Float32Array(totalSamples);

  for (let i = 0; i < definition.layers.length; i++) {
    const layer = definition.layers[i]!;
    const result = layerResults[i]!;
    const gain = layer.gain ?? 1.0;
    const offsetSamples = Math.round(layer.startTime * SAMPLE_RATE);

    for (let s = 0; s < result.samples.length; s++) {
      const outIndex = offsetSamples + s;
      if (outIndex < totalSamples) {
        output[outIndex]! += result.samples[s]! * gain;
      }
    }
  }

  // Step 6: Clamp output to [-1, 1]
  for (let i = 0; i < output.length; i++) {
    if (output[i]! > 1) {
      output[i] = 1;
    } else if (output[i]! < -1) {
      output[i] = -1;
    }
  }

  return {
    samples: output,
    sampleRate: SAMPLE_RATE,
    duration: totalDuration,
    numberOfChannels: 1,
  };
}
