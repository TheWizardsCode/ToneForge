/**
 * Impact Crack Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: Noise burst through highpass filter with fast decay
 * Produces a short, sharp transient crack suitable as the initial
 * attack layer in an explosion stack.
 *
 * Seed-varied parameters:
 * - Filter frequency: 2000-6000 Hz (controls brightness of crack)
 * - Filter Q: 0.5-3 (resonance sharpness)
 * - Attack: 0.001-0.003s (snap of transient)
 * - Decay: 0.04-0.1s (how quickly the crack fades)
 * - Level: 0.7-1.0 (overall amplitude)
 * - Noise color mix: 0.0-1.0 (blend between white and pink character)
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the impact-crack recipe. */
export interface ImpactCrackParams {
  filterFreq: number;
  filterQ: number;
  attack: number;
  decay: number;
  level: number;
  noiseColorMix: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getImpactCrackParams(rng: Rng): ImpactCrackParams {
  return {
    filterFreq: rr(rng, 2000, 6000),
    filterQ: rr(rng, 0.5, 3),
    attack: rr(rng, 0.001, 0.003),
    decay: rr(rng, 0.04, 0.1),
    level: rr(rng, 0.7, 1.0),
    noiseColorMix: rr(rng, 0.0, 1.0),
  };
}
