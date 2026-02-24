/**
 * Slam Transient Recipe
 *
 * A short door impact transient. Uses bandpass-filtered noise burst
 * with a sharp attack for the initial thud, plus a high-frequency
 * click component for the latch/hardware impact.
 *
 * The sound has two layers:
 * 1. Thud: bandpass-filtered noise at mid frequencies
 * 2. Click: highpass-filtered noise at high frequencies
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * slam-transient-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getSlamTransientParams } from "./slam-transient-params.js";

export { getSlamTransientParams } from "./slam-transient-params.js";
export type { SlamTransientParams } from "./slam-transient-params.js";

/**
 * Creates a slam transient Recipe.
 *
 * Bandpass-filtered noise for the thud plus highpass-filtered noise
 * for the click, producing a percussive door impact.
 */
export function createSlamTransient(rng: Rng): Recipe {
  const params = getSlamTransientParams(rng);

  // Thud layer: bandpass-filtered noise
  const thudNoise = new Tone.Noise("white");
  const thudFilter = new Tone.Filter(params.filterFreq, "bandpass");
  thudFilter.Q.value = params.filterQ;
  const thudGain = new Tone.Gain(params.level);
  const thudEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  thudNoise.chain(thudFilter, thudGain, thudEnv);

  // Click layer: highpass-filtered noise
  const clickNoise = new Tone.Noise("white");
  const clickFilter = new Tone.Filter(params.clickFreq, "highpass");
  const clickGain = new Tone.Gain(params.clickLevel);
  const clickEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.5,
    sustain: 0,
    release: 0,
  });

  clickNoise.chain(clickFilter, clickGain, clickEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      thudNoise.start(time);
      thudEnv.triggerAttack(time);
      clickNoise.start(time);
      clickEnv.triggerAttack(time);
    },
    stop(time: number): void {
      thudNoise.stop(time);
      clickNoise.stop(time);
    },
    toDestination(): void {
      thudEnv.toDestination();
      clickEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
