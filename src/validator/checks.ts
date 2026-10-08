/**
 * Validator Core Checks
 *
 * Implements the three core audio checks -- peak clipping, duration
 * bounds, and silence ratio -- as pure functions over a small set of
 * extracted audio facts.  Each check is driven by a configurable rule
 * from `rules.ts` and emits a structured, JSON-serialisable result.
 *
 * Checks never mutate the input entry or its audio samples.
 *
 * Reference: docs/prd/VALIDATOR_PRD.md Sections 5-8.
 */

import type { LibraryEntry } from "../library/types.js";
import type {
  AudioRules,
  DurationRule,
  PeakClippingRule,
  SilenceRatioRule,
  StrictnessLevel,
} from "./rules.js";

/** Names of the core audio checks. */
export type CheckName = "peak_clipping" | "duration_bounds" | "silence_ratio";

/**
 * Outcome status of a single check.
 *
 * `pass` means the asset satisfied the rule; `skipped` means the
 * required metric was unavailable; `info`/`warning`/`error` are
 * violations reported at the active strictness level.
 */
export type CheckStatus = "pass" | "info" | "warning" | "error" | "skipped";

/** Audio facts extracted from a library entry (and its samples). */
export interface AudioFacts {
  /** Peak absolute amplitude, or null when unavailable. */
  peak: number | null;
  /** Duration in seconds, or null when unavailable. */
  duration: number | null;
  /** Proportion of near-silent samples in [0, 1], or null when unavailable. */
  silenceRatio: number | null;
}

/** Result of a single check against a single asset. */
export interface CheckResult {
  /** Which core check produced this result. */
  check: CheckName;
  /** Outcome status. */
  status: CheckStatus;
  /** Observed value, or null when the check was skipped. */
  value: number | null;
  /** Human-readable rule limit that was evaluated. */
  limit: string;
  /** Actionable explanation of the outcome. */
  message: string;
}

/** Default per-sample amplitude below which a sample counts as silent. */
export const DEFAULT_SILENCE_THRESHOLD = 0.001;

/** Format a metric value for deterministic, readable messages. */
function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return String(value);
  const factor = 10 ** digits;
  return String(Math.round(value * factor) / factor);
}

/**
 * Compute the proportion of near-silent samples in a buffer.
 *
 * A sample is silent when its absolute amplitude is below `threshold`.
 * An empty buffer has no silent samples and yields 0.
 *
 * @param samples - Mono audio samples.
 * @param threshold - Per-sample silence threshold (default 0.001).
 * @returns Silence ratio in [0, 1].
 */
export function computeSilenceRatio(
  samples: Float32Array,
  threshold: number = DEFAULT_SILENCE_THRESHOLD,
): number {
  if (samples.length === 0) return 0;

  let silent = 0;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]!) < threshold) silent++;
  }
  return silent / samples.length;
}

/** Read a numeric metric from an entry's analysis result. */
function numericMetric(
  entry: LibraryEntry,
  category: string,
  key: string,
): number | null {
  const bucket = entry.analysis.metrics[category];
  if (!bucket) return null;
  const value = bucket[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Extract the audio facts the core checks need from a library entry.
 *
 * `duration` and `peak` are read from the entry's analysis result.
 * `silenceRatio` is computed from `samples` when they are supplied;
 * otherwise an analysis metric of the same name is used when present.
 *
 * @param entry - Library entry to inspect.
 * @param samples - Optional decoded mono samples for ratio computation.
 * @param silenceThreshold - Per-sample threshold used for the ratio.
 */
export function extractAudioFacts(
  entry: LibraryEntry,
  samples?: Float32Array,
  silenceThreshold: number = DEFAULT_SILENCE_THRESHOLD,
): AudioFacts {
  const analysisDuration = numericMetric(entry, "time", "duration");
  const duration =
    typeof entry.duration === "number" && Number.isFinite(entry.duration)
      ? entry.duration
      : analysisDuration;

  const peak = numericMetric(entry, "time", "peak");

  let silenceRatio: number | null;
  if (samples) {
    silenceRatio = computeSilenceRatio(samples, silenceThreshold);
  } else {
    silenceRatio = numericMetric(entry, "time", "silenceRatio");
  }

  return { peak, duration, silenceRatio };
}

/** Build a `skipped` result for a missing metric. */
function skipped(check: CheckName, reason: string): CheckResult {
  return {
    check,
    status: "skipped",
    value: null,
    limit: "",
    message: `Skipped: ${reason}`,
  };
}

/** Build a `pass` result. */
function passed(
  check: CheckName,
  value: number,
  limit: string,
  message: string,
): CheckResult {
  return { check, status: "pass", value, limit, message };
}

/**
 * Check whether the asset's peak amplitude exceeds the clipping limit.
 *
 * @param facts - Extracted audio facts.
 * @param rule - Configurable peak-clipping rule.
 * @param strictness - Severity applied to a violation.
 */
export function checkPeakClipping(
  facts: AudioFacts,
  rule: PeakClippingRule,
  strictness: StrictnessLevel,
): CheckResult {
  if (facts.peak === null) {
    return skipped("peak_clipping", "peak amplitude not available");
  }

  const limit = `<=${formatNumber(rule.maxPeak)}`;
  if (facts.peak > rule.maxPeak) {
    return {
      check: "peak_clipping",
      status: strictness,
      value: facts.peak,
      limit,
      message:
        `peak ${formatNumber(facts.peak)} exceeds ${limit} ` +
        `(near clip threshold ${formatNumber(rule.maxPeak)})`,
    };
  }

  return passed(
    "peak_clipping",
    facts.peak,
    limit,
    `peak ${formatNumber(facts.peak)} within ${limit}`,
  );
}

/**
 * Check whether the asset's duration falls within the allowed bounds.
 *
 * @param facts - Extracted audio facts.
 * @param rule - Configurable duration-bounds rule.
 * @param strictness - Severity applied to a violation.
 */
export function checkDurationBounds(
  facts: AudioFacts,
  rule: DurationRule,
  strictness: StrictnessLevel,
): CheckResult {
  if (facts.duration === null) {
    return skipped("duration_bounds", "duration not available");
  }

  const limits = `${formatNumber(rule.min)}s..${formatNumber(rule.max)}s`;
  if (facts.duration < rule.min) {
    return {
      check: "duration_bounds",
      status: strictness,
      value: facts.duration,
      limit: limits,
      message: `duration ${formatNumber(facts.duration)}s is below minimum ${formatNumber(rule.min)}s`,
    };
  }
  if (facts.duration > rule.max) {
    return {
      check: "duration_bounds",
      status: strictness,
      value: facts.duration,
      limit: limits,
      message: `duration ${formatNumber(facts.duration)}s exceeds maximum ${formatNumber(rule.max)}s`,
    };
  }

  return passed(
    "duration_bounds",
    facts.duration,
    limits,
    `duration ${formatNumber(facts.duration)}s within ${limits}`,
  );
}

/**
 * Check whether the asset's silence ratio exceeds the allowed maximum.
 *
 * @param facts - Extracted audio facts.
 * @param rule - Configurable silence-ratio rule.
 * @param strictness - Severity applied to a violation.
 */
export function checkSilenceRatio(
  facts: AudioFacts,
  rule: SilenceRatioRule,
  strictness: StrictnessLevel,
): CheckResult {
  if (facts.silenceRatio === null) {
    return skipped("silence_ratio", "silence ratio not available");
  }

  const limit = `<=${formatNumber(rule.maxRatio)}`;
  if (facts.silenceRatio > rule.maxRatio) {
    return {
      check: "silence_ratio",
      status: strictness,
      value: facts.silenceRatio,
      limit,
      message:
        `silence ratio ${formatNumber(facts.silenceRatio)} exceeds ${limit} ` +
        `(high silence ratio)`,
    };
  }

  return passed(
    "silence_ratio",
    facts.silenceRatio,
    limit,
    `silence ratio ${formatNumber(facts.silenceRatio)} within ${limit}`,
  );
}

/**
 * Run all three core checks against a set of audio facts.
 *
 * Results are returned in a stable order: peak clipping, duration
 * bounds, then silence ratio.
 */
export function runChecks(
  facts: AudioFacts,
  rules: AudioRules,
  strictness: StrictnessLevel,
): CheckResult[] {
  return [
    checkPeakClipping(facts, rules.peakClipping, strictness),
    checkDurationBounds(facts, rules.duration, strictness),
    checkSilenceRatio(facts, rules.silenceRatio, strictness),
  ];
}
