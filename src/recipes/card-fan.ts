/**
 * Card Fan Recipe
 *
 * Tonal/oscillator-based synthesis: ascending pitch sweep representing
 * cards fanning out, with a gentle filtered noise bed for texture.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardFanParams } from "./card-fan-params.js";

export { getCardFanParams } from "./card-fan-params.js";
export type { CardFanParams } from "./card-fan-params.js";

/**
 * Creates a card-fan Recipe.
 *
 * Sine Oscillator (Ascending Sweep) + Lowpass Noise -> Amplitude Envelope -> Destination
 */
export function createCardFan(rng: Rng): Recipe {
  const params = getCardFanParams(rng);

  const osc = new Tone.Oscillator(params.baseFreq, "sine");
  const oscGain = new Tone.Gain(params.sweepLevel);
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
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  noise.chain(noiseFilter, noiseGain, noiseEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      osc.frequency.setValueAtTime(params.baseFreq, time);
      osc.frequency.linearRampToValueAtTime(
        params.baseFreq + params.sweepRange,
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
