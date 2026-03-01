/**
 * Card Combo Break Recipe
 *
 * Descending dissonant tone with noise burst for interruption.
 * Clear negative feedback when a combo chain is broken.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardComboBreakParams } from "./card-combo-break-params.js";

export { getCardComboBreakParams } from "./card-combo-break-params.js";
export type { CardComboBreakParams } from "./card-combo-break-params.js";

/**
 * Creates a card-combo-break Recipe.
 *
 * Descending Sine + Dissonant Sine + Noise Burst -> Envelopes -> Destination
 */
export function createCardComboBreak(rng: Rng): Recipe {
  const params = getCardComboBreakParams(rng);

  // Main descending tone
  const osc = new Tone.Oscillator(params.freqStart, "sawtooth");
  const gain = new Tone.Gain(params.toneLevel);
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.chain(gain, env);

  // Dissonant second tone (slightly detuned)
  const dissonant = new Tone.Oscillator(params.freqStart * params.dissonanceRatio, "sawtooth");
  const disGain = new Tone.Gain(params.toneLevel * 0.6);
  const disEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.8,
    sustain: 0,
    release: 0,
  });

  dissonant.chain(disGain, disEnv);

  // Noise burst for impact
  const noise = new Tone.Noise("white");
  const noiseGain = new Tone.Gain(params.noiseLevel);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.3,
    sustain: 0,
    release: 0,
  });

  noise.chain(noiseGain, noiseEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      osc.start(time);
      dissonant.start(time);
      noise.start(time);
      env.triggerAttack(time);
      disEnv.triggerAttack(time);
      noiseEnv.triggerAttack(time);
    },
    stop(time: number): void {
      osc.stop(time);
      dissonant.stop(time);
      noise.stop(time);
    },
    toDestination(): void {
      env.toDestination();
      disEnv.toDestination();
      noiseEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
