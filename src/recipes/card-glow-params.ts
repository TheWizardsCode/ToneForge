/**
 * Card Glow Recipe — Seed-Derived Parameters
 *
 * Sustained filtered oscillator with shimmer/vibrato LFO. Atmospheric
 * hum suggesting a card radiating energy or a highlight state.
 *
 * Card Game Shared Conventions (Tier 5 — State):
 * - Duration up to 1s for atmospheric/sustained effect
 * - LFO modulation for living, pulsing feel
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-glow recipe. */
export interface CardGlowParams {
  /** Base oscillator frequency (Hz) */
  baseFreq: number;
  /** LFO vibrato rate (Hz) */
  lfoRate: number;
  /** LFO depth (frequency deviation in Hz) */
  lfoDepth: number;
  /** Bandpass filter center for shimmer (Hz) */
  filterFreq: number;
  /** Filter Q */
  filterQ: number;
  /** Attack/fade-in time (s) */
  attack: number;
  /** Sustain duration (s) */
  sustain: number;
  /** Release/fade-out time (s) */
  release: number;
  /** Overall level */
  level: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardGlowParams(rng: Rng): CardGlowParams {
  return {
    baseFreq: rr(rng, 400, 900),
    lfoRate: rr(rng, 3, 10),
    lfoDepth: rr(rng, 10, 50),
    filterFreq: rr(rng, 1000, 3000),
    filterQ: rr(rng, 2, 8),
    attack: rr(rng, 0.05, 0.15),
    sustain: rr(rng, 0.3, 0.6),
    release: rr(rng, 0.1, 0.3),
    level: rr(rng, 0.4, 0.8),
  };
}
