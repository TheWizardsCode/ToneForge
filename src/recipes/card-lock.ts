/**
 * Card Lock Recipe
 *
 * Mechanical click transient + lowpass filter sweep downward on noise.
 * Suggests a card being locked, sealed, or constrained.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardLockParams } from "./card-lock-params.js";

export { getCardLockParams } from "./card-lock-params.js";
export type { CardLockParams } from "./card-lock-params.js";

/**
 * Creates a card-lock Recipe.
 *
 * Click Sine + Lowpass-Swept Noise -> Envelopes -> Destination
 */
export function createCardLock(rng: Rng): Recipe {
  const params = getCardLockParams(rng);

  // Mechanical click transient
  const click = new Tone.Oscillator(params.clickFreq, "square");
  const clickGain = new Tone.Gain(params.clickLevel);
  const clickEnv = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: 0.01,
    sustain: 0,
    release: 0,
  });

  click.chain(clickGain, clickEnv);

  // Noise body with descending lowpass sweep
  const noise = new Tone.Noise("white");
  const lpf = new Tone.Filter(params.filterStart, "lowpass");
  const noiseGain = new Tone.Gain(params.noiseLevel);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  noise.chain(lpf, noiseGain, noiseEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      click.start(time);
      noise.start(time);
      clickEnv.triggerAttack(time);
      noiseEnv.triggerAttack(time);
    },
    stop(time: number): void {
      click.stop(time);
      noise.stop(time);
    },
    toDestination(): void {
      clickEnv.toDestination();
      noiseEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
