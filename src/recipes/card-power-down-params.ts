/**
 * Card Power-Down Recipe — Seed-Derived Parameters
 *
 * Descending pitch sweep with filtered decay. Dark, deflating downward
 * motion suggesting a card losing power or ability deactivation.
 * Tonal contrast with card-power-up (descending vs ascending).
 *
 * Card Game Shared Conventions (Tier 5 — State):
 * - Duration 0.2–0.5s for responsive feedback
 * - Descending pitch = power loss
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-power-down recipe. */
export interface CardPowerDownParams {
  /** Starting oscillator frequency — high (Hz) */
  freqStart: number;
  /** Ending oscillator frequency — low (Hz) */
  freqEnd: number;
  /** Lowpass filter cutoff that tracks downward (Hz) */
  filterCutoff: number;
  /** Attack time (s) */
  attack: number;
  /** Decay time (s) */
  decay: number;
  /** Oscillator level */
  level: number;
  /** Noise layer level for grit */
  noiseLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardPowerDownParams(rng: Rng): CardPowerDownParams {
  return {
    freqStart: rr(rng, 800, 1600),
    freqEnd: rr(rng, 200, 500),
    filterCutoff: rr(rng, 2000, 5000),
    attack: rr(rng, 0.005, 0.02),
    decay: rr(rng, 0.2, 0.5),
    level: rr(rng, 0.5, 0.9),
    noiseLevel: rr(rng, 0.05, 0.2),
  };
}
