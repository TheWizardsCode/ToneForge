/**
 * Card Power-Up Recipe
 *
 * Ascending pitch sweep with harmonic reinforcement. Bright, energetic
 * upward motion for card ability activation or power gain.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardPowerUpParams } from "./card-power-up-params.js";

export { getCardPowerUpParams } from "./card-power-up-params.js";
export type { CardPowerUpParams } from "./card-power-up-params.js";

/**
 * Creates a card-power-up Recipe.
 *
 * Ascending Sine + Harmonic Overtone -> Envelope -> Destination
 */
export function createCardPowerUp(rng: Rng): Recipe {
  const params = getCardPowerUpParams(rng);

  // Fundamental: ascending pitch sweep
  const osc = new Tone.Oscillator(params.freqStart, "sine");
  const gain = new Tone.Gain(params.level);
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.chain(gain, env);

  // Harmonic overtone
  const harm = new Tone.Oscillator(params.freqStart * params.harmonicRatio, "sine");
  const harmGain = new Tone.Gain(params.harmonicLevel);
  const harmEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.8,
    sustain: 0,
    release: 0,
  });

  harm.chain(harmGain, harmEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      osc.start(time);
      harm.start(time);
      env.triggerAttack(time);
      harmEnv.triggerAttack(time);
    },
    stop(time: number): void {
      osc.stop(time);
      harm.stop(time);
    },
    toDestination(): void {
      env.toDestination();
      harmEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
