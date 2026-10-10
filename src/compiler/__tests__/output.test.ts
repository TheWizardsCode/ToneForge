import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeWav } from "../../audio/wav-encoder.js";
import { assetOutputPath, renderAsset, writeAsset } from "../output.js";
import { makeEntry } from "./helpers.js";

const SAMPLE_RATE = 44100;

describe("assetOutputPath", () => {
  it("returns a POSIX-style category-relative path", () => {
    const entry = makeEntry({ id: "lib-abc", category: "Impact" });
    expect(assetOutputPath(entry)).toBe("Impact/lib-abc.wav");
  });
});

describe("renderAsset", () => {
  it("renders an entry to a valid 16-bit PCM WAV", async () => {
    const entry = makeEntry({
      id: "lib-chime",
      category: "UI",
      seed: 1,
      duration: 0.1,
    });
    const output = await renderAsset(entry);

    expect(output.assetId).toBe("lib-chime");
    expect(output.file).toBe("UI/lib-chime.wav");
    expect(output.sampleRate).toBe(SAMPLE_RATE);
    expect(output.duration).toBeCloseTo(0.1, 5);

    // 44-byte header + (samples * 2 bytes) for 16-bit mono PCM.
    expect(output.bytes.length).toBe(44 + Math.round(0.1 * SAMPLE_RATE) * 2);
    expect(output.bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(output.bytes.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(output.bytes.subarray(12, 16).toString("ascii")).toBe("fmt ");
    // PCM format code = 1.
    expect(output.bytes.readUInt16LE(20)).toBe(1);
    // Bits per sample = 16.
    expect(output.bytes.readUInt16LE(34)).toBe(16);
  });

  it("is deterministic for the same entry", async () => {
    const entry = makeEntry({ id: "lib-chime", seed: 7, duration: 0.1 });
    const first = await renderAsset(entry);
    const second = await renderAsset(entry);
    expect(Buffer.compare(first.bytes, second.bytes)).toBe(0);
  });

  it("produces different bytes for different seeds", async () => {
    const a = await renderAsset(makeEntry({ id: "lib-a", seed: 1, duration: 0.1 }));
    const b = await renderAsset(makeEntry({ id: "lib-b", seed: 2, duration: 0.1 }));
    expect(Buffer.compare(a.bytes, b.bytes)).not.toBe(0);
  });

  it("applies preset parameter overrides", async () => {
    const base = makeEntry({ id: "lib-a", seed: 1, duration: 0.1 });
    const overridden = makeEntry({
      id: "lib-a",
      seed: 1,
      duration: 0.1,
      params: { fundamentalFreq: 1200, harmonicCount: 2 },
    });
    const a = await renderAsset(base);
    const b = await renderAsset(overridden);
    expect(Buffer.compare(a.bytes, b.bytes)).not.toBe(0);
  });
});

describe("writeAsset", () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), "toneforge-compiler-out-"));
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it("writes encoded bytes to a nested, auto-created directory", async () => {
    // Use a hand-built output so the test does not depend on the renderer.
    const bytes = encodeWav(new Float32Array([0.1, -0.1, 0.2]), {
      sampleRate: SAMPLE_RATE,
    });
    const output = {
      assetId: "lib-x",
      file: "UI/lib-x.wav",
      bytes,
      sampleRate: SAMPLE_RATE,
      duration: 3 / SAMPLE_RATE,
    };

    const written = await writeAsset(output, outDir);
    expect(written).toBe("UI/lib-x.wav");

    const onDisk = await readFile(join(outDir, "UI/lib-x.wav"));
    expect(Buffer.compare(onDisk, bytes)).toBe(0);
  });
});
