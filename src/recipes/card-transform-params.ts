/**
 * Card Transform Recipe — Seed-Derived Parameters
 *
 * Morphing FM synthesis with parameter crossfade. Suggests a card
 * changing form — shifting timbres, modulation depth sweep.
 *
 * Card Game Shared Conventions (Tier 5 — State):
 * - Duration up to 1s for dramatic state change
 * - FM modulation sweep for morphing timbre
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-transform recipe. */
export interface CardTransformParams {
  /** Carrier frequency (Hz) */
  carrierFreq: number;
  /** Modulator frequency ratio (modulator = carrier * ratio) */
  modRatio: number;
  /** FM modulation depth start (Hz) */
  modDepthStart: number;
  /** FM modulation depth end (Hz) */
  modDepthEnd: number;
  /** Attack time (s) */
  attack: number;
  /** Sustain time (s) */
  sustain: number;
  /** Release time (s) */
  release: number;
  /** Overall level */
  level: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardTransformParams(rng: Rng): CardTransformParams {
  return {
    carrierFreq: rr(rng, 300, 700),
    modRatio: rr(rng, 1, 4),
    modDepthStart: rr(rng, 50, 200),
    modDepthEnd: rr(rng, 300, 800),
    attack: rr(rng, 0.02, 0.08),
    sustain: rr(rng, 0.2, 0.5),
    release: rr(rng, 0.1, 0.3),
    level: rr(rng, 0.5, 0.9),
  };
}
