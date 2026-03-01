/**
 * Card Round Complete Recipe — Seed-Derived Parameters
 *
 * Tonal synthesis: neutral completion tone for round/turn end events.
 * Uses a single sine oscillator with a clean envelope and subtle
 * lowpass filtering. Neither ascending (positive) nor descending
 * (negative) — a clean, satisfying "done" signal.
 *
 * Card Game Shared Conventions (Tier 2):
 * - Neutral outcome: stable pitch, clean envelope
 * - Duration under 1 second
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-round-complete recipe. */
export interface CardRoundCompleteParams {
  /** Tone frequency (Hz) */
  frequency: number;
  /** Attack time (s) */
  attack: number;
  /** Sustain level (0–1) */
  sustain: number;
  /** Decay/release time (s) */
  decay: number;
  /** Lowpass filter cutoff (Hz) */
  filterCutoff: number;
  /** Tone level */
  level: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardRoundCompleteParams(rng: Rng): CardRoundCompleteParams {
  return {
    frequency: rr(rng, 500, 900),
    attack: rr(rng, 0.005, 0.02),
    sustain: rr(rng, 0.3, 0.6),
    decay: rr(rng, 0.1, 0.35),
    filterCutoff: rr(rng, 1500, 3500),
    level: rr(rng, 0.5, 0.85),
  };
}
