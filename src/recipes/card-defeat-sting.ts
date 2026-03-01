/**
 * Card Defeat Sting Recipe
 *
 * Tonal synthesis: descending minor-interval sting for major defeat
 * moments. A sine oscillator plays two descending notes through a
 * lowpass filter that sweeps downward during the tail decay, creating
 * a somber, muffled conclusion.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardDefeatStingParams } from "./card-defeat-sting-params.js";

export { getCardDefeatStingParams } from "./card-defeat-sting-params.js";
export type { CardDefeatStingParams } from "./card-defeat-sting-params.js";

/**
 * Creates a card-defeat-sting Recipe.
 *
 * Sine Oscillator (Descending Steps) -> Lowpass Filter (Sweeping) -> Gain Envelope -> Destination
 */
export function createCardDefeatSting(rng: Rng): Recipe {
  const params = getCardDefeatStingParams(rng);

  const osc = new Tone.Oscillator(params.startFreq, "sine");
  const filter = new Tone.Filter(params.filterStart, "lowpass");
  const gain = new Tone.Gain(params.level);
  const env = new Tone.AmplitudeEnvelope({
    attack: params.noteAttack,
    decay: params.noteDuration * 2 + params.tailDecay,
    sustain: 0,
    release: 0,
  });

  osc.chain(filter, gain, env);

  const totalDuration = params.noteDuration * 2 + params.tailDecay;

  return {
    start(time: number): void {
      // First note
      osc.frequency.setValueAtTime(params.startFreq, time);
      // Second note (minor interval drop)
      osc.frequency.setValueAtTime(
        params.startFreq * params.dropRatio,
        time + params.noteDuration,
      );

      // Filter sweep downward during tail
      filter.frequency.setValueAtTime(params.filterStart, time);
      filter.frequency.linearRampToValueAtTime(
        params.filterEnd,
        time + totalDuration,
      );

      osc.start(time);
      env.triggerAttack(time);
    },
    stop(time: number): void {
      osc.stop(time);
    },
    toDestination(): void {
      env.toDestination();
    },
    get duration(): number {
      return totalDuration;
    },
  };
}
