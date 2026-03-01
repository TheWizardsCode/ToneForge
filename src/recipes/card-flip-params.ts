/**
 * Card Flip Recipe — Seed-Derived Parameters
 *
 * Stylized card flip using filtered noise burst with a brief tonal transient.
 * Noise-based synthesis: bandpass-filtered white noise for the "flick" texture
 * with a short sine click for the snap.
 *
 * Card Game Shared Conventions (Tier 1):
 * - Tonal center range: 300–1200 Hz (stylized/arcade aesthetic)
 * - Envelope durations: attack < 0.01s, total < 0.5s
 * - Decay tails < 0.3s for clean rapid playback
 * - All card-* recipes auto-categorize as "card-game" via classifier prefix mapping
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-flip recipe. */
export interface CardFlipParams {
  /** Bandpass filter center frequency for the noise flick (Hz) */
  filterFreq: number;
  /** Bandpass filter Q for spectral width */
  filterQ: number;
  /** Attack time (s) */
  attack: number;
  /** Noise body decay time (s) */
  decay: number;
  /** Noise layer amplitude */
  noiseLevel: number;
  /** Sine click frequency for snap transient (Hz) */
  clickFreq: number;
  /** Click amplitude */
  clickLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardFlipParams(rng: Rng): CardFlipParams {
  return {
    filterFreq: rr(rng, 800, 2500),
    filterQ: rr(rng, 1.5, 5),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.03, 0.12),
    noiseLevel: rr(rng, 0.5, 0.9),
    clickFreq: rr(rng, 600, 1200),
    clickLevel: rr(rng, 0.3, 0.7),
  };
}
