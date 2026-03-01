/**
 * Card Coin Spend Recipe — Seed-Derived Parameters
 *
 * Pure synthesis: muted descending tone for coin/token spend events.
 * Uses a filtered sine oscillator with downward pitch sweep and a
 * soft noise layer for a "dropping" feel.
 *
 * Card Game Shared Conventions (Tier 3 — Economy):
 * - Tonal center range: 400–1000 Hz (warmer, muted)
 * - Descending pitch sweep for spend/loss feedback
 * - Duration under 0.5s for responsive game feedback
 * - Stylized/arcade aesthetic: noticeable but not harsh
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-coin-spend recipe. */
export interface CardCoinSpendParams {
  /** Base frequency — starting pitch before descending (Hz) */
  baseFreq: number;
  /** Downward pitch sweep amount (Hz) */
  pitchDrop: number;
  /** Attack time (s) */
  attack: number;
  /** Decay time (s) */
  decay: number;
  /** Tone level */
  toneLevel: number;
  /** Lowpass filter cutoff to muffle the tone (Hz) */
  filterCutoff: number;
  /** Noise layer level (soft texture) */
  noiseLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardCoinSpendParams(rng: Rng): CardCoinSpendParams {
  return {
    baseFreq: rr(rng, 500, 1000),
    pitchDrop: rr(rng, 150, 500),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.08, 0.3),
    toneLevel: rr(rng, 0.4, 0.8),
    filterCutoff: rr(rng, 1000, 3000),
    noiseLevel: rr(rng, 0.05, 0.2),
  };
}
