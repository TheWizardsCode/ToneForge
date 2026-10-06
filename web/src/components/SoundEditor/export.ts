/**
 * WAV export for the SoundEditor.
 *
 * Renders the current preset offline (no live `AudioContext` required) and
 * encodes it with the existing ToneForge WAV encoder. Also provides a
 * host-usable download helper (Blob + anchor click).
 */

import { encodeWav } from "@toneforge/audio/wav-encoder.js";
import { registry } from "@toneforge/recipes/index.js";
import type { SoundPreset } from "../../models/preset.js";

/** Thrown when a preset cannot be exported (e.g. unknown recipe). */
export class PresetExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresetExportError";
  }
}

/** Bytes + host download helper for an exported preset. */
export interface WavExport {
  /** Encoded WAV bytes. */
  bytes: Uint8Array;
  /** Deterministic filename derived from recipe + seed. */
  filename: string;
  /** The same bytes as a `Blob` (type `audio/wav`). */
  blob: Blob;
  /** Trigger a browser download (no-op outside a DOM environment). */
  download(): void;
}

/** Deterministic filename for a preset. */
export function wavFilename(preset: SoundPreset): string {
  return `${preset.recipe}-seed-${preset.seed}.wav`;
}

/**
 * Render a preset offline and encode it as a WAV.
 *
 * @throws {PresetExportError} If the recipe is not registered.
 */
export async function exportWav(preset: SoundPreset): Promise<Uint8Array> {
  if (!registry.getRegistration(preset.recipe)) {
    throw new PresetExportError(`Unknown recipe: ${preset.recipe}`);
  }

  const { renderPreset } = await import("@toneforge/core/renderer.js");
  const result = await renderPreset(preset);

  const buffer = encodeWav(result.samples, {
    sampleRate: result.sampleRate,
    channels: result.numberOfChannels,
  });
  // Copy out of the Buffer into a plain Uint8Array for the host.
  return Uint8Array.from(buffer);
}

/** Render a preset and build a host-usable WAV download. */
export async function createWavDownload(preset: SoundPreset): Promise<WavExport> {
  const bytes = await exportWav(preset);
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], { type: "audio/wav" });
  const filename = wavFilename(preset);

  return {
    bytes,
    filename,
    blob,
    download(): void {
      if (typeof document === "undefined") {
        return;
      }
      const canObjectUrl =
        typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
      const url = canObjectUrl ? URL.createObjectURL(blob) : "";
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      anchor.click();
      if (url && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(url);
      }
    },
  };
}
