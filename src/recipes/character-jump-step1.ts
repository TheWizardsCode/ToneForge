/**
 * Character Jump Step 1 -- Oscillator Only
 *
 * The simplest possible sound: a sine oscillator at a seed-derived
 * frequency, playing for a fixed 0.2 s at constant volume. No envelope,
 * no sweep, no noise. Demonstrates what a raw oscillator sounds like.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCharacterJumpStep1Params } from "./character-jump-step1-params.js";

// Re-export params API
export { getCharacterJumpStep1Params } from "./character-jump-step1-params.js";
export type { CharacterJumpStep1Params } from "./character-jump-step1-params.js";

/** Fixed duration for the oscillator-only step. */
const FIXED_DURATION = 0.2;

/**
 * Creates a character-jump-step1 Recipe (oscillator only).
 */
export function createCharacterJumpStep1(rng: Rng): Recipe {
  const params = getCharacterJumpStep1Params(rng);

  const osc = new Tone.Oscillator(params.baseFreq, "sine");

  return {
    start(time: number): void {
      osc.start(time);
    },
    stop(time: number): void {
      osc.stop(time);
    },
    toDestination(): void {
      osc.toDestination();
    },
    get duration(): number {
      return FIXED_DURATION;
    },
  };
}
