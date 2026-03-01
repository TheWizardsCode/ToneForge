/**
 * Card Coin Collect Recipe
 *
 * Pure synthesis: bright metallic ascending ping for coin/token
 * collection. A sine oscillator with upward pitch sweep plus a
 * harmonic overtone and highpass noise transient for metallic attack.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardCoinCollectParams } from "./card-coin-collect-params.js";

export { getCardCoinCollectParams } from "./card-coin-collect-params.js";
export type { CardCoinCollectParams } from "./card-coin-collect-params.js";

/**
 * Creates a card-coin-collect Recipe.
 *
 * Sine Oscillator (sweep) + Harmonic Oscillator + Highpass Noise -> Envelope -> Destination
 */
export function createCardCoinCollect(rng: Rng): Recipe {
  const params = getCardCoinCollectParams(rng);

  // Primary tone with pitch sweep
  const osc1 = new Tone.Oscillator(params.baseFreq, "sine");
  const gain1 = new Tone.Gain(params.toneLevel);
  const env1 = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc1.chain(gain1, env1);

  // Harmonic overtone for metallic shimmer
  const osc2 = new Tone.Oscillator(params.baseFreq * 2.5, "sine");
  const gain2 = new Tone.Gain(params.harmonicLevel);
  const env2 = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.7,
    sustain: 0,
    release: 0,
  });

  osc2.chain(gain2, env2);

  // Noise transient for metallic clink attack
  const noise = new Tone.Noise("white");
  const noiseFilter = new Tone.Filter(4000, "highpass");
  const noiseGain = new Tone.Gain(params.noiseLevel);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: params.attack + 0.02,
    sustain: 0,
    release: 0,
  });

  noise.chain(noiseFilter, noiseGain, noiseEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      osc1.start(time);
      osc2.start(time);
      noise.start(time);
      env1.triggerAttack(time);
      env2.triggerAttack(time);
      noiseEnv.triggerAttack(time);
    },
    stop(time: number): void {
      osc1.stop(time);
      osc2.stop(time);
      noise.stop(time);
    },
    toDestination(): void {
      env1.toDestination();
      env2.toDestination();
      noiseEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
