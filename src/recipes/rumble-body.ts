/**
 * Rumble Body Recipe
 *
 * A sustained low-frequency rumble for the body phase of an explosion.
 * Uses lowpass-filtered noise combined with a sub-bass sine oscillator
 * to produce a deep, resonant rumble.
 *
 * The sound has two layers:
 * 1. Noise body: brown noise through a lowpass filter with slow decay
 * 2. Sub bass: sine oscillator at very low frequency for weight
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * rumble-body-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getRumbleBodyParams } from "./rumble-body-params.js";

export { getRumbleBodyParams } from "./rumble-body-params.js";
export type { RumbleBodyParams } from "./rumble-body-params.js";

/**
 * Creates a rumble body Recipe.
 *
 * Brown noise through lowpass filter plus sub-bass sine oscillator
 * for a deep explosion body rumble.
 */
export function createRumbleBody(rng: Rng): Recipe {
  const params = getRumbleBodyParams(rng);

  // Noise body layer
  const noise = new Tone.Noise("brown");
  const filter = new Tone.Filter(params.filterFreq, "lowpass");
  filter.Q.value = params.filterQ;
  const noiseGain = new Tone.Gain(params.level);
  const noiseEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.sustainDecay,
    sustain: 0,
    release: params.tailDecay,
  });

  noise.chain(filter, noiseGain, noiseEnv);

  // Sub bass layer
  const subOsc = new Tone.Oscillator(params.subBassFreq, "sine");
  const subGain = new Tone.Gain(params.subBassLevel);
  const subEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.sustainDecay + params.tailDecay,
    sustain: 0,
    release: 0,
  });

  subOsc.chain(subGain, subEnv);

  const duration = params.attack + params.sustainDecay + params.tailDecay;

  return {
    start(time: number): void {
      noise.start(time);
      noiseEnv.triggerAttack(time);
      subOsc.start(time);
      subEnv.triggerAttack(time);
    },
    stop(time: number): void {
      noise.stop(time);
      subOsc.stop(time);
    },
    toDestination(): void {
      noiseEnv.toDestination();
      subEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
