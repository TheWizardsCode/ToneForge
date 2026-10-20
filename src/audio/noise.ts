/**
 * Shared Seeded Noise Buffer Module
 *
 * Generates deterministic white, pink and brown noise buffers from an injected
 * seeded RNG. The module is shared by ToneGraph `noise` nodes (recipes) and by
 * the instrument engine's noise voices, so a single implementation keeps every
 * noise source reproducible and avoids duplicated filter banks.
 *
 * The generator itself owns no runtime resources beyond the passed-in
 * `BaseAudioContext`: it fills a mono `AudioBuffer` sample by sample from the
 * seeded RNG, which keeps output byte-identical across Node.js and browsers.
 *
 * Usage:
 *   import { generateNoiseBuffer } from "./noise.js";
 *   source.buffer = generateNoiseBuffer(ctx, 0.5, "pink", rng);
 *
 * Reference: docs/modules/instruments.md
 */

import type { Rng } from "../core/rng.js";

/**
 * The noise colours supported by {@link generateNoiseBuffer}.
 *
 * - `white` — flat spectrum, uniform random samples in [-1, 1).
 * - `pink` — 1/f spectrum (equal energy per octave), Paul Kellet filter bank.
 * - `brown` — 1/f² spectrum (integrated white noise), leaky integrator.
 */
export type NoiseColor = "white" | "pink" | "brown";

/** Every accepted noise colour, in spectral-brightness order. */
export const NOISE_COLORS: readonly NoiseColor[] = ["white", "pink", "brown"];

/**
 * Type guard for {@link NoiseColor}.
 *
 * @param value - Any candidate value (for example a colour read from an
 *   untyped JSON document).
 * @returns `true` when the value is one of the accepted noise colours.
 */
export function isNoiseColor(value: unknown): value is NoiseColor {
  return value === "white" || value === "pink" || value === "brown";
}

/**
 * Assert that `color` is an accepted noise colour.
 *
 * @param color - Candidate colour value.
 * @throws {Error} When the value is not an accepted noise colour. The message
 *   names the accepted values so a recipe or instrument author can correct it.
 */
export function assertNoiseColor(color: unknown): asserts color is NoiseColor {
  if (!isNoiseColor(color)) {
    throw new Error(
      `Unsupported noise colour "${String(color)}". Accepted values are: ${NOISE_COLORS.join(", ")}.`,
    );
  }
}

/**
 * Generate a deterministic mono noise buffer from a seeded RNG.
 *
 * The same `color`, `durationSeconds`, sample rate and RNG sequence always
 * produce byte-identical samples. Exactly one RNG draw is consumed per frame
 * for white and brown noise; pink noise also consumes one draw per frame, so
 * the caller's RNG draw order stays predictable.
 *
 * @param ctx - Audio context used to allocate the buffer (its `sampleRate`
 *   and `createBuffer` are the only context features required).
 * @param durationSeconds - Requested buffer length in seconds. The frame count
 *   is rounded up and clamped to at least one frame.
 * @param color - Noise colour: `white`, `pink` or `brown`.
 * @param rng - Seeded RNG returning values in [0, 1) (see `createRng`).
 * @returns A one-channel `AudioBuffer` of the generated noise.
 * @throws {Error} When `color` is not an accepted noise colour.
 */
export function generateNoiseBuffer(
  ctx: BaseAudioContext,
  durationSeconds: number,
  color: NoiseColor,
  rng: Rng,
): AudioBuffer {
  assertNoiseColor(color);

  const frameCount = Math.max(1, Math.ceil(ctx.sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // White noise: one independent uniform sample per frame (flat spectrum).
  if (color === "white") {
    for (let i = 0; i < frameCount; i += 1) {
      data[i] = (rng() * 2) - 1;
    }
    return buffer;
  }

  // Brown noise: leaky integration of white noise. The integrator gain (0.02)
  // and leak (1.02) produce a 1/f² slope; the 3.5 output gain restores a
  // usable level after integration.
  if (color === "brown") {
    let last = 0;
    for (let i = 0; i < frameCount; i += 1) {
      const white = (rng() * 2) - 1;
      last = (last + (0.02 * white)) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  // Pink noise: Paul Kellet's economy filter bank. Seven one-pole sections
  // approximate a 1/f slope; their sum is scaled by 0.11 to keep the result
  // in a comparable range to white noise.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < frameCount; i += 1) {
    const white = (rng() * 2) - 1;
    b0 = (0.99886 * b0) + (white * 0.0555179);
    b1 = (0.99332 * b1) + (white * 0.0750759);
    b2 = (0.96900 * b2) + (white * 0.1538520);
    b3 = (0.86650 * b3) + (white * 0.3104856);
    b4 = (0.55000 * b4) + (white * 0.5329522);
    b5 = (-0.7616 * b5) - (white * 0.0168980);
    const sample = b0 + b1 + b2 + b3 + b4 + b5 + (b6 + (white * 0.5362));
    data[i] = sample * 0.11;
    b6 = white * 0.115926;
  }

  return buffer;
}
