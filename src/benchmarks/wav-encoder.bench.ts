/**
 * WAV Encoder Benchmark
 *
 * Measures the time to encode Float32Array audio samples to WAV format.
 * Tests with various buffer sizes representative of typical ToneForge outputs.
 *
 * Reference: TF-0MM0YUBFR0MCXGLE
 */

import { bench, describe } from "vitest";
import { encodeWav } from "../audio/wav-encoder.js";

// Pre-generate test buffers of various sizes
const SAMPLE_RATE = 44100;

function generateSineWave(durationSec: number): Float32Array {
  const length = Math.ceil(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE);
  }
  return samples;
}

const shortBuffer = generateSineWave(0.5);   // ~22k samples
const mediumBuffer = generateSineWave(2.0);  // ~88k samples
const longBuffer = generateSineWave(5.0);    // ~220k samples

describe("encodeWav", () => {
  bench("0.5s buffer (22,050 samples)", () => {
    encodeWav(shortBuffer, { sampleRate: SAMPLE_RATE });
  });

  bench("2.0s buffer (88,200 samples)", () => {
    encodeWav(mediumBuffer, { sampleRate: SAMPLE_RATE });
  });

  bench("5.0s buffer (220,500 samples)", () => {
    encodeWav(longBuffer, { sampleRate: SAMPLE_RATE });
  });
});
