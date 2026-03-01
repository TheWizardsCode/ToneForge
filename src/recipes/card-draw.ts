/**
 * Card Draw Recipe
 *
 * Noise-based with tonal accent: quick upward swipe sound using
 * highpass-filtered noise with a brief ascending sine sweep.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardDrawParams } from "./card-draw-params.js";

export { getCardDrawParams } from "./card-draw-params.js";
export type { CardDrawParams } from "./card-draw-params.js";

/**
 * Creates a card-draw Recipe.
 *
 * Highpass Noise + Sine Sweep (Ascending) -> Amplitude Envelope -> Destination
 */
export function createCardDraw(rng: Rng): Recipe {
  const params = getCardDrawParams(rng);

  const noise = new Tone.Noise("white");
  const noiseFilter = new Tone.Filter(params.filterFreq, "highpass");
  noiseFilter.Q.value = params.filterQ;
  const noiseGain = new Tone.Gain(params.noiseLevel);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  noise.chain(noiseFilter, noiseGain, noiseEnv);

  const sweep = new Tone.Oscillator(params.sweepBaseFreq, "sine");
  const sweepGain = new Tone.Gain(params.sweepLevel);
  const sweepEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.8,
    sustain: 0,
    release: 0,
  });

  sweep.chain(sweepGain, sweepEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      sweep.frequency.setValueAtTime(params.sweepBaseFreq, time);
      sweep.frequency.linearRampToValueAtTime(
        params.sweepBaseFreq + params.sweepRange,
        time + duration * 0.7,
      );
      noise.start(time);
      sweep.start(time);
      noiseEnv.triggerAttack(time);
      sweepEnv.triggerAttack(time);
    },
    stop(time: number): void {
      noise.stop(time);
      sweep.stop(time);
    },
    toDestination(): void {
      noiseEnv.toDestination();
      sweepEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
