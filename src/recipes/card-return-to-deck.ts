/**
 * Card Return-to-Deck Recipe
 *
 * Subtle swoosh with ascending tonal accent — conceptual inverse
 * of card-draw. Bandpass noise for the slide and ascending sine
 * for the "slot back in" feel.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardReturnToDeckParams } from "./card-return-to-deck-params.js";

export { getCardReturnToDeckParams } from "./card-return-to-deck-params.js";
export type { CardReturnToDeckParams } from "./card-return-to-deck-params.js";

/**
 * Creates a card-return-to-deck Recipe.
 *
 * Bandpass Noise (swoosh) + Ascending Sine -> Envelope -> Destination
 */
export function createCardReturnToDeck(rng: Rng): Recipe {
  const params = getCardReturnToDeckParams(rng);

  // Swoosh noise layer
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

  // Ascending tonal accent
  const osc = new Tone.Oscillator(params.toneStart, "sine");
  const toneGain = new Tone.Gain(params.toneLevel);
  const toneEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.chain(toneGain, toneEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      noise.start(time);
      osc.start(time);
      noiseEnv.triggerAttack(time);
      toneEnv.triggerAttack(time);
    },
    stop(time: number): void {
      noise.stop(time);
      osc.stop(time);
    },
    toDestination(): void {
      noiseEnv.toDestination();
      toneEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
