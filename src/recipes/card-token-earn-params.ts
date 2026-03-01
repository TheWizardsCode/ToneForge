/**
 * Card Token Earn Recipe — Seed-Derived Parameters
 *
 * Pure synthesis: bright ascending multi-harmonic chime for earning
 * tokens/rewards. Uses stacked sine oscillators at harmonic intervals
 * with a quick attack and medium decay for a satisfying "earn" sound.
 *
 * Card Game Shared Conventions (Tier 3 — Economy):
 * - Tonal center range: 600–1400 Hz (bright, rewarding)
 * - Ascending tonal pattern with harmonic richness
 * - Duration under 0.5s for responsive game feedback
 * - Stylized/arcade aesthetic: celebratory but brief
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-token-earn recipe. */
export interface CardTokenEarnParams {
  /** Fundamental frequency (Hz) */
  baseFreq: number;
  /** Second harmonic ratio (e.g. 2.0 = octave) */
  harmonic2Ratio: number;
  /** Third harmonic ratio (e.g. 3.0 = octave + fifth) */
  harmonic3Ratio: number;
  /** Attack time (s) */
  attack: number;
  /** Decay time (s) */
  decay: number;
  /** Fundamental level */
  fundamentalLevel: number;
  /** Second harmonic level */
  harmonic2Level: number;
  /** Third harmonic level */
  harmonic3Level: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardTokenEarnParams(rng: Rng): CardTokenEarnParams {
  return {
    baseFreq: rr(rng, 600, 1400),
    harmonic2Ratio: rr(rng, 1.9, 2.1),
    harmonic3Ratio: rr(rng, 2.9, 3.1),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.1, 0.35),
    fundamentalLevel: rr(rng, 0.5, 0.9),
    harmonic2Level: rr(rng, 0.2, 0.5),
    harmonic3Level: rr(rng, 0.1, 0.3),
  };
}
