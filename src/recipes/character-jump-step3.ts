/**
 * Character Jump Step 3 -- Oscillator + Envelope + Pitch Sweep
 *
 * Adds a rising frequency sweep to the enveloped oscillator from step 2.
 * The frequency starts at baseFreq and rises to baseFreq + sweepRange
 * over sweepDuration seconds, creating the classic "boing" upward motion.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCharacterJumpStep3Params } from "./character-jump-step3-params.js";

// Re-export params API
export { getCharacterJumpStep3Params } from "./character-jump-step3-params.js";
export type { CharacterJumpStep3Params } from "./character-jump-step3-params.js";

/**
 * Creates a character-jump-step3 Recipe (oscillator + envelope + sweep).
 */
export function createCharacterJumpStep3(rng: Rng): Recipe {
  const params = getCharacterJumpStep3Params(rng);

  const osc = new Tone.Oscillator(params.baseFreq, "sine");

  const amp = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.connect(amp);

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
    },
    stop(time: number): void {
      osc.stop(time);
    },
    toDestination(): void {
      amp.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
