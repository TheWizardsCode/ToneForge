/**
 * Character Jump Recipe
 *
 * A pure-synthesis jump/hop sound effect using a rising pitch sweep,
 * noise burst for impact, and filtered amplitude envelope. Produces
 * the kind of springy upward sound heard in platformer games when a
 * character jumps.
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * character-jump-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCharacterJumpParams } from "./character-jump-params.js";

// Re-export params API so existing consumers don't break
export { getCharacterJumpParams } from "./character-jump-params.js";
export type { CharacterJumpParams } from "./character-jump-params.js";

/**
 * Creates a character jump Recipe.
 *
 * Pure synthesis: Sine Oscillator (pitch sweep) + White Noise ->
 * Lowpass Filter -> Amplitude Envelope
 */
export function createCharacterJump(rng: Rng): Recipe {
  const params = getCharacterJumpParams(rng);

  // Sine oscillator with rising pitch sweep
  const osc = new Tone.Oscillator(params.baseFreq, "sine");

  // Amplitude envelope for the tonal sweep
  const amp = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.connect(amp);

  // Noise burst for impact texture
  const noise = new Tone.Noise("white");
  const noiseFilter = new Tone.Filter(params.filterCutoff, "lowpass");
  const noiseGain = new Tone.Gain(params.noiseLevel);
  const noiseAmp = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.noiseDecay,
    sustain: 0,
    release: 0,
  });

  noise.chain(noiseFilter, noiseGain, noiseAmp);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      // Schedule rising pitch sweep
      osc.frequency.setValueAtTime(params.baseFreq, time);
      osc.frequency.linearRampToValueAtTime(
        params.baseFreq + params.sweepRange,
        time + params.sweepDuration,
      );
      osc.start(time);
      amp.triggerAttack(time);
      noise.start(time);
      noiseAmp.triggerAttack(time);
    },
    stop(time: number): void {
      osc.stop(time);
      noise.stop(time);
    },
    toDestination(): void {
      amp.toDestination();
      noiseAmp.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
