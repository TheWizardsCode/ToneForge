/**
 * Debris Tail Recipe
 *
 * Scattered debris/crackle sounds with decreasing density for the
 * tail phase of an explosion. Uses granular noise bursts that thin
 * out over time to simulate falling debris.
 *
 * The sound consists of filtered noise modulated by a rapid grain
 * envelope, with the grain density decreasing exponentially.
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * debris-tail-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md (Demo 3: Sound Stacking)
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getDebrisTailParams } from "./debris-tail-params.js";

export { getDebrisTailParams } from "./debris-tail-params.js";
export type { DebrisTailParams } from "./debris-tail-params.js";

/**
 * Creates a debris tail Recipe.
 *
 * Filtered noise with granular envelope that thins out over time,
 * simulating scattered debris after an explosion.
 */
export function createDebrisTail(rng: Rng): Recipe {
  const params = getDebrisTailParams(rng);

  const noise = new Tone.Noise("white");
  const filter = new Tone.Filter(params.filterFreq, "bandpass");
  filter.Q.value = params.filterQ;
  const gain = new Tone.Gain(params.level);
  const env = new Tone.AmplitudeEnvelope({
    attack: 0.001,
    decay: params.durationEnvelope,
    sustain: 0,
    release: 0,
  });

  noise.chain(filter, gain, env);

  const duration = params.durationEnvelope;

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
