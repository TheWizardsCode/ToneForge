/**
 * ToneForge Haptics — Audio-Backed Pattern Builder
 *
 * Renders a recipe's audio and derives a deterministic haptic pattern from its
 * amplitude envelope, so pulse timing and intensity track the sound event.
 *
 * Reference: docs/prd/HAPTICS_PRD.md
 */

import { renderRecipe } from "../core/renderer.js";
import { registry } from "../recipes/index.js";
import { buildAmplitudeEnvelope } from "../visualizer/envelope.js";
import { resolvePalette } from "../visualizer/palette.js";
import {
  DEFAULT_HAPTIC_FRAME_COUNT,
  generateHapticPattern,
  hapticStyleForRecipe,
} from "./pattern.js";
import type { HapticPattern } from "./pattern.js";

/** Options for {@link buildHapticPattern}. */
export interface BuildHapticPatternOptions {
  /** Registered recipe name. */
  recipe: string;
  /** Deterministic integer seed. */
  seed: number;
  /** Palette name; defaults to `calm_ui`. */
  palette?: string;
  /** Number of envelope frames (default {@link DEFAULT_HAPTIC_FRAME_COUNT}). */
  frameCount?: number;
}

/**
 * Build a deterministic haptic pattern for a recipe.
 *
 * @throws {Error} when the recipe is unknown or the frame count is invalid.
 */
export async function buildHapticPattern(
  options: BuildHapticPatternOptions,
): Promise<HapticPattern> {
  const { recipe, seed, palette: paletteName, frameCount = DEFAULT_HAPTIC_FRAME_COUNT } = options;
  if (!Number.isInteger(seed)) {
    throw new Error(`seed must be an integer, got '${seed}'`);
  }
  if (!Number.isInteger(frameCount) || frameCount < 1) {
    throw new Error(`frameCount must be a positive integer, got '${frameCount}'`);
  }

  const registration = registry.getRegistration(recipe);
  if (!registration) {
    throw new Error(`Recipe not found: ${recipe}`);
  }

  const palette = resolvePalette(paletteName);
  const render = await renderRecipe(recipe, seed);
  const envelope = buildAmplitudeEnvelope(render.samples, render.sampleRate, frameCount);
  const style = hapticStyleForRecipe(registration.category, registration.tags ?? []);

  const pattern = generateHapticPattern({
    envelope,
    durationSeconds: render.duration,
    palette,
    seed,
    style,
  });
  return { ...pattern, recipe };
}
