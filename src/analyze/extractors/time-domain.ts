/**
 * Time-Domain Metrics Extractor
 *
 * Computes duration, peak amplitude, RMS loudness, and crest factor
 * from raw audio samples in a single pass.
 *
 * Reference: docs/prd/ANALYZE_PRD.md
 */

import type { MetricExtractor } from "../types.js";

/**
 * Extracts time-domain metrics: duration, peak, rms, crestFactor.
 *
 * Crest factor is peak / RMS.  When RMS is 0 (all-zero buffer),
 * crestFactor is 0 (sentinel value indicating no signal).
 */
export class TimeDomainExtractor implements MetricExtractor {
  readonly name = "time-domain";
  readonly category = "time";

  extract(
    samples: Float32Array,
    sampleRate: number,
  ): Record<string, number | boolean | string | null> {
    const duration = samples.length / sampleRate;

    if (samples.length === 0) {
      return { duration: 0, peak: 0, rms: 0, crestFactor: 0 };
    }

    let peak = 0;
    let sumSquares = 0;

    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]!);
      if (abs > peak) peak = abs;
      sumSquares += samples[i]! * samples[i]!;
    }

    const rms = Math.sqrt(sumSquares / samples.length);
    const crestFactor = rms === 0 ? 0 : peak / rms;

    return { duration, peak, rms, crestFactor };
  }
}
