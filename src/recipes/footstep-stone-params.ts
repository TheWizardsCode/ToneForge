/**
 * Footstep Stone Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: Filtered noise + transient shaping
 * Produces a percussive, short impact sound mimicking a footstep
 * on a hard stone/concrete surface.
 *
 * Seed-varied parameters:
 * - Filter frequency: 400-2000 Hz (controls "brightness" of impact)
 * - Filter Q: 1-8 (resonance sharpness)
 * - Transient attack: 0.001-0.005s (snap of impact)
 * - Body decay: 0.03-0.15s (sustain of surface resonance)
 * - Tail decay: 0.02-0.08s (room/surface tail)
 * - Body level: 0.5-1.0 (main impact loudness)
 * - Tail level: 0.1-0.4 (residual tail loudness)
 *
 * Reference: docs/prd/DEMO_ROADMAP.md
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the footstep-stone recipe. */
export interface FootstepStoneParams {
  filterFreq: number;
  filterQ: number;
  transientAttack: number;
  bodyDecay: number;
  tailDecay: number;
  bodyLevel: number;
  tailLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getFootstepStoneParams(rng: Rng): FootstepStoneParams {
  return {
    filterFreq: rr(rng, 400, 2000),
    filterQ: rr(rng, 1, 8),
    transientAttack: rr(rng, 0.001, 0.005),
    bodyDecay: rr(rng, 0.03, 0.15),
    tailDecay: rr(rng, 0.02, 0.08),
    bodyLevel: rr(rng, 0.5, 1.0),
    tailLevel: rr(rng, 0.1, 0.4),
  };
}
