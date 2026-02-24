/**
 * WAV File Decoder
 *
 * Pure-TypeScript RIFF/WAV parser that reads 16-bit PCM mono WAV files
 * and returns raw Float32Array sample data for analysis.
 *
 * Supports the WAV format produced by ToneForge's wav-encoder.ts:
 * RIFF/WAVE, PCM format (1), mono, 16-bit, any sample rate.
 *
 * Reference: docs/prd/ANALYZE_PRD.md
 */

import { readFile } from "node:fs/promises";

/** Result of decoding a WAV file. */
export interface WavDecodeResult {
  /** Raw audio samples normalized to [-1, 1]. */
  samples: Float32Array;
  /** Sample rate in Hz. */
  sampleRate: number;
  /** Number of channels. */
  channels: number;
  /** Duration in seconds. */
  duration: number;
}

/**
 * Decode a WAV file from a Buffer.
 *
 * @param data - Buffer containing raw WAV file data.
 * @returns Decoded audio data.
 * @throws If the file is not a valid WAV, or uses an unsupported format.
 */
export function decodeWav(data: Buffer): WavDecodeResult {
  if (data.length < 44) {
    throw new Error(
      "Invalid WAV file: too small (expected at least 44 bytes, " +
      `got ${data.length})`,
    );
  }

  // RIFF header
  const riffTag = data.toString("ascii", 0, 4);
  if (riffTag !== "RIFF") {
    throw new Error(
      `Invalid WAV file: expected RIFF header, got '${riffTag}'`,
    );
  }

  const waveTag = data.toString("ascii", 8, 12);
  if (waveTag !== "WAVE") {
    throw new Error(
      `Invalid WAV file: expected WAVE format, got '${waveTag}'`,
    );
  }

  // Find fmt chunk (may not start at offset 12 if there are other chunks)
  let offset = 12;
  let fmtFound = false;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;

  while (offset < data.length - 8) {
    const chunkId = data.toString("ascii", offset, offset + 4);
    const chunkSize = data.readUInt32LE(offset + 4);

    if (chunkId === "fmt ") {
      if (chunkSize < 16) {
        throw new Error(
          `Invalid WAV file: fmt chunk too small (expected >= 16, got ${chunkSize})`,
        );
      }
      audioFormat = data.readUInt16LE(offset + 8);
      channels = data.readUInt16LE(offset + 10);
      sampleRate = data.readUInt32LE(offset + 12);
      // byteRate at offset + 16 (skip)
      // blockAlign at offset + 20 (skip)
      bitsPerSample = data.readUInt16LE(offset + 22);
      fmtFound = true;
      offset += 8 + chunkSize;
      break;
    }

    offset += 8 + chunkSize;
  }

  if (!fmtFound) {
    throw new Error("Invalid WAV file: fmt chunk not found");
  }

  if (audioFormat !== 1) {
    throw new Error(
      `Unsupported WAV format: expected PCM (1), got ${audioFormat}`,
    );
  }

  if (channels !== 1) {
    throw new Error(
      `Unsupported WAV file: expected mono (1 channel), got ${channels} channels. ` +
      "Multi-channel analysis is not supported in this iteration.",
    );
  }

  if (bitsPerSample !== 16) {
    throw new Error(
      `Unsupported WAV file: expected 16-bit samples, got ${bitsPerSample}-bit. ` +
      "Only 16-bit PCM is supported in this iteration.",
    );
  }

  // Find data chunk
  while (offset < data.length - 8) {
    const chunkId = data.toString("ascii", offset, offset + 4);
    const chunkSize = data.readUInt32LE(offset + 4);

    if (chunkId === "data") {
      const dataOffset = offset + 8;
      const bytesPerSample = bitsPerSample / 8;
      const numSamples = Math.floor(chunkSize / bytesPerSample);
      const samples = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        const int16 = data.readInt16LE(dataOffset + i * bytesPerSample);
        // Convert 16-bit signed integer to float in [-1, 1]
        samples[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
      }

      const duration = numSamples / sampleRate;

      return { samples, sampleRate, channels, duration };
    }

    offset += 8 + chunkSize;
  }

  throw new Error("Invalid WAV file: data chunk not found");
}

/**
 * Read and decode a WAV file from disk.
 *
 * @param filePath - Path to the WAV file.
 * @returns Decoded audio data.
 * @throws If the file cannot be read or is not a valid WAV.
 */
export async function decodeWavFile(filePath: string): Promise<WavDecodeResult> {
  const data = await readFile(filePath);
  return decodeWav(data);
}
