/**
 * Runtime SFX Parameter Modulation
 *
 * Applies the abstract `setSfxParameter` values (`intensity`, `gain`, `pitch`,
 * `filter`) to a rendered buffer so a parameter change is audible on the next
 * playback pass of a continuous/looping voice.
 *
 * The Node playback path renders (and plays) a whole WAV per event, so a
 * buffer already handed to the system player cannot be retuned. Modulation is
 * therefore **iteration-granular**: `createRuntimeSession` re-renders each
 * transport iteration and this module transforms the freshly-rendered buffer
 * before it is scheduled. A parameter change becomes audible on the next loop
 * pass — no second scheduler is introduced.
 *
 * Recipe parameter *overrides* (`renderPreset({ overrides })`) only honour
 * parameters a recipe declares; the abstract SFX parameter names are not
 * recipe parameters, so they are applied here as deterministic DSP rather than
 * being passed through as render overrides.
 *
 * Reference: docs/prd/RUNTIME_PRD.md §6, §19.9
 */

import type { RenderResult } from "../core/renderer.js";

/** The four modulatable parameter names (mirrors `SfxParameterName`). */
export type SfxModulationName = "intensity" | "gain" | "pitch" | "filter";

/** Current parameter values to apply; omitted names are left untouched. */
export type SfxModulationValues = Partial<Record<SfxModulationName, number>>;

/** Lowest one-pole low-pass coefficient (`filter: 0`) — a dark, muffled tone. */
const MIN_FILTER_ALPHA = 0.02;

/**
 * Apply SFX parameter modulation to a rendered buffer.
 *
 * Returns the input `result` unchanged when no parameters are set, so the
 * unmmodulated path stays byte-identical and allocation-free.
 *
 * Transform order: pitch (resample) → filter (one-pole low-pass) → amplitude
 * (`gain` × `intensity`). All operations are deterministic and never mutate
 * the input samples (the render cache shares them).
 *
 * @param result - The rendered buffer.
 * @param values - Parameter values to apply.
 * @returns A new {@link RenderResult} when anything changed, else `result`.
 */
export function applySfxParameters(
  result: RenderResult,
  values: SfxModulationValues,
): RenderResult {
  const { intensity, gain, pitch, filter } = values;
  if (
    intensity === undefined &&
    gain === undefined &&
    pitch === undefined &&
    filter === undefined
  ) {
    return result;
  }

  let samples = result.samples;
  let sampleRate = result.sampleRate;

  if (pitch !== undefined && pitch !== 1) {
    samples = resample(samples, pitch);
  }

  if (filter !== undefined && filter < 1) {
    samples = lowpass(samples, filter);
  }

  const amplitude = (gain ?? 1) * (intensity ?? 1);
  if (amplitude !== 1) {
    samples = scale(samples, amplitude);
  }

  if (samples === result.samples) {
    return result;
  }

  return {
    ...result,
    samples,
    duration: samples.length / sampleRate,
  };
}

/**
 * Resample by a playback-rate ratio (tape-style pitch shift).
 *
 * `pitch > 1` shortens the buffer (higher and shorter); `pitch < 1`
 * lengthens it. Uses linear interpolation between the two nearest input
 * samples so the result is continuous.
 */
function resample(input: Float32Array, ratio: number): Float32Array {
  if (ratio <= 0) return input;

  const outLength = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const src = i * ratio;
    const index = Math.floor(src);
    const fraction = src - index;
    const a = input[index] ?? 0;
    const b = input[index + 1] ?? a;
    out[i] = a + (b - a) * fraction;
  }

  return out;
}

/**
 * One-pole low-pass filter.
 *
 * @param input - Input samples.
 * @param normalizedCutoff - Cutoff in `[0, 1]`; 1 is transparent, 0 is the
 *   darkest supported setting.
 */
function lowpass(input: Float32Array, normalizedCutoff: number): Float32Array {
  const alpha = Math.min(
    1,
    Math.max(MIN_FILTER_ALPHA, normalizedCutoff),
  );
  const out = new Float32Array(input.length);
  let previous = input.length > 0 ? input[0]! : 0;

  for (let i = 0; i < input.length; i++) {
    previous = previous + alpha * (input[i]! - previous);
    out[i] = previous;
  }

  return out;
}

/** Scale every sample by a constant amplitude multiplier. */
function scale(input: Float32Array, amplitude: number): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = input[i]! * amplitude;
  }
  return out;
}
