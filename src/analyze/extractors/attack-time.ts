/**
 * Attack Time Extractor
 *
 * Detects attack time using a threshold method: the time from the
 * start of the signal to when it first reaches 90% of peak amplitude.
 *
 * For sounds with no clear transient (all samples below noise floor),
 * returns attackTime: null.
 *
 * Reference: docs/prd/ANALYZE_PRD.md
 */

import type { MetricExtractor } from "../types.js";

/** Minimum peak amplitude for attack detection to be meaningful. */
const NOISE_FLOOR = 0.01;

/** Fraction of peak amplitude used as the attack threshold. */
const ATTACK_THRESHOLD_RATIO = 0.9;

/**
 * Extracts envelope metrics: attackTime (seconds).
 *
 * Returns null when the signal has no clear attack (peak below
 * noise floor, or no sample reaches the threshold).
 */
export class AttackTimeExtractor implements MetricExtractor {
  readonly name = "attack-time";
  readonly category = "envelope";

  extract(
    samples: Float32Array,
    sampleRate: number,
  ): Record<string, number | boolean | string | null> {
    if (samples.length === 0) {
      return { attackTime: null };
    }

    // Find peak amplitude
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]!);
      if (abs > peak) peak = abs;
    }

    // If peak is below noise floor, no meaningful attack
    if (peak < NOISE_FLOOR) {
      return { attackTime: null };
    }

    const threshold = ATTACK_THRESHOLD_RATIO * peak;

    // Scan forward to find first sample reaching threshold
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]!) >= threshold) {
        return { attackTime: i / sampleRate };
      }
    }

    // Should not reach here if peak >= NOISE_FLOOR, but handle gracefully
    return { attackTime: null };
  }
}
