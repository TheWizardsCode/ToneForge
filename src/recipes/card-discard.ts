/**
 * Card Discard Recipe
 *
 * Short bandpass noise burst with brief tonal thud for discarding a card.
 * Subtle, neutral action.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardDiscardParams } from "./card-discard-params.js";

export { getCardDiscardParams } from "./card-discard-params.js";
export type { CardDiscardParams } from "./card-discard-params.js";

/**
 * Creates a card-discard Recipe.
 *
 * Bandpass Noise Burst + Sine Thud -> Envelope -> Destination
 */
export function createCardDiscard(rng: Rng): Recipe {
  const params = getCardDiscardParams(rng);

  // Noise burst for the flick/toss
  const noise = new Tone.Noise("white");
  const filter = new Tone.Filter(params.filterFreq, "bandpass");
  filter.Q.value = params.filterQ;
  const noiseGain = new Tone.Gain(params.noiseLevel);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  noise.chain(filter, noiseGain, noiseEnv);

  // Low thud for impact
  const thud = new Tone.Oscillator(params.thudFreq, "sine");
  const thudGain = new Tone.Gain(params.thudLevel);
  const thudEnv = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: params.decay * 0.5,
    sustain: 0,
    release: 0,
  });

  thud.chain(thudGain, thudEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      noise.start(time);
      thud.start(time);
      noiseEnv.triggerAttack(time);
      thudEnv.triggerAttack(time);
    },
    stop(time: number): void {
      noise.stop(time);
      thud.stop(time);
    },
    toDestination(): void {
      noiseEnv.toDestination();
      thudEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
