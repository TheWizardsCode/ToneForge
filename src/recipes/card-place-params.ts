/**
 * Card Place Recipe — Seed-Derived Parameters
 *
 * Noise-based synthesis: short impact thud of a card landing on a surface.
 * Uses lowpass-filtered noise burst for the soft "thump" with a quick decay.
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

/** Parameters derived from seed for the card-place recipe. */
export interface CardPlaceParams {
  /** Lowpass filter cutoff for the thud body (Hz) */
  filterFreq: number;
  /** Filter resonance */
  filterQ: number;
  /** Attack time (s) */
  attack: number;
  /** Body decay time (s) */
  bodyDecay: number;
  /** Body noise level */
  bodyLevel: number;
  /** Tonal click frequency for subtle tap accent (Hz) */
  clickFreq: number;
  /** Click level */
  clickLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardPlaceParams(rng: Rng): CardPlaceParams {
  return {
    filterFreq: rr(rng, 300, 900),
    filterQ: rr(rng, 1, 4),
    attack: rr(rng, 0.001, 0.004),
    bodyDecay: rr(rng, 0.03, 0.1),
    bodyLevel: rr(rng, 0.5, 0.9),
    clickFreq: rr(rng, 400, 800),
    clickLevel: rr(rng, 0.15, 0.4),
  };
}
