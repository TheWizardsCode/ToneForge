import { describe, it, expect } from "vitest";
import { OfflineAudioContext } from "node-web-audio-api";
import { loadSample } from "./sample-loader.js";
import { compareBuffers, formatCompareResult } from "../test-utils/buffer-compare.js";

describe("loadSample", () => {
  it("decodes a WAV file and returns an AudioBuffer with correct properties", async () => {
    // test-tone.wav is a 0.01s 440Hz sine at 44100Hz = 441 samples
    const ctx = new OfflineAudioContext(1, 441, 44100);
    const buffer = await loadSample(
      "../../src/test-utils/fixtures/test-tone.wav",
      ctx,
    );

    expect(buffer.numberOfChannels).toBe(1);
    expect(buffer.sampleRate).toBe(44100);
    expect(buffer.length).toBe(441);
  });

  it("decodes the footstep-gravel sample", async () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const buffer = await loadSample("footstep-gravel/impact.wav", ctx);

    expect(buffer.numberOfChannels).toBe(1);
    expect(buffer.sampleRate).toBe(44100);
    expect(buffer.length).toBe(6615); // 0.15s * 44100
  });

  it("decodes the creature-vocal sample", async () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const buffer = await loadSample("creature-vocal/growl.wav", ctx);

    expect(buffer.numberOfChannels).toBe(1);
    expect(buffer.sampleRate).toBe(44100);
    expect(buffer.length).toBe(17640); // 0.4s * 44100
  });

  it("decodes the vehicle-engine sample", async () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const buffer = await loadSample("vehicle-engine/loop.wav", ctx);

    expect(buffer.numberOfChannels).toBe(1);
    expect(buffer.sampleRate).toBe(44100);
    expect(buffer.length).toBe(13230); // 0.3s * 44100
  });

  it("produces byte-identical AudioBuffer data across 10 decodes", async () => {
    const buffers: Float32Array[] = [];

    for (let i = 0; i < 10; i++) {
      const ctx = new OfflineAudioContext(1, 44100, 44100);
      const audioBuffer = await loadSample("footstep-gravel/impact.wav", ctx);
      buffers.push(new Float32Array(audioBuffer.getChannelData(0)));
    }

    const reference = buffers[0]!;
    for (let i = 1; i < buffers.length; i++) {
      const comparison = compareBuffers(reference, buffers[i]!);
      expect(
        comparison.identical,
        `Decode ${i} diverged from reference:\n${formatCompareResult(comparison)}`,
      ).toBe(true);
    }
  });

  it("throws a clear error for nonexistent sample path", async () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100);

    await expect(
      loadSample("nonexistent/missing.wav", ctx),
    ).rejects.toThrow(/Failed to load sample "nonexistent\/missing\.wav"/);
  });

  it("decoded audio contains non-zero samples", async () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const buffer = await loadSample("footstep-gravel/impact.wav", ctx);
    const samples = buffer.getChannelData(0);
    const nonZero = Array.from(samples).filter((s) => s !== 0).length;
    expect(nonZero).toBeGreaterThan(0);
  });
});
