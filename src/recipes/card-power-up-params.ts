/**
 * Card Power-Up Recipe — Seed-Derived Parameters
 *
 * Ascending pitch sweep with harmonic reinforcement. Bright, energetic
 * upward motion suggesting a card gaining power or ability activation.
 *
 * Card Game Shared Conventions (Tier 5 — State):
 * - Duration 0.2–0.5s for responsive feedback
 * - Ascending pitch = power gain
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-power-up recipe. */
export interface CardPowerUpParams {
  /** Starting oscillator frequency (Hz) */
  freqStart: number;
  /** Ending oscillator frequency — higher (Hz) */
  freqEnd: number;
  /** Harmonic overtone ratio */
  harmonicRatio: number;
  /** Harmonic level relative to fundamental */
  harmonicLevel: number;
  /** Attack time (s) */
  attack: number;
  /** Decay time (s) */
  decay: number;
  /** Fundamental level */
  level: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardPowerUpParams(rng: Rng): CardPowerUpParams {
  return {
    freqStart: rr(rng, 300, 600),
    freqEnd: rr(rng, 800, 1600),
    harmonicRatio: rr(rng, 1.5, 3),
    harmonicLevel: rr(rng, 0.2, 0.5),
    attack: rr(rng, 0.01, 0.04),
    decay: rr(rng, 0.15, 0.4),
    level: rr(rng, 0.5, 0.9),
  };
}
