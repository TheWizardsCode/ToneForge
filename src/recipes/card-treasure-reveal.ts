/**
 * Card Treasure Reveal Recipe
 *
 * Pure synthesis: dramatic shimmer-into-tone reveal sound. Starts
 * with highpass-filtered noise shimmer that fades as a bright tonal
 * chord swells in, creating a "sparkling reveal" effect.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardTreasureRevealParams } from "./card-treasure-reveal-params.js";

export { getCardTreasureRevealParams } from "./card-treasure-reveal-params.js";
export type { CardTreasureRevealParams } from "./card-treasure-reveal-params.js";

/**
 * Creates a card-treasure-reveal Recipe.
 *
 * Highpass Noise (shimmer) + Sine Chord (reveal) -> Envelope -> Destination
 */
export function createCardTreasureReveal(rng: Rng): Recipe {
  const params = getCardTreasureRevealParams(rng);

  // Shimmer layer: highpass-filtered white noise
  const noise = new Tone.Noise("white");
  const shimmerFilter = new Tone.Filter(params.shimmerCutoff, "highpass");
  const shimmerGain = new Tone.Gain(params.shimmerLevel);
  const shimmerEnv = new Tone.AmplitudeEnvelope({
    attack: 0.005,
    decay: params.shimmerDecay,
    sustain: 0,
    release: 0,
  });

  noise.chain(shimmerFilter, shimmerGain, shimmerEnv);

  // Reveal tone: base frequency
  const osc1 = new Tone.Oscillator(params.toneFreq, "sine");
  const gain1 = new Tone.Gain(params.toneLevel);
  const env1 = new Tone.AmplitudeEnvelope({
    attack: params.toneAttack,
    decay: params.toneDecay,
    sustain: 0,
    release: 0,
  });

  osc1.chain(gain1, env1);

  // Reveal tone: interval (major third-ish)
  const osc2 = new Tone.Oscillator(params.toneFreq * params.intervalRatio, "sine");
  const gain2 = new Tone.Gain(params.toneLevel * 0.7);
  const env2 = new Tone.AmplitudeEnvelope({
    attack: params.toneAttack,
    decay: params.toneDecay * 0.85,
    sustain: 0,
    release: 0,
  });

  osc2.chain(gain2, env2);

  const duration = Math.max(
    0.005 + params.shimmerDecay,
    params.toneAttack + params.toneDecay,
  );

  return {
    start(time: number): void {
      noise.start(time);
      osc1.start(time);
      osc2.start(time);
      shimmerEnv.triggerAttack(time);
      env1.triggerAttack(time);
      env2.triggerAttack(time);
    },
    stop(time: number): void {
      noise.stop(time);
      osc1.stop(time);
      osc2.stop(time);
    },
    toDestination(): void {
      shimmerEnv.toDestination();
      env1.toDestination();
      env2.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
