/**
 * Card Coin Spend Recipe
 *
 * Pure synthesis: muted descending tone for coin/token spend events.
 * A filtered sine oscillator with downward pitch sweep and soft noise
 * layer creates a "dropping" feel.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardCoinSpendParams } from "./card-coin-spend-params.js";

export { getCardCoinSpendParams } from "./card-coin-spend-params.js";
export type { CardCoinSpendParams } from "./card-coin-spend-params.js";

/**
 * Creates a card-coin-spend Recipe.
 *
 * Sine Oscillator (descending) -> Lowpass Filter + Noise -> Envelope -> Destination
 */
export function createCardCoinSpend(rng: Rng): Recipe {
  const params = getCardCoinSpendParams(rng);

  // Primary descending tone
  const osc = new Tone.Oscillator(params.baseFreq, "sine");
  const filter = new Tone.Filter(params.filterCutoff, "lowpass");
  const toneGain = new Tone.Gain(params.toneLevel);
  const toneEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.chain(filter, toneGain, toneEnv);

  // Soft noise layer for texture
  const noise = new Tone.Noise("pink");
  const noiseLpf = new Tone.Filter(params.filterCutoff * 0.5, "lowpass");
  const noiseGain = new Tone.Gain(params.noiseLevel);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.6,
    sustain: 0,
    release: 0,
  });

  noise.chain(noiseLpf, noiseGain, noiseEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      osc.start(time);
      noise.start(time);
      toneEnv.triggerAttack(time);
      noiseEnv.triggerAttack(time);
    },
    stop(time: number): void {
      osc.stop(time);
      noise.stop(time);
    },
    toDestination(): void {
      toneEnv.toDestination();
      noiseEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
