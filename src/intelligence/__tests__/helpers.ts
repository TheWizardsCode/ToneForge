/**
 * Shared test helpers for Intelligence engine unit tests.
 *
 * Builds deterministic {@link LibraryEntry} fixtures from a compact spec so
 * tests read as intent rather than boilerplate.
 */

import type { LibraryEntry } from "../../library/types.js";

/** Compact description of a fixture library entry. */
export interface EntrySpec {
  id: string;
  category?: string;
  intensity?: string;
  texture?: string[];
  material?: string | null;
  tags?: string[];
  recipe?: string;
  seed?: number;
  embedding?: number[];
  duration?: number;
  clipping?: boolean;
  silence?: boolean;
  peak?: number;
  rms?: number;
  attackTime?: number;
}

/** Build a fully-populated {@link LibraryEntry} from a compact spec. */
export function makeEntry(spec: EntrySpec): LibraryEntry {
  const category = spec.category ?? "ui";
  const recipe = spec.recipe ?? "ui-scifi-confirm";
  const seed = spec.seed ?? 42;
  const duration = spec.duration ?? 0.5;
  const embedding = spec.embedding ?? [0, 0, 0];

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
      metrics: {
        time: {
          duration,
          peak: spec.peak ?? 0.8,
          rms: spec.rms ?? 0.2,
          crestFactor: 1.5,
        },
        quality: {
          clipping: spec.clipping ?? false,
          silence: spec.silence ?? false,
        },
        envelope: { attackTime: spec.attackTime ?? 0.01 },
        spectral: { spectralCentroid: 1200 },
      },
    },
    classification: {
      source: spec.id,
      category,
      intensity: spec.intensity ?? "medium",
      texture: spec.texture ?? ["clean"],
      material: spec.material ?? null,
      tags: spec.tags ?? [],
      embedding,
      analysisRef: `${spec.id}.json`,
    },
    preset: { recipe, seed, params: {} },
    provenance: { toneforgeVersion: "0.0.0-test" },
    files: { wav: `${category}/${spec.id}.wav`, metadata: `${category}/${spec.id}.json` },
    promotedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** A small deterministic fixture library with planted issues. */
export function sampleLibrary(): LibraryEntry[] {
  return [
    makeEntry({ id: "lib-a", category: "weapon", intensity: "hard", material: "metal", embedding: [0, 0, 0], recipe: "weapon-laser-zap", seed: 1 }),
    makeEntry({ id: "lib-b", category: "weapon", intensity: "hard", material: "metal", embedding: [0.01, 0, 0], recipe: "weapon-laser-zap", seed: 2 }),
    makeEntry({ id: "lib-c", category: "weapon", intensity: "aggressive", material: "metal", embedding: [0, 0.01, 0], recipe: "weapon-laser-zap", seed: 3 }),
    makeEntry({ id: "lib-d", category: "ui", intensity: "soft", material: "synthetic", embedding: [1, 1, 1], recipe: "ui-scifi-confirm", seed: 4, clipping: true }),
    makeEntry({ id: "lib-e", category: "ui", intensity: "soft", material: "synthetic", embedding: [1, 1.01, 1], recipe: "ui-scifi-confirm", seed: 5, duration: 9 }),
  ];
}
