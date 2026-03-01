/**
 * Card Flip Recipe
 *
 * Stylized card flip using bandpass-filtered noise burst with a brief
 * sine click for the snap transient. Noise-based primary synthesis.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardFlipParams } from "./card-flip-params.js";

export { getCardFlipParams } from "./card-flip-params.js";
export type { CardFlipParams } from "./card-flip-params.js";

/**
 * Creates a card-flip Recipe.
 *
 * Bandpass Noise Burst + Sine Click -> Amplitude Envelope -> Destination
 */
export function createCardFlip(rng: Rng): Recipe {
  const params = getCardFlipParams(rng);

  const noise = new Tone.Noise("white");
  const noiseFilter = new Tone.Filter(params.filterFreq, "bandpass");
  noiseFilter.Q.value = params.filterQ;
  const noiseGain = new Tone.Gain(params.noiseLevel);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  noise.chain(noiseFilter, noiseGain, noiseEnv);

  const click = new Tone.Oscillator(params.clickFreq, "sine");
  const clickGain = new Tone.Gain(params.clickLevel);
  const clickEnv = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: params.attack + 0.01,
    sustain: 0,
    release: 0,
  });

  click.chain(clickGain, clickEnv);

  const duration = params.attack + params.decay;

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
