/**
 * Card Token Earn Recipe
 *
 * Pure synthesis: bright ascending multi-harmonic chime for earning
 * tokens/rewards. Stacked sine oscillators at harmonic intervals
 * with a quick attack and medium decay.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardTokenEarnParams } from "./card-token-earn-params.js";

export { getCardTokenEarnParams } from "./card-token-earn-params.js";
export type { CardTokenEarnParams } from "./card-token-earn-params.js";

/**
 * Creates a card-token-earn Recipe.
 *
 * Sine (fundamental) + Sine (h2) + Sine (h3) -> Envelope -> Destination
 */
export function createCardTokenEarn(rng: Rng): Recipe {
  const params = getCardTokenEarnParams(rng);

  // Fundamental
  const osc1 = new Tone.Oscillator(params.baseFreq, "sine");
  const gain1 = new Tone.Gain(params.fundamentalLevel);
  const env1 = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc1.chain(gain1, env1);

  // Second harmonic
  const osc2 = new Tone.Oscillator(params.baseFreq * params.harmonic2Ratio, "sine");
  const gain2 = new Tone.Gain(params.harmonic2Level);
  const env2 = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.8,
    sustain: 0,
    release: 0,
  });

  osc2.chain(gain2, env2);

  // Third harmonic
  const osc3 = new Tone.Oscillator(params.baseFreq * params.harmonic3Ratio, "sine");
  const gain3 = new Tone.Gain(params.harmonic3Level);
  const env3 = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.6,
    sustain: 0,
    release: 0,
  });

  osc3.chain(gain3, env3);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      osc1.start(time);
      osc2.start(time);
      osc3.start(time);
      env1.triggerAttack(time);
      env2.triggerAttack(time);
      env3.triggerAttack(time);
    },
    stop(time: number): void {
      osc1.stop(time);
      osc2.stop(time);
      osc3.stop(time);
    },
    toDestination(): void {
      env1.toDestination();
      env2.toDestination();
      env3.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
