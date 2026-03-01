/**
 * Card Coin Collect Hybrid Recipe — Seed-Derived Parameters
 *
 * Sample-hybrid: layers a CC0 metallic coin sample with procedurally
 * varied synthesis. The sample provides realistic metallic texture
 * while synthesis adds tonal richness and seed variation.
 *
 * Card Game Shared Conventions (Tier 3 — Economy):
 * - Tonal center range: 800–2000 Hz (bright, rewarding)
 * - Duration under 0.5s for responsive game feedback
 * - Stylized/arcade aesthetic with sample-enhanced realism
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-coin-collect-hybrid recipe. */
export interface CardCoinCollectHybridParams {
  /** Base frequency for the synthesized tonal layer (Hz) */
  baseFreq: number;
  /** Attack time (s) */
  attack: number;
  /** Decay time (s) */
  decay: number;
  /** Sample vs synthesis mix (0 = all synth, 1 = all sample) */
  mixLevel: number;
  /** Synthesis tone level */
  synthLevel: number;
  /** Highpass filter cutoff for the noise shimmer layer (Hz) */
  filterCutoff: number;
  /** Noise shimmer level */
  shimmerLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardCoinCollectHybridParams(rng: Rng): CardCoinCollectHybridParams {
  return {
    baseFreq: rr(rng, 900, 1800),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.1, 0.35),
    mixLevel: rr(rng, 0.3, 0.7),
    synthLevel: rr(rng, 0.4, 0.8),
    filterCutoff: rr(rng, 3000, 8000),
    shimmerLevel: rr(rng, 0.1, 0.35),
  };
}
