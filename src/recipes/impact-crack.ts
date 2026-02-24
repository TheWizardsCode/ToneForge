/**
 * Impact Crack Recipe
 *
 * A short, sharp transient crack for the attack phase of an explosion.
 * Uses filtered noise with a fast decay envelope to create a percussive
 * crack without samples.
 *
 * The sound consists of white noise through a highpass filter with
 * a very fast attack and short decay, producing a bright snap.
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * impact-crack-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getImpactCrackParams } from "./impact-crack-params.js";

export { getImpactCrackParams } from "./impact-crack-params.js";
export type { ImpactCrackParams } from "./impact-crack-params.js";

/**
 * Creates an impact crack Recipe.
 *
 * White noise through a highpass filter with a fast attack/decay
 * envelope to produce a sharp transient crack.
 */
export function createImpactCrack(rng: Rng): Recipe {
  const params = getImpactCrackParams(rng);

  const noise = new Tone.Noise("white");
  const filter = new Tone.Filter(params.filterFreq, "highpass");
  filter.Q.value = params.filterQ;
  const gain = new Tone.Gain(params.level);
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  noise.chain(filter, gain, env);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      noise.start(time);
      env.triggerAttack(time);
    },
    stop(time: number): void {
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
