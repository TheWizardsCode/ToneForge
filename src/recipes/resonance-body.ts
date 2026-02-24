/**
 * Resonance Body Recipe
 *
 * Woody/metallic resonance for the body phase of a door slam.
 * Uses damped sine oscillators at a fundamental and overtone frequency
 * to produce a resonant, decaying tone similar to a wooden panel
 * vibrating after impact.
 *
 * The sound has two layers:
 * 1. Fundamental: sine oscillator at the main resonant frequency
 * 2. Overtone: sine oscillator at a harmonic ratio above fundamental
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * resonance-body-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getResonanceBodyParams } from "./resonance-body-params.js";

export { getResonanceBodyParams } from "./resonance-body-params.js";
export type { ResonanceBodyParams } from "./resonance-body-params.js";

/**
 * Creates a resonance body Recipe.
 *
 * Two damped sine oscillators at fundamental and overtone frequencies
 * to produce a woody/metallic resonance.
 */
export function createResonanceBody(rng: Rng): Recipe {
  const params = getResonanceBodyParams(rng);

  // Fundamental layer
  const fundOsc = new Tone.Oscillator(params.fundamentalFreq, "sine");
  const fundGain = new Tone.Gain(params.level);
  const fundEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.fundamentalDecay,
    sustain: 0,
    release: 0,
  });

  fundOsc.chain(fundGain, fundEnv);

  // Overtone layer
  const overtoneOsc = new Tone.Oscillator(
    params.fundamentalFreq * params.overtoneRatio,
    "sine",
  );
  const overtoneGain = new Tone.Gain(params.overtoneLevel);
  const overtoneEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.overtoneDecay,
    sustain: 0,
    release: 0,
  });

  overtoneOsc.chain(overtoneGain, overtoneEnv);

  const duration = params.attack + Math.max(params.fundamentalDecay, params.overtoneDecay);

  return {
    start(time: number): void {
      fundOsc.start(time);
      fundEnv.triggerAttack(time);
      overtoneOsc.start(time);
      overtoneEnv.triggerAttack(time);
    },
    stop(time: number): void {
      fundOsc.stop(time);
      overtoneOsc.stop(time);
    },
    toDestination(): void {
      fundEnv.toDestination();
      overtoneEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
