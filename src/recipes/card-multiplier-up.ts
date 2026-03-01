/**
 * Card Multiplier Up Recipe
 *
 * Rising arpeggio with accelerating pitch steps. Escalating positive
 * feedback for multiplier increases.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardMultiplierUpParams } from "./card-multiplier-up-params.js";

export { getCardMultiplierUpParams } from "./card-multiplier-up-params.js";
export type { CardMultiplierUpParams } from "./card-multiplier-up-params.js";

/**
 * Creates a card-multiplier-up Recipe.
 *
 * Rising Arpeggio: N Sine Notes (ascending intervals) -> Envelope -> Destination
 */
export function createCardMultiplierUp(rng: Rng): Recipe {
  const params = getCardMultiplierUpParams(rng);

  const oscillators: Tone.Oscillator[] = [];
  const envelopes: Tone.AmplitudeEnvelope[] = [];
  const gains: Tone.Gain[] = [];

  for (let i = 0; i < params.noteCount; i++) {
    const freq = params.baseFreq * Math.pow(params.intervalRatio, i);
    const osc = new Tone.Oscillator(freq, "sine");
    const g = new Tone.Gain(params.level);
    const env = new Tone.AmplitudeEnvelope({
      attack: params.attack,
      decay: params.noteDuration,
      sustain: 0,
      release: 0,
    });

    osc.chain(g, env);
    oscillators.push(osc);
    gains.push(g);
    envelopes.push(env);
  }

  const totalDuration = params.noteCount * params.noteDuration + params.attack;

  return {
    start(time: number): void {
      for (let i = 0; i < params.noteCount; i++) {
        const noteTime = time + i * params.noteDuration;
        oscillators[i].start(noteTime);
        envelopes[i].triggerAttack(noteTime);
      }
    },
    stop(time: number): void {
      for (const osc of oscillators) {
        osc.stop(time);
      }
    },
    toDestination(): void {
      for (const env of envelopes) {
        env.toDestination();
      }
    },
    get duration(): number {
      return totalDuration;
    },
  };
}
