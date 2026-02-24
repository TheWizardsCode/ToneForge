/**
 * Rumble Body Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: Low-frequency filtered noise with slow decay
 * Produces a sustained low-frequency rumble suitable as the body
 * layer in an explosion stack.
 *
 * Seed-varied parameters:
 * - Filter frequency: 60-200 Hz (low-frequency cutoff)
 * - Filter Q: 0.5-2.5 (resonance width)
 * - Attack: 0.005-0.02s (onset speed)
 * - Sustain decay: 0.4-1.2s (how long the rumble sustains)
 * - Tail decay: 0.1-0.3s (final fade out)
 * - Level: 0.6-1.0 (overall amplitude)
 * - Sub bass freq: 30-60 Hz (sub-bass oscillator frequency)
 * - Sub bass level: 0.2-0.5 (sub-bass contribution)
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the rumble-body recipe. */
export interface RumbleBodyParams {
  filterFreq: number;
  filterQ: number;
  attack: number;
  sustainDecay: number;
  tailDecay: number;
  level: number;
  subBassFreq: number;
  subBassLevel: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getRumbleBodyParams(rng: Rng): RumbleBodyParams {
  return {
    filterFreq: rr(rng, 60, 200),
    filterQ: rr(rng, 0.5, 2.5),
    attack: rr(rng, 0.005, 0.02),
    sustainDecay: rr(rng, 0.4, 1.2),
    tailDecay: rr(rng, 0.1, 0.3),
    level: rr(rng, 0.6, 1.0),
    subBassFreq: rr(rng, 30, 60),
    subBassLevel: rr(rng, 0.2, 0.5),
  };
}
