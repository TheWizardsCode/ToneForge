/**
 * Vehicle Engine Recipe
 *
 * A sample-hybrid engine sound that layers a CC0 looping engine
 * sample with a sawtooth oscillator for harmonic reinforcement,
 * filtered through a lowpass with LFO modulation.
 *
 * The sound has two layers:
 * 1. Sample: A real engine loop played continuously
 * 2. Oscillator: A sawtooth wave at the engine fundamental frequency
 *
 * Both layers pass through a shared lowpass filter with LFO-modulated
 * cutoff, creating RPM-like tonal variation. The sample provides
 * mechanical texture while oscillator parameters vary by seed.
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * vehicle-engine-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.5
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getVehicleEngineParams } from "./vehicle-engine-params.js";

export { getVehicleEngineParams } from "./vehicle-engine-params.js";
export type { VehicleEngineParams } from "./vehicle-engine-params.js";

/**
 * Creates a vehicle engine Recipe for browser/interactive playback.
 *
 * Layers a Tone.Player (looping engine sample) with a sawtooth
 * oscillator, both through a lowpass filter with LFO modulation.
 */
export function createVehicleEngine(rng: Rng): Recipe {
  const params = getVehicleEngineParams(rng);

  // Sample layer: CC0 engine loop
  const player = new Tone.Player({
    url: "/assets/samples/vehicle-engine/loop.wav",
    loop: true,
  });
  const sampleGain = new Tone.Gain(params.mixLevel);

  // Oscillator layer: sawtooth for harmonic reinforcement
  const osc = new Tone.Oscillator(params.oscFreq, "sawtooth");
  const synthGain = new Tone.Gain(1 - params.mixLevel);

  // LFO for filter cutoff modulation
  const lfo = new Tone.LFO(params.lfoRate, params.filterCutoff - params.lfoDepth * 0.5, params.filterCutoff + params.lfoDepth * 0.5);

  // Shared lowpass filter
  const filter = new Tone.Filter(params.filterCutoff, "lowpass");
  lfo.connect(filter.frequency);

  // Amplitude envelope
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: 0,
    sustain: 1,
    release: params.release,
  });

  player.chain(sampleGain, filter, env);
  osc.chain(synthGain, filter);

  const duration = params.attack + 0.2 + params.release; // attack + brief sustain + release

  return {
    start(time: number): void {
      player.start(time);
      osc.start(time);
      lfo.start(time);
      env.triggerAttack(time);
    },
    stop(time: number): void {
      player.stop(time);
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
