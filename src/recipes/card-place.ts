/**
 * Card Place Recipe
 *
 * Noise-based synthesis: short lowpass-filtered thud for a card landing
 * on a surface, with a subtle sine click accent.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardPlaceParams } from "./card-place-params.js";

export { getCardPlaceParams } from "./card-place-params.js";
export type { CardPlaceParams } from "./card-place-params.js";

/**
 * Creates a card-place Recipe.
 *
 * Lowpass Noise (Thud) + Sine Click -> Amplitude Envelope -> Destination
 */
export function createCardPlace(rng: Rng): Recipe {
  const params = getCardPlaceParams(rng);

  const noise = new Tone.Noise("white");
  const noiseFilter = new Tone.Filter(params.filterFreq, "lowpass");
  noiseFilter.Q.value = params.filterQ;
  const noiseGain = new Tone.Gain(params.bodyLevel);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.bodyDecay,
    sustain: 0,
    release: 0,
  });

  noise.chain(noiseFilter, noiseGain, noiseEnv);

  const click = new Tone.Oscillator(params.clickFreq, "sine");
  const clickGain = new Tone.Gain(params.clickLevel);
  const clickEnv = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: params.attack + 0.015,
    sustain: 0,
    release: 0,
  });

  click.chain(clickGain, clickEnv);

  const duration = params.attack + params.bodyDecay;

  return {
    start(time: number): void {
      noise.start(time);
      click.start(time);
      noiseEnv.triggerAttack(time);
      clickEnv.triggerAttack(time);
    },
    stop(time: number): void {
      noise.stop(time);
      click.stop(time);
    },
    toDestination(): void {
      noiseEnv.toDestination();
      clickEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
