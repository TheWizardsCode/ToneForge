/**
 * WAV Encoder
 *
 * Converts Float32Array audio samples to WAV binary format (44.1 kHz, 16-bit PCM, mono).
 *
 * WAV file structure:
 * - RIFF header (12 bytes)
 * - fmt  sub-chunk (24 bytes)
 * - data sub-chunk (8 + sample data bytes)
 */

/** Options for WAV encoding. */
export interface WavEncodeOptions {
  /** Sample rate in Hz (default: 44100). */
  sampleRate?: number;
  /** Number of channels (default: 1). */
  channels?: number;
  /** Bits per sample (default: 16). */
  bitsPerSample?: number;
}

/**
 * Encode audio samples as a WAV file buffer.
 *
 * @param samples - Float32Array of audio samples in [-1, 1] range.
 * @param options - Encoding options.
 * @returns Buffer containing valid WAV file data.
 * @throws If samples is empty or zero-length.
 */
export function encodeWav(
  samples: Float32Array,
  options: WavEncodeOptions = {},
): Buffer {
  const {
    sampleRate = 44100,
    channels = 1,
    bitsPerSample = 16,
  } = options;

  if (samples.length === 0) {
    throw new Error("Cannot encode WAV: buffer is empty (zero-length)");
  }

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const fileSize = 44 + dataSize; // 44-byte header + data

  const buffer = Buffer.alloc(fileSize);
  let offset = 0;

  // RIFF header
  buffer.write("RIFF", offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4; // File size minus RIFF header
  buffer.write("WAVE", offset); offset += 4;

  // fmt sub-chunk
  buffer.write("fmt ", offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;        // Sub-chunk size (PCM = 16)
  buffer.writeUInt16LE(1, offset); offset += 2;         // Audio format (PCM = 1)
  buffer.writeUInt16LE(channels, offset); offset += 2;  // Number of channels
  buffer.writeUInt32LE(sampleRate, offset); offset += 4; // Sample rate
  buffer.writeUInt32LE(byteRate, offset); offset += 4;   // Byte rate
  buffer.writeUInt16LE(blockAlign, offset); offset += 2; // Block align
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2; // Bits per sample

  // data sub-chunk
  buffer.write("data", offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  // Convert float samples to 16-bit PCM
  for (let i = 0; i < samples.length; i++) {
    // Clamp to [-1, 1] and convert to 16-bit signed integer
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    const int16 = clamped < 0
      ? Math.max(-32768, Math.round(clamped * 32768))
      : Math.min(32767, Math.round(clamped * 32767));
    buffer.writeInt16LE(int16, offset);
    offset += 2;
  }

  return buffer;
}
