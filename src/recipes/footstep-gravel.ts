/**
 * Footstep Gravel Recipe
 *
 * A sample-hybrid footstep on gravel that layers a CC0 impact
 * transient sample with procedurally varied noise synthesis.
 *
 * The sound has three layers:
 * 1. Sample: A real impact transient played identically every render
 * 2. Body: bandpass-filtered white noise for the gravel crunch
 * 3. Tail: lowpass-filtered brown noise for residual scatter
 *
 * The sample provides realism while procedural parameters (filter
 * frequency, decay times, mix level) vary by seed, ensuring each
 * footstep sounds unique but authentic.
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * footstep-gravel-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.1
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getFootstepGravelParams } from "./footstep-gravel-params.js";

export { getFootstepGravelParams } from "./footstep-gravel-params.js";
export type { FootstepGravelParams } from "./footstep-gravel-params.js";

/**
 * Creates a footstep gravel Recipe for browser/interactive playback.
 *
 * Layers a Tone.Player (sample) with procedural noise synthesis.
 * The sample URL is resolved by the browser from the Vite dev server.
 */
export function createFootstepGravel(rng: Rng): Recipe {
  const params = getFootstepGravelParams(rng);

  // Sample layer: CC0 impact transient
  const player = new Tone.Player("/assets/samples/footstep-gravel/impact.wav");
  const sampleGain = new Tone.Gain(params.mixLevel);

  player.chain(sampleGain);

  // Body layer: bandpass-filtered white noise for gravel crunch
  const bodyNoise = new Tone.Noise("white");
  const bodyFilter = new Tone.Filter(params.filterFreq, "bandpass");
  const bodyGain = new Tone.Gain(params.bodyLevel);
  const bodyEnv = new Tone.AmplitudeEnvelope({
    attack: params.transientAttack,
    decay: params.bodyDecay,
    sustain: 0,
    release: 0,
  });

  bodyNoise.chain(bodyFilter, bodyGain, bodyEnv);

  // Tail layer: lowpass-filtered brown noise for residual scatter
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
      player.start(time);
      bodyNoise.start(time);
      bodyEnv.triggerAttack(time);
      tailNoise.start(time);
      tailEnv.triggerAttack(time);
    },
    stop(time: number): void {
      player.stop(time);
      bodyNoise.stop(time);
      tailNoise.stop(time);
    },
    toDestination(): void {
      sampleGain.toDestination();
      bodyEnv.toDestination();
      tailEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
