/**
 * Rattle Decay Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: Small noise bursts with irregular timing
 * Produces a rattling/settling decay suitable as the tail layer
 * in a door slam stack, simulating hardware or loose components
 * vibrating after impact.
 *
 * Seed-varied parameters:
 * - Rattle rate: 30-100 Hz (initial rattle frequency)
 * - Rattle decay: 0.001-0.004s (individual rattle grain length)
 * - Filter freq: 2000-5000 Hz (rattle brightness)
 * - Filter Q: 1-5 (rattle resonance)
 * - Duration: 0.15-0.45s (total rattle length)
 * - Density decay: 3.0-6.0 (how quickly rattles thin out)
 * - Level: 0.3-0.7 (overall amplitude)
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the rattle-decay recipe. */
export interface RattleDecayParams {
  rattleRate: number;
  rattleDecay: number;
  filterFreq: number;
  filterQ: number;
  duration: number;
  densityDecay: number;
  level: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getRattleDecayParams(rng: Rng): RattleDecayParams {
  return {
    rattleRate: rr(rng, 30, 100),
    rattleDecay: rr(rng, 0.001, 0.004),
    filterFreq: rr(rng, 2000, 5000),
    filterQ: rr(rng, 1, 5),
    duration: rr(rng, 0.15, 0.45),
    densityDecay: rr(rng, 3.0, 6.0),
    level: rr(rng, 0.3, 0.7),
  };
}
