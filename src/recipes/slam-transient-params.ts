/**
 * Slam Transient Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: Bandpass-filtered noise burst with sharp attack
 * Produces a short door impact transient suitable as the initial
 * attack layer in a door slam stack.
 *
 * Seed-varied parameters:
 * - Filter frequency: 300-1200 Hz (thud tone center)
 * - Filter Q: 2-8 (narrowness of thud resonance)
 * - Attack: 0.001-0.003s (snap of impact)
 * - Decay: 0.025-0.07s (how quickly the thud fades)
 * - Level: 0.7-1.0 (overall amplitude)
 * - Click level: 0.3-0.7 (high-frequency click component)
 * - Click freq: 3000-6000 Hz (click brightness)
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the slam-transient recipe. */
export interface SlamTransientParams {
  filterFreq: number;
  filterQ: number;
  attack: number;
  decay: number;
  level: number;
  clickLevel: number;
  clickFreq: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getSlamTransientParams(rng: Rng): SlamTransientParams {
  return {
    filterFreq: rr(rng, 300, 1200),
    filterQ: rr(rng, 2, 8),
    attack: rr(rng, 0.001, 0.003),
    decay: rr(rng, 0.025, 0.07),
    level: rr(rng, 0.7, 1.0),
    clickLevel: rr(rng, 0.3, 0.7),
    clickFreq: rr(rng, 3000, 6000),
  };
}
