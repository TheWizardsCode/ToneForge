/**
 * Weapon Laser Zap Recipe
 *
 * A short, punchy laser/blaster sound using FM synthesis + noise burst.
 * All parameters are seed-derived for deterministic variation.
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * weapon-laser-zap-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md line 56
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getWeaponLaserZapParams } from "./weapon-laser-zap-params.js";

export { getWeaponLaserZapParams } from "./weapon-laser-zap-params.js";
export type { WeaponLaserZapParams } from "./weapon-laser-zap-params.js";

/**
 * Creates a weapon laser zap Recipe.
 *
 * FM synthesis: carrier oscillator modulated by a second oscillator,
 * plus a noise burst through a bandpass filter for texture.
 */
export function createWeaponLaserZap(rng: Rng): Recipe {
  const params = getWeaponLaserZapParams(rng);

  // FM carrier
  const carrier = new Tone.Oscillator(params.carrierFreq, "sine");

  // FM modulator — connected to carrier frequency for FM effect
  const modulator = new Tone.Oscillator(params.modulatorFreq, "sine");
  const modGain = new Tone.Gain(params.modIndex * params.modulatorFreq);
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  // Amplitude envelope
  const amp = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: 0,
    release: 0,
  });

  carrier.connect(amp);

  // Noise burst for texture
  const noise = new Tone.Noise("white");
  const noiseFilter = new Tone.Filter(params.carrierFreq * 2, "bandpass");
  const noiseGain = new Tone.Gain(params.noiseBurstLevel);
  const noiseAmp = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay * 0.5,
    sustain: 0,
    release: 0,
  });

  noise.chain(noiseFilter, noiseGain, noiseAmp);

  const duration = params.attack + params.decay;

  return {
    start(time: number): void {
      modulator.start(time);
      carrier.start(time);
      amp.triggerAttack(time);
      noise.start(time);
      noiseAmp.triggerAttack(time);
    },
    stop(time: number): void {
      modulator.stop(time);
      carrier.stop(time);
      noise.stop(time);
    },
    toDestination(): void {
      amp.toDestination();
      noiseAmp.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
