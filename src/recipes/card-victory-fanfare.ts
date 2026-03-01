/**
 * Card Victory Fanfare Recipe
 *
 * Tonal synthesis: ascending multi-note arpeggio with harmonic
 * reinforcement. Each arpeggio step uses a sine oscillator at
 * ascending frequency intervals, with a triangle harmonic layer
 * for richness. The final note sustains with a tail decay.
 *
 * Reference: docs/prd/CORE_PRD.md Section 6.3
 */

import * as Tone from "tone";
import type { Rng } from "../core/rng.js";
import type { Recipe } from "../core/recipe.js";
import { getCardVictoryFanfareParams } from "./card-victory-fanfare-params.js";

export { getCardVictoryFanfareParams } from "./card-victory-fanfare-params.js";
export type { CardVictoryFanfareParams } from "./card-victory-fanfare-params.js";

/**
 * Creates a card-victory-fanfare Recipe.
 *
 * Sine Oscillator (Arpeggio Steps) + Triangle Harmonic -> Gain -> Destination
 */
export function createCardVictoryFanfare(rng: Rng): Recipe {
  const params = getCardVictoryFanfareParams(rng);

  const osc = new Tone.Oscillator(params.baseFreq, "sine");
  const oscGain = new Tone.Gain(params.primaryLevel);

  const harmOsc = new Tone.Oscillator(params.baseFreq * 2, "triangle");
  const harmGain = new Tone.Gain(params.harmonicLevel);

  const masterGain = new Tone.Gain(1);

  osc.chain(oscGain, masterGain);
  harmOsc.chain(harmGain, masterGain);

  const totalDuration =
    params.noteCount * params.noteDuration + params.tailDecay;

  return {
    start(time: number): void {
      osc.start(time);
      harmOsc.start(time);

      // Schedule ascending arpeggio steps
      let freq = params.baseFreq;
      for (let i = 0; i < params.noteCount; i++) {
        const noteTime = time + i * params.noteDuration;
        osc.frequency.setValueAtTime(freq, noteTime);
        harmOsc.frequency.setValueAtTime(freq * 2, noteTime);
        freq *= params.stepRatio;
      }

      // Envelope: attack at start, sustain through notes, decay tail
      masterGain.gain.setValueAtTime(0, time);
      masterGain.gain.linearRampToValueAtTime(1, time + params.noteAttack);

      const tailStart = time + params.noteCount * params.noteDuration;
      masterGain.gain.setValueAtTime(1, tailStart);
      masterGain.gain.linearRampToValueAtTime(0, tailStart + params.tailDecay);
    },
    stop(time: number): void {
      osc.stop(time);
      harmOsc.stop(time);
    },
    toDestination(): void {
      masterGain.toDestination();
    },
    get duration(): number {
      return totalDuration;
    },
  };
}
