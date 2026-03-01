/**
 * Card Treasure Reveal Recipe — Seed-Derived Parameters
 *
 * Pure synthesis: dramatic shimmer-into-tone reveal sound for
 * treasure/rare card reveals. Starts with highpass-filtered noise
 * shimmer that fades as a bright tonal chord swells in, creating
 * a "sparkling reveal" effect.
 *
 * Card Game Shared Conventions (Tier 3 — Economy):
 * - Tonal center range: 500–1200 Hz (dramatic, rewarding)
 * - Shimmer-to-tone transition for dramatic reveal
 * - Duration 0.3–0.8s (slightly longer for dramatic effect)
 * - Stylized/arcade aesthetic: sparkle and grandeur
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-treasure-reveal recipe. */
export interface CardTreasureRevealParams {
  /** Shimmer noise highpass cutoff (Hz) */
  shimmerCutoff: number;
  /** Shimmer noise level */
  shimmerLevel: number;
  /** Shimmer decay time — fades out as tone swells (s) */
  shimmerDecay: number;
  /** Reveal tone base frequency (Hz) */
  toneFreq: number;
  /** Reveal tone major-third interval ratio */
  intervalRatio: number;
  /** Tone swell attack time (s) */
  toneAttack: number;
  /** Tone sustain then decay time (s) */
  toneDecay: number;
  /** Reveal tone level */
  toneLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardTreasureRevealParams(rng: Rng): CardTreasureRevealParams {
  return {
    shimmerCutoff: rr(rng, 4000, 10000),
    shimmerLevel: rr(rng, 0.3, 0.7),
    shimmerDecay: rr(rng, 0.1, 0.3),
    toneFreq: rr(rng, 500, 1200),
    intervalRatio: rr(rng, 1.2, 1.5),
    toneAttack: rr(rng, 0.02, 0.1),
    toneDecay: rr(rng, 0.15, 0.5),
    toneLevel: rr(rng, 0.5, 0.9),
  };
}
