/**
 * Card Unlock Recipe — Seed-Derived Parameters
 *
 * Click + highpass filter sweep upward. Suggests a card being
 * unlocked/released — opening, freeing motion. Paired inverse
 * of card-lock.
 *
 * Card Game Shared Conventions (Tier 5 — State):
 * - Duration under 0.3s for snappy feedback
 * - Upward filter sweep = unlocking/opening
 * - Paired with card-lock (opposite direction)
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-unlock recipe. */
export interface CardUnlockParams {
  /** Click transient frequency (Hz) */
  clickFreq: number;
  /** Click level */
  clickLevel: number;
  /** Highpass filter start frequency — low (Hz) */
  filterStart: number;
  /** Highpass filter end frequency — high (Hz) */
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
export function getCardUnlockParams(rng: Rng): CardUnlockParams {
  return {
    clickFreq: rr(rng, 2000, 5000),
    clickLevel: rr(rng, 0.4, 0.8),
    filterStart: rr(rng, 200, 600),
    filterEnd: rr(rng, 3000, 6000),
    noiseLevel: rr(rng, 0.3, 0.6),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.05, 0.2),
  };
}
