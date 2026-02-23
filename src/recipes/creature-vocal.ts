/**
 * Creature Vocal Recipe
 *
 * A sample-hybrid creature vocalization that layers a CC0 growl
 * sample with FM synthesis and formant-style bandpass filtering.
 *
 * The sound has two layers:
 * 1. Sample: A real growl transient played identically every render
 * 2. FM Synthesis: An FM oscillator (carrier + modulator) filtered
 *    through a bandpass for formant-like resonance
 *
 * The sample provides organic texture while FM synthesis parameters
 * (carrier frequency, modulation index, filter cutoff) vary by seed,
 * producing diverse creature variants from a single base sound.
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * creature-vocal-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.4
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCreatureVocalParams } from "./creature-vocal-params.js";

export { getCreatureVocalParams } from "./creature-vocal-params.js";
export type { CreatureVocalParams } from "./creature-vocal-params.js";

/**
 * Creates a creature vocal Recipe for browser/interactive playback.
 *
 * Layers a Tone.Player (growl sample) with FM synthesis through
 * a formant-style bandpass filter.
 */
export function createCreatureVocal(rng: Rng): Recipe {
  const params = getCreatureVocalParams(rng);

  // Sample layer: CC0 growl sample
  const player = new Tone.Player("/assets/samples/creature-vocal/growl.wav");
  const sampleGain = new Tone.Gain(params.mixLevel);

  player.chain(sampleGain);

  // FM synthesis layer
  const fmOsc = new Tone.FMOscillator({
    frequency: params.carrierFreq,
    modulationIndex: params.modIndex,
  });

  const filter = new Tone.Filter(params.filterCutoff, "bandpass");
  filter.Q.value = params.filterQ;

  const synthGain = new Tone.Gain(1 - params.mixLevel);

  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  fmOsc.chain(filter, synthGain, env);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      player.start(time);
      fmOsc.start(time);
      env.triggerAttack(time);
    },
    stop(time: number): void {
      player.stop(time);
      fmOsc.stop(time);
    },
    toDestination(): void {
      sampleGain.toDestination();
      env.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
