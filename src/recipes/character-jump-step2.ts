/**
 * Character Jump Step 2 -- Oscillator + Amplitude Envelope
 *
 * Adds attack/decay envelope shaping to the sine oscillator from step 1.
 * The sound now starts quickly and fades out naturally instead of playing
 * at constant volume.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCharacterJumpStep2Params } from "./character-jump-step2-params.js";

// Re-export params API
export { getCharacterJumpStep2Params } from "./character-jump-step2-params.js";
export type { CharacterJumpStep2Params } from "./character-jump-step2-params.js";

/**
 * Creates a character-jump-step2 Recipe (oscillator + envelope).
 */
export function createCharacterJumpStep2(rng: Rng): Recipe {
  const params = getCharacterJumpStep2Params(rng);

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
