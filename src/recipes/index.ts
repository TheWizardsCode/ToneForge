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
import { createWeaponLaserZap } from "./weapon-laser-zap.js";
import { getWeaponLaserZapParams } from "./weapon-laser-zap-params.js";

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

// ── weapon-laser-zap ──────────────────────────────────────────────

function weaponLaserZapDuration(rng: Rng): number {
  const params = getWeaponLaserZapParams(rng);
  return params.attack + params.decay;
}

function weaponLaserZapOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getWeaponLaserZapParams(rng);

  // FM carrier oscillator
  const carrier = ctx.createOscillator();
  carrier.type = "sine";
  carrier.frequency.value = params.carrierFreq;

  // FM modulator oscillator
  const modulator = ctx.createOscillator();
  modulator.type = "sine";
  modulator.frequency.value = params.modulatorFreq;

  // Modulation depth: modIndex * modulatorFreq
  const modGain = ctx.createGain();
  modGain.gain.value = params.modIndex * params.modulatorFreq;

  // Connect modulator -> modGain -> carrier.frequency (FM)
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  // Carrier amplitude envelope
  const carrierGain = ctx.createGain();
  carrierGain.gain.setValueAtTime(0, 0);
  carrierGain.gain.linearRampToValueAtTime(1, params.attack);
  carrierGain.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  carrier.connect(carrierGain);
  carrierGain.connect(ctx.destination);

  // Noise burst for texture
  const noiseBufferSize = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, noiseBufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);

  // Use a simple deterministic noise fill. The RNG has already been advanced
  // by getWeaponLaserZapParams, so subsequent calls produce deterministic
  // values unique to this seed.
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  // Bandpass filter centred at 2x carrier frequency
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = params.carrierFreq * 2;

  // Noise level
  const noiseLevel = ctx.createGain();
  noiseLevel.gain.value = params.noiseBurstLevel;

  // Noise amplitude envelope (shorter than carrier)
  const noiseAmpGain = ctx.createGain();
  noiseAmpGain.gain.setValueAtTime(0, 0);
  noiseAmpGain.gain.linearRampToValueAtTime(1, params.attack);
  noiseAmpGain.gain.linearRampToValueAtTime(0, params.attack + params.decay * 0.5);

  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseLevel);
  noiseLevel.connect(noiseAmpGain);
  noiseAmpGain.connect(ctx.destination);

  // Schedule
  modulator.start(0);
  carrier.start(0);
  noiseSrc.start(0);
  modulator.stop(duration);
  carrier.stop(duration);
  noiseSrc.stop(duration);
}

registry.register("weapon-laser-zap", {
  factory: createWeaponLaserZap,
  getDuration: weaponLaserZapDuration,
  buildOfflineGraph: weaponLaserZapOfflineGraph,
});
