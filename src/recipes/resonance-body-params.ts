/**
 * Resonance Body Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: Damped sine oscillators at resonant frequencies
 * Produces a woody/metallic resonance suitable as the body layer
 * in a door slam stack.
 *
 * Seed-varied parameters:
 * - Fundamental freq: 80-250 Hz (main resonant frequency)
 * - Overtone ratio: 1.5-3.5 (ratio of second partial)
 * - Fundamental decay: 0.15-0.6s (main resonance sustain)
 * - Overtone decay: 0.08-0.3s (second partial sustain)
 * - Overtone level: 0.2-0.5 (relative level of overtone)
 * - Level: 0.6-1.0 (overall amplitude)
 * - Attack: 0.001-0.005s (onset speed)
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the resonance-body recipe. */
export interface ResonanceBodyParams {
  fundamentalFreq: number;
  overtoneRatio: number;
  fundamentalDecay: number;
  overtoneDecay: number;
  overtoneLevel: number;
  level: number;
  attack: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getResonanceBodyParams(rng: Rng): ResonanceBodyParams {
  return {
    fundamentalFreq: rr(rng, 80, 250),
    overtoneRatio: rr(rng, 1.5, 3.5),
    fundamentalDecay: rr(rng, 0.15, 0.6),
    overtoneDecay: rr(rng, 0.08, 0.3),
    overtoneLevel: rr(rng, 0.2, 0.5),
    level: rr(rng, 0.6, 1.0),
    attack: rr(rng, 0.001, 0.005),
  };
}
