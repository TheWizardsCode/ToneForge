/**
 * UI Notification Chime Recipe
 *
 * A pleasant musical chime tone using a harmonic series with gentle
 * amplitude envelope. Each harmonic is progressively quieter, creating
 * a bright but warm notification sound.
 *
 * NOTE: This file imports Tone.js for the Recipe factory (used in browser/
 * interactive contexts). The offline CLI render path imports only
 * ui-notification-chime-params.ts which has zero heavy dependencies.
 *
 * Reference: docs/prd/DEMO_ROADMAP.md
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getUiNotificationChimeParams } from "./ui-notification-chime-params.js";

export { getUiNotificationChimeParams } from "./ui-notification-chime-params.js";
export type { UiNotificationChimeParams } from "./ui-notification-chime-params.js";

/**
 * Creates a UI notification chime Recipe.
 *
 * Builds a harmonic series of sine oscillators, each with progressively
 * decreasing amplitude, through a shared gentle amplitude envelope.
 */
export function createUiNotificationChime(rng: Rng): Recipe {
  const params = getUiNotificationChimeParams(rng);

  const oscillators: Tone.Oscillator[] = [];
  const gains: Tone.Gain[] = [];

  // Create harmonics: fundamental + overtones
  for (let h = 0; h < params.harmonicCount; h++) {
    const freq = params.fundamentalFreq * (h + 1);
    const osc = new Tone.Oscillator(freq, "sine");
    // Each successive harmonic is quieter
    const level = Math.pow(params.harmonicDecayFactor, h);
    const gain = new Tone.Gain(level);
    osc.connect(gain);
    oscillators.push(osc);
    gains.push(gain);
  }

  // Shared amplitude envelope
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: params.decay,
    sustain: params.sustainLevel,
    release: params.release,
  });

  // Mix all harmonics into the envelope
  for (const gain of gains) {
    gain.connect(env);
  }

  const duration = params.attack + params.decay + params.release;

  return {
    start(time: number): void {
      for (const osc of oscillators) {
        osc.start(time);
      }
      env.triggerAttackRelease(params.attack + params.decay, time);
    },
    stop(time: number): void {
      for (const osc of oscillators) {
        osc.stop(time);
      }
    },
    toDestination(): void {
      env.toDestination();
    },
    get duration(): number {
      return duration;
    },
  };
}
