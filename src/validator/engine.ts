/**
 * Validator Engine
 *
 * Runs the core audio checks against library entries and aggregates the
 * results into a structured, JSON-serialisable validation report.
 *
 * The report records pass/warning/error counts both per check and per
 * asset, and marks the run as blocking when `error`-level findings are
 * present.  The engine never mutates entries or writes to disk.
 *
 * Reference: docs/prd/VALIDATOR_PRD.md Sections 5-8.
 */

import { resolve } from "node:path";
import { decodeWavFile } from "../audio/wav-decoder.js";
import { listEntries } from "../library/index.js";
import type { LibraryEntry, LibraryFilter } from "../library/types.js";
import {
  extractAudioFacts,
  runChecks,
  type CheckName,
  type CheckResult,
  type CheckStatus,
} from "./checks.js";
import {
  resolveRuleset,
  type Ruleset,
  type RulesetName,
  type StrictnessLevel,
} from "./rules.js";

/** Canonical order of the core checks. */
export const CHECK_NAMES: readonly CheckName[] = [
  "peak_clipping",
  "duration_bounds",
  "silence_ratio",
] as const;

/** Pass/warning/error (and info/skipped) counts. */
export interface CheckCounts {
  pass: number;
  info: number;
  warning: number;
  error: number;
  skipped: number;
}

/** Validation outcome for a single asset. */
export interface AssetValidation {
  /** Library entry id. */
  assetId: string;
  /** Entry category (or "uncategorized"). */
  category: string;
  /** Recipe that generated the asset. */
  recipe: string;
  /** Worst non-skipped status across the asset's checks. */
  status: "pass" | "info" | "warning" | "error";
  /** Per-check results for this asset. */
  checks: CheckResult[];
}

/** Structured validation report. */
export interface ValidationReport {
  /** Resolved ruleset name. */
  ruleset: string;
  /** Strictness level violations were reported at. */
  strictness: StrictnessLevel;
  /** Number of entries validated. */
  entryCount: number;
  /** Worst non-skipped status across all assets. */
  status: "pass" | "info" | "warning" | "error";
  /** True when the run is build-blocking (an error-level finding exists). */
  blocking: boolean;
  /** Totals across every check and asset. */
  counts: CheckCounts;
  /** Totals per check, keyed by check name. */
  perCheck: Record<CheckName, CheckCounts>;
  /** Per-asset results in input order. */
  assets: AssetValidation[];
}

/** Options for `validateLibrary`. */
export interface ValidateLibraryOptions {
  /** Built-in ruleset name or a custom ruleset. */
  ruleset: RulesetName | Ruleset;
  /** Severity applied to violations (default "warning"). */
  strictness?: StrictnessLevel;
  /**
   * Optional decoded mono samples keyed by entry id, used to compute
   * the silence ratio.  Entries without samples fall back to an
   * analysis metric (or the silence check is skipped).
   */
  samples?: Map<string, Float32Array> | Record<string, Float32Array>;
}

/** Options for `validateLibraryDir`. */
export interface ValidateLibraryDirOptions extends ValidateLibraryOptions {
  /** Optional entry filter (category, recipe, tags). */
  filter?: LibraryFilter;
}

/** Create an empty counts record. */
function emptyCounts(): CheckCounts {
  return { pass: 0, info: 0, warning: 0, error: 0, skipped: 0 };
}

/** Create a per-check counts record with every check present. */
function emptyPerCheck(): Record<CheckName, CheckCounts> {
  return {
    peak_clipping: emptyCounts(),
    duration_bounds: emptyCounts(),
    silence_ratio: emptyCounts(),
  };
}

const STATUS_RANK: Record<CheckStatus, number> = {
  skipped: -1,
  pass: 0,
  info: 1,
  warning: 2,
  error: 3,
};

/** Pick the worst (most severe) status, ignoring `skipped`. */
function worstStatus(statuses: readonly CheckStatus[]): "pass" | "info" | "warning" | "error" {
  let worst: "pass" | "info" | "warning" | "error" = "pass";
  for (const status of statuses) {
    if (status === "skipped") continue;
    if (STATUS_RANK[status] > STATUS_RANK[worst]) worst = status;
  }
  return worst;
}

/** Normalise the optional samples input to a lookup map. */
function toSampleMap(
  samples: ValidateLibraryOptions["samples"],
): Map<string, Float32Array> {
  if (!samples) return new Map();
  if (samples instanceof Map) return samples;
  return new Map(Object.entries(samples));
}

/**
 * Validate library entries against a ruleset.
 *
 * @param entries - Library entries to validate.
 * @param options - Ruleset, strictness, and optional audio samples.
 * @returns Structured validation report.
 */
export function validateLibrary(
  entries: LibraryEntry[],
  options: ValidateLibraryOptions,
): ValidationReport {
  const ruleset = resolveRuleset(options.ruleset);
  const strictness = options.strictness ?? "warning";
  const samples = toSampleMap(options.samples);

  const perCheck = emptyPerCheck();
  const counts = emptyCounts();
  const assets: AssetValidation[] = [];

  for (const entry of entries) {
    const facts = extractAudioFacts(
      entry,
      samples.get(entry.id),
      ruleset.audio.silenceRatio.threshold,
    );
    const checks = runChecks(facts, ruleset.audio, strictness);

    for (const result of checks) {
      perCheck[result.check][result.status]++;
      counts[result.status]++;
    }

    assets.push({
      assetId: entry.id,
      category: entry.category,
      recipe: entry.recipe,
      status: worstStatus(checks.map((c) => c.status)),
      checks,
    });
  }

  const status = worstStatus(assets.map((a) => a.status));

  return {
    ruleset: ruleset.name,
    strictness,
    entryCount: entries.length,
    status,
    blocking: status === "error",
    counts,
    perCheck,
    assets,
  };
}

/**
 * Validate a library stored on disk.
 *
 * Loads entries from the library index, decodes each entry's WAV so the
 * silence-ratio check can run, then delegates to `validateLibrary`.
 * A missing or undecodable WAV leaves the silence check `skipped` for
 * that asset rather than aborting the whole run.
 *
 * @param libraryDir - Library root directory.
 * @param options - Ruleset, strictness, and optional filter.
 * @returns Structured validation report.
 */
export async function validateLibraryDir(
  libraryDir: string,
  options: ValidateLibraryDirOptions,
): Promise<ValidationReport> {
  const entries = await listEntries(options.filter, libraryDir);
  const samples = new Map<string, Float32Array>();

  for (const entry of entries) {
    const wavPath = resolve(libraryDir, entry.files.wav);
    try {
      const decoded = await decodeWavFile(wavPath);
      samples.set(entry.id, decoded.samples);
    } catch {
      // Leave the silence ratio unavailable for this asset; the check
      // reports `skipped` and the remaining checks still run.
    }
  }

  return validateLibrary(entries, { ...options, samples });
}
