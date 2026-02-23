/**
 * Character Jump Step 2 -- Seed-Derived Parameters
 *
 * Sine oscillator + amplitude envelope (attack/decay). Adds volume
 * shaping so the tone starts quickly and fades naturally instead of
 * playing at constant volume.
 *
 * Seed-varied parameters:
 * - Base frequency: 300-600 Hz
 * - Attack: 0.002-0.01 s
 * - Decay: 0.05-0.2 s
 *
 * Note: Parameters are derived in the same RNG order as the full
 * character-jump recipe. We call rr() for sweepRange, sweepDuration,
 * noiseLevel, and noiseDecay to keep the RNG stream aligned, but
 * discard those values since this step doesn't use them.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for character-jump-step2. */
export interface CharacterJumpStep2Params {
  baseFreq: number;
  attack: number;
  decay: number;
}

/**
 * Extract seed-derived parameters for step 2 (oscillator + envelope).
 */
export function getCharacterJumpStep2Params(rng: Rng): CharacterJumpStep2Params {
  const baseFreq = rr(rng, 300, 600);
  // Advance RNG for unused params to keep stream aligned with full recipe
  rr(rng, 200, 800);   // sweepRange (unused)
  rr(rng, 0.05, 0.15); // sweepDuration (unused)
  rr(rng, 0.1, 0.4);   // noiseLevel (unused)
  rr(rng, 0.02, 0.08); // noiseDecay (unused)
  const attack = rr(rng, 0.002, 0.01);
  const decay = rr(rng, 0.05, 0.2);
  // filterCutoff not consumed -- last param in full recipe

  return { baseFreq, attack, decay };
}
