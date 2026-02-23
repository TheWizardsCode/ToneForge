/**
 * Footstep Gravel Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: Sample-hybrid — a CC0 impact transient is
 * layered with procedurally varied bandpass-filtered noise (body)
 * and lowpass-filtered noise (tail). The sample plays identically
 * on every render; only procedural parameters vary by seed.
 *
 * Seed-varied parameters:
 * - Filter frequency: 300-1800 Hz (controls "brightness" of crunch)
 * - Transient attack: 0.001-0.005s (snap of impact)
 * - Body decay: 0.05-0.25s (sustain of gravel crunch)
 * - Tail decay: 0.04-0.15s (residual scatter)
 * - Mix level: 0.3-0.7 (sample vs synthesis balance)
 * - Body level: 0.4-0.9 (procedural body loudness)
 * - Tail level: 0.1-0.4 (procedural tail loudness)
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.1
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the footstep-gravel recipe. */
export interface FootstepGravelParams {
  filterFreq: number;
  transientAttack: number;
  bodyDecay: number;
  tailDecay: number;
  mixLevel: number;
  bodyLevel: number;
  tailLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getFootstepGravelParams(rng: Rng): FootstepGravelParams {
  return {
    filterFreq: rr(rng, 300, 1800),
    transientAttack: rr(rng, 0.001, 0.005),
    bodyDecay: rr(rng, 0.05, 0.25),
    tailDecay: rr(rng, 0.04, 0.15),
    mixLevel: rr(rng, 0.3, 0.7),
    bodyLevel: rr(rng, 0.4, 0.9),
    tailLevel: rr(rng, 0.1, 0.4),
  };
}
