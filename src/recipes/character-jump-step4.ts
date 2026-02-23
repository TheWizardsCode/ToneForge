/**
 * Character Jump Step 4 -- Oscillator + Envelope + Sweep + Noise
 *
 * Adds an unfiltered white noise burst to the swept, enveloped oscillator
 * from step 3. The noise provides impact texture but sounds harsh without
 * the lowpass filter added in the final character-jump recipe.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCharacterJumpStep4Params } from "./character-jump-step4-params.js";

// Re-export params API
export { getCharacterJumpStep4Params } from "./character-jump-step4-params.js";
export type { CharacterJumpStep4Params } from "./character-jump-step4-params.js";

/**
 * Creates a character-jump-step4 Recipe (osc + envelope + sweep + noise).
 */
export function createCharacterJumpStep4(rng: Rng): Recipe {
  const params = getCharacterJumpStep4Params(rng);

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

  // Noise burst for impact texture (no filter -- raw white noise)
  const noise = new Tone.Noise("white");
  const noiseGain = new Tone.Gain(params.noiseLevel);
  const noiseAmp = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.noiseDecay,
    sustain: 0,
    release: 0,
  });

  noise.chain(noiseGain, noiseAmp);

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
