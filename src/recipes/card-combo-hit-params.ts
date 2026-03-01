/**
 * Card Combo Hit Recipe — Seed-Derived Parameters
 *
 * Bright transient with harmonic reinforcement. Positive, punchy
 * impact for a successful combo hit in chain-style gameplay.
 *
 * Card Game Shared Conventions (Tier 6 — Combo):
 * - Duration under 0.3s for responsive rapid-fire feedback
 * - Bright, ascending character = positive feedback
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-combo-hit recipe. */
export interface CardComboHitParams {
  /** Fundamental transient frequency (Hz) */
  freq: number;
  /** Harmonic overtone ratio */
  harmonicRatio: number;
  /** Harmonic level */
  harmonicLevel: number;
  /** Attack time (s) */
  attack: number;
  /** Decay time (s) */
  decay: number;
  /** Fundamental level */
  level: number;
  /** Brightness: highpass filter cutoff to add sparkle (Hz) */
  brightnessFreq: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardComboHitParams(rng: Rng): CardComboHitParams {
  return {
    freq: rr(rng, 600, 1200),
    harmonicRatio: rr(rng, 1.5, 3),
    harmonicLevel: rr(rng, 0.3, 0.6),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.05, 0.15),
    level: rr(rng, 0.5, 0.9),
    brightnessFreq: rr(rng, 3000, 7000),
  };
}
