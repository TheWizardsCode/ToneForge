/**
 * Card Deck Presence Recipe — Seed-Derived Parameters
 *
 * Quiet tonal hum with harmonic shimmer. A subtle ambient texture
 * that gives the deck a "living" quality — quiet energy.
 *
 * Card Game Shared Conventions (Tier 7 — Ambient):
 * - Duration 1–2s for ambient texture
 * - Quiet, tonal, shimmering background layer
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-deck-presence recipe. */
export interface CardDeckPresenceParams {
  /** Fundamental hum frequency (Hz) */
  humFreq: number;
  /** Shimmer harmonic ratio */
  shimmerRatio: number;
  /** Shimmer LFO rate (Hz) — amplitude tremolo */
  shimmerRate: number;
  /** Shimmer level */
  shimmerLevel: number;
  /** Attack / fade-in time (s) */
  attack: number;
  /** Sustain hold time (s) */
  sustain: number;
  /** Release / fade-out time (s) */
  release: number;
  /** Fundamental hum level */
  level: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardDeckPresenceParams(rng: Rng): CardDeckPresenceParams {
  return {
    humFreq: rr(rng, 80, 200),
    shimmerRatio: rr(rng, 3, 6),
    shimmerRate: rr(rng, 2, 8),
    shimmerLevel: rr(rng, 0.05, 0.2),
    attack: rr(rng, 0.2, 0.5),
    sustain: rr(rng, 0.5, 1.2),
    release: rr(rng, 0.2, 0.5),
    level: rr(rng, 0.1, 0.3),
  };
}
