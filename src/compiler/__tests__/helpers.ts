/**
 * Shared test helpers for Compiler unit tests.
 *
 * Builds deterministic {@link LibraryEntry} fixtures with controllable
 * category, tags, duration, and preset so the decision engine and the
 * WAV/manifest paths can be exercised without a real library on disk.
 */

import type { LibraryEntry } from "../../library/types.js";

/** Compact description of a fixture library entry. */
export interface EntrySpec {
  id: string;
  category?: string;
  recipe?: string;
  seed?: number;
  duration?: number;
  tags?: string[];
  /** Preset parameter overrides. */
  params?: Record<string, number>;
}

/** Build a fully-populated {@link LibraryEntry} from a compact spec. */
export function makeEntry(spec: EntrySpec): LibraryEntry {
  const category = spec.category ?? "UI";
  const recipe = spec.recipe ?? "ui-notification-chime";
  const seed = spec.seed ?? 1;
  const duration = spec.duration ?? 0.5;

  return {
    id: spec.id,
    recipe,
    seed,
    category,
    duration,
    tags: spec.tags ?? [],
    analysis: {
      analysisVersion: "1.0",
      sampleRate: 44100,
      sampleCount: Math.round(duration * 44100),
      metrics: { time: { duration, peak: 0.8 } },
    },
    classification: null,
    preset: { recipe, seed, params: spec.params ?? {} },
    provenance: { toneforgeVersion: "0.0.0-test" },
    files: {
      wav: `${category}/${spec.id}.wav`,
      metadata: `${category}/${spec.id}.json`,
    },
    promotedAt: "2026-01-01T00:00:00.000Z",
  };
}
