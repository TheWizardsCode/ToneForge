/**
 * Card Round Complete Recipe
 *
 * Tonal synthesis: neutral completion tone signaling round/turn end.
 * A single sine oscillator with a clean envelope and lowpass filter
 * produces a satisfying, non-directional "done" sound.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardRoundCompleteParams } from "./card-round-complete-params.js";

export { getCardRoundCompleteParams } from "./card-round-complete-params.js";
export type { CardRoundCompleteParams } from "./card-round-complete-params.js";

/**
 * Creates a card-round-complete Recipe.
 *
 * Sine Oscillator -> Lowpass Filter -> Gain -> Amplitude Envelope -> Destination
 */
export function createCardRoundComplete(rng: Rng): Recipe {
  const params = getCardRoundCompleteParams(rng);

  const osc = new Tone.Oscillator(params.frequency, "sine");
  const filter = new Tone.Filter(params.filterCutoff, "lowpass");
  const gain = new Tone.Gain(params.level);
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.chain(filter, gain, env);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
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
      return duration;
    },
  };
}
