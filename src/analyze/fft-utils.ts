/**
 * FFT Utilities
 *
 * Wrapper around an FFT npm package for spectral analysis.
 *
 * **Package evaluation:**
 * Two candidates were evaluated for pure-JS FFT:
 *
 * 1. `fft.js` (v4.0.4) — Radix-4 FFT, pure JS, no native dependencies,
 *    deterministic, widely used (~1.4M weekly downloads), zero dependencies.
 *    Produces real/imaginary output arrays. MIT license.
 *
 * 2. `ml-fft` (v1.3.5) — Pure JS FFT from the mljs ecosystem. Smaller user
 *    base (~8K weekly downloads), less documentation, but functional.
 *
 * **Selected: `fft.js`** — Preferred for its larger user base, zero
 * dependencies, well-documented API, and radix-4 performance. Deterministic
 * output confirmed: same input produces identical output across runs.
 */

import FFT from "fft.js";

/**
 * Compute the magnitude spectrum of a real-valued signal.
 *
 * The input is zero-padded or truncated to the nearest power of two.
 * Returns an array of magnitudes for frequency bins 0 through N/2
 * (inclusive), where N is the FFT size.
 *
 * @param samples - Real-valued audio samples.
 * @param fftSize - FFT size (must be a power of two). Defaults to the
 *                  largest power of two <= samples.length, minimum 256.
 * @returns Array of magnitudes for each frequency bin.
 */
export function computeMagnitudeSpectrum(
  samples: Float32Array,
  fftSize?: number,
): Float64Array {
  const size = fftSize ?? nearestPowerOfTwo(samples.length);
  const n = Math.max(256, size);

  const fft = new FFT(n);
  const input = new Array(n).fill(0);

  // Copy samples into the input array (truncating if longer)
  const copyLen = Math.min(samples.length, n);
  for (let i = 0; i < copyLen; i++) {
    input[i] = samples[i]!;
  }

  // Apply Hanning window to reduce spectral leakage.
  // Without windowing, abrupt signal boundaries spread energy across many
  // bins, pulling metrics like spectral centroid away from the true value.
  applyHanningWindow(input, n);

  const complexOut = fft.createComplexArray();
  fft.realTransform(complexOut, input);

  // Compute magnitudes for bins 0..N/2
  const numBins = n / 2 + 1;
  const magnitudes = new Float64Array(numBins);

  for (let i = 0; i < numBins; i++) {
    const re = complexOut[2 * i] as number;
    const im = complexOut[2 * i + 1] as number;
    magnitudes[i] = Math.sqrt(re * re + im * im);
  }

  return magnitudes;
}

/**
 * Apply a Hanning window in-place.
 *
 * w(i) = 0.5 * (1 - cos(2*pi*i / (N-1)))
 *
 * This tapers the signal at both ends, reducing spectral leakage caused
 * by the implicit rectangular window of a finite-length DFT.
 */
function applyHanningWindow(buf: number[], n: number): void {
  if (n <= 1) return;
  const factor = (2 * Math.PI) / (n - 1);
  for (let i = 0; i < n; i++) {
    buf[i]! *= 0.5 * (1 - Math.cos(factor * i));
  }
}

/**
 * Find the largest power of two less than or equal to n.
 */
function nearestPowerOfTwo(n: number): number {
  if (n <= 0) return 256;
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}
