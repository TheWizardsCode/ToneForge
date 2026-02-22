/**
 * Ambient Wind Gust Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: Filtered noise + LFO modulation
 * Produces an environmental wind burst that swells and fades,
 * with slow filter modulation for natural-sounding movement.
 *
 * Seed-varied parameters:
 * - Filter frequency: 200-1500 Hz (base cutoff of the wind)
 * - Filter Q: 0.5-3.0 (resonance width)
 * - LFO rate: 0.5-4.0 Hz (speed of filter modulation)
 * - LFO depth: 100-800 Hz (how much the filter sweeps)
 * - Attack: 0.1-0.5s (wind swell-up time)
 * - Sustain: 0.2-1.0s (held wind duration)
 * - Release: 0.2-0.8s (wind fade-out time)
 * - Level: 0.3-0.8 (overall loudness)
 *
 * Reference: docs/prd/DEMO_ROADMAP.md
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the ambient-wind-gust recipe. */
export interface AmbientWindGustParams {
  filterFreq: number;
  filterQ: number;
  lfoRate: number;
  lfoDepth: number;
  attack: number;
  sustain: number;
  release: number;
  level: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getAmbientWindGustParams(rng: Rng): AmbientWindGustParams {
  return {
    filterFreq: rr(rng, 200, 1500),
    filterQ: rr(rng, 0.5, 3.0),
    lfoRate: rr(rng, 0.5, 4.0),
    lfoDepth: rr(rng, 100, 800),
    attack: rr(rng, 0.1, 0.5),
    sustain: rr(rng, 0.2, 1.0),
    release: rr(rng, 0.2, 0.8),
    level: rr(rng, 0.3, 0.8),
  };
}
