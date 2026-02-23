/**
 * Creature Vocal Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — safe for the offline
 * render path.
 *
 * Synthesis approach: Sample-hybrid — a CC0 growl sample is layered
 * with FM synthesis and formant-style bandpass filtering. The sample
 * plays identically on every render; FM frequency, modulation index,
 * filter cutoff, and envelope parameters vary by seed.
 *
 * Seed-varied parameters:
 * - Carrier frequency: 80-220 Hz (fundamental pitch of vocalization)
 * - Modulation index: 8-30 (FM depth — controls harmonic richness)
 * - Filter cutoff: 300-1200 Hz (formant-style bandpass center)
 * - Filter Q: 2-10 (formant resonance width)
 * - Mix level: 0.3-0.7 (sample vs synthesis balance)
 * - Attack: 0.02-0.08s (onset of vocalization)
 * - Decay: 0.2-0.5s (body sustain of vocalization)
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.4
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the creature-vocal recipe. */
export interface CreatureVocalParams {
  carrierFreq: number;
  modIndex: number;
  filterCutoff: number;
  filterQ: number;
  mixLevel: number;
  attack: number;
  decay: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCreatureVocalParams(rng: Rng): CreatureVocalParams {
  return {
    carrierFreq: rr(rng, 80, 220),
    modIndex: rr(rng, 8, 30),
    filterCutoff: rr(rng, 300, 1200),
    filterQ: rr(rng, 2, 10),
    mixLevel: rr(rng, 0.3, 0.7),
    attack: rr(rng, 0.02, 0.08),
    decay: rr(rng, 0.2, 0.5),
  };
}
