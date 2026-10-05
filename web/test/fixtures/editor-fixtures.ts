/**
 * Shared SoundEditor test fixtures.
 *
 * Representative `{ recipe, seed, overrides, descriptors }` cases used across
 * the editor test suite. Parameter descriptors are read from the shared recipe
 * registry (`registry.getRegistration(name).params`) so the fixtures can never
 * drift from the synthesis layer.
 *
 * Coverage required by TF-0MUV11IXS007W29J:
 * - an oscillator/FM recipe (`weapon-laser-zap`, file-backed ToneGraph)
 * - a noise/filter recipe (`footstep-stone`, built-in)
 * - a file-backed ToneGraph recipe (`ambient-wind-gust`)
 *
 * The registry is initialised by `web/test/setup-init-recipes.ts`, which Vitest
 * runs before importing any test module.
 */

import type { ParamDescriptor } from "../../../src/core/recipe.js";
import { registry } from "../../../src/recipes/index.js";

/** Coarse synthesis category a fixture exercises. */
export type EditorFixtureKind = "oscillator" | "noise-filter" | "file-backed";

/** A representative single-sound case for editor tests. */
export interface EditorFixture {
  /** Stable, human-readable identifier for the case. */
  id: string;
  /** Registered recipe name understood by the offline render path. */
  recipe: string;
  /** Deterministic seed used to reproduce the sound. */
  seed: number;
  /** Synthesis category the fixture covers. */
  kind: EditorFixtureKind;
  /** Parameter overrides applied on top of the seed-derived defaults. */
  overrides: Record<string, number>;
  /** Declared parameter descriptors read from the shared registry. */
  descriptors: ParamDescriptor[];
}

/**
 * Resolve the declared descriptors for a recipe from the shared registry.
 *
 * @throws If the recipe is not registered, which almost always means
 *   `initializeRecipeRegistry()` has not run (see `test/setup-init-recipes.ts`).
 */
export function descriptorsFor(recipe: string): ParamDescriptor[] {
  const registration = registry.getRegistration(recipe);
  if (!registration) {
    throw new Error(
      `Editor fixture recipe '${recipe}' is not registered. ` +
        "Ensure initializeRecipeRegistry() has run (see test/setup-init-recipes.ts).",
    );
  }
  // Copy so callers cannot mutate the registry's descriptor table.
  return registration.params.map((param) => ({ ...param }));
}

/** The shared fixture set. Order is stable for deterministic test output. */
export const EDITOR_FIXTURES: EditorFixture[] = [
  {
    id: "oscillator-laser",
    recipe: "weapon-laser-zap",
    seed: 1234,
    kind: "oscillator",
    overrides: {},
    descriptors: descriptorsFor("weapon-laser-zap"),
  },
  {
    id: "noise-filter-footstep",
    recipe: "footstep-stone",
    seed: 42,
    kind: "noise-filter",
    overrides: {},
    descriptors: descriptorsFor("footstep-stone"),
  },
  {
    id: "file-backed-wind",
    recipe: "ambient-wind-gust",
    seed: 7,
    kind: "file-backed",
    overrides: {},
    descriptors: descriptorsFor("ambient-wind-gust"),
  },
];

/**
 * Look up a fixture by id.
 *
 * @throws If no fixture with the given id exists.
 */
export function getEditorFixture(id: string): EditorFixture {
  const fixture = EDITOR_FIXTURES.find((entry) => entry.id === id);
  if (!fixture) {
    throw new Error(`Unknown editor fixture: ${id}`);
  }
  return fixture;
}
