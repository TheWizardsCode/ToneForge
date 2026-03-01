/**
 * Card Success Recipe — Seed-Derived Parameters
 *
 * Tonal synthesis: bright ascending dual-tone "ding" for positive
 * game outcomes (e.g., successful play, correct match). Uses two
 * sine oscillators at a consonant interval with a quick envelope.
 *
 * Card Game Shared Conventions (Tier 2):
 * - Tonal center range: 300–1200 Hz (stylized/arcade aesthetic)
 * - Positive outcomes use ascending patterns and major intervals
 * - Duration under 1 second for responsive game feedback
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-success recipe. */
export interface CardSuccessParams {
  /** Base frequency for the primary tone (Hz) */
  baseFreq: number;
  /** Interval ratio for the second tone (e.g., 1.25 = major third) */
  intervalRatio: number;
  /** Attack time (s) */
  attack: number;
  /** Decay time (s) */
  decay: number;
  /** Primary tone level */
  primaryLevel: number;
  /** Secondary tone level */
  secondaryLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardSuccessParams(rng: Rng): CardSuccessParams {
  return {
    baseFreq: rr(rng, 600, 1100),
    intervalRatio: rr(rng, 1.2, 1.5),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.1, 0.4),
    primaryLevel: rr(rng, 0.5, 0.9),
    secondaryLevel: rr(rng, 0.3, 0.6),
  };
}
