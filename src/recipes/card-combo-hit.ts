/**
 * Card Combo Hit Recipe
 *
 * Bright transient with harmonic reinforcement. Positive, punchy
 * impact for successful combo hits.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardComboHitParams } from "./card-combo-hit-params.js";

export { getCardComboHitParams } from "./card-combo-hit-params.js";
export type { CardComboHitParams } from "./card-combo-hit-params.js";

/**
 * Creates a card-combo-hit Recipe.
 *
 * Sine Fundamental + Harmonic + Highpass Sparkle -> Envelope -> Destination
 */
export function createCardComboHit(rng: Rng): Recipe {
  const params = getCardComboHitParams(rng);

  // Fundamental
  const osc = new Tone.Oscillator(params.freq, "sine");
  const gain = new Tone.Gain(params.level);
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.chain(gain, env);

  // Harmonic overtone
  const harm = new Tone.Oscillator(params.freq * params.harmonicRatio, "sine");
  const harmGain = new Tone.Gain(params.harmonicLevel);
  const harmEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.7,
    sustain: 0,
    release: 0,
  });

  harm.chain(harmGain, harmEnv);

  // Brightness sparkle: highpass noise burst
  const noise = new Tone.Noise("white");
  const hpf = new Tone.Filter(params.brightnessFreq, "highpass");
  const sparkleGain = new Tone.Gain(params.harmonicLevel * 0.5);
  const sparkleEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.4,
    sustain: 0,
    release: 0,
  });

  noise.chain(hpf, sparkleGain, sparkleEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      osc.start(time);
      harm.start(time);
      noise.start(time);
      env.triggerAttack(time);
      harmEnv.triggerAttack(time);
      sparkleEnv.triggerAttack(time);
    },
    stop(time: number): void {
      osc.stop(time);
      harm.stop(time);
      noise.stop(time);
    },
    toDestination(): void {
      env.toDestination();
      harmEnv.toDestination();
      sparkleEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
