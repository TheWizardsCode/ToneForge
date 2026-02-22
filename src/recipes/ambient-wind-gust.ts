/**
 * Ambient Wind Gust Recipe
 *
 * An environmental wind burst using filtered noise with LFO modulation.
 * The filter cutoff sweeps slowly to create natural-sounding wind
 * movement, while the amplitude envelope controls the overall swell
 * and fade of the gust.
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * ambient-wind-gust-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getAmbientWindGustParams } from "./ambient-wind-gust-params.js";

export { getAmbientWindGustParams } from "./ambient-wind-gust-params.js";
export type { AmbientWindGustParams } from "./ambient-wind-gust-params.js";

/**
 * Creates an ambient wind gust Recipe.
 *
 * Noise source through a bandpass filter with LFO-modulated cutoff,
 * shaped by a swell-sustain-fade amplitude envelope.
 */
export function createAmbientWindGust(rng: Rng): Recipe {
  const params = getAmbientWindGustParams(rng);

  // Noise source (pink noise for more natural wind character)
  const noise = new Tone.Noise("pink");

  // Bandpass filter with LFO-modulated cutoff
  const filter = new Tone.Filter(params.filterFreq, "bandpass");
  filter.Q.value = params.filterQ;

  // LFO for filter cutoff modulation
  const lfo = new Tone.LFO(params.lfoRate, params.filterFreq - params.lfoDepth * 0.5, params.filterFreq + params.lfoDepth * 0.5);
  lfo.connect(filter.frequency);

  // Overall level
  const level = new Tone.Gain(params.level);

  // Amplitude envelope: swell up, sustain, fade out
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: 0.01, // negligible decay
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
      // Schedule release after sustain period
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
