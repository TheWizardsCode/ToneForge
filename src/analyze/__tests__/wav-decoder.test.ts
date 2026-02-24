import { describe, it, expect } from "vitest";
import { encodeWav } from "../../audio/wav-encoder.js";
import { decodeWav } from "../../audio/wav-decoder.js";

describe("WAV Decoder", () => {
  it("round-trips with wav-encoder (encode then decode)", () => {
    const original = new Float32Array([0.0, 0.5, -0.5, 1.0, -1.0, 0.25]);
    const encoded = encodeWav(original, { sampleRate: 44100 });
    const decoded = decodeWav(encoded);

    expect(decoded.sampleRate).toBe(44100);
    expect(decoded.channels).toBe(1);
    expect(decoded.samples.length).toBe(original.length);
    expect(decoded.duration).toBeCloseTo(
      original.length / 44100,
      6,
    );

    // 16-bit quantization error: max absolute error < 1/32768
    for (let i = 0; i < original.length; i++) {
      expect(Math.abs(decoded.samples[i]! - original[i]!)).toBeLessThan(
        1 / 32768 + 0.0001,
      );
    }
  });

  it("round-trips a sine wave", () => {
    const sampleRate = 44100;
    const numSamples = 4410;
    const original = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      original[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
    }

    const encoded = encodeWav(original, { sampleRate });
    const decoded = decodeWav(encoded);

    expect(decoded.sampleRate).toBe(sampleRate);
    expect(decoded.samples.length).toBe(numSamples);

    // Verify sample-level accuracy within 16-bit quantization
    for (let i = 0; i < numSamples; i++) {
      expect(Math.abs(decoded.samples[i]! - original[i]!)).toBeLessThan(
        1 / 32768 + 0.0001,
      );
    }
  });

  it("produces deterministic output (same file, same Float32Array)", () => {
    const samples = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
    const encoded = encodeWav(samples, { sampleRate: 44100 });

    const d1 = decodeWav(encoded);
    const d2 = decodeWav(encoded);

    expect(d1.samples.length).toBe(d2.samples.length);
    for (let i = 0; i < d1.samples.length; i++) {
      expect(d1.samples[i]).toBe(d2.samples[i]);
    }
  });

  it("throws for non-WAV data", () => {
    const data = Buffer.from("not a wav file at all");
    expect(() => decodeWav(data)).toThrow("Invalid WAV file");
  });

  it("throws for too-small buffer", () => {
    const data = Buffer.alloc(10);
    expect(() => decodeWav(data)).toThrow("too small");
  });

  it("throws for wrong RIFF header", () => {
    const data = Buffer.alloc(44);
    data.write("NOPE", 0);
    expect(() => decodeWav(data)).toThrow("expected RIFF header");
  });

  it("throws for wrong WAVE format", () => {
    const data = Buffer.alloc(44);
    data.write("RIFF", 0);
    data.writeUInt32LE(36, 4);
    data.write("NOPE", 8);
    expect(() => decodeWav(data)).toThrow("expected WAVE format");
  });

  it("throws for stereo WAV", () => {
    // Create a minimal WAV header with 2 channels
    const data = Buffer.alloc(44);
    data.write("RIFF", 0);
    data.writeUInt32LE(36, 4);
    data.write("WAVE", 8);
    data.write("fmt ", 12);
    data.writeUInt32LE(16, 16); // chunk size
    data.writeUInt16LE(1, 20);  // PCM
    data.writeUInt16LE(2, 22);  // 2 channels (stereo)
    data.writeUInt32LE(44100, 24);
    data.writeUInt32LE(176400, 28);
    data.writeUInt16LE(4, 32);
    data.writeUInt16LE(16, 34);
    data.write("data", 36);
    data.writeUInt32LE(0, 40);

    expect(() => decodeWav(data)).toThrow("mono");
  });

  it("throws for 24-bit WAV", () => {
    const data = Buffer.alloc(44);
    data.write("RIFF", 0);
    data.writeUInt32LE(36, 4);
    data.write("WAVE", 8);
    data.write("fmt ", 12);
    data.writeUInt32LE(16, 16);
    data.writeUInt16LE(1, 20);  // PCM
    data.writeUInt16LE(1, 22);  // mono
    data.writeUInt32LE(44100, 24);
    data.writeUInt32LE(132300, 28);
    data.writeUInt16LE(3, 32);
    data.writeUInt16LE(24, 34); // 24-bit
    data.write("data", 36);
    data.writeUInt32LE(0, 40);

    expect(() => decodeWav(data)).toThrow("16-bit");
  });
});
