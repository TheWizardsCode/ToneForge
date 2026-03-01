/**
 * Card Burn Recipe
 *
 * Destructive synthesis: lowpass-swept noise with descending filter
 * sweep for a dissolve/fire effect. Includes a crackle layer and
 * a low rumble for body.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardBurnParams } from "./card-burn-params.js";

export { getCardBurnParams } from "./card-burn-params.js";
export type { CardBurnParams } from "./card-burn-params.js";

/**
 * Creates a card-burn Recipe.
 *
 * Lowpass Noise (sweeping down) + Highpass Crackle + Sine Rumble -> Envelope -> Destination
 */
export function createCardBurn(rng: Rng): Recipe {
  const params = getCardBurnParams(rng);

  // Main noise layer with descending lowpass sweep
  const noise = new Tone.Noise("white");
  const lpf = new Tone.Filter(params.filterStart, "lowpass");
  const noiseGain = new Tone.Gain(params.noiseLevel);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  noise.chain(lpf, noiseGain, noiseEnv);

  // Crackle layer: highpass-filtered noise for fire texture
  const crackle = new Tone.Noise("pink");
  const hpf = new Tone.Filter(5000, "highpass");
  const crackleGain = new Tone.Gain(params.crackleLevel);
  const crackleEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.7,
    sustain: 0,
    release: 0,
  });

  crackle.chain(hpf, crackleGain, crackleEnv);

  // Low rumble for body
  const rumble = new Tone.Oscillator(params.rumbleFreq, "sine");
  const rumbleGain = new Tone.Gain(params.rumbleLevel);
  const rumbleEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.8,
    sustain: 0,
    release: 0,
  });

  rumble.chain(rumbleGain, rumbleEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      noise.start(time);
      crackle.start(time);
      rumble.start(time);
      noiseEnv.triggerAttack(time);
      crackleEnv.triggerAttack(time);
      rumbleEnv.triggerAttack(time);
    },
    stop(time: number): void {
      noise.stop(time);
      crackle.stop(time);
      rumble.stop(time);
    },
    toDestination(): void {
      noiseEnv.toDestination();
      crackleEnv.toDestination();
      rumbleEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
