/**
 * Card Timer Tick Recipe — Seed-Derived Parameters
 *
 * Sharp, clean click/tick for a metronome-like timer beat.
 * Short and repeatable — designed for rapid succession.
 *
 * Card Game Shared Conventions (Tier 7 — Contextual):
 * - Duration under 0.2s for crisp, repeatable ticks
 * - Clean, precise transient
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-timer-tick recipe. */
export interface CardTimerTickParams {
  /** Click frequency (Hz) */
  freq: number;
  /** Attack time (s) — near-instantaneous */
  attack: number;
  /** Decay time (s) — short */
  decay: number;
  /** Overall level */
  level: number;
  /** Highpass cutoff for click crispness (Hz) */
  clickCutoff: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardTimerTickParams(rng: Rng): CardTimerTickParams {
  return {
    freq: rr(rng, 1000, 2500),
    attack: rr(rng, 0.0005, 0.002),
    decay: rr(rng, 0.02, 0.08),
    level: rr(rng, 0.4, 0.8),
    clickCutoff: rr(rng, 2000, 5000),
  };
}
