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
import { createAmbientWindGust } from "./ambient-wind-gust.js";
import { getAmbientWindGustParams } from "./ambient-wind-gust-params.js";
import { createFootstepGravel } from "./footstep-gravel.js";
import { getFootstepGravelParams } from "./footstep-gravel-params.js";
import { createCreatureVocal } from "./creature-vocal.js";
import { getCreatureVocalParams } from "./creature-vocal-params.js";
import { loadSample } from "../audio/sample-loader.js";

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
  description: "Short sci-fi confirmation tone using sine synthesis with a filtered sweep.",
  category: "UI",
  tags: ["sci-fi", "confirm", "ui"],
  signalChain: "Sine Oscillator -> Lowpass Filter -> Amplitude Envelope -> Destination",
  params: [
    { name: "frequency", min: 400, max: 1200, unit: "Hz" },
    { name: "attack", min: 0.001, max: 0.01, unit: "s" },
    { name: "decay", min: 0.05, max: 0.3, unit: "s" },
    { name: "filterCutoff", min: 800, max: 4000, unit: "Hz" },
  ],
  getParams: (rng) => {
    const p = getUiSciFiConfirmParams(rng);
    return { frequency: p.frequency, attack: p.attack, decay: p.decay, filterCutoff: p.filterCutoff };
  },
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
  description: "Punchy laser zap using FM synthesis with a bandpass-filtered noise burst.",
  category: "Weapon",
  tags: ["laser", "zap", "sci-fi", "weapon"],
  signalChain: "FM Oscillator (Carrier + Modulator) + Bandpass Noise Burst -> Amplitude Envelope -> Destination",
  params: [
    { name: "carrierFreq", min: 200, max: 2000, unit: "Hz" },
    { name: "modulatorFreq", min: 50, max: 500, unit: "Hz" },
    { name: "modIndex", min: 1, max: 10, unit: "ratio" },
    { name: "noiseBurstLevel", min: 0.1, max: 0.5, unit: "amplitude" },
    { name: "attack", min: 0.001, max: 0.005, unit: "s" },
    { name: "decay", min: 0.03, max: 0.25, unit: "s" },
  ],
  getParams: (rng) => {
    const p = getWeaponLaserZapParams(rng);
    return {
      carrierFreq: p.carrierFreq, modulatorFreq: p.modulatorFreq,
      modIndex: p.modIndex, noiseBurstLevel: p.noiseBurstLevel,
      attack: p.attack, decay: p.decay,
    };
  },
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
  description: "Percussive stone footstep impact using bandpass-filtered noise with transient shaping.",
  category: "Footstep",
  tags: ["footstep", "stone", "impact", "foley"],
  signalChain: "White Noise -> Bandpass Filter (Body) + Brown Noise -> Lowpass Filter (Tail) -> Amplitude Envelope -> Destination",
  params: [
    { name: "filterFreq", min: 400, max: 2000, unit: "Hz" },
    { name: "filterQ", min: 1, max: 8, unit: "Q" },
    { name: "transientAttack", min: 0.001, max: 0.005, unit: "s" },
    { name: "bodyDecay", min: 0.03, max: 0.15, unit: "s" },
    { name: "tailDecay", min: 0.02, max: 0.08, unit: "s" },
    { name: "bodyLevel", min: 0.5, max: 1.0, unit: "amplitude" },
    { name: "tailLevel", min: 0.1, max: 0.4, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getFootstepStoneParams(rng);
    return {
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      transientAttack: p.transientAttack, bodyDecay: p.bodyDecay,
      tailDecay: p.tailDecay, bodyLevel: p.bodyLevel, tailLevel: p.tailLevel,
    };
  },
});

// ── footstep-gravel (sample-hybrid) ───────────────────────────────

function footstepGravelDuration(rng: Rng): number {
  const params = getFootstepGravelParams(rng);
  return params.transientAttack + Math.max(params.bodyDecay, params.tailDecay);
}

async function footstepGravelOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): Promise<void> {
  const params = getFootstepGravelParams(rng);

  // Load the CC0 impact sample
  const sampleBuffer = await loadSample("footstep-gravel/impact.wav", ctx);

  // Sample layer: play the impact transient identically every render
  const sampleSrc = ctx.createBufferSource();
  sampleSrc.buffer = sampleBuffer;

  const sampleGain = ctx.createGain();
  sampleGain.gain.value = params.mixLevel;

  sampleSrc.connect(sampleGain);
  sampleGain.connect(ctx.destination);

  // Procedural body layer: bandpass-filtered white noise for gravel crunch
  const bufferSize = Math.ceil(ctx.sampleRate * duration);

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

  const bodyGain = ctx.createGain();
  bodyGain.gain.value = params.bodyLevel;

  const bodyEnv = ctx.createGain();
  bodyEnv.gain.setValueAtTime(0, 0);
  bodyEnv.gain.linearRampToValueAtTime(1, params.transientAttack);
  bodyEnv.gain.linearRampToValueAtTime(0, params.transientAttack + params.bodyDecay);

  bodySrc.connect(bodyFilter);
  bodyFilter.connect(bodyGain);
  bodyGain.connect(bodyEnv);
  bodyEnv.connect(ctx.destination);

  // Procedural tail layer: lowpass-filtered brown noise for scatter
  const tailBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const tailData = tailBuffer.getChannelData(0);
  let brownState = 0;
  for (let i = 0; i < tailData.length; i++) {
    brownState += rng() * 2 - 1;
    brownState *= 0.998; // leaky integrator to prevent drift
    tailData[i] = brownState * 0.1;
  }

  const tailSrc = ctx.createBufferSource();
  tailSrc.buffer = tailBuffer;

  const tailFilter = ctx.createBiquadFilter();
  tailFilter.type = "lowpass";
  tailFilter.frequency.value = params.filterFreq * 0.5;

  const tailGain = ctx.createGain();
  tailGain.gain.value = params.tailLevel;

  const tailEnv = ctx.createGain();
  tailEnv.gain.setValueAtTime(0, 0);
  tailEnv.gain.linearRampToValueAtTime(1, params.transientAttack);
  tailEnv.gain.linearRampToValueAtTime(0, params.transientAttack + params.tailDecay);

  tailSrc.connect(tailFilter);
  tailFilter.connect(tailGain);
  tailGain.connect(tailEnv);
  tailEnv.connect(ctx.destination);

  // Schedule all sources
  sampleSrc.start(0);
  bodySrc.start(0);
  tailSrc.start(0);
  sampleSrc.stop(duration);
  bodySrc.stop(duration);
  tailSrc.stop(duration);
}

registry.register("footstep-gravel", {
  factory: createFootstepGravel,
  getDuration: footstepGravelDuration,
  buildOfflineGraph: footstepGravelOfflineGraph,
  description: "Sample-hybrid gravel footstep layering a CC0 impact transient with procedurally varied noise synthesis.",
  category: "Footstep",
  tags: ["footstep", "gravel", "impact", "foley", "sample-hybrid"],
  signalChain: "CC0 Impact Sample + White Noise -> Bandpass Filter (Body) + Brown Noise -> Lowpass Filter (Tail) -> Amplitude Envelope -> Destination",
  params: [
    { name: "filterFreq", min: 300, max: 1800, unit: "Hz" },
    { name: "transientAttack", min: 0.001, max: 0.005, unit: "s" },
    { name: "bodyDecay", min: 0.05, max: 0.25, unit: "s" },
    { name: "tailDecay", min: 0.04, max: 0.15, unit: "s" },
    { name: "mixLevel", min: 0.3, max: 0.7, unit: "amplitude" },
    { name: "bodyLevel", min: 0.4, max: 0.9, unit: "amplitude" },
    { name: "tailLevel", min: 0.1, max: 0.4, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getFootstepGravelParams(rng);
    return {
      filterFreq: p.filterFreq, transientAttack: p.transientAttack,
      bodyDecay: p.bodyDecay, tailDecay: p.tailDecay,
      mixLevel: p.mixLevel, bodyLevel: p.bodyLevel, tailLevel: p.tailLevel,
    };
  },
});

// ── creature-vocal (sample-hybrid) ────────────────────────────────

function creatureVocalDuration(rng: Rng): number {
  const params = getCreatureVocalParams(rng);
  return params.attack + params.decay;
}

async function creatureVocalOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): Promise<void> {
  const params = getCreatureVocalParams(rng);

  // Load the CC0 growl sample
  const sampleBuffer = await loadSample("creature-vocal/growl.wav", ctx);

  // Sample layer: play the growl identically every render
  const sampleSrc = ctx.createBufferSource();
  sampleSrc.buffer = sampleBuffer;

  const sampleGain = ctx.createGain();
  sampleGain.gain.value = params.mixLevel;

  sampleSrc.connect(sampleGain);
  sampleGain.connect(ctx.destination);

  // FM synthesis layer: carrier + modulator
  const carrier = ctx.createOscillator();
  carrier.type = "sine";
  carrier.frequency.value = params.carrierFreq;

  const modulator = ctx.createOscillator();
  modulator.type = "sine";
  modulator.frequency.value = params.carrierFreq; // modulator at carrier freq for rich harmonics

  const modGain = ctx.createGain();
  modGain.gain.value = params.modIndex * params.carrierFreq;

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  // Formant-style bandpass filter
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = params.filterCutoff;
  filter.Q.value = params.filterQ;

  // Synthesis level (inverse of sample mix)
  const synthGain = ctx.createGain();
  synthGain.gain.value = 1 - params.mixLevel;

  // Amplitude envelope
  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0, 0);
  envGain.gain.linearRampToValueAtTime(1, params.attack);
  envGain.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  carrier.connect(filter);
  filter.connect(synthGain);
  synthGain.connect(envGain);
  envGain.connect(ctx.destination);

  // Schedule all sources
  modulator.start(0);
  carrier.start(0);
  sampleSrc.start(0);
  modulator.stop(duration);
  carrier.stop(duration);
  sampleSrc.stop(duration);
}

registry.register("creature-vocal", {
  factory: createCreatureVocal,
  getDuration: creatureVocalDuration,
  buildOfflineGraph: creatureVocalOfflineGraph,
  description: "Sample-hybrid creature vocalization layering a CC0 growl sample with FM synthesis and formant filtering.",
  category: "Creature",
  tags: ["creature", "vocal", "growl", "monster", "sample-hybrid"],
  signalChain: "CC0 Growl Sample + FM Oscillator -> Bandpass Formant Filter -> Amplitude Envelope -> Destination",
  params: [
    { name: "carrierFreq", min: 80, max: 220, unit: "Hz" },
    { name: "modIndex", min: 8, max: 30, unit: "ratio" },
    { name: "filterCutoff", min: 300, max: 1200, unit: "Hz" },
    { name: "filterQ", min: 2, max: 10, unit: "Q" },
    { name: "mixLevel", min: 0.3, max: 0.7, unit: "amplitude" },
    { name: "attack", min: 0.02, max: 0.08, unit: "s" },
    { name: "decay", min: 0.2, max: 0.5, unit: "s" },
  ],
  getParams: (rng) => {
    const p = getCreatureVocalParams(rng);
    return {
      carrierFreq: p.carrierFreq, modIndex: p.modIndex,
      filterCutoff: p.filterCutoff, filterQ: p.filterQ,
      mixLevel: p.mixLevel, attack: p.attack, decay: p.decay,
    };
  },
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
  description: "Pleasant musical chime using harmonic series synthesis with ADSR envelope.",
  category: "UI",
  tags: ["chime", "notification", "ui", "musical"],
  signalChain: "Harmonic Sine Oscillators -> Per-Harmonic Gain -> ADSR Envelope -> Destination",
  params: [
    { name: "fundamentalFreq", min: 400, max: 1200, unit: "Hz" },
    { name: "harmonicCount", min: 2, max: 6, unit: "integer" },
    { name: "harmonicDecayFactor", min: 0.3, max: 0.8, unit: "ratio" },
    { name: "attack", min: 0.005, max: 0.02, unit: "s" },
    { name: "sustainLevel", min: 0.3, max: 0.7, unit: "amplitude" },
    { name: "decay", min: 0.1, max: 0.4, unit: "s" },
    { name: "release", min: 0.1, max: 0.5, unit: "s" },
  ],
  getParams: (rng) => {
    const p = getUiNotificationChimeParams(rng);
    return {
      fundamentalFreq: p.fundamentalFreq, harmonicCount: p.harmonicCount,
      harmonicDecayFactor: p.harmonicDecayFactor, attack: p.attack,
      sustainLevel: p.sustainLevel, decay: p.decay, release: p.release,
    };
  },
});

// ── ambient-wind-gust ─────────────────────────────────────────────

function ambientWindGustDuration(rng: Rng): number {
  const params = getAmbientWindGustParams(rng);
  return params.attack + params.sustain + params.release;
}

function ambientWindGustOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getAmbientWindGustParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Pink noise approximation: filter white noise with -3dB/octave slope
  // Use a lowpass at a moderate frequency to approximate pink spectrum
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  // Pink noise approximation filter (lowpass to roll off highs)
  const pinkFilter = ctx.createBiquadFilter();
  pinkFilter.type = "lowpass";
  pinkFilter.frequency.value = 2000;

  // Main bandpass filter
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = params.filterFreq;
  filter.Q.value = params.filterQ;

  // LFO for filter cutoff modulation (manual via automation)
  // Approximate sine LFO by scheduling value changes
  const lfoMin = params.filterFreq - params.lfoDepth * 0.5;
  const lfoMax = params.filterFreq + params.lfoDepth * 0.5;
  const lfoSafeMin = Math.max(20, lfoMin); // prevent negative/zero freq
  const lfoPeriod = 1 / params.lfoRate;
  const lfoSteps = Math.ceil(duration / (lfoPeriod / 16)); // 16 steps per cycle
  const lfoStepTime = duration / lfoSteps;

  for (let i = 0; i <= lfoSteps; i++) {
    const t = i * lfoStepTime;
    const phase = (t * params.lfoRate * 2 * Math.PI);
    const value = lfoSafeMin + (lfoMax - lfoSafeMin) * (0.5 + 0.5 * Math.sin(phase));
    filter.frequency.setValueAtTime(value, t);
  }

  // Level control
  const levelGain = ctx.createGain();
  levelGain.gain.value = params.level;

  // Amplitude envelope: swell, sustain, fade
  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0, 0);
  // Attack: swell up
  envGain.gain.linearRampToValueAtTime(1, params.attack);
  // Sustain: hold at 1
  envGain.gain.setValueAtTime(1, params.attack + params.sustain);
  // Release: fade out
  envGain.gain.linearRampToValueAtTime(0, duration);

  noiseSrc.connect(pinkFilter);
  pinkFilter.connect(filter);
  filter.connect(levelGain);
  levelGain.connect(envGain);
  envGain.connect(ctx.destination);

  noiseSrc.start(0);
  noiseSrc.stop(duration);
}

registry.register("ambient-wind-gust", {
  factory: createAmbientWindGust,
  getDuration: ambientWindGustDuration,
  buildOfflineGraph: ambientWindGustOfflineGraph,
  description: "Environmental wind burst with filtered noise and LFO-modulated bandpass sweep.",
  category: "Ambient",
  tags: ["wind", "ambient", "environment", "nature"],
  signalChain: "Pink Noise Approximation -> Bandpass Filter (LFO Modulated) -> Level Control -> Swell Envelope -> Destination",
  params: [
    { name: "filterFreq", min: 200, max: 1500, unit: "Hz" },
    { name: "filterQ", min: 0.5, max: 3.0, unit: "Q" },
    { name: "lfoRate", min: 0.5, max: 4.0, unit: "Hz" },
    { name: "lfoDepth", min: 100, max: 800, unit: "Hz" },
    { name: "attack", min: 0.1, max: 0.5, unit: "s" },
    { name: "sustain", min: 0.2, max: 1.0, unit: "s" },
    { name: "release", min: 0.2, max: 0.8, unit: "s" },
    { name: "level", min: 0.3, max: 0.8, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getAmbientWindGustParams(rng);
    return {
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      lfoRate: p.lfoRate, lfoDepth: p.lfoDepth,
      attack: p.attack, sustain: p.sustain,
      release: p.release, level: p.level,
    };
  },
});
