/**
 * Card Deck Presence Recipe
 *
 * Quiet tonal hum with harmonic shimmer. A subtle ambient texture
 * giving the deck a "living" quality.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardDeckPresenceParams } from "./card-deck-presence-params.js";

export { getCardDeckPresenceParams } from "./card-deck-presence-params.js";
export type { CardDeckPresenceParams } from "./card-deck-presence-params.js";

/**
 * Creates a card-deck-presence Recipe.
 *
 * Sine Hum + Shimmer Sine (amplitude-tremolo via LFO) -> Gain -> Envelope -> Destination
 */
export function createCardDeckPresence(rng: Rng): Recipe {
  const params = getCardDeckPresenceParams(rng);

  // Fundamental hum
  const hum = new Tone.Oscillator(params.humFreq, "sine");
  const humGain = new Tone.Gain(params.level);

  // Shimmer harmonic with amplitude tremolo
  const shimmer = new Tone.Oscillator(params.humFreq * params.shimmerRatio, "sine");
  const shimmerGain = new Tone.Gain(params.shimmerLevel);

  // LFO for shimmer tremolo
  const lfo = new Tone.LFO(params.shimmerRate, 0, params.shimmerLevel);
  lfo.connect(shimmerGain.gain);

  // Master envelope
  const env = new Tone.AmplitudeEnvelope({
    attack: params.attack,
    decay: 0.01,
    sustain: 1.0,
    release: params.release,
  });

  hum.connect(humGain);
  humGain.connect(env);
  shimmer.connect(shimmerGain);
  shimmerGain.connect(env);

  const duration = params.attack + params.sustain + params.release;

  return {
    start(time: number): void {
      hum.start(time);
      shimmer.start(time);
      lfo.start(time);
      env.triggerAttack(time);
      env.triggerRelease(time + params.attack + params.sustain);
    },
    stop(time: number): void {
      hum.stop(time);
      shimmer.stop(time);
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
