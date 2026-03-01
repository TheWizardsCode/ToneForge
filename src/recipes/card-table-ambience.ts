/**
 * Card Table Ambience Recipe
 *
 * Warm filtered noise bed with subtle LFO modulation. Evokes the
 * atmosphere of a card table — unobtrusive background layer.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardTableAmbienceParams } from "./card-table-ambience-params.js";

export { getCardTableAmbienceParams } from "./card-table-ambience-params.js";
export type { CardTableAmbienceParams } from "./card-table-ambience-params.js";

/**
 * Creates a card-table-ambience Recipe.
 *
 * Pink Noise -> Bandpass Filter (LFO-modulated) -> Gain -> Envelope -> Destination
 */
export function createCardTableAmbience(rng: Rng): Recipe {
  const params = getCardTableAmbienceParams(rng);

  // Pink noise for warm ambient character
  const noise = new Tone.Noise("pink");

  // Bandpass filter with LFO-modulated cutoff
  const filter = new Tone.Filter(params.filterFreq, "bandpass");
  filter.Q.value = params.filterQ;

  const lfo = new Tone.LFO(
    params.lfoRate,
    params.filterFreq - params.lfoDepth * 0.5,
    params.filterFreq + params.lfoDepth * 0.5,
  );
  lfo.connect(filter.frequency);

  const level = new Tone.Gain(params.level);

  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: 0.01,
    sustain: 1.0,
    release: params.release,
  });

  noise.chain(filter, level, env);

  const duration = params.attack + params.sustain + params.release;

  return {
    start(time: number): void {
      lfo.start(time);
      noise.start(time);
      env.triggerAttack(time);
      env.triggerRelease(time + params.attack + params.sustain);
    },
    stop(time: number): void {
      lfo.stop(time);
      noise.stop(time);
    },
    toDestination(): void {
      env.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
