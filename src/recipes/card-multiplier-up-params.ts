/**
 * Card Multiplier Up Recipe — Seed-Derived Parameters
 *
 * Rising arpeggio / accelerating pitch sweep. Escalating positive
 * feedback for multiplier increases in combo gameplay.
 *
 * Card Game Shared Conventions (Tier 6 — Combo):
 * - Duration 0.2–0.5s for satisfying escalation
 * - Ascending, accelerating character = escalating positive
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-multiplier-up recipe. */
export interface CardMultiplierUpParams {
  /** Base frequency for arpeggio start (Hz) */
  baseFreq: number;
  /** Interval ratio between arpeggio notes */
  intervalRatio: number;
  /** Number of arpeggio steps (2-4) */
  noteCount: number;
  /** Per-note duration (s) */
  noteDuration: number;
  /** Attack per note (s) */
  attack: number;
  /** Overall level */
  level: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardMultiplierUpParams(rng: Rng): CardMultiplierUpParams {
  return {
    baseFreq: rr(rng, 500, 1000),
    intervalRatio: rr(rng, 1.15, 1.5),
    noteCount: Math.floor(rr(rng, 2, 5)),
    noteDuration: rr(rng, 0.04, 0.1),
    attack: rr(rng, 0.002, 0.01),
    level: rr(rng, 0.5, 0.9),
  };
}
