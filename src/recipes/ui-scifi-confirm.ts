/**
 * UI Sci-Fi Confirm Recipe
 *
 * A pure-synthesis confirmation sound suitable for sci-fi UI interactions.
 * Uses a sine oscillator through an amplitude envelope with optional
 * filter sweep. All parameters are seed-derived for deterministic variation.
 *
 * Seed-varied parameters:
 * - Base frequency: 400-1200 Hz
 * - Attack: 0.001-0.01s
 * - Decay: 0.05-0.3s
 * - Filter cutoff: 800-4000 Hz
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import { rr } from "../core/rng.js";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";

/** Parameters derived from seed for the ui-scifi-confirm recipe. */
export interface UiSciFiConfirmParams {
  frequency: number;
  attack: number;
  decay: number;
  filterCutoff: number;
}

/**
 * Extract the seed-derived parameters without constructing the Tone.js graph.
 * Useful for testing parameter variation without requiring audio context.
 */
export function getUiSciFiConfirmParams(rng: Rng): UiSciFiConfirmParams {
  return {
    frequency: rr(rng, 400, 1200),
    attack: rr(rng, 0.001, 0.01),
    decay: rr(rng, 0.05, 0.3),
    filterCutoff: rr(rng, 800, 4000),
  };
}

/**
 * Creates a UI sci-fi confirm Recipe.
 *
 * Pure synthesis: Tone.Oscillator -> Tone.Filter -> Tone.AmplitudeEnvelope
 */
export function createUiSciFiConfirm(rng: Rng): Recipe {
  const params = getUiSciFiConfirmParams(rng);

  const osc = new Tone.Oscillator(params.frequency, "sine");
  const filter = new Tone.Filter(params.filterCutoff, "lowpass");
  const amp = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.chain(filter, amp);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      osc.start(time);
      amp.triggerAttack(time);
    },
    stop(time: number): void {
      osc.stop(time);
    },
    toDestination(): void {
      amp.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
