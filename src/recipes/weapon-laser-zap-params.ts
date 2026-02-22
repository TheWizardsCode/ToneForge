/**
 * Weapon Laser Zap Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: FM synthesis + noise burst
 * Seed-varied parameters:
 * - Carrier frequency: 200-2000 Hz
 * - Modulator frequency: 50-500 Hz
 * - Modulation index: 1-10
 * - Noise burst level: 0.1-0.5
 * - Attack: 0.001-0.005s
 * - Decay: 0.03-0.25s
 *
 * Reference: docs/prd/DEMO_ROADMAP.md line 56
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the weapon-laser-zap recipe. */
export interface WeaponLaserZapParams {
  carrierFreq: number;
  modulatorFreq: number;
  modIndex: number;
  noiseBurstLevel: number;
  attack: number;
  decay: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getWeaponLaserZapParams(rng: Rng): WeaponLaserZapParams {
  return {
    carrierFreq: rr(rng, 200, 2000),
    modulatorFreq: rr(rng, 50, 500),
    modIndex: rr(rng, 1, 10),
    noiseBurstLevel: rr(rng, 0.1, 0.5),
    attack: rr(rng, 0.001, 0.005),
    decay: rr(rng, 0.03, 0.25),
  };
}
