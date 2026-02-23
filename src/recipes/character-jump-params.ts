/**
 * Character Jump Recipe -- Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies -- this module is safe to
 * import in the offline render path without pulling in heavy libraries.
 *
 * Synthesis approach: rising pitch sweep + noise burst + filter
 * Seed-varied parameters:
 * - Base frequency: 300-600 Hz
 * - Sweep range: 200-800 Hz (added to base for the peak)
 * - Sweep duration: 0.05-0.15s
 * - Noise level: 0.1-0.4
 * - Noise decay: 0.02-0.08s
 * - Attack: 0.002-0.01s
 * - Decay: 0.05-0.2s
 * - Filter cutoff: 1500-5000 Hz
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the character-jump recipe. */
export interface CharacterJumpParams {
  baseFreq: number;
  sweepRange: number;
  sweepDuration: number;
  noiseLevel: number;
  noiseDecay: number;
  attack: number;
  decay: number;
  filterCutoff: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 * Useful for testing parameter variation and for the offline renderer.
 */
export function getCharacterJumpParams(rng: Rng): CharacterJumpParams {
  return {
    baseFreq: rr(rng, 300, 600),
    sweepRange: rr(rng, 200, 800),
    sweepDuration: rr(rng, 0.05, 0.15),
    noiseLevel: rr(rng, 0.1, 0.4),
    noiseDecay: rr(rng, 0.02, 0.08),
    attack: rr(rng, 0.002, 0.01),
    decay: rr(rng, 0.05, 0.2),
    filterCutoff: rr(rng, 1500, 5000),
  };
}
