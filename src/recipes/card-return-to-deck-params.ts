/**
 * Card Return-to-Deck Recipe — Seed-Derived Parameters
 *
 * Subtle swoosh with slight upward pitch — conceptual inverse of
 * card-draw. Bandpass-filtered noise with ascending tonal accent
 * to suggest the card sliding back into the deck.
 *
 * Card Game Shared Conventions (Tier 4 — Removal):
 * - Duration under 0.3s for quick feedback
 * - Ascending pitch accent (inverse of draw)
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-return-to-deck recipe. */
export interface CardReturnToDeckParams {
  /** Bandpass center frequency for swoosh noise (Hz) */
  filterFreq: number;
  /** Filter Q */
  filterQ: number;
  /** Attack time (s) */
  attack: number;
  /** Swoosh decay time (s) */
  decay: number;
  /** Swoosh noise level */
  noiseLevel: number;
  /** Ascending tone start frequency (Hz) */
  toneStart: number;
  /** Ascending tone end frequency (Hz) */
  toneEnd: number;
  /** Tone level */
  toneLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardReturnToDeckParams(rng: Rng): CardReturnToDeckParams {
  return {
    filterFreq: rr(rng, 800, 2500),
    filterQ: rr(rng, 1.5, 5),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.05, 0.15),
    noiseLevel: rr(rng, 0.3, 0.7),
    toneStart: rr(rng, 400, 800),
    toneEnd: rr(rng, 800, 1400),
    toneLevel: rr(rng, 0.2, 0.5),
  };
}
