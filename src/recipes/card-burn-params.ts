/**
 * Card Burn Recipe — Seed-Derived Parameters
 *
 * Destructive synthesis: filtered noise with descending pitch sweep
 * for a dissolve/fire effect. Longer decay than discard to convey
 * permanence. Uses lowpass-swept noise to simulate burning/dissolving.
 *
 * Card Game Shared Conventions (Tier 4 — Removal):
 * - Duration 0.3–0.8s for dramatic destructive effect
 * - Descending filter sweep for dissolve feel
 * - Distinct from card-discard (longer, more dramatic)
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-burn recipe. */
export interface CardBurnParams {
  /** Starting filter cutoff frequency — high, sweeps down (Hz) */
  filterStart: number;
  /** Ending filter cutoff frequency — low (Hz) */
  filterEnd: number;
  /** Attack time (s) */
  attack: number;
  /** Burn decay/sustain time (s) */
  decay: number;
  /** Noise level */
  noiseLevel: number;
  /** Crackle layer level (adds fire texture) */
  crackleLevel: number;
  /** Low rumble frequency for body (Hz) */
  rumbleFreq: number;
  /** Rumble level */
  rumbleLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardBurnParams(rng: Rng): CardBurnParams {
  return {
    filterStart: rr(rng, 3000, 8000),
    filterEnd: rr(rng, 200, 800),
    attack: rr(rng, 0.005, 0.02),
    decay: rr(rng, 0.3, 0.7),
    noiseLevel: rr(rng, 0.4, 0.8),
    crackleLevel: rr(rng, 0.1, 0.4),
    rumbleFreq: rr(rng, 60, 150),
    rumbleLevel: rr(rng, 0.1, 0.3),
  };
}
