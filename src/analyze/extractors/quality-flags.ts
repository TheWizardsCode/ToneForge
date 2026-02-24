/**
 * Quality Flags Extractor
 *
 * Detects clipping (peak >= 1.0) and silence (RMS below threshold)
 * in audio samples.
 *
 * Thresholds are hard-coded named constants for this iteration.
 *
 * Reference: docs/prd/ANALYZE_PRD.md
 */

import type { MetricExtractor } from "../types.js";

/** Peak amplitude at or above which clipping is flagged. */
export const CLIPPING_THRESHOLD = 1.0;

/** RMS below which the signal is considered silent. */
export const SILENCE_RMS_THRESHOLD = 0.001;

/**
 * Extracts quality flags: clipping and silence detection.
 *
 * Computes peak and RMS internally (single-pass) to remain
 * independent of the TimeDomainExtractor.
 */
export class QualityFlagsExtractor implements MetricExtractor {
  readonly name = "quality-flags";
  readonly category = "quality";

  extract(
    samples: Float32Array,
    _sampleRate: number,
  ): Record<string, number | boolean | string | null> {
    if (samples.length === 0) {
      return { clipping: false, silence: true };
    }

    let peak = 0;
    let sumSquares = 0;

    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]!);
      if (abs > peak) peak = abs;
      sumSquares += samples[i]! * samples[i]!;
    }

    const rms = Math.sqrt(sumSquares / samples.length);

    return {
      clipping: peak >= CLIPPING_THRESHOLD,
      silence: rms < SILENCE_RMS_THRESHOLD,
    };
  }
}
