/**
 * Card Victory Fanfare Recipe — Seed-Derived Parameters
 *
 * Tonal synthesis: ascending multi-note arpeggio with harmonic
 * reinforcement for major victory moments. Uses a primary sine
 * oscillator with stepped frequency increases and a triangle
 * harmonic layer. Up to 3 seconds duration.
 *
 * Card Game Shared Conventions (Tier 2):
 * - Positive outcomes: ascending tonal patterns, major intervals
 * - Victory fanfare may be up to 3 seconds
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-victory-fanfare recipe. */
export interface CardVictoryFanfareParams {
  /** Base frequency for the arpeggio root note (Hz) */
  baseFreq: number;
  /** Number of arpeggio steps (3–6) */
  noteCount: number;
  /** Duration per note (s) */
  noteDuration: number;
  /** Attack per note (s) */
  noteAttack: number;
  /** Arpeggio step interval ratio (e.g., 1.125 = major second) */
  stepRatio: number;
  /** Primary oscillator level */
  primaryLevel: number;
  /** Harmonic (triangle) oscillator level */
  harmonicLevel: number;
  /** Final sustain tail decay (s) */
  tailDecay: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardVictoryFanfareParams(rng: Rng): CardVictoryFanfareParams {
  return {
    baseFreq: rr(rng, 400, 800),
    noteCount: Math.floor(rr(rng, 3, 7)),
    noteDuration: rr(rng, 0.15, 0.35),
    noteAttack: rr(rng, 0.005, 0.02),
    stepRatio: rr(rng, 1.1, 1.26),
    primaryLevel: rr(rng, 0.5, 0.85),
    harmonicLevel: rr(rng, 0.2, 0.5),
    tailDecay: rr(rng, 0.3, 0.8),
  };
}
