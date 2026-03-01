/**
 * Card Glow Recipe
 *
 * Sustained filtered oscillator with shimmer/vibrato LFO. Atmospheric
 * hum suggesting a card radiating energy or highlight state.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardGlowParams } from "./card-glow-params.js";

export { getCardGlowParams } from "./card-glow-params.js";
export type { CardGlowParams } from "./card-glow-params.js";

/**
 * Creates a card-glow Recipe.
 *
 * Sine Oscillator -> LFO Vibrato -> Bandpass Filter -> Envelope -> Destination
 */
export function createCardGlow(rng: Rng): Recipe {
  const params = getCardGlowParams(rng);

  // Base tone with LFO vibrato
  const osc = new Tone.Oscillator(params.baseFreq, "sine");
  const lfo = new Tone.LFO(params.lfoRate, -params.lfoDepth, params.lfoDepth);
  lfo.connect(osc.frequency);

  const filter = new Tone.Filter(params.filterFreq, "bandpass");
  filter.Q.value = params.filterQ;

  const gain = new Tone.Gain(params.level);
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: 0,
    sustain: 1,
    release: params.release,
  });

  osc.chain(filter, gain, env);

  const duration = params.attack + params.sustain + params.release;

  return {
    start(time: number): void {
      lfo.start(time);
      osc.start(time);
      env.triggerAttackRelease(params.attack + params.sustain, time);
    },
    stop(time: number): void {
      osc.stop(time);
      lfo.stop(time);
    },
    toDestination(): void {
      env.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
