/**
 * Card Transform Recipe
 *
 * Morphing FM synthesis with modulation depth crossfade. Suggests a card
 * changing form with shifting timbres.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardTransformParams } from "./card-transform-params.js";

export { getCardTransformParams } from "./card-transform-params.js";
export type { CardTransformParams } from "./card-transform-params.js";

/**
 * Creates a card-transform Recipe.
 *
 * FM Synthesis: Modulator -> Carrier (frequency modulation depth sweep) -> Envelope -> Destination
 */
export function createCardTransform(rng: Rng): Recipe {
  const params = getCardTransformParams(rng);

  // Carrier oscillator
  const carrier = new Tone.Oscillator(params.carrierFreq, "sine");

  // Modulator oscillator for FM
  const modFreq = params.carrierFreq * params.modRatio;
  const modulator = new Tone.Oscillator(modFreq, "sine");
  const modGain = new Tone.Gain(params.modDepthStart);

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  const gain = new Tone.Gain(params.level);
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: 0,
    sustain: 1,
    release: params.release,
  });

  carrier.chain(gain, env);

  const duration = params.attack + params.sustain + params.release;

  return {
    start(time: number): void {
      modulator.start(time);
      carrier.start(time);
      env.triggerAttackRelease(params.attack + params.sustain, time);
    },
    stop(time: number): void {
      carrier.stop(time);
      modulator.stop(time);
    },
    toDestination(): void {
      env.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
