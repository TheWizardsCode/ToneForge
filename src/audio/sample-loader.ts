/**
 * Cross-Platform Sample Loader
 *
 * Loads and decodes WAV sample files from disk (Node.js) or network
 * (browser) and returns a decoded AudioBuffer.
 *
 * Usage:
 *   const buffer = await loadSample("footstep-gravel/impact.wav", ctx);
 *
 * Paths are relative to the `assets/samples/` directory:
 * - Node.js: resolved relative to the project root.
 * - Browser: fetched from the Vite dev server static assets.
 *
 * Reference: docs/prd/CORE_PRD.md Section 5
 */

import { resolve, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { OfflineAudioContext, AudioBuffer } from "node-web-audio-api";

/** Directory of this file (src/audio/) */
const __dirname = dirname(fileURLToPath(import.meta.url));

/** Project root (two levels up from src/audio/) */
const PROJECT_ROOT = resolve(__dirname, "..", "..");

/**
 * Detect whether we are running in a browser environment.
 */
function isBrowser(): boolean {
  return typeof globalThis.window !== "undefined"
    && typeof globalThis.fetch === "function";
}

/**
 * Load and decode a WAV sample file, returning a decoded AudioBuffer.
 *
 * @param relativePath - Path relative to `assets/samples/` (e.g.,
 *   "footstep-gravel/impact.wav").
 * @param ctx - An OfflineAudioContext (or AudioContext in browser)
 *   used for `decodeAudioData`.
 * @returns Promise resolving to the decoded AudioBuffer.
 * @throws If the file cannot be found or decoded.
 */
export async function loadSample(
  relativePath: string,
  ctx: OfflineAudioContext,
): Promise<AudioBuffer> {
  if (isBrowser()) {
    return loadSampleBrowser(relativePath, ctx);
  }
  return loadSampleNode(relativePath, ctx);
}

/**
 * Node.js path: read file from disk and decode via OfflineAudioContext.
 */
async function loadSampleNode(
  relativePath: string,
  ctx: OfflineAudioContext,
): Promise<AudioBuffer> {
  const fullPath = resolve(PROJECT_ROOT, "assets", "samples", relativePath);

  let fileBuffer: Buffer;
  try {
    fileBuffer = readFileSync(fullPath);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to load sample "${relativePath}" at ${fullPath}: ${message}`,
    );
  }

  // Convert Node.js Buffer to ArrayBuffer for decodeAudioData.
  // Use Uint8Array to ensure we get a proper ArrayBuffer (not SharedArrayBuffer).
  const uint8 = new Uint8Array(fileBuffer);
  const arrayBuffer = uint8.buffer.slice(
    uint8.byteOffset,
    uint8.byteOffset + uint8.byteLength,
  ) as ArrayBuffer;

  return ctx.decodeAudioData(arrayBuffer);
}

/**
 * Browser path: fetch from the dev server and decode via AudioContext.
 */
async function loadSampleBrowser(
  relativePath: string,
  ctx: OfflineAudioContext,
): Promise<AudioBuffer> {
  const url = `/assets/samples/${relativePath}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to load sample "${relativePath}" from ${url}: ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}
