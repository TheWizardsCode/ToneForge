/**
 * Card Failure Recipe
 *
 * Tonal synthesis: descending dissonant tone for negative game outcomes.
 * A sine oscillator sweeps downward while a detuned secondary oscillator
 * adds dissonant beating for a "wrong" feeling.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardFailureParams } from "./card-failure-params.js";

export { getCardFailureParams } from "./card-failure-params.js";
export type { CardFailureParams } from "./card-failure-params.js";

/**
 * Creates a card-failure Recipe.
 *
 * Sine Oscillator (Descending Sweep) + Detuned Sine -> Amplitude Envelope -> Destination
 */
export function createCardFailure(rng: Rng): Recipe {
  const params = getCardFailureParams(rng);

  const osc1 = new Tone.Oscillator(params.startFreq, "sine");
  const gain1 = new Tone.Gain(params.primaryLevel);
  const env1 = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc1.chain(gain1, env1);

  const osc2 = new Tone.Oscillator(params.startFreq + params.detuneOffset, "sine");
  const gain2 = new Tone.Gain(params.secondaryLevel);
  const env2 = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc2.chain(gain2, env2);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      osc1.frequency.setValueAtTime(params.startFreq, time);
      osc1.frequency.linearRampToValueAtTime(
        params.startFreq - params.sweepDrop,
        time + duration,
      );
      osc2.frequency.setValueAtTime(params.startFreq + params.detuneOffset, time);
      osc2.frequency.linearRampToValueAtTime(
        params.startFreq - params.sweepDrop + params.detuneOffset,
        time + duration,
      );
      osc1.start(time);
      osc2.start(time);
      env1.triggerAttack(time);
      env2.triggerAttack(time);
    },
    stop(time: number): void {
      osc1.stop(time);
      osc2.stop(time);
    },
    toDestination(): void {
      env1.toDestination();
      env2.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
