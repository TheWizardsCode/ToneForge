/**
 * Recipe Registry Index
 *
 * Registers all built-in recipes and exports the shared registry instance.
 * Each recipe provides a LazyRecipeRegistration with:
 *   - factoryLoader: deferred Tone.js factory import (avoids loading
 *     heavy dependencies at module load time)
 *   - getDuration: compute natural duration from a seeded RNG
 *   - buildOfflineGraph: build Web Audio API graph on OfflineAudioContext
 *
 * Only the lightweight param modules are imported eagerly. Recipe factory
 * modules (which import Tone.js) are loaded on demand via dynamic import()
 * when the factory is actually needed (browser/interactive contexts).
 */

import type { OfflineAudioContext } from "node-web-audio-api";
import { RecipeRegistry } from "../core/recipe.js";
import type { Rng } from "../core/rng.js";
import { getUiSciFiConfirmParams } from "./ui-scifi-confirm-params.js";
import { getWeaponLaserZapParams } from "./weapon-laser-zap-params.js";
import { getFootstepStoneParams } from "./footstep-stone-params.js";
import { getUiNotificationChimeParams } from "./ui-notification-chime-params.js";
import { getAmbientWindGustParams } from "./ambient-wind-gust-params.js";
import { getFootstepGravelParams } from "./footstep-gravel-params.js";
import { getCreatureVocalParams } from "./creature-vocal-params.js";
import { getVehicleEngineParams } from "./vehicle-engine-params.js";
import { getCharacterJumpStep1Params } from "./character-jump-step1-params.js";
import { getCharacterJumpStep2Params } from "./character-jump-step2-params.js";
import { getCharacterJumpStep3Params } from "./character-jump-step3-params.js";
import { getCharacterJumpStep4Params } from "./character-jump-step4-params.js";
import { getCharacterJumpParams } from "./character-jump-params.js";
import { loadSample } from "../audio/sample-loader.js";
import { getImpactCrackParams } from "./impact-crack-params.js";
import { getRumbleBodyParams } from "./rumble-body-params.js";
import { getDebrisTailParams } from "./debris-tail-params.js";
import { getSlamTransientParams } from "./slam-transient-params.js";
import { getResonanceBodyParams } from "./resonance-body-params.js";
import { getRattleDecayParams } from "./rattle-decay-params.js";
import { getCardFlipParams } from "./card-flip-params.js";
import { getCardSlideParams } from "./card-slide-params.js";
import { getCardPlaceParams } from "./card-place-params.js";
import { getCardDrawParams } from "./card-draw-params.js";
import { getCardShuffleParams } from "./card-shuffle-params.js";
import { getCardFanParams } from "./card-fan-params.js";
import { getCardSuccessParams } from "./card-success-params.js";
import { getCardFailureParams } from "./card-failure-params.js";
import { getCardVictoryFanfareParams } from "./card-victory-fanfare-params.js";
import { getCardDefeatStingParams } from "./card-defeat-sting-params.js";
import { getCardRoundCompleteParams } from "./card-round-complete-params.js";
import { getCardCoinCollectParams } from "./card-coin-collect-params.js";
import { getCardCoinCollectHybridParams } from "./card-coin-collect-hybrid-params.js";
import { getCardCoinSpendParams } from "./card-coin-spend-params.js";
import { getCardChipStackParams } from "./card-chip-stack-params.js";
import { getCardTokenEarnParams } from "./card-token-earn-params.js";
import { getCardTreasureRevealParams } from "./card-treasure-reveal-params.js";
import { getCardDiscardParams } from "./card-discard-params.js";
import { getCardBurnParams } from "./card-burn-params.js";
import { getCardReturnToDeckParams } from "./card-return-to-deck-params.js";

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
  factoryLoader: async () => (await import("./ui-scifi-confirm.js")).createUiSciFiConfirm,
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
  factoryLoader: async () => (await import("./weapon-laser-zap.js")).createWeaponLaserZap,
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
  factoryLoader: async () => (await import("./footstep-stone.js")).createFootstepStone,
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
  factoryLoader: async () => (await import("./footstep-gravel.js")).createFootstepGravel,
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
  factoryLoader: async () => (await import("./creature-vocal.js")).createCreatureVocal,
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

// ── vehicle-engine (sample-hybrid) ────────────────────────────────

function vehicleEngineDuration(rng: Rng): number {
  const params = getVehicleEngineParams(rng);
  return params.attack + 0.4 + params.release;
}

async function vehicleEngineOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): Promise<void> {
  const params = getVehicleEngineParams(rng);

  // Load the CC0 engine loop sample
  const sampleBuffer = await loadSample("vehicle-engine/loop.wav", ctx);

  // Sample layer: looping engine sample
  const sampleSrc = ctx.createBufferSource();
  sampleSrc.buffer = sampleBuffer;
  sampleSrc.loop = true;

  const sampleGain = ctx.createGain();
  sampleGain.gain.value = params.mixLevel;

  sampleSrc.connect(sampleGain);

  // Oscillator layer: sawtooth for harmonic reinforcement
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = params.oscFreq;

  const synthGain = ctx.createGain();
  synthGain.gain.value = 1 - params.mixLevel;

  osc.connect(synthGain);

  // Shared lowpass filter
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = params.filterCutoff;

  // LFO for filter cutoff modulation (manual via automation)
  const lfoMin = Math.max(20, params.filterCutoff - params.lfoDepth * 0.5);
  const lfoMax = params.filterCutoff + params.lfoDepth * 0.5;
  const lfoPeriod = 1 / params.lfoRate;
  const lfoSteps = Math.ceil(duration / (lfoPeriod / 16));
  const lfoStepTime = duration / lfoSteps;

  for (let i = 0; i <= lfoSteps; i++) {
    const t = i * lfoStepTime;
    const phase = t * params.lfoRate * 2 * Math.PI;
    const value = lfoMin + (lfoMax - lfoMin) * (0.5 + 0.5 * Math.sin(phase));
    filter.frequency.setValueAtTime(value, t);
  }

  sampleGain.connect(filter);
  synthGain.connect(filter);

  // Amplitude envelope: attack -> sustain -> release
  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0, 0);
  envGain.gain.linearRampToValueAtTime(1, params.attack);
  const sustainEnd = Math.max(params.attack, duration - params.release);
  envGain.gain.setValueAtTime(1, sustainEnd);
  envGain.gain.linearRampToValueAtTime(0, duration);

  filter.connect(envGain);
  envGain.connect(ctx.destination);

  // Schedule all sources
  sampleSrc.start(0);
  osc.start(0);
  sampleSrc.stop(duration);
  osc.stop(duration);
}

registry.register("vehicle-engine", {
  factoryLoader: async () => (await import("./vehicle-engine.js")).createVehicleEngine,
  getDuration: vehicleEngineDuration,
  buildOfflineGraph: vehicleEngineOfflineGraph,
  description: "Sample-hybrid vehicle engine layering a CC0 engine loop with sawtooth oscillator and LFO-modulated lowpass filter.",
  category: "Vehicle",
  tags: ["vehicle", "engine", "loop", "mechanical", "sample-hybrid"],
  signalChain: "CC0 Engine Loop + Sawtooth Oscillator -> Lowpass Filter (LFO Modulated) -> Amplitude Envelope -> Destination",
  params: [
    { name: "oscFreq", min: 40, max: 80, unit: "Hz" },
    { name: "lfoRate", min: 1, max: 4, unit: "Hz" },
    { name: "lfoDepth", min: 50, max: 300, unit: "Hz" },
    { name: "filterCutoff", min: 200, max: 600, unit: "Hz" },
    { name: "mixLevel", min: 0.3, max: 0.7, unit: "amplitude" },
    { name: "attack", min: 0.2, max: 0.6, unit: "s" },
    { name: "release", min: 0.6, max: 1.6, unit: "s" },
  ],
  getParams: (rng) => {
    const p = getVehicleEngineParams(rng);
    return {
      oscFreq: p.oscFreq, lfoRate: p.lfoRate,
      lfoDepth: p.lfoDepth, filterCutoff: p.filterCutoff,
      mixLevel: p.mixLevel, attack: p.attack, release: p.release,
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
  factoryLoader: async () => (await import("./ui-notification-chime.js")).createUiNotificationChime,
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
  factoryLoader: async () => (await import("./ambient-wind-gust.js")).createAmbientWindGust,
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

// ── character-jump-step1 (oscillator only) ────────────────────────

function characterJumpStep1Duration(_rng: Rng): number {
  // Fixed duration -- no envelope params to derive it from
  return 0.2;
}

function characterJumpStep1OfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCharacterJumpStep1Params(rng);

  // Sine oscillator at constant volume -- no envelope
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = params.baseFreq;

  // Constant gain of 1 (no envelope shaping)
  const gain = ctx.createGain();
  gain.gain.value = 1;

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(0);
  osc.stop(duration);
}

registry.register("character-jump-step1", {
  factoryLoader: async () => (await import("./character-jump-step1.js")).createCharacterJumpStep1,
  getDuration: characterJumpStep1Duration,
  buildOfflineGraph: characterJumpStep1OfflineGraph,
  description: "Raw sine oscillator at a seed-derived frequency. No envelope, fixed 0.2 s duration.",
  category: "Character",
  tags: ["jump", "tutorial", "step1", "oscillator"],
  signalChain: "Sine Oscillator -> Destination",
  params: [
    { name: "baseFreq", min: 300, max: 600, unit: "Hz" },
  ],
  getParams: (rng) => {
    const p = getCharacterJumpStep1Params(rng);
    return { baseFreq: p.baseFreq };
  },
});

// ── character-jump-step2 (oscillator + envelope) ──────────────────

function characterJumpStep2Duration(rng: Rng): number {
  const params = getCharacterJumpStep2Params(rng);
  return params.attack + params.decay;
}

function characterJumpStep2OfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCharacterJumpStep2Params(rng);

  // Sine oscillator
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = params.baseFreq;

  // Amplitude envelope
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(1, params.attack);
  gain.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(0);
  osc.stop(duration);
}

registry.register("character-jump-step2", {
  factoryLoader: async () => (await import("./character-jump-step2.js")).createCharacterJumpStep2,
  getDuration: characterJumpStep2Duration,
  buildOfflineGraph: characterJumpStep2OfflineGraph,
  description: "Sine oscillator with attack/decay amplitude envelope. Sound starts quickly and fades naturally.",
  category: "Character",
  tags: ["jump", "tutorial", "step2", "envelope"],
  signalChain: "Sine Oscillator -> Amplitude Envelope -> Destination",
  params: [
    { name: "baseFreq", min: 300, max: 600, unit: "Hz" },
    { name: "attack", min: 0.002, max: 0.01, unit: "s" },
    { name: "decay", min: 0.05, max: 0.2, unit: "s" },
  ],
  getParams: (rng) => {
    const p = getCharacterJumpStep2Params(rng);
    return { baseFreq: p.baseFreq, attack: p.attack, decay: p.decay };
  },
});

// ── character-jump-step3 (oscillator + envelope + pitch sweep) ────

function characterJumpStep3Duration(rng: Rng): number {
  const params = getCharacterJumpStep3Params(rng);
  return params.attack + params.decay;
}

function characterJumpStep3OfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCharacterJumpStep3Params(rng);

  // Sine oscillator with rising pitch sweep
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(params.baseFreq, 0);
  osc.frequency.linearRampToValueAtTime(
    params.baseFreq + params.sweepRange,
    params.sweepDuration,
  );

  // Amplitude envelope
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(1, params.attack);
  gain.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(0);
  osc.stop(duration);
}

registry.register("character-jump-step3", {
  factoryLoader: async () => (await import("./character-jump-step3.js")).createCharacterJumpStep3,
  getDuration: characterJumpStep3Duration,
  buildOfflineGraph: characterJumpStep3OfflineGraph,
  description: "Sine oscillator with amplitude envelope and rising pitch sweep for upward motion.",
  category: "Character",
  tags: ["jump", "tutorial", "step3", "sweep"],
  signalChain: "Sine Oscillator (Pitch Sweep) -> Amplitude Envelope -> Destination",
  params: [
    { name: "baseFreq", min: 300, max: 600, unit: "Hz" },
    { name: "sweepRange", min: 200, max: 800, unit: "Hz" },
    { name: "sweepDuration", min: 0.05, max: 0.15, unit: "s" },
    { name: "attack", min: 0.002, max: 0.01, unit: "s" },
    { name: "decay", min: 0.05, max: 0.2, unit: "s" },
  ],
  getParams: (rng) => {
    const p = getCharacterJumpStep3Params(rng);
    return {
      baseFreq: p.baseFreq, sweepRange: p.sweepRange,
      sweepDuration: p.sweepDuration, attack: p.attack, decay: p.decay,
    };
  },
});

// ── character-jump-step4 (osc + envelope + sweep + noise) ─────────

function characterJumpStep4Duration(rng: Rng): number {
  const params = getCharacterJumpStep4Params(rng);
  return params.attack + params.decay;
}

function characterJumpStep4OfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCharacterJumpStep4Params(rng);

  // Sine oscillator with rising pitch sweep
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(params.baseFreq, 0);
  osc.frequency.linearRampToValueAtTime(
    params.baseFreq + params.sweepRange,
    params.sweepDuration,
  );

  // Amplitude envelope for the tonal sweep
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0, 0);
  oscGain.gain.linearRampToValueAtTime(1, params.attack);
  oscGain.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  // Noise burst for impact texture (no filter -- raw white noise)
  const noiseBufferSize = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, noiseBufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);

  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  // Noise level control
  const noiseLevel = ctx.createGain();
  noiseLevel.gain.value = params.noiseLevel;

  // Noise amplitude envelope (shorter than tonal component)
  const noiseAmpGain = ctx.createGain();
  noiseAmpGain.gain.setValueAtTime(0, 0);
  noiseAmpGain.gain.linearRampToValueAtTime(1, params.attack);
  noiseAmpGain.gain.linearRampToValueAtTime(0, params.attack + params.noiseDecay);

  noiseSrc.connect(noiseLevel);
  noiseLevel.connect(noiseAmpGain);
  noiseAmpGain.connect(ctx.destination);

  // Schedule
  osc.start(0);
  noiseSrc.start(0);
  osc.stop(duration);
  noiseSrc.stop(duration);
}

registry.register("character-jump-step4", {
  factoryLoader: async () => (await import("./character-jump-step4.js")).createCharacterJumpStep4,
  getDuration: characterJumpStep4Duration,
  buildOfflineGraph: characterJumpStep4OfflineGraph,
  description: "Sine oscillator with envelope, pitch sweep, and unfiltered white noise burst.",
  category: "Character",
  tags: ["jump", "tutorial", "step4", "noise"],
  signalChain: "Sine Oscillator (Pitch Sweep) + White Noise -> Amplitude Envelope -> Destination",
  params: [
    { name: "baseFreq", min: 300, max: 600, unit: "Hz" },
    { name: "sweepRange", min: 200, max: 800, unit: "Hz" },
    { name: "sweepDuration", min: 0.05, max: 0.15, unit: "s" },
    { name: "noiseLevel", min: 0.1, max: 0.4, unit: "amplitude" },
    { name: "noiseDecay", min: 0.02, max: 0.08, unit: "s" },
    { name: "attack", min: 0.002, max: 0.01, unit: "s" },
    { name: "decay", min: 0.05, max: 0.2, unit: "s" },
  ],
  getParams: (rng) => {
    const p = getCharacterJumpStep4Params(rng);
    return {
      baseFreq: p.baseFreq, sweepRange: p.sweepRange,
      sweepDuration: p.sweepDuration, noiseLevel: p.noiseLevel,
      noiseDecay: p.noiseDecay, attack: p.attack, decay: p.decay,
    };
  },
});

// ── character-jump ────────────────────────────────────────────────

function characterJumpDuration(rng: Rng): number {
  const params = getCharacterJumpParams(rng);
  return params.attack + params.decay;
}

function characterJumpOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCharacterJumpParams(rng);

  // Sine oscillator with rising pitch sweep
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(params.baseFreq, 0);
  osc.frequency.linearRampToValueAtTime(
    params.baseFreq + params.sweepRange,
    params.sweepDuration,
  );

  // Amplitude envelope for the tonal sweep
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0, 0);
  oscGain.gain.linearRampToValueAtTime(1, params.attack);
  oscGain.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  // Noise burst for impact texture
  const noiseBufferSize = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, noiseBufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);

  // Use RNG to fill noise buffer deterministically (RNG already advanced
  // by getCharacterJumpParams, so subsequent calls are seed-unique)
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  // Lowpass filter for noise shaping
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = params.filterCutoff;

  // Noise level control
  const noiseLevel = ctx.createGain();
  noiseLevel.gain.value = params.noiseLevel;

  // Noise amplitude envelope (shorter than tonal component)
  const noiseAmpGain = ctx.createGain();
  noiseAmpGain.gain.setValueAtTime(0, 0);
  noiseAmpGain.gain.linearRampToValueAtTime(1, params.attack);
  noiseAmpGain.gain.linearRampToValueAtTime(0, params.attack + params.noiseDecay);

  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseLevel);
  noiseLevel.connect(noiseAmpGain);
  noiseAmpGain.connect(ctx.destination);

  // Schedule
  osc.start(0);
  noiseSrc.start(0);
  osc.stop(duration);
  noiseSrc.stop(duration);
}

registry.register("character-jump", {
  factoryLoader: async () => (await import("./character-jump.js")).createCharacterJump,
  getDuration: characterJumpDuration,
  buildOfflineGraph: characterJumpOfflineGraph,
  description: "Springy jump sound using a rising pitch sweep with a filtered noise burst for impact.",
  category: "Character",
  tags: ["jump", "hop", "platformer", "character", "action"],
  signalChain: "Sine Oscillator (Pitch Sweep) + White Noise -> Lowpass Filter -> Amplitude Envelope -> Destination",
  params: [
    { name: "baseFreq", min: 300, max: 600, unit: "Hz" },
    { name: "sweepRange", min: 200, max: 800, unit: "Hz" },
    { name: "sweepDuration", min: 0.05, max: 0.15, unit: "s" },
    { name: "noiseLevel", min: 0.1, max: 0.4, unit: "amplitude" },
    { name: "noiseDecay", min: 0.02, max: 0.08, unit: "s" },
    { name: "attack", min: 0.002, max: 0.01, unit: "s" },
    { name: "decay", min: 0.05, max: 0.2, unit: "s" },
    { name: "filterCutoff", min: 1500, max: 5000, unit: "Hz" },
  ],
  getParams: (rng) => {
    const p = getCharacterJumpParams(rng);
    return {
      baseFreq: p.baseFreq, sweepRange: p.sweepRange,
      sweepDuration: p.sweepDuration, noiseLevel: p.noiseLevel,
      noiseDecay: p.noiseDecay, attack: p.attack,
      decay: p.decay, filterCutoff: p.filterCutoff,
    };
  },
});

// ── impact-crack ──────────────────────────────────────────────────

function impactCrackDuration(rng: Rng): number {
  const params = getImpactCrackParams(rng);
  return params.attack + params.decay;
}

function impactCrackOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getImpactCrackParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // White noise source
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  // Highpass filter for crack brightness
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = params.filterFreq;
  filter.Q.value = params.filterQ;

  // Level gain
  const gain = ctx.createGain();
  gain.gain.value = params.level;

  // Amplitude envelope
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, 0);
  env.gain.linearRampToValueAtTime(1, params.attack);
  env.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  // Connect
  noiseSrc.connect(filter);
  filter.connect(gain);
  gain.connect(env);
  env.connect(ctx.destination);

  // Schedule
  noiseSrc.start(0);
  noiseSrc.stop(duration);
}

registry.register("impact-crack", {
  factoryLoader: async () => (await import("./impact-crack.js")).createImpactCrack,
  getDuration: impactCrackDuration,
  buildOfflineGraph: impactCrackOfflineGraph,
  description: "Short, sharp transient crack for explosion attack layers using highpass-filtered noise with fast decay.",
  category: "Impact",
  tags: ["impact", "crack", "transient", "explosion", "stacking"],
  signalChain: "White Noise -> Highpass Filter -> Gain -> Amplitude Envelope -> Destination",
  params: [
    { name: "filterFreq", min: 2000, max: 6000, unit: "Hz" },
    { name: "filterQ", min: 0.5, max: 3, unit: "Q" },
    { name: "attack", min: 0.001, max: 0.003, unit: "s" },
    { name: "decay", min: 0.04, max: 0.1, unit: "s" },
    { name: "level", min: 0.7, max: 1.0, unit: "amplitude" },
    { name: "noiseColorMix", min: 0.0, max: 1.0, unit: "ratio" },
  ],
  getParams: (rng) => {
    const p = getImpactCrackParams(rng);
    return {
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      attack: p.attack, decay: p.decay,
      level: p.level, noiseColorMix: p.noiseColorMix,
    };
  },
});

// ── rumble-body ───────────────────────────────────────────────────

function rumbleBodyDuration(rng: Rng): number {
  const params = getRumbleBodyParams(rng);
  return params.attack + params.sustainDecay + params.tailDecay;
}

function rumbleBodyOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getRumbleBodyParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Brown noise body layer
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  let brownState = 0;
  for (let i = 0; i < noiseData.length; i++) {
    brownState += rng() * 2 - 1;
    brownState *= 0.998;
    noiseData[i] = brownState * 0.1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  // Lowpass filter
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = params.filterFreq;
  filter.Q.value = params.filterQ;

  // Level gain
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = params.level;

  // Noise amplitude envelope
  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, 0);
  noiseEnv.gain.linearRampToValueAtTime(1, params.attack);
  noiseEnv.gain.linearRampToValueAtTime(0.3, params.attack + params.sustainDecay);
  noiseEnv.gain.linearRampToValueAtTime(0, params.attack + params.sustainDecay + params.tailDecay);

  noiseSrc.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(noiseEnv);
  noiseEnv.connect(ctx.destination);

  // Sub bass oscillator layer
  const subOsc = ctx.createOscillator();
  subOsc.type = "sine";
  subOsc.frequency.value = params.subBassFreq;

  const subGain = ctx.createGain();
  subGain.gain.value = params.subBassLevel;

  const subEnv = ctx.createGain();
  subEnv.gain.setValueAtTime(0, 0);
  subEnv.gain.linearRampToValueAtTime(1, params.attack);
  subEnv.gain.linearRampToValueAtTime(0, params.attack + params.sustainDecay + params.tailDecay);

  subOsc.connect(subGain);
  subGain.connect(subEnv);
  subEnv.connect(ctx.destination);

  // Schedule
  noiseSrc.start(0);
  subOsc.start(0);
  noiseSrc.stop(duration);
  subOsc.stop(duration);
}

registry.register("rumble-body", {
  factoryLoader: async () => (await import("./rumble-body.js")).createRumbleBody,
  getDuration: rumbleBodyDuration,
  buildOfflineGraph: rumbleBodyOfflineGraph,
  description: "Low-frequency rumble body for explosion layers using filtered brown noise with sub-bass oscillator.",
  category: "Impact",
  tags: ["impact", "rumble", "body", "explosion", "stacking", "bass"],
  signalChain: "Brown Noise -> Lowpass Filter + Sine Oscillator (Sub Bass) -> Amplitude Envelopes -> Destination",
  params: [
    { name: "filterFreq", min: 60, max: 200, unit: "Hz" },
    { name: "filterQ", min: 0.5, max: 2.5, unit: "Q" },
    { name: "attack", min: 0.005, max: 0.02, unit: "s" },
    { name: "sustainDecay", min: 0.4, max: 1.2, unit: "s" },
    { name: "tailDecay", min: 0.1, max: 0.3, unit: "s" },
    { name: "level", min: 0.6, max: 1.0, unit: "amplitude" },
    { name: "subBassFreq", min: 30, max: 60, unit: "Hz" },
    { name: "subBassLevel", min: 0.2, max: 0.5, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getRumbleBodyParams(rng);
    return {
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      attack: p.attack, sustainDecay: p.sustainDecay,
      tailDecay: p.tailDecay, level: p.level,
      subBassFreq: p.subBassFreq, subBassLevel: p.subBassLevel,
    };
  },
});

// ── debris-tail ──────────────────────────────────────────────────

function debrisTailDuration(rng: Rng): number {
  const params = getDebrisTailParams(rng);
  return params.durationEnvelope;
}

function debrisTailOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getDebrisTailParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Generate granular noise: create noise buffer with amplitude modulation
  // to simulate individual debris particles
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);

  const grainPeriodSamples = Math.floor(ctx.sampleRate / params.grainRate);
  const grainDecaySamples = Math.floor(ctx.sampleRate * params.grainDecay);

  for (let i = 0; i < noiseData.length; i++) {
    const rawNoise = rng() * 2 - 1;
    // Grain envelope: create periodic bursts that decay
    const posInGrain = i % grainPeriodSamples;
    const grainAmp = posInGrain < grainDecaySamples
      ? 1.0 - (posInGrain / grainDecaySamples)
      : 0.0;
    // Overall density decay: exponential fade
    const timeNorm = i / bufferSize;
    const densityAmp = Math.exp(-timeNorm * params.densityDecay);
    // Random per-grain skip for irregularity
    const grainIndex = Math.floor(i / grainPeriodSamples);
    // Use a simple hash to decide if this grain plays
    const grainHash = Math.sin(grainIndex * 127.1 + params.grainRate) * 43758.5453;
    const grainActive = (grainHash - Math.floor(grainHash)) > 0.3 ? 1.0 : 0.0;

    noiseData[i] = rawNoise * grainAmp * densityAmp * grainActive;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  // Bandpass filter for debris character
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = params.filterFreq;
  filter.Q.value = params.filterQ;

  // Level gain
  const gain = ctx.createGain();
  gain.gain.value = params.level;

  noiseSrc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  // Schedule
  noiseSrc.start(0);
  noiseSrc.stop(duration);
}

registry.register("debris-tail", {
  factoryLoader: async () => (await import("./debris-tail.js")).createDebrisTail,
  getDuration: debrisTailDuration,
  buildOfflineGraph: debrisTailOfflineGraph,
  description: "Scattered debris crackle tail for explosion layers using granular noise bursts with decreasing density.",
  category: "Impact",
  tags: ["impact", "debris", "tail", "explosion", "stacking", "granular"],
  signalChain: "Granular White Noise (Amplitude Modulated) -> Bandpass Filter -> Gain -> Destination",
  params: [
    { name: "grainRate", min: 20, max: 80, unit: "Hz" },
    { name: "grainDecay", min: 0.002, max: 0.008, unit: "s" },
    { name: "filterFreq", min: 1000, max: 4000, unit: "Hz" },
    { name: "filterQ", min: 0.5, max: 3, unit: "Q" },
    { name: "durationEnvelope", min: 0.5, max: 1.8, unit: "s" },
    { name: "densityDecay", min: 2.0, max: 5.0, unit: "rate" },
    { name: "level", min: 0.4, max: 0.8, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getDebrisTailParams(rng);
    return {
      grainRate: p.grainRate, grainDecay: p.grainDecay,
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      durationEnvelope: p.durationEnvelope, densityDecay: p.densityDecay,
      level: p.level,
    };
  },
});

// ── slam-transient ───────────────────────────────────────────────

function slamTransientDuration(rng: Rng): number {
  const params = getSlamTransientParams(rng);
  return params.attack + params.decay;
}

function slamTransientOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getSlamTransientParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Thud layer: bandpass-filtered noise
  const thudBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const thudData = thudBuffer.getChannelData(0);
  for (let i = 0; i < thudData.length; i++) {
    thudData[i] = rng() * 2 - 1;
  }

  const thudSrc = ctx.createBufferSource();
  thudSrc.buffer = thudBuffer;

  const thudFilter = ctx.createBiquadFilter();
  thudFilter.type = "bandpass";
  thudFilter.frequency.value = params.filterFreq;
  thudFilter.Q.value = params.filterQ;

  const thudGain = ctx.createGain();
  thudGain.gain.value = params.level;

  const thudEnv = ctx.createGain();
  thudEnv.gain.setValueAtTime(0, 0);
  thudEnv.gain.linearRampToValueAtTime(1, params.attack);
  thudEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  thudSrc.connect(thudFilter);
  thudFilter.connect(thudGain);
  thudGain.connect(thudEnv);
  thudEnv.connect(ctx.destination);

  // Click layer: highpass-filtered noise
  const clickBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const clickData = clickBuffer.getChannelData(0);
  for (let i = 0; i < clickData.length; i++) {
    clickData[i] = rng() * 2 - 1;
  }

  const clickSrc = ctx.createBufferSource();
  clickSrc.buffer = clickBuffer;

  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type = "highpass";
  clickFilter.frequency.value = params.clickFreq;

  const clickGain = ctx.createGain();
  clickGain.gain.value = params.clickLevel;

  const clickEnv = ctx.createGain();
  clickEnv.gain.setValueAtTime(0, 0);
  clickEnv.gain.linearRampToValueAtTime(1, params.attack);
  clickEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay * 0.5);

  clickSrc.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(clickEnv);
  clickEnv.connect(ctx.destination);

  // Schedule
  thudSrc.start(0);
  clickSrc.start(0);
  thudSrc.stop(duration);
  clickSrc.stop(duration);
}

registry.register("slam-transient", {
  factoryLoader: async () => (await import("./slam-transient.js")).createSlamTransient,
  getDuration: slamTransientDuration,
  buildOfflineGraph: slamTransientOfflineGraph,
  description: "Short door impact transient using bandpass-filtered noise thud with highpass click component.",
  category: "Impact",
  tags: ["impact", "slam", "transient", "door", "stacking"],
  signalChain: "White Noise -> Bandpass Filter (Thud) + White Noise -> Highpass Filter (Click) -> Amplitude Envelopes -> Destination",
  params: [
    { name: "filterFreq", min: 300, max: 1200, unit: "Hz" },
    { name: "filterQ", min: 2, max: 8, unit: "Q" },
    { name: "attack", min: 0.001, max: 0.003, unit: "s" },
    { name: "decay", min: 0.025, max: 0.07, unit: "s" },
    { name: "level", min: 0.7, max: 1.0, unit: "amplitude" },
    { name: "clickLevel", min: 0.3, max: 0.7, unit: "amplitude" },
    { name: "clickFreq", min: 3000, max: 6000, unit: "Hz" },
  ],
  getParams: (rng) => {
    const p = getSlamTransientParams(rng);
    return {
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      attack: p.attack, decay: p.decay,
      level: p.level, clickLevel: p.clickLevel,
      clickFreq: p.clickFreq,
    };
  },
});

// ── resonance-body ───────────────────────────────────────────────

function resonanceBodyDuration(rng: Rng): number {
  const params = getResonanceBodyParams(rng);
  return params.attack + Math.max(params.fundamentalDecay, params.overtoneDecay);
}

function resonanceBodyOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getResonanceBodyParams(rng);

  // Fundamental sine oscillator
  const fundOsc = ctx.createOscillator();
  fundOsc.type = "sine";
  fundOsc.frequency.value = params.fundamentalFreq;

  const fundGain = ctx.createGain();
  fundGain.gain.value = params.level;

  const fundEnv = ctx.createGain();
  fundEnv.gain.setValueAtTime(0, 0);
  fundEnv.gain.linearRampToValueAtTime(1, params.attack);
  fundEnv.gain.linearRampToValueAtTime(0, params.attack + params.fundamentalDecay);

  fundOsc.connect(fundGain);
  fundGain.connect(fundEnv);
  fundEnv.connect(ctx.destination);

  // Overtone sine oscillator
  const overtoneOsc = ctx.createOscillator();
  overtoneOsc.type = "sine";
  overtoneOsc.frequency.value = params.fundamentalFreq * params.overtoneRatio;

  const overtoneGain = ctx.createGain();
  overtoneGain.gain.value = params.overtoneLevel;

  const overtoneEnv = ctx.createGain();
  overtoneEnv.gain.setValueAtTime(0, 0);
  overtoneEnv.gain.linearRampToValueAtTime(1, params.attack);
  overtoneEnv.gain.linearRampToValueAtTime(0, params.attack + params.overtoneDecay);

  overtoneOsc.connect(overtoneGain);
  overtoneGain.connect(overtoneEnv);
  overtoneEnv.connect(ctx.destination);

  // Schedule
  fundOsc.start(0);
  overtoneOsc.start(0);
  fundOsc.stop(duration);
  overtoneOsc.stop(duration);
}

registry.register("resonance-body", {
  factoryLoader: async () => (await import("./resonance-body.js")).createResonanceBody,
  getDuration: resonanceBodyDuration,
  buildOfflineGraph: resonanceBodyOfflineGraph,
  description: "Woody/metallic resonance body for door slam layers using damped sine oscillators at harmonic frequencies.",
  category: "Impact",
  tags: ["impact", "resonance", "body", "door", "stacking", "tonal"],
  signalChain: "Sine Oscillator (Fundamental) + Sine Oscillator (Overtone) -> Amplitude Envelopes -> Destination",
  params: [
    { name: "fundamentalFreq", min: 80, max: 250, unit: "Hz" },
    { name: "overtoneRatio", min: 1.5, max: 3.5, unit: "ratio" },
    { name: "fundamentalDecay", min: 0.15, max: 0.6, unit: "s" },
    { name: "overtoneDecay", min: 0.08, max: 0.3, unit: "s" },
    { name: "overtoneLevel", min: 0.2, max: 0.5, unit: "amplitude" },
    { name: "level", min: 0.6, max: 1.0, unit: "amplitude" },
    { name: "attack", min: 0.001, max: 0.005, unit: "s" },
  ],
  getParams: (rng) => {
    const p = getResonanceBodyParams(rng);
    return {
      fundamentalFreq: p.fundamentalFreq, overtoneRatio: p.overtoneRatio,
      fundamentalDecay: p.fundamentalDecay, overtoneDecay: p.overtoneDecay,
      overtoneLevel: p.overtoneLevel, level: p.level,
      attack: p.attack,
    };
  },
});

// ── rattle-decay ─────────────────────────────────────────────────

function rattleDecayDuration(rng: Rng): number {
  const params = getRattleDecayParams(rng);
  return params.duration;
}

function rattleDecayOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getRattleDecayParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Generate granular noise: small bursts with irregular timing
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);

  const rattlePeriodSamples = Math.floor(ctx.sampleRate / params.rattleRate);
  const rattleDecaySamples = Math.floor(ctx.sampleRate * params.rattleDecay);

  for (let i = 0; i < noiseData.length; i++) {
    const rawNoise = rng() * 2 - 1;
    // Rattle grain envelope
    const posInGrain = i % rattlePeriodSamples;
    const grainAmp = posInGrain < rattleDecaySamples
      ? 1.0 - (posInGrain / rattleDecaySamples)
      : 0.0;
    // Overall density decay
    const timeNorm = i / bufferSize;
    const densityAmp = Math.exp(-timeNorm * params.densityDecay);
    // Random grain skip for irregularity
    const grainIndex = Math.floor(i / rattlePeriodSamples);
    const grainHash = Math.sin(grainIndex * 131.7 + params.rattleRate) * 43758.5453;
    const grainActive = (grainHash - Math.floor(grainHash)) > 0.25 ? 1.0 : 0.0;

    noiseData[i] = rawNoise * grainAmp * densityAmp * grainActive;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  // Bandpass filter for rattle character
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = params.filterFreq;
  filter.Q.value = params.filterQ;

  // Level gain
  const gain = ctx.createGain();
  gain.gain.value = params.level;

  noiseSrc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  // Schedule
  noiseSrc.start(0);
  noiseSrc.stop(duration);
}

registry.register("rattle-decay", {
  factoryLoader: async () => (await import("./rattle-decay.js")).createRattleDecay,
  getDuration: rattleDecayDuration,
  buildOfflineGraph: rattleDecayOfflineGraph,
  description: "Rattling/settling decay for door slam tail layers using granular noise bursts with irregular timing.",
  category: "Impact",
  tags: ["impact", "rattle", "decay", "door", "stacking", "granular"],
  signalChain: "Granular White Noise (Amplitude Modulated) -> Bandpass Filter -> Gain -> Destination",
  params: [
    { name: "rattleRate", min: 30, max: 100, unit: "Hz" },
    { name: "rattleDecay", min: 0.001, max: 0.004, unit: "s" },
    { name: "filterFreq", min: 2000, max: 5000, unit: "Hz" },
    { name: "filterQ", min: 1, max: 5, unit: "Q" },
    { name: "duration", min: 0.15, max: 0.45, unit: "s" },
    { name: "densityDecay", min: 3.0, max: 6.0, unit: "rate" },
    { name: "level", min: 0.3, max: 0.7, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getRattleDecayParams(rng);
    return {
      rattleRate: p.rattleRate, rattleDecay: p.rattleDecay,
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      duration: p.duration, densityDecay: p.densityDecay,
      level: p.level,
    };
  },
});

// ── card-flip ─────────────────────────────────────────────────────

function cardFlipDuration(rng: Rng): number {
  const params = getCardFlipParams(rng);
  return params.attack + params.decay;
}

function cardFlipOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardFlipParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Noise layer: bandpass-filtered white noise for the "flick" texture
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = params.filterFreq;
  noiseFilter.Q.value = params.filterQ;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = params.noiseLevel;

  // Noise amplitude envelope
  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, 0);
  noiseEnv.gain.linearRampToValueAtTime(1, params.attack);
  noiseEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(noiseEnv);
  noiseEnv.connect(ctx.destination);

  // Click layer: short sine transient for the snap
  const clickOsc = ctx.createOscillator();
  clickOsc.type = "sine";
  clickOsc.frequency.value = params.clickFreq;

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(params.clickLevel, 0);
  clickGain.gain.linearRampToValueAtTime(0, Math.min(0.01, duration));

  clickOsc.connect(clickGain);
  clickGain.connect(ctx.destination);

  // Schedule
  noiseSrc.start(0);
  noiseSrc.stop(duration);
  clickOsc.start(0);
  clickOsc.stop(duration);
}

registry.register("card-flip", {
  factoryLoader: async () => (await import("./card-flip.js")).createCardFlip,
  getDuration: cardFlipDuration,
  buildOfflineGraph: cardFlipOfflineGraph,
  description: "Stylized card flip sound using bandpass-filtered noise burst with a sine click transient.",
  category: "Card Game",
  tags: ["card", "flip", "card-game", "manipulation", "arcade"],
  signalChain: "White Noise -> Bandpass Filter -> Gain -> Envelope + Sine Oscillator -> Click Gain -> Destination",
  params: [
    { name: "filterFreq", min: 800, max: 2500, unit: "Hz" },
    { name: "filterQ", min: 1.5, max: 5, unit: "Q" },
    { name: "attack", min: 0.001, max: 0.005, unit: "s" },
    { name: "decay", min: 0.03, max: 0.12, unit: "s" },
    { name: "noiseLevel", min: 0.5, max: 0.9, unit: "amplitude" },
    { name: "clickFreq", min: 600, max: 1200, unit: "Hz" },
    { name: "clickLevel", min: 0.3, max: 0.7, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardFlipParams(rng);
    return {
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      attack: p.attack, decay: p.decay,
      noiseLevel: p.noiseLevel, clickFreq: p.clickFreq,
      clickLevel: p.clickLevel,
    };
  },
});

// ── card-slide ────────────────────────────────────────────────────

function cardSlideDuration(rng: Rng): number {
  const params = getCardSlideParams(rng);
  return params.attack + params.decay;
}

function cardSlideOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardSlideParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Tonal layer: sine oscillator with downward frequency sweep
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(params.startFreq, 0);
  osc.frequency.linearRampToValueAtTime(
    params.startFreq - params.sweepRange,
    duration,
  );

  // Lowpass filter for warmth
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = params.filterCutoff;

  // Tonal amplitude envelope
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0, 0);
  oscGain.gain.linearRampToValueAtTime(1, params.attack);
  oscGain.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc.connect(filter);
  filter.connect(oscGain);
  oscGain.connect(ctx.destination);

  // Noise undertone: gentle surface friction texture
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = params.filterCutoff * 0.5;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = params.noiseLevel;

  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, 0);
  noiseEnv.gain.linearRampToValueAtTime(1, params.attack);
  noiseEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(noiseEnv);
  noiseEnv.connect(ctx.destination);

  // Schedule
  osc.start(0);
  osc.stop(duration);
  noiseSrc.start(0);
  noiseSrc.stop(duration);
}

registry.register("card-slide", {
  factoryLoader: async () => (await import("./card-slide.js")).createCardSlide,
  getDuration: cardSlideDuration,
  buildOfflineGraph: cardSlideOfflineGraph,
  description: "Smooth card slide sound using sine sweep with filtered noise undertone for surface friction.",
  category: "Card Game",
  tags: ["card", "slide", "card-game", "manipulation", "tonal", "arcade"],
  signalChain: "Sine Oscillator (Freq Sweep) -> Lowpass Filter -> Envelope + White Noise -> Lowpass Filter -> Noise Gain -> Envelope -> Destination",
  params: [
    { name: "startFreq", min: 500, max: 1000, unit: "Hz" },
    { name: "sweepRange", min: 100, max: 400, unit: "Hz" },
    { name: "attack", min: 0.001, max: 0.008, unit: "s" },
    { name: "decay", min: 0.06, max: 0.2, unit: "s" },
    { name: "filterCutoff", min: 1000, max: 3000, unit: "Hz" },
    { name: "noiseLevel", min: 0.1, max: 0.35, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardSlideParams(rng);
    return {
      startFreq: p.startFreq, sweepRange: p.sweepRange,
      attack: p.attack, decay: p.decay,
      filterCutoff: p.filterCutoff, noiseLevel: p.noiseLevel,
    };
  },
});

// ── card-place ────────────────────────────────────────────────────

function cardPlaceDuration(rng: Rng): number {
  const params = getCardPlaceParams(rng);
  return params.attack + params.bodyDecay;
}

function cardPlaceOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardPlaceParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Body layer: lowpass-filtered noise for the soft thud
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const bodyFilter = ctx.createBiquadFilter();
  bodyFilter.type = "lowpass";
  bodyFilter.frequency.value = params.filterFreq;
  bodyFilter.Q.value = params.filterQ;

  const bodyGain = ctx.createGain();
  bodyGain.gain.value = params.bodyLevel;

  // Body amplitude envelope
  const bodyEnv = ctx.createGain();
  bodyEnv.gain.setValueAtTime(0, 0);
  bodyEnv.gain.linearRampToValueAtTime(1, params.attack);
  bodyEnv.gain.linearRampToValueAtTime(0, params.attack + params.bodyDecay);

  noiseSrc.connect(bodyFilter);
  bodyFilter.connect(bodyGain);
  bodyGain.connect(bodyEnv);
  bodyEnv.connect(ctx.destination);

  // Click layer: subtle sine tap accent
  const clickOsc = ctx.createOscillator();
  clickOsc.type = "sine";
  clickOsc.frequency.value = params.clickFreq;

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(params.clickLevel, 0);
  clickGain.gain.linearRampToValueAtTime(0, Math.min(0.008, duration));

  clickOsc.connect(clickGain);
  clickGain.connect(ctx.destination);

  // Schedule
  noiseSrc.start(0);
  noiseSrc.stop(duration);
  clickOsc.start(0);
  clickOsc.stop(duration);
}

registry.register("card-place", {
  factoryLoader: async () => (await import("./card-place.js")).createCardPlace,
  getDuration: cardPlaceDuration,
  buildOfflineGraph: cardPlaceOfflineGraph,
  description: "Soft card placement thud using lowpass-filtered noise with a subtle sine tap accent.",
  category: "Card Game",
  tags: ["card", "place", "card-game", "manipulation", "impact", "arcade"],
  signalChain: "White Noise -> Lowpass Filter -> Body Gain -> Envelope + Sine Oscillator -> Click Gain -> Destination",
  params: [
    { name: "filterFreq", min: 300, max: 900, unit: "Hz" },
    { name: "filterQ", min: 1, max: 4, unit: "Q" },
    { name: "attack", min: 0.001, max: 0.004, unit: "s" },
    { name: "bodyDecay", min: 0.03, max: 0.1, unit: "s" },
    { name: "bodyLevel", min: 0.5, max: 0.9, unit: "amplitude" },
    { name: "clickFreq", min: 400, max: 800, unit: "Hz" },
    { name: "clickLevel", min: 0.15, max: 0.4, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardPlaceParams(rng);
    return {
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      attack: p.attack, bodyDecay: p.bodyDecay,
      bodyLevel: p.bodyLevel, clickFreq: p.clickFreq,
      clickLevel: p.clickLevel,
    };
  },
});

// ── card-draw ─────────────────────────────────────────────────────

function cardDrawDuration(rng: Rng): number {
  const params = getCardDrawParams(rng);
  return params.attack + params.decay;
}

function cardDrawOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardDrawParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Noise layer: highpass-filtered white noise for the swipe
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.value = params.filterFreq;
  noiseFilter.Q.value = params.filterQ;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = params.noiseLevel;

  // Noise amplitude envelope
  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, 0);
  noiseEnv.gain.linearRampToValueAtTime(1, params.attack);
  noiseEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(noiseEnv);
  noiseEnv.connect(ctx.destination);

  // Tonal accent: ascending sine sweep for lift-off feel
  const sweepOsc = ctx.createOscillator();
  sweepOsc.type = "sine";
  sweepOsc.frequency.setValueAtTime(params.sweepBaseFreq, 0);
  sweepOsc.frequency.linearRampToValueAtTime(
    params.sweepBaseFreq + params.sweepRange,
    duration,
  );

  const sweepGain = ctx.createGain();
  sweepGain.gain.setValueAtTime(0, 0);
  sweepGain.gain.linearRampToValueAtTime(params.sweepLevel, params.attack);
  sweepGain.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  sweepOsc.connect(sweepGain);
  sweepGain.connect(ctx.destination);

  // Schedule
  noiseSrc.start(0);
  noiseSrc.stop(duration);
  sweepOsc.start(0);
  sweepOsc.stop(duration);
}

registry.register("card-draw", {
  factoryLoader: async () => (await import("./card-draw.js")).createCardDraw,
  getDuration: cardDrawDuration,
  buildOfflineGraph: cardDrawOfflineGraph,
  description: "Quick card draw sound with highpass-filtered noise swipe and ascending sine sweep accent.",
  category: "Card Game",
  tags: ["card", "draw", "card-game", "manipulation", "swipe", "arcade"],
  signalChain: "White Noise -> Highpass Filter -> Noise Gain -> Envelope + Sine Oscillator (Ascending Sweep) -> Sweep Gain -> Destination",
  params: [
    { name: "filterFreq", min: 1200, max: 3000, unit: "Hz" },
    { name: "filterQ", min: 0.5, max: 2.5, unit: "Q" },
    { name: "attack", min: 0.001, max: 0.005, unit: "s" },
    { name: "decay", min: 0.04, max: 0.15, unit: "s" },
    { name: "noiseLevel", min: 0.3, max: 0.7, unit: "amplitude" },
    { name: "sweepBaseFreq", min: 400, max: 800, unit: "Hz" },
    { name: "sweepRange", min: 200, max: 600, unit: "Hz" },
    { name: "sweepLevel", min: 0.3, max: 0.6, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardDrawParams(rng);
    return {
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      attack: p.attack, decay: p.decay,
      noiseLevel: p.noiseLevel, sweepBaseFreq: p.sweepBaseFreq,
      sweepRange: p.sweepRange, sweepLevel: p.sweepLevel,
    };
  },
});

// ── card-shuffle ──────────────────────────────────────────────────

function cardShuffleDuration(rng: Rng): number {
  const params = getCardShuffleParams(rng);
  return params.attack + params.decay;
}

function cardShuffleOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardShuffleParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // White noise source for the flutter texture
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  // Bandpass filter for card shuffle character
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = params.filterFreq;
  filter.Q.value = params.filterQ;

  // Amplitude modulation for grain flutter effect
  // LFO oscillator modulates amplitude at grainRate
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = params.grainRate;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = params.grainDepth * 0.5;

  const modOffset = ctx.createGain();
  modOffset.gain.value = 1.0 - params.grainDepth * 0.5;

  // Overall noise level
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = params.noiseLevel;

  // Amplitude envelope with decay
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, 0);
  env.gain.linearRampToValueAtTime(1, params.attack);
  env.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  // Signal chain: noise -> filter -> noiseGain -> env -> destination
  // LFO modulates env gain for flutter effect
  noiseSrc.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(env);
  env.connect(modOffset);
  modOffset.connect(ctx.destination);

  // LFO -> lfoGain -> destination (additive AM on the modOffset output)
  lfo.connect(lfoGain);
  lfoGain.connect(modOffset.gain);

  // Schedule
  noiseSrc.start(0);
  noiseSrc.stop(duration);
  lfo.start(0);
  lfo.stop(duration);
}

registry.register("card-shuffle", {
  factoryLoader: async () => (await import("./card-shuffle.js")).createCardShuffle,
  getDuration: cardShuffleDuration,
  buildOfflineGraph: cardShuffleOfflineGraph,
  description: "Rapid card shuffle riffle using bandpass-filtered noise with amplitude-modulated grain flutter.",
  category: "Card Game",
  tags: ["card", "shuffle", "card-game", "manipulation", "granular", "arcade"],
  signalChain: "White Noise -> Bandpass Filter -> Gain -> Envelope -> AM (LFO Grain Flutter) -> Destination",
  params: [
    { name: "filterFreq", min: 600, max: 2000, unit: "Hz" },
    { name: "filterQ", min: 1, max: 4, unit: "Q" },
    { name: "attack", min: 0.002, max: 0.008, unit: "s" },
    { name: "decay", min: 0.15, max: 0.4, unit: "s" },
    { name: "grainRate", min: 20, max: 60, unit: "Hz" },
    { name: "grainDepth", min: 0.3, max: 0.8, unit: "depth" },
    { name: "noiseLevel", min: 0.5, max: 0.9, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardShuffleParams(rng);
    return {
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      attack: p.attack, decay: p.decay,
      grainRate: p.grainRate, grainDepth: p.grainDepth,
      noiseLevel: p.noiseLevel,
    };
  },
});

// ── card-fan ──────────────────────────────────────────────────────

function cardFanDuration(rng: Rng): number {
  const params = getCardFanParams(rng);
  return params.attack + params.decay;
}

function cardFanOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardFanParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Tonal layer: ascending sine sweep for the fan-out gesture
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(params.baseFreq, 0);
  osc.frequency.linearRampToValueAtTime(
    params.baseFreq + params.sweepRange,
    duration,
  );

  // Lowpass filter for smoothness
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = params.filterCutoff;

  // Tonal amplitude envelope
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0, 0);
  oscGain.gain.linearRampToValueAtTime(params.sweepLevel, params.attack);
  oscGain.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc.connect(filter);
  filter.connect(oscGain);
  oscGain.connect(ctx.destination);

  // Noise bed: gentle filtered noise for paper texture
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = params.filterCutoff * 0.6;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = params.noiseLevel;

  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, 0);
  noiseEnv.gain.linearRampToValueAtTime(1, params.attack);
  noiseEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(noiseEnv);
  noiseEnv.connect(ctx.destination);

  // Schedule
  osc.start(0);
  osc.stop(duration);
  noiseSrc.start(0);
  noiseSrc.stop(duration);
}

registry.register("card-fan", {
  factoryLoader: async () => (await import("./card-fan.js")).createCardFan,
  getDuration: cardFanDuration,
  buildOfflineGraph: cardFanOfflineGraph,
  description: "Smooth card fanning sound using ascending sine sweep with gentle filtered noise bed texture.",
  category: "Card Game",
  tags: ["card", "fan", "card-game", "manipulation", "tonal", "arcade"],
  signalChain: "Sine Oscillator (Ascending Sweep) -> Lowpass Filter -> Envelope + White Noise -> Lowpass Filter -> Noise Gain -> Envelope -> Destination",
  params: [
    { name: "baseFreq", min: 400, max: 900, unit: "Hz" },
    { name: "sweepRange", min: 200, max: 600, unit: "Hz" },
    { name: "attack", min: 0.002, max: 0.008, unit: "s" },
    { name: "decay", min: 0.08, max: 0.25, unit: "s" },
    { name: "filterCutoff", min: 1500, max: 4000, unit: "Hz" },
    { name: "noiseLevel", min: 0.1, max: 0.3, unit: "amplitude" },
    { name: "sweepLevel", min: 0.4, max: 0.8, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardFanParams(rng);
    return {
      baseFreq: p.baseFreq, sweepRange: p.sweepRange,
      attack: p.attack, decay: p.decay,
      filterCutoff: p.filterCutoff, noiseLevel: p.noiseLevel,
      sweepLevel: p.sweepLevel,
    };
  },
});

// ── card-success ──────────────────────────────────────────────────

function cardSuccessDuration(rng: Rng): number {
  const params = getCardSuccessParams(rng);
  return params.attack + params.decay;
}

function cardSuccessOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardSuccessParams(rng);

  // Primary tone
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = params.baseFreq;

  const gain1 = ctx.createGain();
  gain1.gain.value = params.primaryLevel;

  const env1 = ctx.createGain();
  env1.gain.setValueAtTime(0, 0);
  env1.gain.linearRampToValueAtTime(1, params.attack);
  env1.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc1.connect(gain1);
  gain1.connect(env1);
  env1.connect(ctx.destination);

  // Secondary tone at consonant interval
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = params.baseFreq * params.intervalRatio;

  const gain2 = ctx.createGain();
  gain2.gain.value = params.secondaryLevel;

  const env2 = ctx.createGain();
  env2.gain.setValueAtTime(0, 0);
  env2.gain.linearRampToValueAtTime(1, params.attack);
  env2.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc2.connect(gain2);
  gain2.connect(env2);
  env2.connect(ctx.destination);

  // Schedule
  osc1.start(0);
  osc1.stop(duration);
  osc2.start(0);
  osc2.stop(duration);
}

registry.register("card-success", {
  factoryLoader: async () => (await import("./card-success.js")).createCardSuccess,
  getDuration: cardSuccessDuration,
  buildOfflineGraph: cardSuccessOfflineGraph,
  description: "Bright ascending dual-tone confirmation for positive card game outcomes.",
  category: "Card Game",
  tags: ["card", "success", "card-game", "outcome", "positive", "arcade"],
  signalChain: "Sine Oscillator (Base) + Sine Oscillator (Interval) -> Gain -> Envelope -> Destination",
  params: [
    { name: "baseFreq", min: 600, max: 1100, unit: "Hz" },
    { name: "intervalRatio", min: 1.2, max: 1.5, unit: "ratio" },
    { name: "attack", min: 0.001, max: 0.005, unit: "s" },
    { name: "decay", min: 0.1, max: 0.4, unit: "s" },
    { name: "primaryLevel", min: 0.5, max: 0.9, unit: "amplitude" },
    { name: "secondaryLevel", min: 0.3, max: 0.6, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardSuccessParams(rng);
    return {
      baseFreq: p.baseFreq, intervalRatio: p.intervalRatio,
      attack: p.attack, decay: p.decay,
      primaryLevel: p.primaryLevel, secondaryLevel: p.secondaryLevel,
    };
  },
});

// ── card-failure ──────────────────────────────────────────────────

function cardFailureDuration(rng: Rng): number {
  const params = getCardFailureParams(rng);
  return params.attack + params.decay;
}

function cardFailureOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardFailureParams(rng);

  // Primary descending oscillator
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(params.startFreq, 0);
  osc1.frequency.linearRampToValueAtTime(
    params.startFreq - params.sweepDrop,
    duration,
  );

  const gain1 = ctx.createGain();
  gain1.gain.value = params.primaryLevel;

  const env1 = ctx.createGain();
  env1.gain.setValueAtTime(0, 0);
  env1.gain.linearRampToValueAtTime(1, params.attack);
  env1.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc1.connect(gain1);
  gain1.connect(env1);
  env1.connect(ctx.destination);

  // Detuned secondary oscillator for dissonance
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(params.startFreq + params.detuneOffset, 0);
  osc2.frequency.linearRampToValueAtTime(
    params.startFreq - params.sweepDrop + params.detuneOffset,
    duration,
  );

  const gain2 = ctx.createGain();
  gain2.gain.value = params.secondaryLevel;

  const env2 = ctx.createGain();
  env2.gain.setValueAtTime(0, 0);
  env2.gain.linearRampToValueAtTime(1, params.attack);
  env2.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc2.connect(gain2);
  gain2.connect(env2);
  env2.connect(ctx.destination);

  // Schedule
  osc1.start(0);
  osc1.stop(duration);
  osc2.start(0);
  osc2.stop(duration);
}

registry.register("card-failure", {
  factoryLoader: async () => (await import("./card-failure.js")).createCardFailure,
  getDuration: cardFailureDuration,
  buildOfflineGraph: cardFailureOfflineGraph,
  description: "Descending dissonant tone for negative card game outcomes with detuned beating.",
  category: "Card Game",
  tags: ["card", "failure", "card-game", "outcome", "negative", "arcade"],
  signalChain: "Sine Oscillator (Descending) + Detuned Sine -> Gain -> Envelope -> Destination",
  params: [
    { name: "startFreq", min: 500, max: 900, unit: "Hz" },
    { name: "sweepDrop", min: 100, max: 300, unit: "Hz" },
    { name: "detuneOffset", min: 15, max: 50, unit: "Hz" },
    { name: "attack", min: 0.001, max: 0.005, unit: "s" },
    { name: "decay", min: 0.15, max: 0.5, unit: "s" },
    { name: "primaryLevel", min: 0.5, max: 0.9, unit: "amplitude" },
    { name: "secondaryLevel", min: 0.2, max: 0.5, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardFailureParams(rng);
    return {
      startFreq: p.startFreq, sweepDrop: p.sweepDrop,
      detuneOffset: p.detuneOffset, attack: p.attack,
      decay: p.decay, primaryLevel: p.primaryLevel,
      secondaryLevel: p.secondaryLevel,
    };
  },
});

// ── card-victory-fanfare ──────────────────────────────────────────

function cardVictoryFanfareDuration(rng: Rng): number {
  const params = getCardVictoryFanfareParams(rng);
  return params.noteCount * params.noteDuration + params.tailDecay;
}

function cardVictoryFanfareOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardVictoryFanfareParams(rng);

  // Primary sine oscillator for arpeggio
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = params.baseFreq;

  // Harmonic triangle oscillator at 2x frequency
  const harmOsc = ctx.createOscillator();
  harmOsc.type = "triangle";
  harmOsc.frequency.value = params.baseFreq * 2;

  const oscGain = ctx.createGain();
  oscGain.gain.value = params.primaryLevel;

  const harmGain = ctx.createGain();
  harmGain.gain.value = params.harmonicLevel;

  // Master envelope
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, 0);
  masterGain.gain.linearRampToValueAtTime(1, params.noteAttack);

  const tailStart = params.noteCount * params.noteDuration;
  masterGain.gain.setValueAtTime(1, tailStart);
  masterGain.gain.linearRampToValueAtTime(0, tailStart + params.tailDecay);

  // Schedule ascending arpeggio frequencies
  let freq = params.baseFreq;
  for (let i = 0; i < params.noteCount; i++) {
    const noteTime = i * params.noteDuration;
    osc.frequency.setValueAtTime(freq, noteTime);
    harmOsc.frequency.setValueAtTime(freq * 2, noteTime);
    freq *= params.stepRatio;
  }

  osc.connect(oscGain);
  oscGain.connect(masterGain);
  harmOsc.connect(harmGain);
  harmGain.connect(masterGain);
  masterGain.connect(ctx.destination);

  // Schedule
  osc.start(0);
  osc.stop(duration);
  harmOsc.start(0);
  harmOsc.stop(duration);
}

registry.register("card-victory-fanfare", {
  factoryLoader: async () => (await import("./card-victory-fanfare.js")).createCardVictoryFanfare,
  getDuration: cardVictoryFanfareDuration,
  buildOfflineGraph: cardVictoryFanfareOfflineGraph,
  description: "Ascending multi-note arpeggio fanfare with harmonic reinforcement for card game victories.",
  category: "Card Game",
  tags: ["card", "victory", "fanfare", "card-game", "outcome", "positive", "arcade"],
  signalChain: "Sine Oscillator (Arpeggio) + Triangle Harmonic -> Gain -> Master Envelope -> Destination",
  params: [
    { name: "baseFreq", min: 400, max: 800, unit: "Hz" },
    { name: "noteCount", min: 3, max: 7, unit: "count" },
    { name: "noteDuration", min: 0.15, max: 0.35, unit: "s" },
    { name: "noteAttack", min: 0.005, max: 0.02, unit: "s" },
    { name: "stepRatio", min: 1.1, max: 1.26, unit: "ratio" },
    { name: "primaryLevel", min: 0.5, max: 0.85, unit: "amplitude" },
    { name: "harmonicLevel", min: 0.2, max: 0.5, unit: "amplitude" },
    { name: "tailDecay", min: 0.3, max: 0.8, unit: "s" },
  ],
  getParams: (rng) => {
    const p = getCardVictoryFanfareParams(rng);
    return {
      baseFreq: p.baseFreq, noteCount: p.noteCount,
      noteDuration: p.noteDuration, noteAttack: p.noteAttack,
      stepRatio: p.stepRatio, primaryLevel: p.primaryLevel,
      harmonicLevel: p.harmonicLevel, tailDecay: p.tailDecay,
    };
  },
});

// ── card-defeat-sting ─────────────────────────────────────────────

function cardDefeatStingDuration(rng: Rng): number {
  const params = getCardDefeatStingParams(rng);
  return params.noteDuration * 2 + params.tailDecay;
}

function cardDefeatStingOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardDefeatStingParams(rng);

  // Sine oscillator with descending step
  const osc = ctx.createOscillator();
  osc.type = "sine";

  // First note
  osc.frequency.setValueAtTime(params.startFreq, 0);
  // Second note (minor interval drop)
  osc.frequency.setValueAtTime(
    params.startFreq * params.dropRatio,
    params.noteDuration,
  );

  // Lowpass filter sweeping downward during tail
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(params.filterStart, 0);
  filter.frequency.linearRampToValueAtTime(params.filterEnd, duration);

  const gain = ctx.createGain();
  gain.gain.value = params.level;

  // Amplitude envelope
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, 0);
  env.gain.linearRampToValueAtTime(1, params.noteAttack);
  env.gain.linearRampToValueAtTime(0, duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(env);
  env.connect(ctx.destination);

  // Schedule
  osc.start(0);
  osc.stop(duration);
}

registry.register("card-defeat-sting", {
  factoryLoader: async () => (await import("./card-defeat-sting.js")).createCardDefeatSting,
  getDuration: cardDefeatStingDuration,
  buildOfflineGraph: cardDefeatStingOfflineGraph,
  description: "Descending minor-interval sting with lowpass filter sweep for card game defeat moments.",
  category: "Card Game",
  tags: ["card", "defeat", "sting", "card-game", "outcome", "negative", "arcade"],
  signalChain: "Sine Oscillator (Descending Steps) -> Lowpass Filter (Sweeping) -> Gain -> Envelope -> Destination",
  params: [
    { name: "startFreq", min: 400, max: 700, unit: "Hz" },
    { name: "dropRatio", min: 0.75, max: 0.9, unit: "ratio" },
    { name: "noteDuration", min: 0.3, max: 0.6, unit: "s" },
    { name: "noteAttack", min: 0.005, max: 0.02, unit: "s" },
    { name: "filterStart", min: 2000, max: 4000, unit: "Hz" },
    { name: "filterEnd", min: 200, max: 600, unit: "Hz" },
    { name: "level", min: 0.5, max: 0.9, unit: "amplitude" },
    { name: "tailDecay", min: 0.5, max: 1.2, unit: "s" },
  ],
  getParams: (rng) => {
    const p = getCardDefeatStingParams(rng);
    return {
      startFreq: p.startFreq, dropRatio: p.dropRatio,
      noteDuration: p.noteDuration, noteAttack: p.noteAttack,
      filterStart: p.filterStart, filterEnd: p.filterEnd,
      level: p.level, tailDecay: p.tailDecay,
    };
  },
});

// ── card-round-complete ───────────────────────────────────────────

function cardRoundCompleteDuration(rng: Rng): number {
  const params = getCardRoundCompleteParams(rng);
  return params.attack + params.decay;
}

function cardRoundCompleteOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardRoundCompleteParams(rng);

  // Sine oscillator
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = params.frequency;

  // Lowpass filter
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = params.filterCutoff;

  // Level gain
  const gain = ctx.createGain();
  gain.gain.value = params.level;

  // Amplitude envelope
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, 0);
  env.gain.linearRampToValueAtTime(1, params.attack);
  env.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(env);
  env.connect(ctx.destination);

  // Schedule
  osc.start(0);
  osc.stop(duration);
}

registry.register("card-round-complete", {
  factoryLoader: async () => (await import("./card-round-complete.js")).createCardRoundComplete,
  getDuration: cardRoundCompleteDuration,
  buildOfflineGraph: cardRoundCompleteOfflineGraph,
  description: "Neutral completion tone for round/turn end events in card games.",
  category: "Card Game",
  tags: ["card", "round-complete", "card-game", "outcome", "neutral", "arcade"],
  signalChain: "Sine Oscillator -> Lowpass Filter -> Gain -> Envelope -> Destination",
  params: [
    { name: "frequency", min: 500, max: 900, unit: "Hz" },
    { name: "attack", min: 0.005, max: 0.02, unit: "s" },
    { name: "sustain", min: 0.3, max: 0.6, unit: "amplitude" },
    { name: "decay", min: 0.1, max: 0.35, unit: "s" },
    { name: "filterCutoff", min: 1500, max: 3500, unit: "Hz" },
    { name: "level", min: 0.5, max: 0.85, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardRoundCompleteParams(rng);
    return {
      frequency: p.frequency, attack: p.attack,
      sustain: p.sustain, decay: p.decay,
      filterCutoff: p.filterCutoff, level: p.level,
    };
  },
});

// ── card-coin-collect ─────────────────────────────────────────────

function cardCoinCollectDuration(rng: Rng): number {
  const params = getCardCoinCollectParams(rng);
  return params.attack + params.decay;
}

function cardCoinCollectOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardCoinCollectParams(rng);

  // Primary tone with pitch sweep (start high, settle to baseFreq)
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(params.baseFreq + params.pitchSweep, 0);
  osc1.frequency.exponentialRampToValueAtTime(params.baseFreq, params.attack + 0.03);

  const gain1 = ctx.createGain();
  gain1.gain.value = params.toneLevel;

  const env1 = ctx.createGain();
  env1.gain.setValueAtTime(0, 0);
  env1.gain.linearRampToValueAtTime(1, params.attack);
  env1.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc1.connect(gain1);
  gain1.connect(env1);
  env1.connect(ctx.destination);

  // Harmonic overtone for metallic shimmer
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = params.baseFreq * 2.5;

  const gain2 = ctx.createGain();
  gain2.gain.value = params.harmonicLevel;

  const env2 = ctx.createGain();
  env2.gain.setValueAtTime(0, 0);
  env2.gain.linearRampToValueAtTime(1, params.attack);
  env2.gain.linearRampToValueAtTime(0, params.attack + params.decay * 0.7);

  osc2.connect(gain2);
  gain2.connect(env2);
  env2.connect(ctx.destination);

  // Noise transient for metallic clink attack
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const noiseHpf = ctx.createBiquadFilter();
  noiseHpf.type = "highpass";
  noiseHpf.frequency.value = 4000;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = params.noiseLevel;

  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, 0);
  noiseEnv.gain.linearRampToValueAtTime(1, 0.001);
  noiseEnv.gain.linearRampToValueAtTime(0, 0.001 + params.attack + 0.02);

  noiseSrc.connect(noiseHpf);
  noiseHpf.connect(noiseGain);
  noiseGain.connect(noiseEnv);
  noiseEnv.connect(ctx.destination);

  // Schedule
  osc1.start(0);
  osc2.start(0);
  noiseSrc.start(0);
  osc1.stop(duration);
  osc2.stop(duration);
  noiseSrc.stop(duration);
}

registry.register("card-coin-collect", {
  factoryLoader: async () => (await import("./card-coin-collect.js")).createCardCoinCollect,
  getDuration: cardCoinCollectDuration,
  buildOfflineGraph: cardCoinCollectOfflineGraph,
  description: "Bright metallic ascending ping for coin/token collection events in card games.",
  category: "Card Game",
  tags: ["card", "coin", "collect", "card-game", "economy", "arcade", "metallic"],
  signalChain: "Sine Oscillator (pitch sweep) + Harmonic Oscillator + Highpass Noise -> Envelope -> Destination",
  params: [
    { name: "baseFreq", min: 800, max: 2000, unit: "Hz" },
    { name: "pitchSweep", min: 200, max: 800, unit: "Hz" },
    { name: "attack", min: 0.001, max: 0.005, unit: "s" },
    { name: "decay", min: 0.08, max: 0.3, unit: "s" },
    { name: "toneLevel", min: 0.5, max: 0.9, unit: "amplitude" },
    { name: "harmonicLevel", min: 0.2, max: 0.5, unit: "amplitude" },
    { name: "noiseLevel", min: 0.1, max: 0.4, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardCoinCollectParams(rng);
    return {
      baseFreq: p.baseFreq, pitchSweep: p.pitchSweep,
      attack: p.attack, decay: p.decay,
      toneLevel: p.toneLevel, harmonicLevel: p.harmonicLevel,
      noiseLevel: p.noiseLevel,
    };
  },
});

// ── card-coin-collect-hybrid (sample-hybrid) ──────────────────────

function cardCoinCollectHybridDuration(rng: Rng): number {
  const params = getCardCoinCollectHybridParams(rng);
  return params.attack + params.decay;
}

async function cardCoinCollectHybridOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): Promise<void> {
  const params = getCardCoinCollectHybridParams(rng);

  // Load the CC0 metallic coin sample
  const sampleBuffer = await loadSample("card-coin-collect/clink.wav", ctx);

  // Sample layer
  const sampleSrc = ctx.createBufferSource();
  sampleSrc.buffer = sampleBuffer;

  const sampleGain = ctx.createGain();
  sampleGain.gain.value = params.mixLevel;

  sampleSrc.connect(sampleGain);
  sampleGain.connect(ctx.destination);

  // Synthesis tonal layer
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = params.baseFreq;

  const synthGain = ctx.createGain();
  synthGain.gain.value = params.synthLevel;

  const synthEnv = ctx.createGain();
  synthEnv.gain.setValueAtTime(0, 0);
  synthEnv.gain.linearRampToValueAtTime(1, params.attack);
  synthEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc.connect(synthGain);
  synthGain.connect(synthEnv);
  synthEnv.connect(ctx.destination);

  // Shimmer layer: highpass-filtered noise
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const shimmerHpf = ctx.createBiquadFilter();
  shimmerHpf.type = "highpass";
  shimmerHpf.frequency.value = params.filterCutoff;

  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = params.shimmerLevel;

  const shimmerEnv = ctx.createGain();
  shimmerEnv.gain.setValueAtTime(0, 0);
  shimmerEnv.gain.linearRampToValueAtTime(1, 0.001);
  shimmerEnv.gain.linearRampToValueAtTime(0, 0.001 + params.attack + 0.03);

  noiseSrc.connect(shimmerHpf);
  shimmerHpf.connect(shimmerGain);
  shimmerGain.connect(shimmerEnv);
  shimmerEnv.connect(ctx.destination);

  // Schedule
  sampleSrc.start(0);
  osc.start(0);
  noiseSrc.start(0);
  sampleSrc.stop(duration);
  osc.stop(duration);
  noiseSrc.stop(duration);
}

registry.register("card-coin-collect-hybrid", {
  factoryLoader: async () => (await import("./card-coin-collect-hybrid.js")).createCardCoinCollectHybrid,
  getDuration: cardCoinCollectHybridDuration,
  buildOfflineGraph: cardCoinCollectHybridOfflineGraph,
  description: "Sample-hybrid metallic coin collect layering a CC0 coin clink sample with procedurally varied synthesis.",
  category: "Card Game",
  tags: ["card", "coin", "collect", "card-game", "economy", "arcade", "metallic", "sample-hybrid"],
  signalChain: "CC0 Coin Sample + Sine Oscillator + Highpass Noise (shimmer) -> Envelope -> Destination",
  params: [
    { name: "baseFreq", min: 900, max: 1800, unit: "Hz" },
    { name: "attack", min: 0.001, max: 0.005, unit: "s" },
    { name: "decay", min: 0.1, max: 0.35, unit: "s" },
    { name: "mixLevel", min: 0.3, max: 0.7, unit: "amplitude" },
    { name: "synthLevel", min: 0.4, max: 0.8, unit: "amplitude" },
    { name: "filterCutoff", min: 3000, max: 8000, unit: "Hz" },
    { name: "shimmerLevel", min: 0.1, max: 0.35, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardCoinCollectHybridParams(rng);
    return {
      baseFreq: p.baseFreq, attack: p.attack,
      decay: p.decay, mixLevel: p.mixLevel,
      synthLevel: p.synthLevel, filterCutoff: p.filterCutoff,
      shimmerLevel: p.shimmerLevel,
    };
  },
});

// ── card-coin-spend ───────────────────────────────────────────────

function cardCoinSpendDuration(rng: Rng): number {
  const params = getCardCoinSpendParams(rng);
  return params.attack + params.decay;
}

function cardCoinSpendOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardCoinSpendParams(rng);

  // Primary descending tone
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(params.baseFreq, 0);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(20, params.baseFreq - params.pitchDrop),
    params.attack + params.decay * 0.8,
  );

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = params.filterCutoff;

  const toneGain = ctx.createGain();
  toneGain.gain.value = params.toneLevel;

  const toneEnv = ctx.createGain();
  toneEnv.gain.setValueAtTime(0, 0);
  toneEnv.gain.linearRampToValueAtTime(1, params.attack);
  toneEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc.connect(filter);
  filter.connect(toneGain);
  toneGain.connect(toneEnv);
  toneEnv.connect(ctx.destination);

  // Soft noise layer
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  // Pink-ish noise: low-pass filtered white noise approximation
  let pinkState = 0;
  for (let i = 0; i < noiseData.length; i++) {
    pinkState = pinkState * 0.95 + (rng() * 2 - 1) * 0.05;
    noiseData[i] = pinkState * 10;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const noiseLpf = ctx.createBiquadFilter();
  noiseLpf.type = "lowpass";
  noiseLpf.frequency.value = params.filterCutoff * 0.5;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = params.noiseLevel;

  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, 0);
  noiseEnv.gain.linearRampToValueAtTime(1, params.attack);
  noiseEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay * 0.6);

  noiseSrc.connect(noiseLpf);
  noiseLpf.connect(noiseGain);
  noiseGain.connect(noiseEnv);
  noiseEnv.connect(ctx.destination);

  // Schedule
  osc.start(0);
  noiseSrc.start(0);
  osc.stop(duration);
  noiseSrc.stop(duration);
}

registry.register("card-coin-spend", {
  factoryLoader: async () => (await import("./card-coin-spend.js")).createCardCoinSpend,
  getDuration: cardCoinSpendDuration,
  buildOfflineGraph: cardCoinSpendOfflineGraph,
  description: "Muted descending tone for coin/token spend events in card games.",
  category: "Card Game",
  tags: ["card", "coin", "spend", "card-game", "economy", "arcade", "descending"],
  signalChain: "Sine Oscillator (descending pitch) -> Lowpass Filter + Pink Noise -> Envelope -> Destination",
  params: [
    { name: "baseFreq", min: 500, max: 1000, unit: "Hz" },
    { name: "pitchDrop", min: 150, max: 500, unit: "Hz" },
    { name: "attack", min: 0.001, max: 0.005, unit: "s" },
    { name: "decay", min: 0.08, max: 0.3, unit: "s" },
    { name: "toneLevel", min: 0.4, max: 0.8, unit: "amplitude" },
    { name: "filterCutoff", min: 1000, max: 3000, unit: "Hz" },
    { name: "noiseLevel", min: 0.05, max: 0.2, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardCoinSpendParams(rng);
    return {
      baseFreq: p.baseFreq, pitchDrop: p.pitchDrop,
      attack: p.attack, decay: p.decay,
      toneLevel: p.toneLevel, filterCutoff: p.filterCutoff,
      noiseLevel: p.noiseLevel,
    };
  },
});

// ── card-chip-stack ───────────────────────────────────────────────

function cardChipStackDuration(rng: Rng): number {
  const params = getCardChipStackParams(rng);
  return params.attack + Math.max(params.clickDecay, params.ringDecay);
}

function cardChipStackOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardChipStackParams(rng);

  // Percussive click: bandpass-filtered noise
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type = "bandpass";
  clickFilter.frequency.value = params.clickFreq;
  clickFilter.Q.value = params.clickQ;

  const clickGain = ctx.createGain();
  clickGain.gain.value = params.clickLevel;

  const clickEnv = ctx.createGain();
  clickEnv.gain.setValueAtTime(0, 0);
  clickEnv.gain.linearRampToValueAtTime(1, params.attack);
  clickEnv.gain.linearRampToValueAtTime(0, params.attack + params.clickDecay);

  noiseSrc.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(clickEnv);
  clickEnv.connect(ctx.destination);

  // Ring-out tone: damped sine
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = params.ringFreq;

  const ringGain = ctx.createGain();
  ringGain.gain.value = params.ringLevel;

  const ringEnv = ctx.createGain();
  ringEnv.gain.setValueAtTime(0, 0);
  ringEnv.gain.linearRampToValueAtTime(1, params.attack);
  ringEnv.gain.linearRampToValueAtTime(0, params.attack + params.ringDecay);

  osc.connect(ringGain);
  ringGain.connect(ringEnv);
  ringEnv.connect(ctx.destination);

  // Schedule
  noiseSrc.start(0);
  osc.start(0);
  noiseSrc.stop(duration);
  osc.stop(duration);
}

registry.register("card-chip-stack", {
  factoryLoader: async () => (await import("./card-chip-stack.js")).createCardChipStack,
  getDuration: cardChipStackDuration,
  buildOfflineGraph: cardChipStackOfflineGraph,
  description: "Percussive click with brief tonal ring for stacking chips/tokens in card games.",
  category: "Card Game",
  tags: ["card", "chip", "stack", "card-game", "economy", "arcade", "percussive"],
  signalChain: "Bandpass Noise (click) + Sine Oscillator (ring) -> Envelope -> Destination",
  params: [
    { name: "clickFreq", min: 1500, max: 4000, unit: "Hz" },
    { name: "clickQ", min: 2, max: 8, unit: "Q" },
    { name: "clickLevel", min: 0.5, max: 0.9, unit: "amplitude" },
    { name: "ringFreq", min: 800, max: 2000, unit: "Hz" },
    { name: "ringLevel", min: 0.2, max: 0.5, unit: "amplitude" },
    { name: "attack", min: 0.001, max: 0.003, unit: "s" },
    { name: "clickDecay", min: 0.02, max: 0.08, unit: "s" },
    { name: "ringDecay", min: 0.05, max: 0.2, unit: "s" },
  ],
  getParams: (rng) => {
    const p = getCardChipStackParams(rng);
    return {
      clickFreq: p.clickFreq, clickQ: p.clickQ,
      clickLevel: p.clickLevel, ringFreq: p.ringFreq,
      ringLevel: p.ringLevel, attack: p.attack,
      clickDecay: p.clickDecay, ringDecay: p.ringDecay,
    };
  },
});

// ── card-token-earn ───────────────────────────────────────────────

function cardTokenEarnDuration(rng: Rng): number {
  const params = getCardTokenEarnParams(rng);
  return params.attack + params.decay;
}

function cardTokenEarnOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardTokenEarnParams(rng);

  // Fundamental
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = params.baseFreq;

  const gain1 = ctx.createGain();
  gain1.gain.value = params.fundamentalLevel;

  const env1 = ctx.createGain();
  env1.gain.setValueAtTime(0, 0);
  env1.gain.linearRampToValueAtTime(1, params.attack);
  env1.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc1.connect(gain1);
  gain1.connect(env1);
  env1.connect(ctx.destination);

  // Second harmonic
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = params.baseFreq * params.harmonic2Ratio;

  const gain2 = ctx.createGain();
  gain2.gain.value = params.harmonic2Level;

  const env2 = ctx.createGain();
  env2.gain.setValueAtTime(0, 0);
  env2.gain.linearRampToValueAtTime(1, params.attack);
  env2.gain.linearRampToValueAtTime(0, params.attack + params.decay * 0.8);

  osc2.connect(gain2);
  gain2.connect(env2);
  env2.connect(ctx.destination);

  // Third harmonic
  const osc3 = ctx.createOscillator();
  osc3.type = "sine";
  osc3.frequency.value = params.baseFreq * params.harmonic3Ratio;

  const gain3 = ctx.createGain();
  gain3.gain.value = params.harmonic3Level;

  const env3 = ctx.createGain();
  env3.gain.setValueAtTime(0, 0);
  env3.gain.linearRampToValueAtTime(1, params.attack);
  env3.gain.linearRampToValueAtTime(0, params.attack + params.decay * 0.6);

  osc3.connect(gain3);
  gain3.connect(env3);
  env3.connect(ctx.destination);

  // Schedule
  osc1.start(0);
  osc2.start(0);
  osc3.start(0);
  osc1.stop(duration);
  osc2.stop(duration);
  osc3.stop(duration);
}

registry.register("card-token-earn", {
  factoryLoader: async () => (await import("./card-token-earn.js")).createCardTokenEarn,
  getDuration: cardTokenEarnDuration,
  buildOfflineGraph: cardTokenEarnOfflineGraph,
  description: "Bright ascending multi-harmonic chime for earning tokens/rewards in card games.",
  category: "Card Game",
  tags: ["card", "token", "earn", "card-game", "economy", "arcade", "harmonic", "chime"],
  signalChain: "Sine (fundamental) + Sine (h2) + Sine (h3) -> Envelope -> Destination",
  params: [
    { name: "baseFreq", min: 600, max: 1400, unit: "Hz" },
    { name: "harmonic2Ratio", min: 1.9, max: 2.1, unit: "ratio" },
    { name: "harmonic3Ratio", min: 2.9, max: 3.1, unit: "ratio" },
    { name: "attack", min: 0.001, max: 0.005, unit: "s" },
    { name: "decay", min: 0.1, max: 0.35, unit: "s" },
    { name: "fundamentalLevel", min: 0.5, max: 0.9, unit: "amplitude" },
    { name: "harmonic2Level", min: 0.2, max: 0.5, unit: "amplitude" },
    { name: "harmonic3Level", min: 0.1, max: 0.3, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardTokenEarnParams(rng);
    return {
      baseFreq: p.baseFreq, harmonic2Ratio: p.harmonic2Ratio,
      harmonic3Ratio: p.harmonic3Ratio, attack: p.attack,
      decay: p.decay, fundamentalLevel: p.fundamentalLevel,
      harmonic2Level: p.harmonic2Level, harmonic3Level: p.harmonic3Level,
    };
  },
});

// ── card-treasure-reveal ──────────────────────────────────────────

function cardTreasureRevealDuration(rng: Rng): number {
  const params = getCardTreasureRevealParams(rng);
  return Math.max(
    0.005 + params.shimmerDecay,
    params.toneAttack + params.toneDecay,
  );
}

function cardTreasureRevealOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardTreasureRevealParams(rng);

  // Shimmer layer: highpass-filtered white noise
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const shimmerHpf = ctx.createBiquadFilter();
  shimmerHpf.type = "highpass";
  shimmerHpf.frequency.value = params.shimmerCutoff;

  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = params.shimmerLevel;

  const shimmerEnv = ctx.createGain();
  shimmerEnv.gain.setValueAtTime(0, 0);
  shimmerEnv.gain.linearRampToValueAtTime(1, 0.005);
  shimmerEnv.gain.linearRampToValueAtTime(0, 0.005 + params.shimmerDecay);

  noiseSrc.connect(shimmerHpf);
  shimmerHpf.connect(shimmerGain);
  shimmerGain.connect(shimmerEnv);
  shimmerEnv.connect(ctx.destination);

  // Reveal tone: base frequency
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = params.toneFreq;

  const gain1 = ctx.createGain();
  gain1.gain.value = params.toneLevel;

  const env1 = ctx.createGain();
  env1.gain.setValueAtTime(0, 0);
  env1.gain.linearRampToValueAtTime(1, params.toneAttack);
  env1.gain.linearRampToValueAtTime(0, params.toneAttack + params.toneDecay);

  osc1.connect(gain1);
  gain1.connect(env1);
  env1.connect(ctx.destination);

  // Reveal tone: interval
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = params.toneFreq * params.intervalRatio;

  const gain2 = ctx.createGain();
  gain2.gain.value = params.toneLevel * 0.7;

  const env2 = ctx.createGain();
  env2.gain.setValueAtTime(0, 0);
  env2.gain.linearRampToValueAtTime(1, params.toneAttack);
  env2.gain.linearRampToValueAtTime(0, params.toneAttack + params.toneDecay * 0.85);

  osc2.connect(gain2);
  gain2.connect(env2);
  env2.connect(ctx.destination);

  // Schedule
  noiseSrc.start(0);
  osc1.start(0);
  osc2.start(0);
  noiseSrc.stop(duration);
  osc1.stop(duration);
  osc2.stop(duration);
}

registry.register("card-treasure-reveal", {
  factoryLoader: async () => (await import("./card-treasure-reveal.js")).createCardTreasureReveal,
  getDuration: cardTreasureRevealDuration,
  buildOfflineGraph: cardTreasureRevealOfflineGraph,
  description: "Dramatic shimmer-into-tone reveal sound for treasure/rare card reveals in card games.",
  category: "Card Game",
  tags: ["card", "treasure", "reveal", "card-game", "economy", "arcade", "dramatic", "shimmer"],
  signalChain: "Highpass Noise (shimmer) + Sine Chord (reveal) -> Envelope -> Destination",
  params: [
    { name: "shimmerCutoff", min: 4000, max: 10000, unit: "Hz" },
    { name: "shimmerLevel", min: 0.3, max: 0.7, unit: "amplitude" },
    { name: "shimmerDecay", min: 0.1, max: 0.3, unit: "s" },
    { name: "toneFreq", min: 500, max: 1200, unit: "Hz" },
    { name: "intervalRatio", min: 1.2, max: 1.5, unit: "ratio" },
    { name: "toneAttack", min: 0.02, max: 0.1, unit: "s" },
    { name: "toneDecay", min: 0.15, max: 0.5, unit: "s" },
    { name: "toneLevel", min: 0.5, max: 0.9, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardTreasureRevealParams(rng);
    return {
      shimmerCutoff: p.shimmerCutoff, shimmerLevel: p.shimmerLevel,
      shimmerDecay: p.shimmerDecay, toneFreq: p.toneFreq,
      intervalRatio: p.intervalRatio, toneAttack: p.toneAttack,
      toneDecay: p.toneDecay, toneLevel: p.toneLevel,
    };
  },
});

// ── card-discard ─────────────────────────────────────────────────

function cardDiscardDuration(rng: Rng): number {
  const params = getCardDiscardParams(rng);
  return params.attack + params.decay;
}

function cardDiscardOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardDiscardParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Noise burst layer: bandpass-filtered white noise
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const bpf = ctx.createBiquadFilter();
  bpf.type = "bandpass";
  bpf.frequency.value = params.filterFreq;
  bpf.Q.value = params.filterQ;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = params.noiseLevel;

  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, 0);
  noiseEnv.gain.linearRampToValueAtTime(1, params.attack);
  noiseEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  noiseSrc.connect(bpf);
  bpf.connect(noiseGain);
  noiseGain.connect(noiseEnv);
  noiseEnv.connect(ctx.destination);

  // Thud layer: low sine oscillator
  const thud = ctx.createOscillator();
  thud.type = "sine";
  thud.frequency.value = params.thudFreq;

  const thudGain = ctx.createGain();
  thudGain.gain.value = params.thudLevel;

  const thudEnv = ctx.createGain();
  thudEnv.gain.setValueAtTime(0, 0);
  thudEnv.gain.linearRampToValueAtTime(1, 0.001);
  thudEnv.gain.linearRampToValueAtTime(0, 0.001 + params.decay * 0.5);

  thud.connect(thudGain);
  thudGain.connect(thudEnv);
  thudEnv.connect(ctx.destination);

  // Schedule
  noiseSrc.start(0);
  noiseSrc.stop(duration);
  thud.start(0);
  thud.stop(duration);
}

registry.register("card-discard", {
  factoryLoader: async () => (await import("./card-discard.js")).createCardDiscard,
  getDuration: cardDiscardDuration,
  buildOfflineGraph: cardDiscardOfflineGraph,
  description: "Short noise burst with tonal thud for discarding a card — subtle, neutral removal action.",
  category: "Card Game",
  tags: ["card", "discard", "card-game", "removal", "arcade", "neutral"],
  signalChain: "White Noise -> Bandpass Filter -> Noise Gain -> Envelope + Sine Thud -> Thud Gain -> Envelope -> Destination",
  params: [
    { name: "filterFreq", min: 600, max: 2000, unit: "Hz" },
    { name: "filterQ", min: 1, max: 4, unit: "Q" },
    { name: "attack", min: 0.001, max: 0.005, unit: "s" },
    { name: "decay", min: 0.04, max: 0.15, unit: "s" },
    { name: "noiseLevel", min: 0.4, max: 0.8, unit: "amplitude" },
    { name: "thudFreq", min: 100, max: 300, unit: "Hz" },
    { name: "thudLevel", min: 0.2, max: 0.5, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardDiscardParams(rng);
    return {
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      attack: p.attack, decay: p.decay,
      noiseLevel: p.noiseLevel, thudFreq: p.thudFreq,
      thudLevel: p.thudLevel,
    };
  },
});

// ── card-burn ────────────────────────────────────────────────────

function cardBurnDuration(rng: Rng): number {
  const params = getCardBurnParams(rng);
  return params.attack + params.decay;
}

function cardBurnOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardBurnParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Main noise layer with descending lowpass sweep
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.setValueAtTime(params.filterStart, 0);
  lpf.frequency.linearRampToValueAtTime(params.filterEnd, duration);

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = params.noiseLevel;

  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, 0);
  noiseEnv.gain.linearRampToValueAtTime(1, params.attack);
  noiseEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  noiseSrc.connect(lpf);
  lpf.connect(noiseGain);
  noiseGain.connect(noiseEnv);
  noiseEnv.connect(ctx.destination);

  // Crackle layer: highpass-filtered noise for fire texture
  const crackleBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const crackleData = crackleBuffer.getChannelData(0);
  for (let i = 0; i < crackleData.length; i++) {
    crackleData[i] = rng() * 2 - 1;
  }

  const crackleSrc = ctx.createBufferSource();
  crackleSrc.buffer = crackleBuffer;

  const hpf = ctx.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = 5000;

  const crackleGain = ctx.createGain();
  crackleGain.gain.value = params.crackleLevel;

  const crackleEnv = ctx.createGain();
  crackleEnv.gain.setValueAtTime(0, 0);
  crackleEnv.gain.linearRampToValueAtTime(1, params.attack);
  crackleEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay * 0.7);

  crackleSrc.connect(hpf);
  hpf.connect(crackleGain);
  crackleGain.connect(crackleEnv);
  crackleEnv.connect(ctx.destination);

  // Low rumble: sine oscillator
  const rumble = ctx.createOscillator();
  rumble.type = "sine";
  rumble.frequency.value = params.rumbleFreq;

  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = params.rumbleLevel;

  const rumbleEnv = ctx.createGain();
  rumbleEnv.gain.setValueAtTime(0, 0);
  rumbleEnv.gain.linearRampToValueAtTime(1, params.attack);
  rumbleEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay * 0.8);

  rumble.connect(rumbleGain);
  rumbleGain.connect(rumbleEnv);
  rumbleEnv.connect(ctx.destination);

  // Schedule
  noiseSrc.start(0);
  noiseSrc.stop(duration);
  crackleSrc.start(0);
  crackleSrc.stop(duration);
  rumble.start(0);
  rumble.stop(duration);
}

registry.register("card-burn", {
  factoryLoader: async () => (await import("./card-burn.js")).createCardBurn,
  getDuration: cardBurnDuration,
  buildOfflineGraph: cardBurnOfflineGraph,
  description: "Destructive dissolve/fire effect with descending filter sweep, crackle, and rumble for permanently burning a card.",
  category: "Card Game",
  tags: ["card", "burn", "card-game", "removal", "destructive", "arcade", "fire", "dramatic"],
  signalChain: "White Noise -> Lowpass Sweep -> Noise Gain -> Envelope + Highpass Noise (crackle) -> Envelope + Sine Rumble -> Envelope -> Destination",
  params: [
    { name: "filterStart", min: 3000, max: 8000, unit: "Hz" },
    { name: "filterEnd", min: 200, max: 800, unit: "Hz" },
    { name: "attack", min: 0.005, max: 0.02, unit: "s" },
    { name: "decay", min: 0.3, max: 0.7, unit: "s" },
    { name: "noiseLevel", min: 0.4, max: 0.8, unit: "amplitude" },
    { name: "crackleLevel", min: 0.1, max: 0.4, unit: "amplitude" },
    { name: "rumbleFreq", min: 60, max: 150, unit: "Hz" },
    { name: "rumbleLevel", min: 0.1, max: 0.3, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardBurnParams(rng);
    return {
      filterStart: p.filterStart, filterEnd: p.filterEnd,
      attack: p.attack, decay: p.decay,
      noiseLevel: p.noiseLevel, crackleLevel: p.crackleLevel,
      rumbleFreq: p.rumbleFreq, rumbleLevel: p.rumbleLevel,
    };
  },
});

// ── card-return-to-deck ──────────────────────────────────────────

function cardReturnToDeckDuration(rng: Rng): number {
  const params = getCardReturnToDeckParams(rng);
  return params.attack + params.decay;
}

function cardReturnToDeckOfflineGraph(
  rng: Rng,
  ctx: OfflineAudioContext,
  duration: number,
): void {
  const params = getCardReturnToDeckParams(rng);

  const bufferSize = Math.ceil(ctx.sampleRate * duration);

  // Swoosh noise layer: bandpass-filtered white noise
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = rng() * 2 - 1;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const bpf = ctx.createBiquadFilter();
  bpf.type = "bandpass";
  bpf.frequency.value = params.filterFreq;
  bpf.Q.value = params.filterQ;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = params.noiseLevel;

  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, 0);
  noiseEnv.gain.linearRampToValueAtTime(1, params.attack);
  noiseEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  noiseSrc.connect(bpf);
  bpf.connect(noiseGain);
  noiseGain.connect(noiseEnv);
  noiseEnv.connect(ctx.destination);

  // Ascending tonal accent: sine with frequency ramp
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(params.toneStart, 0);
  osc.frequency.linearRampToValueAtTime(params.toneEnd, duration);

  const toneGain = ctx.createGain();
  toneGain.gain.value = params.toneLevel;

  const toneEnv = ctx.createGain();
  toneEnv.gain.setValueAtTime(0, 0);
  toneEnv.gain.linearRampToValueAtTime(1, params.attack);
  toneEnv.gain.linearRampToValueAtTime(0, params.attack + params.decay);

  osc.connect(toneGain);
  toneGain.connect(toneEnv);
  toneEnv.connect(ctx.destination);

  // Schedule
  noiseSrc.start(0);
  noiseSrc.stop(duration);
  osc.start(0);
  osc.stop(duration);
}

registry.register("card-return-to-deck", {
  factoryLoader: async () => (await import("./card-return-to-deck.js")).createCardReturnToDeck,
  getDuration: cardReturnToDeckDuration,
  buildOfflineGraph: cardReturnToDeckOfflineGraph,
  description: "Subtle swoosh with ascending tonal accent for returning a card to the deck — conceptual inverse of card-draw.",
  category: "Card Game",
  tags: ["card", "return", "deck", "card-game", "removal", "arcade", "swoosh", "ascending"],
  signalChain: "White Noise -> Bandpass Filter -> Noise Gain -> Envelope + Ascending Sine -> Tone Gain -> Envelope -> Destination",
  params: [
    { name: "filterFreq", min: 800, max: 2500, unit: "Hz" },
    { name: "filterQ", min: 1.5, max: 5, unit: "Q" },
    { name: "attack", min: 0.001, max: 0.005, unit: "s" },
    { name: "decay", min: 0.05, max: 0.15, unit: "s" },
    { name: "noiseLevel", min: 0.3, max: 0.7, unit: "amplitude" },
    { name: "toneStart", min: 400, max: 800, unit: "Hz" },
    { name: "toneEnd", min: 800, max: 1400, unit: "Hz" },
    { name: "toneLevel", min: 0.2, max: 0.5, unit: "amplitude" },
  ],
  getParams: (rng) => {
    const p = getCardReturnToDeckParams(rng);
    return {
      filterFreq: p.filterFreq, filterQ: p.filterQ,
      attack: p.attack, decay: p.decay,
      noiseLevel: p.noiseLevel, toneStart: p.toneStart,
      toneEnd: p.toneEnd, toneLevel: p.toneLevel,
    };
  },
});
