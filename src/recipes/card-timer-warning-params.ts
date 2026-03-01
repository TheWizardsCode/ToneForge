/**
 * Card Timer Warning Recipe — Seed-Derived Parameters
 *
 * Escalating/urgent tick variant with higher pitch, faster modulation,
 * and sharper attack. Conveys time pressure.
 *
 * Card Game Shared Conventions (Tier 7 — Contextual):
 * - Duration under 0.3s
 * - Higher pitch and more aggressive than timer-tick
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-timer-warning recipe. */
export interface CardTimerWarningParams {
  /** Base frequency — higher than timer-tick (Hz) */
  freq: number;
  /** Second tone ratio for urgency chord */
  urgencyRatio: number;
  /** Attack time (s) — near-instantaneous */
  attack: number;
  /** Decay time (s) */
  decay: number;
  /** Overall level — louder than tick */
  level: number;
  /** Pitch modulation rate for urgency vibrato (Hz) */
  vibratoRate: number;
  /** Pitch modulation depth (Hz) */
  vibratoDepth: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardTimerWarningParams(rng: Rng): CardTimerWarningParams {
  return {
    freq: rr(rng, 1500, 3500),
    urgencyRatio: rr(rng, 1.3, 1.8),
    attack: rr(rng, 0.0005, 0.002),
    decay: rr(rng, 0.05, 0.15),
    level: rr(rng, 0.5, 0.9),
    vibratoRate: rr(rng, 8, 20),
    vibratoDepth: rr(rng, 20, 80),
  };
}
