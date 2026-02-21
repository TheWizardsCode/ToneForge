import { describe, it, expect } from "vitest";
import { encodeWav } from "./wav-encoder.js";

describe("encodeWav", () => {
  it("produces a buffer starting with RIFF header magic bytes", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const wav = encodeWav(samples);

    // First 4 bytes: "RIFF"
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    // Bytes 8-12: "WAVE"
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
  });

  it("contains a valid fmt sub-chunk", () => {
    const samples = new Float32Array([0.25, -0.25]);
    const wav = encodeWav(samples);

    // fmt sub-chunk ID at offset 12
    expect(wav.toString("ascii", 12, 16)).toBe("fmt ");
    // fmt sub-chunk size: 16 (PCM)
    expect(wav.readUInt32LE(16)).toBe(16);
    // Audio format: 1 (PCM)
    expect(wav.readUInt16LE(20)).toBe(1);
    // Channels: 1 (mono)
    expect(wav.readUInt16LE(22)).toBe(1);
    // Sample rate: 44100
    expect(wav.readUInt32LE(24)).toBe(44100);
    // Byte rate: 44100 * 1 * 2 = 88200
    expect(wav.readUInt32LE(28)).toBe(88200);
    // Block align: 1 * 2 = 2
    expect(wav.readUInt16LE(32)).toBe(2);
    // Bits per sample: 16
    expect(wav.readUInt16LE(34)).toBe(16);
  });

  it("contains a valid data sub-chunk with correct size", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const wav = encodeWav(samples);

    // data sub-chunk ID at offset 36
    expect(wav.toString("ascii", 36, 40)).toBe("data");
    // data sub-chunk size: 5 samples * 2 bytes = 10
    expect(wav.readUInt32LE(40)).toBe(10);
  });

  it("has correct overall RIFF chunk size", () => {
    const samples = new Float32Array([0, 0.5, -0.5]);
    const wav = encodeWav(samples);

    // RIFF chunk size = fileSize - 8
    // fileSize = 44 header + (3 samples * 2 bytes) = 50
    // RIFF chunk size = 50 - 8 = 42
    expect(wav.readUInt32LE(4)).toBe(42);
  });

  it("has correct total buffer length", () => {
    const samples = new Float32Array(100);
    const wav = encodeWav(samples);

    // 44 byte header + 100 samples * 2 bytes = 244
    expect(wav.length).toBe(244);
  });

  it("correctly encodes sample values as 16-bit PCM", () => {
    const samples = new Float32Array([0, 1, -1, 0.5, -0.5]);
    const wav = encodeWav(samples);

    // Data starts at offset 44
    // Sample 0: 0.0 -> 0
    expect(wav.readInt16LE(44)).toBe(0);
    // Sample 1: 1.0 -> 32767 (max positive)
    expect(wav.readInt16LE(46)).toBe(32767);
    // Sample 2: -1.0 -> -32768 (max negative)
    expect(wav.readInt16LE(48)).toBe(-32768);
    // Sample 3: 0.5 -> ~16384
    expect(wav.readInt16LE(50)).toBe(16384);
    // Sample 4: -0.5 -> ~-16384
    expect(wav.readInt16LE(52)).toBe(-16384);
  });

  it("clamps values outside [-1, 1] range", () => {
    const samples = new Float32Array([2.0, -3.0]);
    const wav = encodeWav(samples);

    // Values should be clamped to [-1, 1] before conversion
    expect(wav.readInt16LE(44)).toBe(32767);  // 2.0 clamped to 1.0
    expect(wav.readInt16LE(46)).toBe(-32768); // -3.0 clamped to -1.0
  });

  it("throws on empty buffer", () => {
    const empty = new Float32Array(0);
    expect(() => encodeWav(empty)).toThrow("empty");
  });

  it("respects custom sample rate option", () => {
    const samples = new Float32Array([0.1]);
    const wav = encodeWav(samples, { sampleRate: 48000 });

    expect(wav.readUInt32LE(24)).toBe(48000);
    // Byte rate: 48000 * 1 * 2 = 96000
    expect(wav.readUInt32LE(28)).toBe(96000);
  });

  it("produces identical output for identical input", () => {
    const samples = new Float32Array([0, 0.1, 0.2, 0.3, -0.5, 0.9]);
    const wav1 = encodeWav(samples);
    const wav2 = encodeWav(samples);

    expect(Buffer.compare(wav1, wav2)).toBe(0);
  });
});
