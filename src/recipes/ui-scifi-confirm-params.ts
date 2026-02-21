/**
 * UI Sci-Fi Confirm Recipe — Seed-Derived Parameters
 *
 * Pure math functions for deriving recipe parameters from a seed.
 * NO Tone.js or audio library dependencies — this module is safe to
 * import in the offline render path without pulling in heavy libraries.
 *
 * Seed-varied parameters:
 * - Base frequency: 400-1200 Hz
 * - Attack: 0.001-0.01s
 * - Decay: 0.05-0.3s
 * - Filter cutoff: 800-4000 Hz
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";

/** Parameters derived from seed for the ui-scifi-confirm recipe. */
export interface UiSciFiConfirmParams {
  frequency: number;
  attack: number;
  decay: number;
  filterCutoff: number;
}

/**
 * Extract the seed-derived parameters without constructing any audio graph.
 * Useful for testing parameter variation and for the offline renderer.
 */
export function getUiSciFiConfirmParams(rng: Rng): UiSciFiConfirmParams {
  return {
    frequency: rr(rng, 400, 1200),
    attack: rr(rng, 0.001, 0.01),
    decay: rr(rng, 0.05, 0.3),
    filterCutoff: rr(rng, 800, 4000),
  };
}
