/**
 * Card Power-Down Recipe
 *
 * Descending pitch sweep with lowpass filter decay and subtle noise
 * grit. Dark, deflating motion for card ability deactivation or power loss.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardPowerDownParams } from "./card-power-down-params.js";

export { getCardPowerDownParams } from "./card-power-down-params.js";
export type { CardPowerDownParams } from "./card-power-down-params.js";

/**
 * Creates a card-power-down Recipe.
 *
 * Descending Sine -> Lowpass Filter -> Envelope + Noise grit -> Destination
 */
export function createCardPowerDown(rng: Rng): Recipe {
  const params = getCardPowerDownParams(rng);

  // Main oscillator: descending pitch
  const osc = new Tone.Oscillator(params.freqStart, "sine");
  const lpf = new Tone.Filter(params.filterCutoff, "lowpass");
  const gain = new Tone.Gain(params.level);
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.chain(lpf, gain, env);

  // Noise grit layer
  const noise = new Tone.Noise("white");
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
      env.triggerAttack(time);
      noiseEnv.triggerAttack(time);
    },
    stop(time: number): void {
      osc.stop(time);
      noise.stop(time);
    },
    toDestination(): void {
      env.toDestination();
      noiseEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
