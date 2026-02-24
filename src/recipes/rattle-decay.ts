/**
 * Rattle Decay Recipe
 *
 * Rattling/settling decay for the tail phase of a door slam.
 * Uses small noise bursts with irregular timing to simulate hardware
 * or loose components vibrating after a door impact.
 *
 * The sound consists of bandpass-filtered noise with a rapid grain
 * envelope that decays in both amplitude and density.
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * rattle-decay-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getRattleDecayParams } from "./rattle-decay-params.js";

export { getRattleDecayParams } from "./rattle-decay-params.js";
export type { RattleDecayParams } from "./rattle-decay-params.js";

/**
 * Creates a rattle decay Recipe.
 *
 * Bandpass-filtered noise with decaying amplitude to simulate
 * rattling hardware after a door slam impact.
 */
export function createRattleDecay(rng: Rng): Recipe {
  const params = getRattleDecayParams(rng);

  const noise = new Tone.Noise("white");
  const filter = new Tone.Filter(params.filterFreq, "bandpass");
  filter.Q.value = params.filterQ;
  const gain = new Tone.Gain(params.level);
  const env = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: params.duration,
    sustain: 0,
    release: 0,
  });

  noise.chain(filter, gain, env);

  const duration = params.duration;

  return {
    start(time: number): void {
      noise.start(time);
      env.triggerAttack(time);
    },
    stop(time: number): void {
      noise.stop(time);
    },
    toDestination(): void {
      env.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
