/**
 * Card Discard Recipe — Seed-Derived Parameters
 *
 * Short noise burst with quick decay for discarding a card. Subtle,
 * neutral action — bandpass-filtered noise with a brief tonal "thud"
 * to suggest the card landing in a discard pile.
 *
 * Card Game Shared Conventions (Tier 4 — Removal):
 * - Duration under 0.3s for quick, neutral feedback
 * - Noise-based primary with brief tonal accent
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-discard recipe. */
export interface CardDiscardParams {
  /** Bandpass filter center frequency for noise burst (Hz) */
  filterFreq: number;
  /** Filter Q */
  filterQ: number;
  /** Attack time (s) */
  attack: number;
  /** Noise decay time (s) */
  decay: number;
  /** Noise burst level */
  noiseLevel: number;
  /** Low thud frequency (Hz) */
  thudFreq: number;
  /** Thud level */
  thudLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardDiscardParams(rng: Rng): CardDiscardParams {
  return {
    filterFreq: rr(rng, 600, 2000),
    filterQ: rr(rng, 1, 4),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.04, 0.15),
    noiseLevel: rr(rng, 0.4, 0.8),
    thudFreq: rr(rng, 100, 300),
    thudLevel: rr(rng, 0.2, 0.5),
  };
}
