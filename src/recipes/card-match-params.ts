/**
 * Card Match Recipe — Seed-Derived Parameters
 *
 * Dual-tone confirmation — satisfying "ding-ding" for a successful
 * card match in matching/memory games.
 *
 * Card Game Shared Conventions (Tier 6 — Combo):
 * - Duration 0.15–0.4s for responsive match feedback
 * - Dual-tone chord = confirmation/success
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-match recipe. */
export interface CardMatchParams {
  /** First tone frequency (Hz) */
  tone1Freq: number;
  /** Second tone interval ratio (harmonic above first) */
  tone2Ratio: number;
  /** Attack time (s) */
  attack: number;
  /** Decay time (s) */
  decay: number;
  /** Delay before second tone (s) */
  tone2Delay: number;
  /** Overall level */
  level: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardMatchParams(rng: Rng): CardMatchParams {
  return {
    tone1Freq: rr(rng, 700, 1400),
    tone2Ratio: rr(rng, 1.25, 1.6),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.08, 0.2),
    tone2Delay: rr(rng, 0.04, 0.1),
    level: rr(rng, 0.5, 0.9),
  };
}
