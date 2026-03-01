/**
 * Card Timer Warning Recipe
 *
 * Escalating/urgent tick with higher pitch, vibrato modulation,
 * and dual-tone urgency chord. Conveys time pressure.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardTimerWarningParams } from "./card-timer-warning-params.js";

export { getCardTimerWarningParams } from "./card-timer-warning-params.js";
export type { CardTimerWarningParams } from "./card-timer-warning-params.js";

/**
 * Creates a card-timer-warning Recipe.
 *
 * Sine (Vibrato-modulated) + Urgency Sine (higher) -> Gain -> Envelope -> Destination
 */
export function createCardTimerWarning(rng: Rng): Recipe {
  const params = getCardTimerWarningParams(rng);

  // Primary tone with vibrato
  const osc = new Tone.Oscillator(params.freq, "sine");
  const vibrato = new Tone.LFO(params.vibratoRate, params.freq - params.vibratoDepth, params.freq + params.vibratoDepth);
  vibrato.connect(osc.frequency);

  const gain = new Tone.Gain(params.level);
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.chain(gain, env);

  // Urgency tone (higher)
  const urgOsc = new Tone.Oscillator(params.freq * params.urgencyRatio, "sine");
  const urgGain = new Tone.Gain(params.level * 0.6);
  const urgEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.7,
    sustain: 0,
    release: 0,
  });

  urgOsc.chain(urgGain, urgEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      vibrato.start(time);
      osc.start(time);
      urgOsc.start(time);
      env.triggerAttack(time);
      urgEnv.triggerAttack(time);
    },
    stop(time: number): void {
      vibrato.stop(time);
      osc.stop(time);
      urgOsc.stop(time);
    },
    toDestination(): void {
      env.toDestination();
      urgEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
