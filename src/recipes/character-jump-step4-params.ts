/**
 * Character Jump Step 4 -- Seed-Derived Parameters
 *
 * Sine oscillator + amplitude envelope + pitch sweep + unfiltered noise
 * burst. Adds a white noise burst for physical impact texture. No filter
 * yet -- the noise is raw, which sounds harsher than the final recipe.
 *
 * Seed-varied parameters:
 * - Base frequency: 300-600 Hz
 * - Sweep range: 200-800 Hz
 * - Sweep duration: 0.05-0.15 s
 * - Noise level: 0.1-0.4
 * - Noise decay: 0.02-0.08 s
 * - Attack: 0.002-0.01 s
 * - Decay: 0.05-0.2 s
 *
 * Note: Parameters are derived in the same RNG order as the full
 * character-jump recipe. filterCutoff is not consumed since this step
 * doesn't use a filter.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for character-jump-step4. */
export interface CharacterJumpStep4Params {
  baseFreq: number;
  sweepRange: number;
  sweepDuration: number;
  noiseLevel: number;
  noiseDecay: number;
  attack: number;
  decay: number;
}

/**
 * Extract seed-derived parameters for step 4 (osc + envelope + sweep + noise).
 */
export function getCharacterJumpStep4Params(rng: Rng): CharacterJumpStep4Params {
  return {
    baseFreq: rr(rng, 300, 600),
    sweepRange: rr(rng, 200, 800),
    sweepDuration: rr(rng, 0.05, 0.15),
    noiseLevel: rr(rng, 0.1, 0.4),
    noiseDecay: rr(rng, 0.02, 0.08),
    attack: rr(rng, 0.002, 0.01),
    decay: rr(rng, 0.05, 0.2),
  };
  // filterCutoff not consumed -- last param in full recipe
}
