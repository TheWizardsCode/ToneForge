/**
 * Card Slide Recipe
 *
 * Tonal/oscillator-based: smooth downward pitch sweep with filtered
 * noise undertone for surface friction. Uses sine oscillator with
 * descending frequency ramp.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardSlideParams } from "./card-slide-params.js";

export { getCardSlideParams } from "./card-slide-params.js";
export type { CardSlideParams } from "./card-slide-params.js";

/**
 * Creates a card-slide Recipe.
 *
 * Sine Oscillator (Pitch Sweep) + Lowpass Noise -> Amplitude Envelope -> Destination
 */
export function createCardSlide(rng: Rng): Recipe {
  const params = getCardSlideParams(rng);

  const osc = new Tone.Oscillator(params.startFreq, "sine");
  const oscGain = new Tone.Gain(1);
  const oscEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.chain(oscGain, oscEnv);

  const noise = new Tone.Noise("white");
  const noiseFilter = new Tone.Filter(params.filterCutoff, "lowpass");
  const noiseGain = new Tone.Gain(params.noiseLevel);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.8,
    sustain: 0,
    release: 0,
  });

  noise.chain(noiseFilter, noiseGain, noiseEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      osc.frequency.setValueAtTime(params.startFreq, time);
      osc.frequency.linearRampToValueAtTime(
        params.startFreq - params.sweepRange,
        time + duration,
      );
      osc.start(time);
      noise.start(time);
      oscEnv.triggerAttack(time);
      noiseEnv.triggerAttack(time);
    },
    stop(time: number): void {
      osc.stop(time);
      noise.stop(time);
    },
    toDestination(): void {
      oscEnv.toDestination();
      noiseEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
