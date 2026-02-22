/**
 * Footstep Stone Recipe
 *
 * A short, percussive footstep impact on a hard stone/concrete surface.
 * Uses filtered noise with transient shaping to create a realistic
 * percussive impact without samples.
 *
 * The sound has two layers:
 * 1. Body: bandpass-filtered noise with a fast attack and medium decay
 * 2. Tail: lowpass-filtered noise with a slower decay for surface resonance
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * footstep-stone-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getFootstepStoneParams } from "./footstep-stone-params.js";

export { getFootstepStoneParams } from "./footstep-stone-params.js";
export type { FootstepStoneParams } from "./footstep-stone-params.js";

/**
 * Creates a footstep stone Recipe.
 *
 * Two noise layers with different filters and envelopes simulate the
 * initial transient impact and the trailing surface resonance.
 */
export function createFootstepStone(rng: Rng): Recipe {
  const params = getFootstepStoneParams(rng);

  // Body layer: bandpass-filtered noise for the main impact
  const bodyNoise = new Tone.Noise("white");
  const bodyFilter = new Tone.Filter(params.filterFreq, "bandpass");
  bodyFilter.Q.value = params.filterQ;
  const bodyGain = new Tone.Gain(params.bodyLevel);
  const bodyEnv = new Tone.AmplitudeEnvelope({
    attack: params.transientAttack,
    decay: params.bodyDecay,
    sustain: 0,
    release: 0,
  });

  bodyNoise.chain(bodyFilter, bodyGain, bodyEnv);

  // Tail layer: lowpass-filtered noise for surface resonance
  const tailNoise = new Tone.Noise("brown");
  const tailFilter = new Tone.Filter(params.filterFreq * 0.5, "lowpass");
  const tailGain = new Tone.Gain(params.tailLevel);
  const tailEnv = new Tone.AmplitudeEnvelope({
    attack: params.transientAttack,
    decay: params.tailDecay,
    sustain: 0,
    release: 0,
  });

  tailNoise.chain(tailFilter, tailGain, tailEnv);

  const duration = params.transientAttack + Math.max(params.bodyDecay, params.tailDecay);

  return {
    start(time: number): void {
      bodyNoise.start(time);
      bodyEnv.triggerAttack(time);
      tailNoise.start(time);
      tailEnv.triggerAttack(time);
    },
    stop(time: number): void {
      bodyNoise.stop(time);
      tailNoise.stop(time);
    },
    toDestination(): void {
      bodyEnv.toDestination();
      tailEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
