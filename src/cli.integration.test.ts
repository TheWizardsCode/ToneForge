/**
 * CLI Integration Tests (always run)
 *
 * Unlike cli.test.ts, these tests do NOT mock playAudio.
 * They exercise the pipeline from render through WAV encoding and file I/O
 * without requiring a system audio player to be installed.
 *
 * For full end-to-end tests that include player detection and actual
 * playback, see cli.e2e.test.ts (run via `npm run test:e2e`).
 *
 * Work item: TF-0MLW2GCS31CTRQ4T
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderRecipe } from "./core/renderer.js";
import { encodeWav } from "./audio/wav-encoder.js";

describe("CLI Integration — render and WAV encode pipeline (no mocks)", () => {
  it("renders audio and encodes a valid WAV file", async () => {
    // Step 1: Render — exercises the real OfflineAudioContext pipeline
    const result = await renderRecipe("ui-scifi-confirm", 42);

    expect(result.samples).toBeInstanceOf(Float32Array);
    expect(result.samples.length).toBeGreaterThan(0);
    expect(result.sampleRate).toBe(44100);
    expect(result.duration).toBeGreaterThan(0);

    // Step 2: WAV encode — exercises the real encoder
    const wav = encodeWav(result.samples, { sampleRate: result.sampleRate });

    expect(wav).toBeInstanceOf(Buffer);
    expect(wav.length).toBeGreaterThan(44); // Header + some data

    // Validate RIFF header
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.toString("ascii", 12, 16)).toBe("fmt ");
    expect(wav.toString("ascii", 36, 40)).toBe("data");

    // Validate data chunk size matches rendered samples
    const dataSize = wav.readUInt32LE(40);
    expect(dataSize).toBe(result.samples.length * 2); // 16-bit = 2 bytes per sample
  });

  it("writes a valid WAV temp file to disk", async () => {
    const result = await renderRecipe("ui-scifi-confirm", 42);
    const wav = encodeWav(result.samples, { sampleRate: result.sampleRate });

    // Write to a temp file just like playAudio does
    const tempPath = join(tmpdir(), `toneforge-integration-test-${Date.now()}.wav`);

    try {
      await writeFile(tempPath, wav);

      // Verify the file exists and has the correct size
      expect(existsSync(tempPath)).toBe(true);
      const fileContents = readFileSync(tempPath);
      expect(fileContents.length).toBe(wav.length);

      // Verify file starts with RIFF header (not corrupted during write)
      expect(fileContents.toString("ascii", 0, 4)).toBe("RIFF");
    } finally {
      // Clean up
      try { unlinkSync(tempPath); } catch { /* ignore */ }
    }
  });

  it("WAV byte count matches render output exactly", async () => {
    const result = await renderRecipe("ui-scifi-confirm", 99);
    const wav = encodeWav(result.samples, { sampleRate: result.sampleRate });

    // 44-byte WAV header + (samples * 2 bytes per 16-bit sample)
    const expectedSize = 44 + result.samples.length * 2;
    expect(wav.length).toBe(expectedSize);
  });

  it("multiple seeds produce different WAV files", async () => {
    const result1 = await renderRecipe("ui-scifi-confirm", 1);
    const result2 = await renderRecipe("ui-scifi-confirm", 9999);

    const wav1 = encodeWav(result1.samples, { sampleRate: result1.sampleRate });
    const wav2 = encodeWav(result2.samples, { sampleRate: result2.sampleRate });

    // Different seeds should produce different WAV content
    // (they may differ in length and/or sample data)
    const differ = wav1.length !== wav2.length || !wav1.equals(wav2);
    expect(differ).toBe(true);
  });
});
