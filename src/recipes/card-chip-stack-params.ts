/**
 * Card Chip Stack Recipe — Seed-Derived Parameters
 *
 * Pure synthesis: layered percussive click with a brief tonal ring
 * for stacking poker chips or game tokens. Uses a bandpass noise
 * burst for the "clack" impact and a damped sine for the ring-out.
 *
 * Card Game Shared Conventions (Tier 3 — Economy):
 * - Percussive with brief tonal tail
 * - Duration under 0.3s for rapid stacking sequences
 * - Stylized/arcade aesthetic: satisfying tactile feedback
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-chip-stack recipe. */
export interface CardChipStackParams {
  /** Bandpass center frequency for the percussive click (Hz) */
  clickFreq: number;
  /** Bandpass Q for the click */
  clickQ: number;
  /** Click noise level */
  clickLevel: number;
  /** Ring-out tone frequency (Hz) */
  ringFreq: number;
  /** Ring-out level */
  ringLevel: number;
  /** Attack time (s) */
  attack: number;
  /** Click decay time (s) */
  clickDecay: number;
  /** Ring decay time (s) */
  ringDecay: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardChipStackParams(rng: Rng): CardChipStackParams {
  return {
    clickFreq: rr(rng, 1500, 4000),
    clickQ: rr(rng, 2, 8),
    clickLevel: rr(rng, 0.5, 0.9),
    ringFreq: rr(rng, 800, 2000),
    ringLevel: rr(rng, 0.2, 0.5),
    attack: rr(rng, 0.001, 0.003),
    clickDecay: rr(rng, 0.02, 0.08),
    ringDecay: rr(rng, 0.05, 0.2),
  };
}
