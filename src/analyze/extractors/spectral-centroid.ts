/**
 * Spectral Centroid Extractor
 *
 * Computes spectral centroid (in Hz) using FFT magnitude spectrum.
 * Spectral centroid indicates the "brightness" or "center of mass"
 * of the frequency spectrum.
 *
 * Reference: docs/prd/ANALYZE_PRD.md
 */

import type { MetricExtractor } from "../types.js";
import { computeMagnitudeSpectrum } from "../fft-utils.js";

/**
 * Extracts spectral metrics: spectralCentroid (Hz).
 *
 * The spectral centroid is the weighted mean of frequencies,
 * weighted by their magnitudes:
 *   centroid = sum(freq[i] * mag[i]) / sum(mag[i])
 *
 * Returns 0 for silent (all-zero) buffers.
 */
export class SpectralCentroidExtractor implements MetricExtractor {
  readonly name = "spectral-centroid";
  readonly category = "spectral";

  extract(
    samples: Float32Array,
    sampleRate: number,
  ): Record<string, number | boolean | string | null> {
    if (samples.length === 0) {
      return { spectralCentroid: 0 };
    }

    // Check for all-zero buffer (avoid unnecessary FFT)
    let hasSignal = false;
    for (let i = 0; i < samples.length; i++) {
      if (samples[i] !== 0) {
        hasSignal = true;
        break;
      }
    }
    if (!hasSignal) {
      return { spectralCentroid: 0 };
    }

    const magnitudes = computeMagnitudeSpectrum(samples);
    const fftSize = (magnitudes.length - 1) * 2;
    const binWidth = sampleRate / fftSize;

    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < magnitudes.length; i++) {
      const freq = i * binWidth;
      const mag = magnitudes[i]!;
      weightedSum += freq * mag;
      magnitudeSum += mag;
    }

    if (magnitudeSum === 0) {
      return { spectralCentroid: 0 };
    }

    return { spectralCentroid: weightedSum / magnitudeSum };
  }
}
