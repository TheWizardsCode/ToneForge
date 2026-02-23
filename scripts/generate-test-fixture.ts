/**
 * Generate a tiny 440Hz sine WAV fixture for sample-loader unit tests.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeWav } from "../src/audio/wav-encoder.js";

const sampleRate = 44100;
const duration = 0.01; // 10ms = 441 samples
const length = Math.ceil(sampleRate * duration);
const samples = new Float32Array(length);
for (let i = 0; i < length; i++) {
  samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
}
const wav = encodeWav(samples);
const outPath = resolve(import.meta.dirname, "../src/test-utils/fixtures/test-tone.wav");
writeFileSync(outPath, wav);
console.log(`test-tone.wav: ${wav.length} bytes, ${length} samples`);
