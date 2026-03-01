/**
 * Card Lock Recipe — Seed-Derived Parameters
 *
 * Mechanical click + lowpass filter sweep downward. Suggests a card
 * being locked/sealed — constrained, heavy, closing motion.
 *
 * Card Game Shared Conventions (Tier 5 — State):
 * - Duration under 0.3s for snappy feedback
 * - Downward filter sweep = locking/closing
 * - Paired with card-unlock (opposite direction)
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-lock recipe. */
export interface CardLockParams {
  /** Click transient frequency (Hz) */
  clickFreq: number;
  /** Click level */
  clickLevel: number;
  /** Lowpass filter start frequency — high (Hz) */
  filterStart: number;
  /** Lowpass filter end frequency — low (Hz) */
  filterEnd: number;
  /** Noise body level */
  noiseLevel: number;
  /** Attack time (s) */
  attack: number;
  /** Decay time (s) */
  decay: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardLockParams(rng: Rng): CardLockParams {
  return {
    clickFreq: rr(rng, 1500, 4000),
    clickLevel: rr(rng, 0.4, 0.8),
    filterStart: rr(rng, 3000, 6000),
    filterEnd: rr(rng, 200, 600),
    noiseLevel: rr(rng, 0.3, 0.6),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.05, 0.2),
  };
}
