/**
 * Vehicle Engine Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: Sample-hybrid — a CC0 engine loop sample is
 * layered with a sawtooth oscillator for harmonic reinforcement,
 * both filtered through a lowpass filter with LFO modulation.
 * The sample loops identically on every render; oscillator frequency,
 * LFO rate/depth, filter cutoff, and envelope shape vary by seed.
 *
 * Seed-varied parameters:
 * - Oscillator frequency: 40-80 Hz (engine fundamental)
 * - LFO rate: 1-4 Hz (RPM-like fluctuation speed)
 * - LFO depth: 50-300 Hz (filter cutoff modulation range)
 * - Filter cutoff: 200-600 Hz (lowpass tonal shaping)
 * - Mix level: 0.3-0.7 (sample vs synthesis balance)
 * - Attack: 0.1-0.3s (engine startup ramp)
 * - Release: 0.3-0.8s (engine shutdown fade)
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.5
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the vehicle-engine recipe. */
export interface VehicleEngineParams {
  oscFreq: number;
  lfoRate: number;
  lfoDepth: number;
  filterCutoff: number;
  mixLevel: number;
  attack: number;
  release: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getVehicleEngineParams(rng: Rng): VehicleEngineParams {
  return {
    oscFreq: rr(rng, 40, 80),
    lfoRate: rr(rng, 1, 4),
    lfoDepth: rr(rng, 50, 300),
    filterCutoff: rr(rng, 200, 600),
    mixLevel: rr(rng, 0.3, 0.7),
    attack: rr(rng, 0.1, 0.3),
    release: rr(rng, 0.3, 0.8),
  };
}
