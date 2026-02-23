/**
 * Character Jump Step 1 -- Seed-Derived Parameters
 *
 * Bare-minimum recipe: a sine oscillator at a fixed 0.2 s duration.
 * Only one seed-varied parameter (baseFreq) to demonstrate the
 * simplest possible sound: a constant tone that starts and stops.
 *
 * Seed-varied parameters:
 * - Base frequency: 300-600 Hz
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for character-jump-step1. */
export interface CharacterJumpStep1Params {
  baseFreq: number;
}

/**
 * Extract seed-derived parameters for step 1 (oscillator only).
 * Fixed 0.2 s duration -- no envelope shaping.
 */
export function getCharacterJumpStep1Params(rng: Rng): CharacterJumpStep1Params {
  return {
    baseFreq: rr(rng, 300, 600),
  };
}
