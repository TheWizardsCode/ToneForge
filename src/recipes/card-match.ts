/**
 * Card Match Recipe
 *
 * Dual-tone confirmation — satisfying "ding-ding" for successful
 * card matches in matching/memory games.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardMatchParams } from "./card-match-params.js";

export { getCardMatchParams } from "./card-match-params.js";
export type { CardMatchParams } from "./card-match-params.js";

/**
 * Creates a card-match Recipe.
 *
 * Sine Tone 1 + Delayed Sine Tone 2 (harmonic above) -> Envelopes -> Destination
 */
export function createCardMatch(rng: Rng): Recipe {
  const params = getCardMatchParams(rng);

  // First tone
  const osc1 = new Tone.Oscillator(params.tone1Freq, "sine");
  const gain1 = new Tone.Gain(params.level);
  const env1 = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc1.chain(gain1, env1);

  // Second tone (higher, delayed)
  const osc2 = new Tone.Oscillator(params.tone1Freq * params.tone2Ratio, "sine");
  const gain2 = new Tone.Gain(params.level * 0.85);
  const env2 = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc2.chain(gain2, env2);

  const duration = params.tone2Delay + params.attack + params.decay;

  return {
    start(time: number): void {
      osc1.start(time);
      env1.triggerAttack(time);
      osc2.start(time + params.tone2Delay);
      env2.triggerAttack(time + params.tone2Delay);
    },
    stop(time: number): void {
      osc1.stop(time);
      osc2.stop(time);
    },
    toDestination(): void {
      env1.toDestination();
      env2.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
