// @vitest-environment happy-dom
/**
 * WAV export tests: header validity, determinism, round-trip sample equality,
 * typed errors, the download helper and the editor export API.
 *
 * AC (TF-0MUV1231O00873IF): valid WAV via the existing encoder; byte-identical
 * across calls and matching renderPreset samples; editor API + download helper;
 * offline-only (no live AudioContext); typed error for unknown recipes.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeWav } from "@toneforge/audio/wav-encoder.js";
import { renderPreset } from "@toneforge/core/renderer.js";
import {
  PresetExportError,
  createSoundEditor,
  createWavDownload,
  exportWav,
  wavFilename,
} from "../index.js";
import type { SoundPreset } from "../../../models/preset.js";

const PRESET: SoundPreset = {
  version: 1,
  recipe: "ui-scifi-confirm",
  seed: 42,
  overrides: {},
};

function bytesToAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("exportWav", () => {
  it("produces a valid RIFF/WAVE header", async () => {
    const bytes = await exportWav(PRESET);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    expect(bytesToAscii(bytes, 0, 4)).toBe("RIFF");
    expect(bytesToAscii(bytes, 8, 4)).toBe("WAVE");
    expect(bytesToAscii(bytes, 12, 4)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16); // bit depth
    expect(bytesToAscii(bytes, 36, 4)).toBe("data");

    const dataSize = view.getUint32(40, true);
    expect(bytes.length).toBe(44 + dataSize);
    expect(dataSize % 2).toBe(0);
  });

  it("is byte-identical across calls (deterministic)", async () => {
    const first = await exportWav(PRESET);
    const second = await exportWav(PRESET);
    expect(second).toEqual(first);
  });

  it("matches the samples returned by renderPreset (round-trip)", async () => {
    const rendered = await renderPreset(PRESET);
    const expected = Uint8Array.from(
      encodeWav(rendered.samples, {
        sampleRate: rendered.sampleRate,
        channels: rendered.numberOfChannels,
      }),
    );
    const bytes = await exportWav(PRESET);
    expect(bytes).toEqual(expected);
  });

  it("throws a typed error for an unknown recipe", async () => {
    await expect(
      exportWav({ version: 1, recipe: "no-such-recipe", seed: 1, overrides: {} }),
    ).rejects.toBeInstanceOf(PresetExportError);
  });

  it("works without any live AudioContext", async () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("live AudioContext must not be used for export");
        }
      },
    );
    const bytes = await exportWav(PRESET);
    expect(bytesToAscii(bytes, 0, 4)).toBe("RIFF");
  });
});

describe("createWavDownload", () => {
  it("derives a deterministic filename from recipe + seed", async () => {
    const download = await createWavDownload(PRESET);
    expect(download.filename).toBe("ui-scifi-confirm-seed-42.wav");
    expect(wavFilename(PRESET)).toBe(download.filename);
    expect(download.blob.type).toBe("audio/wav");
    expect(download.blob.size).toBe(download.bytes.length);
  });

  it("triggers an anchor click with the download filename", async () => {
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const download = await createWavDownload(PRESET);
    download.download();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});

describe("editor export API", () => {
  it("exposes exportWav for the current preset without mounting", async () => {
    const editor = createSoundEditor({ preset: PRESET });
    const bytes = await editor.exportWav();
    expect(bytesToAscii(bytes, 0, 4)).toBe("RIFF");

    const custom = await editor.exportWav({ ...PRESET, seed: 7 });
    expect(custom.length).toBeGreaterThan(44);
    expect(custom).not.toEqual(bytes);
    editor.dispose();
  });
});
