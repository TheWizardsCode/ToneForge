/**
 * Card Coin Collect Hybrid Recipe
 *
 * Sample-hybrid: layers a CC0 metallic coin sample with procedurally
 * varied synthesis. The sample provides realistic metallic texture
 * while a sine oscillator adds tonal richness per seed.
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * card-coin-collect-hybrid-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardCoinCollectHybridParams } from "./card-coin-collect-hybrid-params.js";

export { getCardCoinCollectHybridParams } from "./card-coin-collect-hybrid-params.js";
export type { CardCoinCollectHybridParams } from "./card-coin-collect-hybrid-params.js";

/**
 * Creates a card-coin-collect-hybrid Recipe for browser/interactive playback.
 *
 * Layers a Tone.Player (coin sample) with synthesized tonal + shimmer layers.
 */
export function createCardCoinCollectHybrid(rng: Rng): Recipe {
  const params = getCardCoinCollectHybridParams(rng);

  // Sample layer: CC0 metallic coin clink
  const player = new Tone.Player("/assets/samples/card-coin-collect/clink.wav");
  const sampleGain = new Tone.Gain(params.mixLevel);

  player.chain(sampleGain);

  // Synthesis tonal layer
  const osc = new Tone.Oscillator(params.baseFreq, "sine");
  const synthGain = new Tone.Gain(params.synthLevel);
  const synthEnv = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  osc.chain(synthGain, synthEnv);

  // Shimmer layer: highpass-filtered noise for metallic texture
  const noise = new Tone.Noise("white");
  const shimmerFilter = new Tone.Filter(params.filterCutoff, "highpass");
  const shimmerGain = new Tone.Gain(params.shimmerLevel);
  const shimmerEnv = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: params.attack + 0.03,
    sustain: 0,
    release: 0,
  });

  noise.chain(shimmerFilter, shimmerGain, shimmerEnv);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      player.start(time);
      osc.start(time);
      noise.start(time);
      synthEnv.triggerAttack(time);
      shimmerEnv.triggerAttack(time);
    },
    stop(time: number): void {
      player.stop(time);
      osc.stop(time);
      noise.stop(time);
    },
    toDestination(): void {
      sampleGain.toDestination();
      synthEnv.toDestination();
      shimmerEnv.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
