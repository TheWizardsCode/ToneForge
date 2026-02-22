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
import { createFootstepStone } from "./footstep-stone.js";
import { getFootstepStoneParams } from "./footstep-stone-params.js";
import { createUiNotificationChime } from "./ui-notification-chime.js";
import { getUiNotificationChimeParams } from "./ui-notification-chime-params.js";

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

// ── footstep-stone ────────────────────────────────────────────────

function footstepStoneDuration(rng: Rng): number {
  const params = getFootstepStoneParams(rng);
  return params.transientAttack + Math.max(params.bodyDecay, params.tailDecay);
}

function footstepStoneOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getFootstepStoneParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Body layer: bandpass-filtered noise for the main impact
  const bodyBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const bodyData = bodyBuffer.getChannelData(0);
  for (let i = 0; i < bodyData.length; i++) {
    bodyData[i] = rng() * 2 - 1; // white noise
  }

  const bodySrc = ctx.createBufferSource();
  bodySrc.buffer = bodyBuffer;

  const bodyFilter = ctx.createBiquadFilter();
  bodyFilter.type = "bandpass";
  bodyFilter.frequency.value = params.filterFreq;
  bodyFilter.Q.value = params.filterQ;

  const bodyGain = ctx.createGain();
  bodyGain.gain.value = params.bodyLevel;

  // Body amplitude envelope
  const bodyEnv = ctx.createGain();
  bodyEnv.gain.setValueAtTime(0, 0);
  bodyEnv.gain.linearRampToValueAtTime(1, params.transientAttack);
  bodyEnv.gain.linearRampToValueAtTime(0, params.transientAttack + params.bodyDecay);

  bodySrc.connect(bodyFilter);
  bodyFilter.connect(bodyGain);
  bodyGain.connect(bodyEnv);
  bodyEnv.connect(ctx.destination);

  // Tail layer: lowpass-filtered brownian noise for surface resonance
  const tailBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const tailData = tailBuffer.getChannelData(0);
  // Approximate brown noise: integrate white noise
  let brownState = 0;
  for (let i = 0; i < tailData.length; i++) {
    brownState += rng() * 2 - 1;
    brownState *= 0.998; // leaky integrator to prevent drift
    tailData[i] = brownState * 0.1; // scale down
  }

  const tailSrc = ctx.createBufferSource();
  tailSrc.buffer = tailBuffer;

  const tailFilter = ctx.createBiquadFilter();
  tailFilter.type = "lowpass";
  tailFilter.frequency.value = params.filterFreq * 0.5;

  const tailGain = ctx.createGain();
  tailGain.gain.value = params.tailLevel;

  // Tail amplitude envelope
  const tailEnv = ctx.createGain();
  tailEnv.gain.setValueAtTime(0, 0);
  tailEnv.gain.linearRampToValueAtTime(1, params.transientAttack);
  tailEnv.gain.linearRampToValueAtTime(0, params.transientAttack + params.tailDecay);

  tailSrc.connect(tailFilter);
  tailFilter.connect(tailGain);
  tailGain.connect(tailEnv);
  tailEnv.connect(ctx.destination);

  // Schedule
  bodySrc.start(0);
  tailSrc.start(0);
  bodySrc.stop(duration);
  tailSrc.stop(duration);
}

registry.register("footstep-stone", {
  factory: createFootstepStone,
  getDuration: footstepStoneDuration,
  buildOfflineGraph: footstepStoneOfflineGraph,
});

// ── ui-notification-chime ─────────────────────────────────────────

function uiNotificationChimeDuration(rng: Rng): number {
  const params = getUiNotificationChimeParams(rng);
  return params.attack + params.decay + params.release;
}

function uiNotificationChimeOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getUiNotificationChimeParams(rng);

  // Create harmonics: fundamental + overtones as separate oscillators
  for (let h = 0; h < params.harmonicCount; h++) {
    const freq = params.fundamentalFreq * (h + 1);
    const level = Math.pow(params.harmonicDecayFactor, h);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = level;

    // Per-harmonic amplitude envelope (attack -> decay -> sustain -> release)
    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0, 0);
    // Attack: ramp up to 1
    envGain.gain.linearRampToValueAtTime(1, params.attack);
    // Decay: ramp down to sustain level
    envGain.gain.linearRampToValueAtTime(
      params.sustainLevel,
      params.attack + params.decay,
    );
    // Release: ramp down to 0
    envGain.gain.linearRampToValueAtTime(0, duration);

    osc.connect(harmonicGain);
    harmonicGain.connect(envGain);
    envGain.connect(ctx.destination);

    osc.start(0);
    osc.stop(duration);
  }
}

registry.register("ui-notification-chime", {
  factory: createUiNotificationChime,
  getDuration: uiNotificationChimeDuration,
  buildOfflineGraph: uiNotificationChimeOfflineGraph,
});
