/**
 * UI Sci-Fi Confirm Recipe
 *
 * A pure-synthesis confirmation sound suitable for sci-fi UI interactions.
 * Uses a sine oscillator through an amplitude envelope with optional
 * filter sweep. All parameters are seed-derived for deterministic variation.
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * ui-scifi-confirm-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getUiSciFiConfirmParams } from "./ui-scifi-confirm-params.js";

// Re-export params API so existing consumers don't break
export { getUiSciFiConfirmParams } from "./ui-scifi-confirm-params.js";
export type { UiSciFiConfirmParams } from "./ui-scifi-confirm-params.js";

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
