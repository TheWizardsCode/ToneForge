/**
 * Card Shuffle Recipe
 *
 * Noise-based synthesis: rapid granular noise burst representing a card
 * riffle/shuffle. Bandpass-filtered white noise with amplitude modulation
 * at a grain rate to create the rapid flutter texture.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardShuffleParams } from "./card-shuffle-params.js";

export { getCardShuffleParams } from "./card-shuffle-params.js";
export type { CardShuffleParams } from "./card-shuffle-params.js";

/**
 * Creates a card-shuffle Recipe.
 *
 * Bandpass Noise -> Grain Modulation -> Amplitude Envelope -> Destination
 */
export function createCardShuffle(rng: Rng): Recipe {
  const params = getCardShuffleParams(rng);

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

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      noise.start(time);
      noiseEnv.triggerAttack(time);
    },
    stop(time: number): void {
      noise.stop(time);
    },
    toDestination(): void {
      noiseEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
