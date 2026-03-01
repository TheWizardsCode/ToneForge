/**
 * Card Success Recipe
 *
 * Tonal synthesis: bright ascending dual-tone confirmation sound
 * for positive game outcomes. Two sine oscillators at a consonant
 * interval create a satisfying "ding" effect.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardSuccessParams } from "./card-success-params.js";

export { getCardSuccessParams } from "./card-success-params.js";
export type { CardSuccessParams } from "./card-success-params.js";

/**
 * Creates a card-success Recipe.
 *
 * Sine Oscillator (Base) + Sine Oscillator (Interval) -> Amplitude Envelope -> Destination
 */
export function createCardSuccess(rng: Rng): Recipe {
  const params = getCardSuccessParams(rng);

  const osc1 = new Tone.Oscillator(params.baseFreq, "sine");
  const gain1 = new Tone.Gain(params.primaryLevel);
  const env1 = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc1.chain(gain1, env1);

  const osc2Freq = params.baseFreq * params.intervalRatio;
  const osc2 = new Tone.Oscillator(osc2Freq, "sine");
  const gain2 = new Tone.Gain(params.secondaryLevel);
  const env2 = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc2.chain(gain2, env2);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      osc1.start(time);
      osc2.start(time);
      env1.triggerAttack(time);
      env2.triggerAttack(time);
    },
    stop(time: number): void {
      osc1.stop(time);
      osc2.stop(time);
    },
    toDestination(): void {
      env1.toDestination();
      env2.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
