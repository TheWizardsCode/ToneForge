/**
 * Generate CC0 synthetic sample WAV files for hybrid recipes.
 *
 * These are procedurally generated samples (not downloaded) that serve
 * as minimal, deterministic audio fixtures for the sample-hybrid recipes.
 * All output is CC0/public-domain since it is original generated content.
 *
 * Uses a seeded PRNG (same xorshift as ToneForge recipes) so the output
 * is deterministic and byte-identical across runs.
 *
 * Generates:
 * - assets/samples/footstep-gravel/impact.wav  (short transient click/crack)
 * - assets/samples/creature-vocal/growl.wav     (short tonal growl)
 * - assets/samples/vehicle-engine/loop.wav      (short engine loop)
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeWav } from "../src/audio/wav-encoder.js";
import { createRng } from "../src/core/rng.js";

const SAMPLE_RATE = 44100;

/**
 * Generate a footstep impact transient: sharp noise burst with rapid decay.
 * ~0.15s, sounds like a short percussive click/crack.
 */
function generateFootstepImpact(): Float32Array {
  const rng = createRng(1001); // Deterministic seed for footstep sample
  const duration = 0.15;
  const length = Math.ceil(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    // White noise shaped by exponential decay envelope
    const noise = rng() * 2 - 1;
    const envelope = Math.exp(-t * 40); // Fast decay
    // Add a low-frequency thump component
    const thump = Math.sin(2 * Math.PI * 80 * t) * Math.exp(-t * 25);
    samples[i] = (noise * 0.6 + thump * 0.4) * envelope * 0.8;
  }

  return samples;
}

/**
 * Generate a creature growl: low-frequency FM synthesis with noise texture.
 * ~0.4s, sounds like a short guttural vocalization.
 */
function generateCreatureGrowl(): Float32Array {
  const rng = createRng(2002); // Deterministic seed for creature sample
  const duration = 0.4;
  const length = Math.ceil(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    // Carrier at ~120Hz with FM modulation for growl texture
    const modFreq = 30;
    const modIndex = 8;
    const carrier = Math.sin(
      2 * Math.PI * 120 * t + modIndex * Math.sin(2 * Math.PI * modFreq * t),
    );
    // Add filtered noise for breathiness
    const noise = (rng() * 2 - 1) * 0.15;
    // Amplitude envelope: attack + sustain + decay
    let envelope: number;
    if (t < 0.03) {
      envelope = t / 0.03; // 30ms attack
    } else if (t < 0.3) {
      envelope = 1.0; // sustain
    } else {
      envelope = Math.max(0, 1.0 - (t - 0.3) / 0.1); // 100ms decay
    }
    samples[i] = (carrier * 0.7 + noise) * envelope * 0.7;
  }

  return samples;
}

/**
 * Generate a vehicle engine loop: sawtooth-like harmonics with rumble.
 * ~0.3s, designed to loop seamlessly.
 */
function generateEngineLoop(): Float32Array {
  const rng = createRng(3003); // Deterministic seed for engine sample
  const duration = 0.3;
  const length = Math.ceil(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  const fundamentalFreq = 55; // Hz, low engine rumble

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    // Build a sawtooth-like waveform from harmonics for engine texture
    let signal = 0;
    for (let h = 1; h <= 8; h++) {
      const amplitude = 1.0 / h;
      signal += amplitude * Math.sin(2 * Math.PI * fundamentalFreq * h * t);
    }
    // Add low-frequency modulation for engine "chug"
    const lfo = 1.0 + 0.3 * Math.sin(2 * Math.PI * 8 * t);
    // Add slight noise for combustion texture
    const noise = (rng() * 2 - 1) * 0.05;
    // Apply a gentle fade at loop boundaries for smoother looping
    const fadeLen = 0.01; // 10ms fade
    let loopEnv = 1.0;
    if (t < fadeLen) {
      loopEnv = t / fadeLen;
    } else if (t > duration - fadeLen) {
      loopEnv = (duration - t) / fadeLen;
    }
    samples[i] = (signal * 0.4 * lfo + noise) * loopEnv * 0.6;
  }

  return samples;
}

/**
 * Generate an 8-bit coin/token collection sound: ascending square-wave arpeggio.
 * ~0.2s, classic retro pickup SFX — two quick rising tones.
 */
function generateCoinCollect(): Float32Array {
  const duration = 0.2;
  const length = Math.ceil(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);

  // Two-note ascending arpeggio (B5 → E6), classic coin pattern
  const notes = [
    { freq: 988, start: 0.0, end: 0.1 }, // B5
    { freq: 1319, start: 0.07, end: 0.2 }, // E6 (overlaps slightly)
  ];

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    let signal = 0;

    for (const note of notes) {
      if (t >= note.start && t < note.end) {
        const noteT = t - note.start;
        const noteDur = note.end - note.start;
        // Square wave (fundamental + odd harmonics, band-limited to 3)
        let sq = 0;
        for (let h = 1; h <= 5; h += 2) {
          sq += Math.sin(2 * Math.PI * note.freq * h * noteT) / h;
        }
        sq *= 4 / Math.PI; // Normalize to square-wave amplitude
        // Envelope: instant attack, sustain, short decay at end
        const decayStart = noteDur - 0.03;
        const env = noteT > decayStart ? (noteDur - noteT) / 0.03 : 1.0;
        signal += sq * env * 0.35;
      }
    }

    // Soft-clip to prevent distortion
    samples[i] = Math.max(-0.9, Math.min(0.9, signal));
  }

  return samples;
}

// Generate and write all sample files
const projectRoot = resolve(import.meta.dirname, "..");

const impactSamples = generateFootstepImpact();
const impactWav = encodeWav(impactSamples);
writeFileSync(resolve(projectRoot, "assets/samples/footstep-gravel/impact.wav"), impactWav);
console.log(
  `footstep-gravel/impact.wav: ${impactSamples.length} samples, ${(impactSamples.length / SAMPLE_RATE).toFixed(3)}s, ${impactWav.length} bytes`,
);

const growlSamples = generateCreatureGrowl();
const growlWav = encodeWav(growlSamples);
writeFileSync(resolve(projectRoot, "assets/samples/creature-vocal/growl.wav"), growlWav);
console.log(
  `creature-vocal/growl.wav: ${growlSamples.length} samples, ${(growlSamples.length / SAMPLE_RATE).toFixed(3)}s, ${growlWav.length} bytes`,
);

const engineSamples = generateEngineLoop();
const engineWav = encodeWav(engineSamples);
writeFileSync(resolve(projectRoot, "assets/samples/vehicle-engine/loop.wav"), engineWav);
console.log(
  `vehicle-engine/loop.wav: ${engineSamples.length} samples, ${(engineSamples.length / SAMPLE_RATE).toFixed(3)}s, ${engineWav.length} bytes`,
);

const coinSamples = generateCoinCollect();
const coinWav = encodeWav(coinSamples);
writeFileSync(resolve(projectRoot, "assets/samples/coin-collect/token.wav"), coinWav);
console.log(
  `coin-collect/token.wav: ${coinSamples.length} samples, ${(coinSamples.length / SAMPLE_RATE).toFixed(3)}s, ${coinWav.length} bytes`,
);

const totalBytes = impactWav.length + growlWav.length + engineWav.length + coinWav.length;
console.log(`\nTotal sample size: ${totalBytes} bytes (${(totalBytes / 1024).toFixed(1)} KB)`);
console.log(`Budget: ${totalBytes < 1_000_000 ? "PASS" : "FAIL"} (< 1MB)`);
