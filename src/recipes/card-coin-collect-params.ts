/**
 * Card Coin Collect Recipe — Seed-Derived Parameters
 *
 * Pure synthesis: bright metallic ascending ping for coin/token
 * collection events. Uses a sine oscillator with harmonics and a
 * highpass-filtered noise transient for the metallic "clink" attack.
 *
 * Card Game Shared Conventions (Tier 3 — Economy):
 * - Tonal center range: 800–2000 Hz (bright, rewarding)
 * - Ascending pitch sweep for positive feedback
 * - Duration under 0.5s for responsive game feedback
 * - Stylized/arcade aesthetic: exaggerated brightness
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-coin-collect recipe. */
export interface CardCoinCollectParams {
  /** Base frequency for the metallic ping (Hz) */
  baseFreq: number;
  /** Pitch sweep amount — upward frequency offset at attack (Hz) */
  pitchSweep: number;
  /** Attack time (s) */
  attack: number;
  /** Decay time (s) */
  decay: number;
  /** Primary tone level */
  toneLevel: number;
  /** Harmonic overtone level (adds metallic shimmer) */
  harmonicLevel: number;
  /** Noise transient level (metallic clink attack) */
  noiseLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardCoinCollectParams(rng: Rng): CardCoinCollectParams {
  return {
    baseFreq: rr(rng, 800, 2000),
    pitchSweep: rr(rng, 200, 800),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.08, 0.3),
    toneLevel: rr(rng, 0.5, 0.9),
    harmonicLevel: rr(rng, 0.2, 0.5),
    noiseLevel: rr(rng, 0.1, 0.4),
  };
}
