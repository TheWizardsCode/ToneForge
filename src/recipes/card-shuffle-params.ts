/**
 * Card Shuffle Recipe — Seed-Derived Parameters
 *
 * Noise-based synthesis: rapid burst of granular noise representing
 * the riffle of a card shuffle. Uses bandpass-filtered white noise
 * with amplitude modulation at a grain rate to create the rapid
 * "flutter" texture.
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

/** Parameters derived from seed for the card-shuffle recipe. */
export interface CardShuffleParams {
  /** Bandpass filter center frequency (Hz) */
  filterFreq: number;
  /** Bandpass filter Q */
  filterQ: number;
  /** Attack time (s) */
  attack: number;
  /** Overall duration/decay (s) */
  decay: number;
  /** Grain rate for the flutter modulation (Hz) */
  grainRate: number;
  /** Grain depth (0–1, modulation depth) */
  grainDepth: number;
  /** Overall noise level */
  noiseLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardShuffleParams(rng: Rng): CardShuffleParams {
  return {
    filterFreq: rr(rng, 600, 2000),
    filterQ: rr(rng, 1, 4),
    attack: rr(rng, 0.002, 0.008),
    decay: rr(rng, 0.15, 0.4),
    grainRate: rr(rng, 20, 60),
    grainDepth: rr(rng, 0.3, 0.8),
    noiseLevel: rr(rng, 0.5, 0.9),
  };
}
