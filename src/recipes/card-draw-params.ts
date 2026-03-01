/**
 * Card Draw Recipe — Seed-Derived Parameters
 *
 * Noise-based synthesis with tonal accent: quick upward "swipe" sound
 * for drawing a card from a deck. Uses highpass-filtered noise with
 * a brief ascending sine sweep for the lift-off feel.
 *
 * Card Game Shared Conventions (Tier 1):
 * - Tonal center range: 300–1200 Hz
 * - Envelope durations: attack < 0.01s, total < 0.5s
 * - Decay tails < 0.3s for clean rapid playback
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-draw recipe. */
export interface CardDrawParams {
  /** Highpass filter frequency for the swipe noise (Hz) */
  filterFreq: number;
  /** Filter Q */
  filterQ: number;
  /** Attack time (s) */
  attack: number;
  /** Noise decay time (s) */
  decay: number;
  /** Noise layer amplitude */
  noiseLevel: number;
  /** Base frequency for ascending sweep (Hz) */
  sweepBaseFreq: number;
  /** Sweep range upward (Hz) */
  sweepRange: number;
  /** Sweep oscillator level */
  sweepLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardDrawParams(rng: Rng): CardDrawParams {
  return {
    filterFreq: rr(rng, 1200, 3000),
    filterQ: rr(rng, 0.5, 2.5),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.04, 0.15),
    noiseLevel: rr(rng, 0.3, 0.7),
    sweepBaseFreq: rr(rng, 400, 800),
    sweepRange: rr(rng, 200, 600),
    sweepLevel: rr(rng, 0.3, 0.6),
  };
}
