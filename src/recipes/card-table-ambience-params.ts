/**
 * Card Table Ambience Recipe — Seed-Derived Parameters
 *
 * Filtered noise bed with subtle LFO modulation. A warm, low ambient
 * texture that evokes the atmosphere of a card table.
 *
 * Card Game Shared Conventions (Tier 7 — Ambient):
 * - Duration 2–3s for loopable ambient texture
 * - Warm, filtered, unobtrusive background layer
 * - Stylized/arcade aesthetic
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the card-table-ambience recipe. */
export interface CardTableAmbienceParams {
  /** Base filter cutoff frequency (Hz) */
  filterFreq: number;
  /** Filter Q / resonance */
  filterQ: number;
  /** LFO modulation rate (Hz) */
  lfoRate: number;
  /** LFO depth — filter sweep range (Hz) */
  lfoDepth: number;
  /** Attack / fade-in time (s) */
  attack: number;
  /** Sustain hold time (s) */
  sustain: number;
  /** Release / fade-out time (s) */
  release: number;
  /** Overall level */
  level: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 */
export function getCardTableAmbienceParams(rng: Rng): CardTableAmbienceParams {
  return {
    filterFreq: rr(rng, 200, 800),
    filterQ: rr(rng, 0.5, 2),
    lfoRate: rr(rng, 0.2, 1.5),
    lfoDepth: rr(rng, 30, 150),
    attack: rr(rng, 0.05, 0.3),
    sustain: rr(rng, 1, 2),
    release: rr(rng, 0.3, 0.8),
    level: rr(rng, 0.3, 0.7),
  };
}
