/**
 * Card Defeat Sting Recipe — Seed-Derived Parameters
 *
 * Tonal synthesis: descending minor-interval sting for major defeat
 * moments. Uses a primary sine oscillator stepping down through a
 * minor interval with lowpass filtering for a somber, muffled decay.
 * Up to 3 seconds duration.
 *
 * Card Game Shared Conventions (Tier 2):
 * - Negative outcomes: descending tonal patterns, minor/dissonant intervals
 * - Defeat sting may be up to 3 seconds
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-defeat-sting recipe. */
export interface CardDefeatStingParams {
  /** Starting frequency for the first note (Hz) */
  startFreq: number;
  /** Minor interval ratio for the second note (e.g., 0.84 = minor third down) */
  dropRatio: number;
  /** Duration of each note (s) */
  noteDuration: number;
  /** Attack time per note (s) */
  noteAttack: number;
  /** Lowpass filter cutoff that sweeps down during decay (Hz) */
  filterStart: number;
  /** Filter end frequency (Hz) */
  filterEnd: number;
  /** Primary tone level */
  level: number;
  /** Tail decay after final note (s) */
  tailDecay: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardDefeatStingParams(rng: Rng): CardDefeatStingParams {
  return {
    startFreq: rr(rng, 400, 700),
    dropRatio: rr(rng, 0.75, 0.9),
    noteDuration: rr(rng, 0.3, 0.6),
    noteAttack: rr(rng, 0.005, 0.02),
    filterStart: rr(rng, 2000, 4000),
    filterEnd: rr(rng, 200, 600),
    level: rr(rng, 0.5, 0.9),
    tailDecay: rr(rng, 0.5, 1.2),
  };
}
