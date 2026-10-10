/**
 * Compiler WAV Output
 *
 * Renders a Library entry's stored preset to audio and encodes it as a
 * 16-bit PCM WAV file. Rendering goes through the project's offline
 * renderer (`renderPreset`), which wraps the platform Web Audio
 * `OfflineAudioContext` — the same deterministic offline path used
 * everywhere else in ToneForge.
 *
 * Note on the PRD: `COMPILER_PRD.md` refers to "Tone.js Tone.Offline".
 * ToneForge does not depend on Tone.js; the equivalent offline-render
 * capability is provided by `src/core/renderer.ts`. Using the existing
 * renderer avoids a new runtime dependency while preserving the
 * required behaviour (deterministic offline WAV generation).
 *
 * Reference: docs/prd/COMPILER_PRD.md Sections 6, 10.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { encodeWav } from "../audio/wav-encoder.js";
import { renderPreset } from "../core/renderer.js";
import type { LibraryEntry } from "../library/types.js";

/** A rendered, encoded asset ready to be written to disk. */
export interface CompiledAssetOutput {
  /** Library entry id. */
  assetId: string;
  /** Category-relative output path (`<category>/<assetId>.wav`). */
  file: string;
  /** Encoded WAV bytes. */
  bytes: Buffer;
  /** Rendered sample rate in Hz. */
  sampleRate: number;
  /** Rendered duration in seconds. */
  duration: number;
}

/**
 * Deterministic output path for an entry, relative to the build root.
 *
 * Paths use forward slashes so manifests are identical across platforms.
 */
export function assetOutputPath(entry: LibraryEntry): string {
  return `${entry.category}/${entry.id}.wav`;
}

/**
 * Render a Library entry to WAV bytes without touching the disk.
 *
 * The entry's stored preset (`recipe`, `seed`, `params`) drives the
 * render; `entry.duration` pins the render window so the compiled WAV
 * reproduces the curated asset exactly.
 *
 * @throws If the recipe is unknown or the offline render fails.
 */
export async function renderAsset(
  entry: LibraryEntry,
): Promise<CompiledAssetOutput> {
  const rendered = await renderPreset(
    {
      recipe: entry.preset.recipe,
      seed: entry.preset.seed,
      overrides: entry.preset.params,
    },
    entry.duration,
  );

  const bytes = encodeWav(rendered.samples, { sampleRate: rendered.sampleRate });

  return {
    assetId: entry.id,
    file: assetOutputPath(entry),
    bytes,
    sampleRate: rendered.sampleRate,
    duration: rendered.duration,
  };
}

/**
 * Write an encoded asset to `<outputDir>/<output.file>`, creating any
 * missing parent directories.
 *
 * @returns The relative path that was written.
 */
export async function writeAsset(
  output: CompiledAssetOutput,
  outputDir: string,
): Promise<string> {
  const destination = resolve(outputDir, output.file);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, output.bytes);
  return output.file;
}
