/**
 * Card Combo Break Recipe — Seed-Derived Parameters
 *
 * Descending dissonant tone with noise burst for interruption.
 * Clear negative feedback when a combo chain is broken.
 *
 * Card Game Shared Conventions (Tier 6 — Combo):
 * - Duration 0.15–0.4s for immediate disruption feel
 * - Dissonant, descending character = negative feedback
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-combo-break recipe. */
export interface CardComboBreakParams {
  /** Starting frequency — high, drops down (Hz) */
  freqStart: number;
  /** Ending frequency — low (Hz) */
  freqEnd: number;
  /** Dissonant interval ratio (slightly off-harmony) */
  dissonanceRatio: number;
  /** Attack time (s) */
  attack: number;
  /** Decay time (s) */
  decay: number;
  /** Tone level */
  toneLevel: number;
  /** Noise burst level */
  noiseLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardComboBreakParams(rng: Rng): CardComboBreakParams {
  return {
    freqStart: rr(rng, 500, 1000),
    freqEnd: rr(rng, 150, 350),
    dissonanceRatio: rr(rng, 1.05, 1.15),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.15, 0.35),
    toneLevel: rr(rng, 0.4, 0.8),
    noiseLevel: rr(rng, 0.2, 0.5),
  };
}
