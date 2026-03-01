/**
 * Card Timer Tick Recipe
 *
 * Sharp, clean click/tick for metronome-like timer beats.
 * Very short and repeatable.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardTimerTickParams } from "./card-timer-tick-params.js";

export { getCardTimerTickParams } from "./card-timer-tick-params.js";
export type { CardTimerTickParams } from "./card-timer-tick-params.js";

/**
 * Creates a card-timer-tick Recipe.
 *
 * Sine Click + Highpass Noise Transient -> Gain -> Envelope -> Destination
 */
export function createCardTimerTick(rng: Rng): Recipe {
  const params = getCardTimerTickParams(rng);

  // Tonal click
  const osc = new Tone.Oscillator(params.freq, "sine");
  const gain = new Tone.Gain(params.level);
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.chain(gain, env);

  // Highpass noise for click crispness
  const noise = new Tone.Noise("white");
  const hpf = new Tone.Filter(params.clickCutoff, "highpass");
  const noiseGain = new Tone.Gain(params.level * 0.3);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.5,
    sustain: 0,
    release: 0,
  });

  noise.chain(hpf, noiseGain, noiseEnv);

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
