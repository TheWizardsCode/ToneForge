/**
 * Shared test helpers for Validator unit tests.
 *
 * Builds deterministic {@link LibraryEntry} fixtures with controllable
 * peak, duration, and silence-ratio metrics.
 */

import type { LibraryEntry } from "../../library/types.js";

/** Compact description of a fixture library entry. */
export interface EntrySpec {
  id: string;
  category?: string;
  recipe?: string;
  seed?: number;
  duration?: number;
  /** Peak amplitude; pass `null` to omit the metric. */
  peak?: number | null;
  /** Optional pre-computed silence-ratio metric. */
  silenceRatio?: number;
}

/** Build a fully-populated {@link LibraryEntry} from a compact spec. */
export function makeEntry(spec: EntrySpec): LibraryEntry {
  const category = spec.category ?? "ui";
  const recipe = spec.recipe ?? "ui-confirm";
  const seed = spec.seed ?? 1;
  const duration = spec.duration ?? 0.5;

  const time: Record<string, number | boolean | string | null> = { duration };
  if (spec.peak !== null) {
    time["peak"] = spec.peak ?? 0.8;
  }
  if (spec.silenceRatio !== undefined) {
    time["silenceRatio"] = spec.silenceRatio;
  }

  return {
    id: spec.id,
    recipe,
    seed,
    category,
    duration,
    tags: [],
    analysis: {
      analysisVersion: "1.0",
      sampleRate: 44100,
      sampleCount: Math.round(duration * 44100),
      metrics: {
        time,
        quality: { clipping: false, silence: false },
      },
    },
    classification: null,
    preset: { recipe, seed, params: {} },
    provenance: { toneforgeVersion: "0.0.0-test" },
    files: {
      wav: `${category}/${spec.id}.wav`,
      metadata: `${category}/${spec.id}.json`,
    },
    promotedAt: "2026-01-01T00:00:00.000Z",
  };
}
