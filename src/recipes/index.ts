/**
 * Recipe Registry Index
 *
 * Registers all built-in recipes and exports the shared registry instance.
 * Each recipe provides a full RecipeRegistration with:
 *   - factory: Tone.js factory for browser/interactive playback
 *   - getDuration: compute natural duration from a seeded RNG
 *   - buildOfflineGraph: build Web Audio API graph on OfflineAudioContext
 */

import type { OfflineAudioContext } from "node-web-audio-api";
import { RecipeRegistry } from "../core/recipe.js";
import type { Rng } from "../core/rng.js";
import { createUiSciFiConfirm } from "./ui-scifi-confirm.js";
import { getUiSciFiConfirmParams } from "./ui-scifi-confirm-params.js";

/** The global recipe registry instance with all built-in recipes registered. */
export const registry = new RecipeRegistry();

// ── ui-scifi-confirm ──────────────────────────────────────────────

function uiSciFiConfirmDuration(rng: Rng): number {
  const params = getUiSciFiConfirmParams(rng);
  return params.attack + params.decay;
}

function uiSciFiConfirmOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getUiSciFiConfirmParams(rng);

  // Create oscillator
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = params.frequency;

  // Create lowpass filter
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = params.filterCutoff;

  // Create gain node for amplitude envelope
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, 0);
  // Attack: ramp up
  gain.gain.linearRampToValueAtTime(1, params.attack);
  // Decay: ramp down
  gain.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  // Connect: osc -> filter -> gain -> destination
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  // Schedule
  osc.start(0);
  osc.stop(duration);
}

registry.register("ui-scifi-confirm", {
  factory: createUiSciFiConfirm,
  getDuration: uiSciFiConfirmDuration,
  buildOfflineGraph: uiSciFiConfirmOfflineGraph,
});
