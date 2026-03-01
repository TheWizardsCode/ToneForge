/**
 * Card Slide Recipe — Seed-Derived Parameters
 *
 * Tonal/oscillator-based synthesis: smooth pitch sweep with filtered
 * undertone to evoke a card sliding across a surface. Uses a sine
 * oscillator with a gentle downward frequency ramp for the sliding motion.
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

/** Parameters derived from seed for the card-slide recipe. */
export interface CardSlideParams {
  /** Starting frequency for the slide sweep (Hz) */
  startFreq: number;
  /** Frequency drop range during slide (Hz) */
  sweepRange: number;
  /** Attack time (s) */
  attack: number;
  /** Slide/decay time (s) */
  decay: number;
  /** Lowpass filter cutoff (Hz) */
  filterCutoff: number;
  /** Noise texture level for surface friction */
  noiseLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardSlideParams(rng: Rng): CardSlideParams {
  return {
    startFreq: rr(rng, 500, 1000),
    sweepRange: rr(rng, 100, 400),
    attack: rr(rng, 0.001, 0.008),
    decay: rr(rng, 0.06, 0.2),
    filterCutoff: rr(rng, 1000, 3000),
    noiseLevel: rr(rng, 0.1, 0.35),
  };
}
