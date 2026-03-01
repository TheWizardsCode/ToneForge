/**
 * Card Failure Recipe — Seed-Derived Parameters
 *
 * Tonal synthesis: descending dissonant tone for negative game outcomes
 * (e.g., wrong match, failed action). Uses a sine oscillator with a
 * descending frequency sweep and slight detuned secondary tone for
 * the dissonant quality.
 *
 * Card Game Shared Conventions (Tier 2):
 * - Negative outcomes use descending patterns and dissonant intervals
 * - Duration under 1 second for responsive game feedback
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-failure recipe. */
export interface CardFailureParams {
  /** Starting frequency for the descending sweep (Hz) */
  startFreq: number;
  /** Frequency drop range (Hz) */
  sweepDrop: number;
  /** Detuned secondary oscillator offset (Hz) — creates dissonance */
  detuneOffset: number;
  /** Attack time (s) */
  attack: number;
  /** Decay time (s) */
  decay: number;
  /** Primary tone level */
  primaryLevel: number;
  /** Secondary (detuned) tone level */
  secondaryLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardFailureParams(rng: Rng): CardFailureParams {
  return {
    startFreq: rr(rng, 500, 900),
    sweepDrop: rr(rng, 100, 300),
    detuneOffset: rr(rng, 15, 50),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.15, 0.5),
    primaryLevel: rr(rng, 0.5, 0.9),
    secondaryLevel: rr(rng, 0.2, 0.5),
  };
}
