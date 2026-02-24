/**
 * Debris Tail Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: Granular noise bursts with randomized timing
 * Produces scattered debris/crackle sounds with decreasing density,
 * suitable as the tail layer in an explosion stack.
 *
 * Seed-varied parameters:
 * - Grain rate: 20-80 Hz (initial burst density)
 * - Grain decay: 0.002-0.008s (individual grain duration)
 * - Filter freq: 1000-4000 Hz (brightness of debris)
 * - Filter Q: 0.5-3 (resonance of debris particles)
 * - Duration envelope: 0.5-1.8s (total tail length)
 * - Density decay: 2.0-5.0 (how quickly bursts thin out)
 * - Level: 0.4-0.8 (overall amplitude)
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the debris-tail recipe. */
export interface DebrisTailParams {
  grainRate: number;
  grainDecay: number;
  filterFreq: number;
  filterQ: number;
  durationEnvelope: number;
  densityDecay: number;
  level: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getDebrisTailParams(rng: Rng): DebrisTailParams {
  return {
    grainRate: rr(rng, 20, 80),
    grainDecay: rr(rng, 0.002, 0.008),
    filterFreq: rr(rng, 1000, 4000),
    filterQ: rr(rng, 0.5, 3),
    durationEnvelope: rr(rng, 0.5, 1.8),
    densityDecay: rr(rng, 2.0, 5.0),
    level: rr(rng, 0.4, 0.8),
  };
}
