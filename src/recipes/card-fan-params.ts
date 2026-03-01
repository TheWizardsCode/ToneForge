/**
 * Card Fan Recipe — Seed-Derived Parameters
 *
 * Tonal/oscillator-based synthesis: smooth ascending arpeggio-like sweep
 * representing cards fanning out. Uses multiple rapid sine blips at
 * ascending frequencies with a gentle filtered noise bed.
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

/** Parameters derived from seed for the card-fan recipe. */
export interface CardFanParams {
  /** Base frequency for the ascending sweep (Hz) */
  baseFreq: number;
  /** Frequency range of ascending sweep (Hz) */
  sweepRange: number;
  /** Attack time (s) */
  attack: number;
  /** Total sweep/decay time (s) */
  decay: number;
  /** Lowpass filter cutoff (Hz) */
  filterCutoff: number;
  /** Noise bed level for texture */
  noiseLevel: number;
  /** Tonal sweep level */
  sweepLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardFanParams(rng: Rng): CardFanParams {
  return {
    baseFreq: rr(rng, 400, 900),
    sweepRange: rr(rng, 200, 600),
    attack: rr(rng, 0.002, 0.008),
    decay: rr(rng, 0.08, 0.25),
    filterCutoff: rr(rng, 1500, 4000),
    noiseLevel: rr(rng, 0.1, 0.3),
    sweepLevel: rr(rng, 0.4, 0.8),
  };
}
