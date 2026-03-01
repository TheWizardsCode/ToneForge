/**
 * Card Unlock Recipe
 *
 * Click transient + highpass filter sweep upward on noise. Suggests
 * a card being unlocked, released, or freed. Paired inverse of card-lock.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardUnlockParams } from "./card-unlock-params.js";

export { getCardUnlockParams } from "./card-unlock-params.js";
export type { CardUnlockParams } from "./card-unlock-params.js";

/**
 * Creates a card-unlock Recipe.
 *
 * Click Sine + Highpass-Swept Noise -> Envelopes -> Destination
 */
export function createCardUnlock(rng: Rng): Recipe {
  const params = getCardUnlockParams(rng);

  // Click transient
  const click = new Tone.Oscillator(params.clickFreq, "square");
  const clickGain = new Tone.Gain(params.clickLevel);
  const clickEnv = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: 0.01,
    sustain: 0,
    release: 0,
  });

  click.chain(clickGain, clickEnv);

  // Noise body with ascending highpass sweep
  const noise = new Tone.Noise("white");
  const hpf = new Tone.Filter(params.filterStart, "highpass");
  const noiseGain = new Tone.Gain(params.noiseLevel);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  noise.chain(hpf, noiseGain, noiseEnv);

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
