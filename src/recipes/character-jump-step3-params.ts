/**
 * Character Jump Step 3 -- Seed-Derived Parameters
 *
 * Sine oscillator + amplitude envelope + pitch sweep. Adds a rising
 * frequency sweep to the enveloped tone, creating a sense of upward
 * motion.
 *
 * Seed-varied parameters:
 * - Base frequency: 300-600 Hz
 * - Sweep range: 200-800 Hz
 * - Sweep duration: 0.05-0.15 s
 * - Attack: 0.002-0.01 s
 * - Decay: 0.05-0.2 s
 *
 * Note: Parameters are derived in the same RNG order as the full
 * character-jump recipe. We call rr() for noiseLevel and noiseDecay
 * to keep the RNG stream aligned, but discard those values.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for character-jump-step3. */
export interface CharacterJumpStep3Params {
  baseFreq: number;
  sweepRange: number;
  sweepDuration: number;
  attack: number;
  decay: number;
}

/**
 * Extract seed-derived parameters for step 3 (oscillator + envelope + sweep).
 */
export function getCharacterJumpStep3Params(rng: Rng): CharacterJumpStep3Params {
  const baseFreq = rr(rng, 300, 600);
  const sweepRange = rr(rng, 200, 800);
  const sweepDuration = rr(rng, 0.05, 0.15);
  // Advance RNG for unused params to keep stream aligned with full recipe
  rr(rng, 0.1, 0.4);   // noiseLevel (unused)
  rr(rng, 0.02, 0.08); // noiseDecay (unused)
  const attack = rr(rng, 0.002, 0.01);
  const decay = rr(rng, 0.05, 0.2);
  // filterCutoff not consumed -- last param in full recipe

  return { baseFreq, sweepRange, sweepDuration, attack, decay };
}
