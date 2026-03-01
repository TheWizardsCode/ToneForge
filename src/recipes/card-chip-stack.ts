/**
 * Card Chip Stack Recipe
 *
 * Pure synthesis: layered percussive click with brief tonal ring
 * for stacking poker chips or game tokens. Bandpass noise burst
 * for the "clack" impact and a damped sine for the ring-out.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardChipStackParams } from "./card-chip-stack-params.js";

export { getCardChipStackParams } from "./card-chip-stack-params.js";
export type { CardChipStackParams } from "./card-chip-stack-params.js";

/**
 * Creates a card-chip-stack Recipe.
 *
 * Bandpass Noise (click) + Sine (ring) -> Envelope -> Destination
 */
export function createCardChipStack(rng: Rng): Recipe {
  const params = getCardChipStackParams(rng);

  // Percussive click: bandpass-filtered noise
  const noise = new Tone.Noise("white");
  const clickFilter = new Tone.Filter(params.clickFreq, "bandpass");
  clickFilter.Q.value = params.clickQ;
  const clickGain = new Tone.Gain(params.clickLevel);
  const clickEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.clickDecay,
    sustain: 0,
    release: 0,
  });

  noise.chain(clickFilter, clickGain, clickEnv);

  // Ring-out tone: damped sine
  const osc = new Tone.Oscillator(params.ringFreq, "sine");
  const ringGain = new Tone.Gain(params.ringLevel);
  const ringEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.ringDecay,
    sustain: 0,
    release: 0,
  });

  osc.chain(ringGain, ringEnv);

  const duration = params.attack + Math.max(params.clickDecay, params.ringDecay);

  return {
    start(time: number): void {
      noise.start(time);
      osc.start(time);
      clickEnv.triggerAttack(time);
      ringEnv.triggerAttack(time);
    },
    stop(time: number): void {
      noise.stop(time);
      osc.stop(time);
    },
    toDestination(): void {
      clickEnv.toDestination();
      ringEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
